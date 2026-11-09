<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

const ONLINE_SEGUNDOS = 90;
const PAREAMENTO_MINUTOS = 10;
const STATUS_PEDIDO = ['recebido', 'preparo', 'pronto', 'entregue', 'cancelado'];

class HttpErro extends Exception
{
    public function __construct(public int $http, string $msg)
    {
        parent::__construct($msg);
    }
}

function responder($dados, int $http = 200): never
{
    http_response_code($http);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dados, JSON_UNESCAPED_UNICODE);
    exit;
}

function erro(int $http, string $msg): never
{
    throw new HttpErro($http, $msg);
}

function entrada(): array
{
    static $dados = null;
    if ($dados !== null) return $dados;
    $bruto = file_get_contents('php://input');
    $dados = $bruto ? (json_decode($bruto, true) ?: []) : [];
    return $dados;
}

function iniciar_sessao_php(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', '43200');
    session_save_path(SESSAO_DIR);
    session_name(https() ? '__Host-deufome' : 'deufome_staff');
    session_set_cookie_params(['httponly' => true, 'samesite' => 'Strict', 'path' => '/', 'secure' => https()]);
    session_start();
}

function usuario_logado(): array
{
    iniciar_sessao_php();
    $uid = $_SESSION['uid'] ?? null;
    if (!$uid) erro(401, 'Faça login.');
    $u = db()->prepare('SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.tenant_id, t.nome AS estabelecimento, t.status AS tenant_status
        FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ?');
    $u->execute([$uid]);
    $user = $u->fetch();
    if (!$user || !$user['ativo']) erro(401, 'Faça login.');
    if ($user['tenant_id'] && $user['tenant_status'] !== 'ativo') erro(403, 'Este estabelecimento está bloqueado. Fale com o suporte do Deu Fome.');
    $user['id'] = (int)$user['id'];
    $user['tenant_id'] = $user['tenant_id'] === null ? null : (int)$user['tenant_id'];
    return $user;
}

function equipe(string ...$papeis): array
{
    $u = usuario_logado();
    if (!$u['tenant_id']) erro(403, 'Entre com um usuário do estabelecimento.');
    if ($papeis && !in_array($u['papel'], $papeis, true)) erro(403, 'Seu usuário não tem acesso a esta área.');
    return $u;
}

function funcionario(): array
{
    return equipe('dono', 'gerente', 'caixa');
}

function plataforma(): array
{
    $u = usuario_logado();
    if ($u['papel'] !== 'plataforma') erro(403, 'Área restrita ao administrador do Deu Fome.');
    return $u;
}

function hash_token(string $token): string
{
    return hash('sha256', $token);
}

function dispositivo(): array
{
    $token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? '';
    if (strlen($token) < 40) erro(401, 'Dispositivo não ativado.');
    $st = db()->prepare('SELECT d.*, t.nome AS estabelecimento, t.status AS tenant_status, m.numero AS mesa_numero, m.nome AS mesa_nome
        FROM devices d JOIN tenants t ON t.id = d.tenant_id LEFT JOIN tables m ON m.id = d.table_id AND m.tenant_id = d.tenant_id AND m.ativo = 1
        WHERE d.token_hash = ?');
    $st->execute([hash_token($token)]);
    $d = $st->fetch();
    if (!$d) erro(401, 'Dispositivo não ativado.');
    if ($d['status'] === 'bloqueado') erro(403, 'Dispositivo bloqueado.');
    if ($d['status'] !== 'ativo') erro(401, 'Dispositivo não ativado.');
    if ($d['tenant_status'] !== 'ativo') erro(403, 'Estabelecimento bloqueado.');
    if (!$d['mesa_numero']) $d['table_id'] = null;
    $ip = ip_cliente();
    $versao = substr($_SERVER['HTTP_X_APP_VERSION'] ?? '', 0, 20);
    if (!$d['last_seen_at'] || time() - strtotime($d['last_seen_at'] . ' UTC') >= 20 || $d['ip'] !== $ip || $d['app_version'] !== $versao) {
        db()->prepare('UPDATE devices SET last_seen_at = ?, ip = ?, app_version = ? WHERE id = ?')->execute([agora(), $ip, $versao, $d['id']]);
    }
    return $d;
}

function exigir_mesa(array $d): void
{
    if (!$d['table_id'] || !$d['mesa_numero']) erro(409, 'Tablet sem mesa vinculada. Chame um atendente.');
}

function sessao_aberta(int $tenantId, int $tableId): ?array
{
    $st = db()->prepare("SELECT * FROM table_sessions WHERE tenant_id = ? AND table_id = ? AND status IN ('aberta','conta_solicitada')");
    $st->execute([$tenantId, $tableId]);
    return $st->fetch() ?: null;
}

function pedidos_da_sessao(int $tenantId, string $sessaoId): array
{
    $st = db()->prepare('SELECT id, numero, status, total, origem, created_at, updated_at FROM orders WHERE tenant_id = ? AND session_id = ? ORDER BY id');
    $st->execute([$tenantId, $sessaoId]);
    $pedidos = $st->fetchAll();
    $it = db()->prepare('SELECT nome, preco_unit, quantidade, adicionais, observacao, subtotal FROM order_items WHERE order_id = ? ORDER BY id');
    foreach ($pedidos as &$p) {
        $it->execute([$p['id']]);
        $p['itens'] = array_map(function ($i) {
            $i['adicionais'] = json_decode($i['adicionais'], true);
            return $i;
        }, $it->fetchAll());
    }
    return $pedidos;
}

function total_sessao(int $tenantId, string $sessaoId): int
{
    $st = db()->prepare("SELECT COALESCE(SUM(total),0) FROM orders WHERE tenant_id = ? AND session_id = ? AND status <> 'cancelado'");
    $st->execute([$tenantId, $sessaoId]);
    return (int)$st->fetchColumn();
}

function versao_cardapio(int $tenantId): string
{
    $st = db()->prepare('SELECT
        (SELECT group_concat(id || ":" || category_id || ":" || preco || ":" || disponivel || ":" || ordem || ":" || COALESCE(imagem,"") || ":" || nome || ":" || descricao, "|") FROM products WHERE tenant_id = ?)
        || "#" || (SELECT group_concat(id || ":" || ordem || ":" || nome, "|") FROM categories WHERE tenant_id = ?)
        || "#" || (SELECT group_concat(id || ":" || product_id || ":" || preco || ":" || nome, "|") FROM product_options WHERE tenant_id = ?)');
    $st->execute([$tenantId, $tenantId, $tenantId]);
    return substr(md5((string)$st->fetchColumn()), 0, 12);
}

function cardapio(int $tenantId, bool $soDisponiveisNaoOcultos = false): array
{
    $cats = db()->prepare('SELECT id, nome FROM categories WHERE tenant_id = ? ORDER BY ordem, id');
    $cats->execute([$tenantId]);
    $categorias = $cats->fetchAll();
    $prods = db()->prepare('SELECT id, category_id, nome, descricao, preco, imagem, disponivel FROM products WHERE tenant_id = ? ORDER BY ordem, id');
    $prods->execute([$tenantId]);
    $produtos = $prods->fetchAll();
    $ops = db()->prepare('SELECT id, product_id, nome, preco FROM product_options WHERE tenant_id = ? ORDER BY id');
    $ops->execute([$tenantId]);
    $porProduto = [];
    foreach ($ops->fetchAll() as $o) $porProduto[$o['product_id']][] = ['id' => $o['id'], 'nome' => $o['nome'], 'preco' => (int)$o['preco']];
    foreach ($categorias as &$c) {
        $c['produtos'] = [];
        foreach ($produtos as $p) {
            if ($p['category_id'] != $c['id']) continue;
            $p['preco'] = (int)$p['preco'];
            $p['disponivel'] = (bool)$p['disponivel'];
            $p['adicionais'] = $porProduto[$p['id']] ?? [];
            unset($p['category_id']);
            $c['produtos'][] = $p;
        }
    }
    return $categorias;
}

function codigo_pareamento(int $tenantId, int $deviceId): array
{
    $pdo = db();
    $pdo->prepare('UPDATE device_pairings SET usado_em = ? WHERE device_id = ? AND usado_em IS NULL')->execute(['revogado', $deviceId]);
    do {
        $codigo = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $ex = $pdo->prepare('SELECT 1 FROM device_pairings WHERE codigo = ? AND usado_em IS NULL AND expira_em > ?');
        $ex->execute([$codigo, agora()]);
    } while ($ex->fetchColumn());
    $expira = gmdate('Y-m-d H:i:s', time() + PAREAMENTO_MINUTOS * 60);
    $pdo->prepare('INSERT INTO device_pairings (tenant_id, device_id, codigo, expira_em) VALUES (?,?,?,?)')
        ->execute([$tenantId, $deviceId, $codigo, $expira]);
    return ['codigo' => $codigo, 'expira_em' => $expira];
}

function mesa_do_tenant(int $tenantId, $tableId): ?int
{
    if ($tableId === null || $tableId === '' || $tableId === 0) return null;
    $st = db()->prepare('SELECT id FROM tables WHERE id = ? AND tenant_id = ? AND ativo = 1');
    $st->execute([(int)$tableId, $tenantId]);
    $id = $st->fetchColumn();
    if (!$id) erro(404, 'Mesa não encontrada.');
    return (int)$id;
}

function garantir_mesa_livre_de_tablet(int $tenantId, ?int $tableId, ?int $exceto = null): void
{
    if (!$tableId) return;
    $st = db()->prepare("SELECT nome FROM devices WHERE tenant_id = ? AND table_id = ? AND status <> 'bloqueado' AND id <> ?");
    $st->execute([$tenantId, $tableId, $exceto ?? 0]);
    if ($nome = $st->fetchColumn()) erro(409, "Esta mesa já está vinculada ao $nome. Desvincule-o primeiro.");
}

function dispositivo_do_tenant(int $tenantId, int $id): array
{
    $st = db()->prepare('SELECT * FROM devices WHERE id = ? AND tenant_id = ?');
    $st->execute([$id, $tenantId]);
    return $st->fetch() ?: erro(404, 'Dispositivo não encontrado.');
}

function sessao_do_tenant(int $tenantId, string $id): array
{
    $st = db()->prepare('SELECT * FROM table_sessions WHERE id = ? AND tenant_id = ?');
    $st->execute([$id, $tenantId]);
    return $st->fetch() ?: erro(404, 'Sessão não encontrada.');
}

/* ------------------------------------------------------------------ rotas */

function rotear(string $metodo, string $caminho): void
{
    $r = [
        // públicas
        ['POST', '#^/api/login$#', 'r_login'],
        ['POST', '#^/api/logout$#', 'r_logout'],
        ['GET', '#^/api/me$#', 'r_me'],
        ['GET', '#^/api/info$#', 'r_info'],
        ['POST', '#^/api/tablet/ativar$#', 'r_tablet_ativar'],
        // tablet
        ['GET', '#^/api/tablet/estado$#', 'r_tablet_estado'],
        ['GET', '#^/api/tablet/cardapio$#', 'r_tablet_cardapio'],
        ['POST', '#^/api/tablet/pedidos$#', 'r_tablet_pedido'],
        ['POST', '#^/api/tablet/chamar$#', 'r_tablet_chamar'],
        ['POST', '#^/api/tablet/desbloquear$#', 'r_tablet_desbloquear'],
        // cozinha
        ['GET', '#^/api/cozinha/pedidos$#', 'r_cozinha_pedidos'],
        ['POST', '#^/api/cozinha/pedidos/(\d+)/status$#', 'r_cozinha_status'],
        // salão / caixa
        ['GET', '#^/api/salao/mesas$#', 'r_salao_mesas'],
        ['GET', '#^/api/salao/sessoes/([0-9a-f-]{36})$#', 'r_salao_sessao'],
        ['POST', '#^/api/salao/sessoes/([0-9a-f-]{36})/fechar$#', 'r_salao_fechar'],
        ['POST', '#^/api/salao/sessoes/([0-9a-f-]{36})/reabrir$#', 'r_salao_reabrir'],
        ['POST', '#^/api/salao/pedidos/(\d+)/cancelar$#', 'r_salao_cancelar_pedido'],
        ['POST', '#^/api/salao/chamados/(\d+)/atender$#', 'r_salao_atender'],
        // dispositivos
        ['GET', '#^/api/dispositivos$#', 'r_disp_listar'],
        ['POST', '#^/api/dispositivos$#', 'r_disp_criar'],
        ['POST', '#^/api/dispositivos/(\d+)/mesa$#', 'r_disp_mesa'],
        ['POST', '#^/api/dispositivos/(\d+)/bloquear$#', 'r_disp_bloquear'],
        ['POST', '#^/api/dispositivos/(\d+)/credencial$#', 'r_disp_credencial'],
        ['POST', '#^/api/dispositivos/(\d+)/excluir$#', 'r_disp_excluir'],
        // cardápio (admin)
        ['GET', '#^/api/produtos$#', 'r_prod_listar'],
        ['POST', '#^/api/produtos$#', 'r_prod_criar'],
        ['POST', '#^/api/produtos/(\d+)$#', 'r_prod_salvar'],
        ['POST', '#^/api/produtos/(\d+)/imagem$#', 'r_prod_imagem'],
        ['POST', '#^/api/produtos/(\d+)/mover$#', 'r_prod_mover'],
        ['POST', '#^/api/produtos/(\d+)/remover$#', 'r_prod_remover'],
        ['POST', '#^/api/categorias$#', 'r_cat_criar'],
        ['POST', '#^/api/categorias/(\d+)$#', 'r_cat_salvar'],
        ['POST', '#^/api/categorias/(\d+)/mover$#', 'r_cat_mover'],
        ['POST', '#^/api/categorias/(\d+)/remover$#', 'r_cat_remover'],
        // mesas
        ['GET', '#^/api/mesas$#', 'r_mesas_listar'],
        ['POST', '#^/api/mesas$#', 'r_mesas_criar'],
        ['POST', '#^/api/mesas/(\d+)$#', 'r_mesas_salvar'],
        ['POST', '#^/api/mesas/(\d+)/remover$#', 'r_mesas_remover'],
        // equipe e configurações
        ['GET', '#^/api/equipe$#', 'r_equipe_listar'],
        ['POST', '#^/api/equipe$#', 'r_equipe_criar'],
        ['POST', '#^/api/equipe/(\d+)$#', 'r_equipe_salvar'],
        ['GET', '#^/api/config$#', 'r_config_ler'],
        ['POST', '#^/api/config$#', 'r_config_salvar'],
        ['POST', '#^/api/minha-senha$#', 'r_minha_senha'],
        // plataforma
        ['GET', '#^/api/plataforma/estabelecimentos$#', 'r_plat_listar'],
        ['POST', '#^/api/plataforma/estabelecimentos$#', 'r_plat_criar'],
        ['POST', '#^/api/plataforma/estabelecimentos/(\d+)$#', 'r_plat_salvar'],
        ['GET', '#^/api/plataforma/backup$#', 'r_plat_backup'],
    ];
    try {
        if ($metodo === 'POST' && !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'multipart/form-data')
            && !str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
            erro(415, 'Envie JSON.');
        }
        if ($metodo === 'POST' && !empty($_SERVER['HTTP_ORIGIN'])) {
            $origem = parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_HOST) . (parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT) ? ':' . parse_url($_SERVER['HTTP_ORIGIN'], PHP_URL_PORT) : '');
            if (strcasecmp($origem, $_SERVER['HTTP_HOST'] ?? '') !== 0) erro(403, 'Origem não permitida.');
        }
        foreach ($r as [$m, $re, $fn]) {
            if ($m === $metodo && preg_match($re, $caminho, $mm)) {
                array_shift($mm);
                $fn(...$mm);
            }
        }
        erro(404, 'Rota não encontrada.');
    } catch (HttpErro $e) {
        responder(['erro' => $e->getMessage()], $e->http);
    } catch (Throwable $e) {
        error_log((string)$e);
        responder(['erro' => 'Erro interno.'], 500);
    }
}

/* -------------------------------------------------------------- login */

function r_login(): never
{
    $in = entrada();
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $in['senha'] = (string)($in['senha'] ?? '');
    $ip = ip_cliente();
    $pdo = db();
    $limite = gmdate('Y-m-d H:i:s', time() - 15 * 60);
    $pdo->prepare('DELETE FROM login_tentativas WHERE created_at < ?')->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
    $c = $pdo->prepare('SELECT (SELECT COUNT(*) FROM login_tentativas WHERE email = ? AND created_at > ?), (SELECT COUNT(*) FROM login_tentativas WHERE ip = ? AND created_at > ?)');
    $c->execute([$email, $limite, $ip, $limite]);
    [$porEmail, $porIp] = $c->fetch(PDO::FETCH_NUM);
    if ($porEmail >= 8 || $porIp >= 30) erro(429, 'Muitas tentativas. Espere 15 minutos e tente de novo.');
    $st = $pdo->prepare('SELECT u.*, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = ?');
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u || !$u['ativo'] || !password_verify((string)($in['senha'] ?? ''), $u['senha_hash'])) {
        $pdo->prepare('INSERT INTO login_tentativas (ip, email, created_at) VALUES (?,?,?)')->execute([$ip, $email, agora()]);
        usleep(400000);
        erro(422, 'E-mail ou senha incorretos.');
    }
    if ($u['tenant_id'] && $u['tenant_status'] !== 'ativo') erro(403, 'Este estabelecimento está bloqueado. Fale com o suporte do Deu Fome.');
    $pdo->prepare('DELETE FROM login_tentativas WHERE email = ?')->execute([$email]);
    if (password_needs_rehash($u['senha_hash'], PASSWORD_DEFAULT)) {
        $pdo->prepare('UPDATE users SET senha_hash = ? WHERE id = ?')->execute([password_hash((string)$in['senha'], PASSWORD_DEFAULT), $u['id']]);
    }
    iniciar_sessao_php();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    responder(['ok' => true, 'papel' => $u['papel']]);
}

function r_logout(): never
{
    iniciar_sessao_php();
    $_SESSION = [];
    session_destroy();
    responder(['ok' => true]);
}

function r_info(): never
{
    responder(['demo' => DEMO, 'versao' => versao_app()]);
}

function r_me(): never
{
    $u = usuario_logado();
    responder([
        'id' => $u['id'], 'nome' => $u['nome'], 'email' => $u['email'], 'papel' => $u['papel'],
        'estabelecimento' => $u['estabelecimento'], 'sem_volume' => SEM_VOLUME && $u['papel'] === 'plataforma',
    ]);
}

/* -------------------------------------------------------------- tablet */

function r_tablet_ativar(): never
{
    $codigo = preg_replace('/\D/', '', (string)(entrada()['codigo'] ?? ''));
    $pdo = db();
    $st = $pdo->prepare('SELECT p.*, d.status AS d_status FROM device_pairings p JOIN devices d ON d.id = p.device_id AND d.tenant_id = p.tenant_id
        WHERE p.codigo = ? AND p.usado_em IS NULL AND p.expira_em > ?');
    $st->execute([$codigo, agora()]);
    $p = $st->fetch();
    if (!$p || $p['d_status'] === 'bloqueado') {
        sleep(1);
        erro(422, 'Código inválido ou expirado.');
    }
    $token = bin2hex(random_bytes(32));
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE device_pairings SET usado_em = ? WHERE id = ?')->execute([agora(), $p['id']]);
    $pdo->prepare("UPDATE devices SET token_hash = ?, status = 'ativo', last_seen_at = ? WHERE id = ?")->execute([hash_token($token), agora(), $p['device_id']]);
    $pdo->commit();
    auditar((int)$p['tenant_id'], 'dispositivo:' . $p['device_id'], 'dispositivo.ativado');
    responder(['token' => $token]);
}

function r_tablet_estado(): never
{
    $d = dispositivo();
    $sessao = $d['table_id'] ? sessao_aberta((int)$d['tenant_id'], (int)$d['table_id']) : null;
    $chamados = [];
    if ($sessao) {
        $st = db()->prepare("SELECT tipo FROM service_calls WHERE tenant_id = ? AND session_id = ? AND status = 'aberto'");
        $st->execute([$d['tenant_id'], $sessao['id']]);
        $chamados = array_column($st->fetchAll(), 'tipo');
    }
    responder([
        'estabelecimento' => $d['estabelecimento'],
        'dispositivo' => $d['nome'],
        'mesa' => $d['table_id'] ? ['numero' => (int)$d['mesa_numero'], 'nome' => $d['mesa_nome']] : null,
        'sessao' => $sessao ? ['id' => $sessao['id'], 'status' => $sessao['status']] : null,
        'pedidos' => $sessao ? pedidos_da_sessao((int)$d['tenant_id'], $sessao['id']) : [],
        'total' => $sessao ? total_sessao((int)$d['tenant_id'], $sessao['id']) : 0,
        'chamados_abertos' => $chamados,
        'versao_cardapio' => versao_cardapio((int)$d['tenant_id']),
        'versao_app' => versao_app(),
    ]);
}

function r_tablet_cardapio(): never
{
    $d = dispositivo();
    responder(['categorias' => cardapio((int)$d['tenant_id']), 'versao' => versao_cardapio((int)$d['tenant_id'])]);
}

function r_tablet_pedido(): never
{
    $d = dispositivo();
    exigir_mesa($d);
    $tid = (int)$d['tenant_id'];
    $mesa = (int)$d['table_id'];
    $in = entrada();
    $chave = (string)($in['chave'] ?? '');
    if (!preg_match('/^[A-Za-z0-9-]{8,64}$/', $chave)) erro(422, 'Chave do pedido inválida.');
    $itens = $in['itens'] ?? null;
    if (!is_array($itens) || count($itens) < 1 || count($itens) > 40) erro(422, 'Carrinho vazio ou grande demais.');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $sessao = sessao_aberta($tid, $mesa);
        if ($sessao && $sessao['status'] === 'conta_solicitada') erro(409, 'A conta já foi solicitada. Chame um atendente para pedir mais.');
        if (!$sessao) {
            $sid = uuid();
            $pdo->prepare("INSERT INTO table_sessions (id, tenant_id, table_id, device_id, status, aberta_em) VALUES (?,?,?,?, 'aberta', ?)")
                ->execute([$sid, $tid, $mesa, $d['id'], agora()]);
            $sessao = sessao_aberta($tid, $mesa);
            auditar($tid, 'dispositivo:' . $d['id'], 'sessao.aberta', $sid);
        }
        $ja = $pdo->prepare('SELECT id FROM orders WHERE session_id = ? AND idempotency_key = ?');
        $ja->execute([$sessao['id'], $chave]);
        if ($existente = $ja->fetchColumn()) {
            $pdo->commit();
            responder(['ok' => true, 'pedido_id' => (int)$existente, 'repetido' => true]);
        }

        $prod = $pdo->prepare('SELECT id, nome, preco, disponivel FROM products WHERE id = ? AND tenant_id = ?');
        $opt = $pdo->prepare('SELECT id, nome, preco FROM product_options WHERE id = ? AND product_id = ? AND tenant_id = ?');
        $linhas = [];
        $total = 0;
        foreach ($itens as $item) {
            $prod->execute([(int)($item['produto_id'] ?? 0), $tid]);
            $p = $prod->fetch();
            if (!$p) erro(422, 'Produto não encontrado.');
            if (!$p['disponivel']) erro(409, "{$p['nome']} acabou de ficar indisponível. Remova do carrinho.");
            $qtd = (int)($item['quantidade'] ?? 0);
            if ($qtd < 1 || $qtd > 20) erro(422, 'Quantidade inválida.');
            $unit = (int)$p['preco'];
            $adds = [];
            foreach (array_unique(array_map('intval', (array)($item['adicionais'] ?? []))) as $oid) {
                $opt->execute([$oid, $p['id'], $tid]);
                $o = $opt->fetch();
                if (!$o) erro(422, 'Adicional inválido.');
                $unit += (int)$o['preco'];
                $adds[] = ['nome' => $o['nome'], 'preco' => (int)$o['preco']];
            }
            $obs = mb_substr(trim(strip_tags((string)($item['observacao'] ?? ''))), 0, 140);
            $sub = $unit * $qtd;
            $total += $sub;
            $linhas[] = [$p['id'], $p['nome'], $unit, $qtd, json_encode($adds, JSON_UNESCAPED_UNICODE), $obs, $sub];
        }
        $num = $pdo->prepare('SELECT COALESCE(MAX(numero),0)+1 FROM orders WHERE tenant_id = ?');
        $num->execute([$tid]);
        $numero = (int)$num->fetchColumn();
        $pdo->prepare("INSERT INTO orders (tenant_id, session_id, table_id, numero, status, total, idempotency_key, origem, created_at, updated_at)
            VALUES (?,?,?,?, 'recebido', ?, ?, 'tablet', ?, ?)")
            ->execute([$tid, $sessao['id'], $mesa, $numero, $total, $chave, agora(), agora()]);
        $oid = (int)$pdo->lastInsertId();
        $ins = $pdo->prepare('INSERT INTO order_items (order_id, product_id, nome, preco_unit, quantidade, adicionais, observacao, subtotal) VALUES (?,?,?,?,?,?,?,?)');
        foreach ($linhas as $l) $ins->execute([$oid, ...$l]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }
    responder(['ok' => true, 'pedido_id' => $oid, 'numero' => $numero, 'total' => $total], 201);
}

function r_tablet_chamar(): never
{
    $d = dispositivo();
    exigir_mesa($d);
    $tid = (int)$d['tenant_id'];
    $tipo = (string)(entrada()['tipo'] ?? '');
    if (!in_array($tipo, ['garcom', 'conta'], true)) erro(422, 'Tipo de chamado inválido.');
    $sessao = sessao_aberta($tid, (int)$d['table_id']);
    if ($tipo === 'conta') {
        if (!$sessao) erro(409, 'Ainda não há pedidos nesta mesa.');
        if ($sessao['status'] === 'aberta') {
            db()->prepare("UPDATE table_sessions SET status = 'conta_solicitada', conta_em = ? WHERE id = ?")->execute([agora(), $sessao['id']]);
            auditar($tid, 'dispositivo:' . $d['id'], 'sessao.conta_solicitada', $sessao['id']);
        }
    }
    $ex = db()->prepare("SELECT 1 FROM service_calls WHERE tenant_id = ? AND table_id = ? AND tipo = ? AND status = 'aberto'");
    $ex->execute([$tid, $d['table_id'], $tipo]);
    if (!$ex->fetchColumn()) {
        db()->prepare('INSERT INTO service_calls (tenant_id, session_id, table_id, tipo, created_at) VALUES (?,?,?,?,?)')
            ->execute([$tid, $sessao['id'] ?? null, $d['table_id'], $tipo, agora()]);
    }
    responder(['ok' => true]);
}

function r_tablet_desbloquear(): never
{
    $d = dispositivo();
    $st = db()->prepare('SELECT pin_gerente_hash FROM tenants WHERE id = ?');
    $st->execute([$d['tenant_id']]);
    if (!password_verify((string)(entrada()['pin'] ?? ''), (string)$st->fetchColumn())) {
        sleep(1);
        auditar((int)$d['tenant_id'], 'dispositivo:' . $d['id'], 'quiosque.pin_incorreto');
        erro(422, 'PIN incorreto.');
    }
    auditar((int)$d['tenant_id'], 'dispositivo:' . $d['id'], 'quiosque.desbloqueado');
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- cozinha */

function r_cozinha_pedidos(): never
{
    $u = equipe('dono', 'gerente', 'caixa', 'cozinha');
    $st = db()->prepare("SELECT o.id, o.numero, o.status, o.total, o.created_at, o.updated_at, m.numero AS mesa
        FROM orders o JOIN tables m ON m.id = o.table_id
        WHERE o.tenant_id = ? AND (o.status IN ('recebido','preparo','pronto'))
        ORDER BY o.id");
    $st->execute([$u['tenant_id']]);
    $pedidos = $st->fetchAll();
    $it = db()->prepare('SELECT nome, quantidade, adicionais, observacao FROM order_items WHERE order_id = ? ORDER BY id');
    foreach ($pedidos as &$p) {
        $it->execute([$p['id']]);
        $p['itens'] = array_map(fn($i) => ['nome' => $i['nome'], 'quantidade' => (int)$i['quantidade'], 'adicionais' => array_column(json_decode($i['adicionais'], true), 'nome'), 'observacao' => $i['observacao']], $it->fetchAll());
    }
    responder(['pedidos' => $pedidos, 'agora' => agora()]);
}

function r_cozinha_status(string $id): never
{
    $u = equipe('dono', 'gerente', 'caixa', 'cozinha');
    $novo = (string)(entrada()['status'] ?? '');
    $permitidos = ['recebido' => ['preparo'], 'preparo' => ['pronto', 'recebido'], 'pronto' => ['entregue', 'preparo']];
    $st = db()->prepare('SELECT status FROM orders WHERE id = ? AND tenant_id = ?');
    $st->execute([(int)$id, $u['tenant_id']]);
    $atual = $st->fetchColumn();
    if (!$atual) erro(404, 'Pedido não encontrado.');
    if (!in_array($novo, $permitidos[$atual] ?? [], true)) erro(409, 'Mudança de status não permitida.');
    db()->prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')->execute([$novo, agora(), (int)$id]);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- salão */

function r_salao_mesas(): never
{
    $u = funcionario();
    $tid = (int)$u['tenant_id'];
    $mesas = db()->prepare('SELECT id, numero, nome FROM tables WHERE tenant_id = ? AND ativo = 1 ORDER BY numero');
    $mesas->execute([$tid]);
    $lista = $mesas->fetchAll();
    $disp = db()->prepare('SELECT id, nome, status, last_seen_at FROM devices WHERE tenant_id = ? AND table_id = ? AND status <> \'bloqueado\'');
    $cham = db()->prepare("SELECT id, tipo, created_at FROM service_calls WHERE tenant_id = ? AND table_id = ? AND status = 'aberto' ORDER BY id");
    foreach ($lista as &$m) {
        $s = sessao_aberta($tid, (int)$m['id']);
        $m['sessao'] = $s ? ['id' => $s['id'], 'status' => $s['status'], 'aberta_em' => $s['aberta_em'], 'total' => total_sessao($tid, $s['id'])] : null;
        $disp->execute([$tid, $m['id']]);
        $d = $disp->fetch();
        $m['tablet'] = $d ? ['nome' => $d['nome'], 'online' => online($d['last_seen_at']), 'status' => $d['status']] : null;
        $cham->execute([$tid, $m['id']]);
        $m['chamados'] = $cham->fetchAll();
    }
    responder(['mesas' => $lista, 'agora' => agora()]);
}

function r_salao_sessao(string $id): never
{
    $u = funcionario();
    $s = sessao_do_tenant((int)$u['tenant_id'], $id);
    responder(['sessao' => $s, 'pedidos' => pedidos_da_sessao((int)$u['tenant_id'], $id), 'total' => total_sessao((int)$u['tenant_id'], $id)]);
}

function r_salao_fechar(string $id): never
{
    $u = funcionario();
    $tid = (int)$u['tenant_id'];
    $s = sessao_do_tenant($tid, $id);
    if (!in_array($s['status'], ['aberta', 'conta_solicitada'], true)) erro(409, 'Esta sessão já foi encerrada.');
    $forma = (string)(entrada()['forma'] ?? '');
    if (!in_array($forma, ['pix', 'dinheiro', 'credito', 'debito'], true)) erro(422, 'Escolha a forma de pagamento.');
    $pdo = db();
    $pdo->beginTransaction();
    $total = total_sessao($tid, $id);
    $pdo->prepare("UPDATE table_sessions SET status = 'fechada', fechada_em = ?, fechada_por = ?, forma_pagamento = ?, total = ? WHERE id = ?")
        ->execute([agora(), $u['id'], $forma, $total, $id]);
    $pdo->prepare("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE tenant_id = ? AND (session_id = ? OR (table_id = ? AND status = 'aberto'))")
        ->execute([agora(), $tid, $id, $s['table_id']]);
    $pdo->prepare("UPDATE orders SET status = 'entregue', updated_at = ? WHERE session_id = ? AND status IN ('recebido','preparo','pronto')")
        ->execute([agora(), $id]);
    $pdo->commit();
    auditar($tid, 'usuario:' . $u['id'], 'sessao.fechada', $id, ['total' => $total, 'forma' => $forma]);
    responder(['ok' => true, 'total' => $total]);
}

function r_salao_reabrir(string $id): never
{
    $u = funcionario();
    $s = sessao_do_tenant((int)$u['tenant_id'], $id);
    if ($s['status'] !== 'conta_solicitada') erro(409, 'Só é possível reabrir uma conta solicitada.');
    db()->prepare("UPDATE table_sessions SET status = 'aberta', conta_em = NULL WHERE id = ?")->execute([$id]);
    db()->prepare("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE session_id = ? AND tipo = 'conta' AND status = 'aberto'")->execute([agora(), $id]);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'sessao.reaberta', $id);
    responder(['ok' => true]);
}

function r_salao_cancelar_pedido(string $id): never
{
    $u = funcionario();
    $motivo = trim((string)(entrada()['motivo'] ?? ''));
    if ($motivo === '') erro(422, 'Informe o motivo.');
    $st = db()->prepare("SELECT o.id, s.status FROM orders o JOIN table_sessions s ON s.id = o.session_id WHERE o.id = ? AND o.tenant_id = ?");
    $st->execute([(int)$id, $u['tenant_id']]);
    $o = $st->fetch();
    if (!$o) erro(404, 'Pedido não encontrado.');
    if ($o['status'] === 'fechada') erro(409, 'A conta desta mesa já foi fechada.');
    db()->prepare("UPDATE orders SET status = 'cancelado', updated_at = ? WHERE id = ?")->execute([agora(), (int)$id]);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'pedido.cancelado', $id, ['motivo' => $motivo]);
    responder(['ok' => true]);
}

function r_salao_atender(string $id): never
{
    $u = funcionario();
    $st = db()->prepare("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE id = ? AND tenant_id = ? AND tipo = 'garcom'");
    $st->execute([agora(), (int)$id, $u['tenant_id']]);
    if (!$st->rowCount()) erro(404, 'Chamado não encontrado.');
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- dispositivos */

function online(?string $visto): bool
{
    return $visto !== null && (time() - strtotime($visto . ' UTC')) <= ONLINE_SEGUNDOS;
}

function r_disp_listar(): never
{
    $u = equipe('dono', 'gerente');
    $st = db()->prepare('SELECT d.id, d.nome, d.status, d.last_seen_at, d.app_version, d.ip, d.table_id, m.numero AS mesa_numero, m.nome AS mesa_nome
        FROM devices d LEFT JOIN tables m ON m.id = d.table_id WHERE d.tenant_id = ? ORDER BY d.nome');
    $st->execute([$u['tenant_id']]);
    $lista = $st->fetchAll();
    $cod = db()->prepare('SELECT codigo, expira_em FROM device_pairings WHERE device_id = ? AND usado_em IS NULL AND expira_em > ? ORDER BY id DESC LIMIT 1');
    foreach ($lista as &$d) {
        $d['online'] = $d['status'] === 'ativo' && online($d['last_seen_at']);
        $cod->execute([$d['id'], agora()]);
        $d['ativacao'] = $cod->fetch() ?: null;
    }
    $mesas = db()->prepare('SELECT id, numero, nome FROM tables WHERE tenant_id = ? AND ativo = 1 ORDER BY numero');
    $mesas->execute([$u['tenant_id']]);
    responder(['dispositivos' => $lista, 'mesas' => $mesas->fetchAll(), 'agora' => agora()]);
}

function r_disp_criar(): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $in = entrada();
    $nome = trim((string)($in['nome'] ?? ''));
    if ($nome === '' || mb_strlen($nome) > 40) erro(422, 'Dê um nome ao tablet (até 40 letras).');
    $mesa = mesa_do_tenant($tid, $in['mesa_id'] ?? null);
    garantir_mesa_livre_de_tablet($tid, $mesa);
    db()->prepare('INSERT INTO devices (tenant_id, table_id, nome, created_at) VALUES (?,?,?,?)')->execute([$tid, $mesa, $nome, agora()]);
    $id = (int)db()->lastInsertId();
    $c = codigo_pareamento($tid, $id);
    auditar($tid, 'usuario:' . $u['id'], 'dispositivo.criado', (string)$id, ['mesa' => $mesa]);
    responder(['id' => $id, 'ativacao' => $c], 201);
}

function r_disp_mesa(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $d = dispositivo_do_tenant($tid, (int)$id);
    $mesa = mesa_do_tenant($tid, entrada()['mesa_id'] ?? null);
    garantir_mesa_livre_de_tablet($tid, $mesa, (int)$d['id']);
    db()->prepare('UPDATE devices SET table_id = ? WHERE id = ?')->execute([$mesa, $d['id']]);
    auditar($tid, 'usuario:' . $u['id'], $mesa ? 'dispositivo.mesa_alterada' : 'dispositivo.desvinculado', (string)$d['id'], ['de' => $d['table_id'], 'para' => $mesa]);
    responder(['ok' => true]);
}

function r_disp_bloquear(string $id): never
{
    $u = equipe('dono', 'gerente');
    $d = dispositivo_do_tenant((int)$u['tenant_id'], (int)$id);
    db()->prepare("UPDATE devices SET status = 'bloqueado' WHERE id = ?")->execute([$d['id']]);
    db()->prepare("UPDATE device_pairings SET usado_em = 'revogado' WHERE device_id = ? AND usado_em IS NULL")->execute([$d['id']]);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'dispositivo.bloqueado', (string)$d['id']);
    responder(['ok' => true]);
}

function r_disp_credencial(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $d = dispositivo_do_tenant($tid, (int)$id);
    if ($d['status'] === 'bloqueado') garantir_mesa_livre_de_tablet($tid, $d['table_id'] ? (int)$d['table_id'] : null, (int)$d['id']);
    db()->prepare("UPDATE devices SET status = 'pendente', token_hash = NULL WHERE id = ?")->execute([$d['id']]);
    $c = codigo_pareamento($tid, (int)$d['id']);
    auditar($tid, 'usuario:' . $u['id'], 'dispositivo.nova_credencial', (string)$d['id']);
    responder(['ativacao' => $c]);
}

function r_disp_excluir(string $id): never
{
    $u = equipe('dono', 'gerente');
    $d = dispositivo_do_tenant((int)$u['tenant_id'], (int)$id);
    if ($d['status'] !== 'bloqueado') erro(409, 'Bloqueie o tablet antes de excluir.');
    db()->prepare('UPDATE table_sessions SET device_id = NULL WHERE device_id = ?')->execute([$d['id']]);
    db()->prepare('DELETE FROM device_pairings WHERE device_id = ?')->execute([$d['id']]);
    db()->prepare('DELETE FROM devices WHERE id = ?')->execute([$d['id']]);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'dispositivo.excluido', (string)$d['id']);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- produtos */

function r_prod_listar(): never
{
    $u = equipe('dono', 'gerente');
    responder(['categorias' => cardapio((int)$u['tenant_id'])]);
}

function produto_do_tenant(int $tid, int $id): array
{
    $st = db()->prepare('SELECT * FROM products WHERE id = ? AND tenant_id = ?');
    $st->execute([$id, $tid]);
    return $st->fetch() ?: erro(404, 'Produto não encontrado.');
}

function texto(array $in, string $campo, int $max, bool $obrigatorio = true, string $rotulo = 'Nome'): string
{
    $v = trim(preg_replace('/\s+/u', ' ', strip_tags((string)($in[$campo] ?? ''))));
    if ($obrigatorio && $v === '') erro(422, "Preencha: $rotulo.");
    if (mb_strlen($v) > $max) erro(422, "$rotulo muito longo (até $max letras).");
    return $v;
}

function centavos($v, string $rotulo = 'Preço'): int
{
    if (!is_numeric($v)) erro(422, "$rotulo inválido.");
    $c = (int)round((float)$v);
    if ($c < 0 || $c > 10000000) erro(422, "$rotulo inválido.");
    return $c;
}

function categoria_do_tenant(int $tid, int $id): array
{
    $st = db()->prepare('SELECT * FROM categories WHERE id = ? AND tenant_id = ?');
    $st->execute([$id, $tid]);
    return $st->fetch() ?: erro(404, 'Categoria não encontrada.');
}

function salvar_adicionais(int $tid, int $pid, $lista): void
{
    if (!is_array($lista)) erro(422, 'Adicionais inválidos.');
    if (count($lista) > 30) erro(422, 'No máximo 30 adicionais por produto.');
    $pdo = db();
    $atuais = $pdo->prepare('SELECT id FROM product_options WHERE product_id = ? AND tenant_id = ?');
    $atuais->execute([$pid, $tid]);
    $existentes = array_map('intval', $atuais->fetchAll(PDO::FETCH_COLUMN));
    $mantidos = [];
    foreach ($lista as $a) {
        if (!is_array($a)) erro(422, 'Adicionais inválidos.');
        $nome = texto($a, 'nome', 60, true, 'Nome do adicional');
        $preco = centavos($a['preco'] ?? 0, 'Preço do adicional');
        $id = (int)($a['id'] ?? 0);
        if ($id && in_array($id, $existentes, true)) {
            $pdo->prepare('UPDATE product_options SET nome = ?, preco = ? WHERE id = ?')->execute([$nome, $preco, $id]);
            $mantidos[] = $id;
        } else {
            $pdo->prepare('INSERT INTO product_options (tenant_id, product_id, nome, preco) VALUES (?,?,?,?)')->execute([$tid, $pid, $nome, $preco]);
        }
    }
    foreach (array_diff($existentes, $mantidos) as $id) {
        $pdo->prepare('DELETE FROM product_options WHERE id = ?')->execute([$id]);
    }
}

function r_prod_criar(): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $in = entrada();
    $cat = categoria_do_tenant($tid, (int)($in['categoria_id'] ?? 0));
    $nome = texto($in, 'nome', 80);
    $desc = texto($in, 'descricao', 300, false, 'Descrição');
    $preco = centavos($in['preco'] ?? null);
    $pdo = db();
    $pdo->beginTransaction();
    $o = $pdo->prepare('SELECT COALESCE(MAX(ordem), -1) + 1 FROM products WHERE category_id = ?');
    $o->execute([$cat['id']]);
    $pdo->prepare('INSERT INTO products (tenant_id, category_id, nome, descricao, preco, disponivel, ordem) VALUES (?,?,?,?,?,?,?)')
        ->execute([$tid, $cat['id'], $nome, $desc, $preco, empty($in['disponivel']) && array_key_exists('disponivel', $in) ? 0 : 1, (int)$o->fetchColumn()]);
    $pid = (int)$pdo->lastInsertId();
    salvar_adicionais($tid, $pid, $in['adicionais'] ?? []);
    $pdo->commit();
    responder(['ok' => true, 'id' => $pid], 201);
}

function r_prod_salvar(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $p = produto_do_tenant($tid, (int)$id);
    $in = entrada();
    $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 80) : $p['nome'];
    $desc = array_key_exists('descricao', $in) ? texto($in, 'descricao', 300, false, 'Descrição') : $p['descricao'];
    $preco = array_key_exists('preco', $in) ? centavos($in['preco']) : (int)$p['preco'];
    $disp = array_key_exists('disponivel', $in) ? ($in['disponivel'] ? 1 : 0) : (int)$p['disponivel'];
    $cat = array_key_exists('categoria_id', $in) ? (int)categoria_do_tenant($tid, (int)$in['categoria_id'])['id'] : (int)$p['category_id'];
    $pdo = db();
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE products SET nome = ?, descricao = ?, preco = ?, disponivel = ?, category_id = ? WHERE id = ?')
        ->execute([$nome, $desc, $preco, $disp, $cat, $p['id']]);
    if (array_key_exists('adicionais', $in)) salvar_adicionais($tid, (int)$p['id'], $in['adicionais']);
    $pdo->commit();
    responder(['ok' => true]);
}

function apagar_arquivo(?string $imagem): void
{
    if ($imagem && preg_match('#^/arquivos/([a-z0-9-]+\.(jpg|png|webp))$#', $imagem, $m)) @unlink(UPLOAD_DIR . '/' . $m[1]);
}

function r_prod_imagem(string $id): never
{
    $u = equipe('dono', 'gerente');
    $p = produto_do_tenant((int)$u['tenant_id'], (int)$id);
    $f = $_FILES['imagem'] ?? null;
    if (!$f || $f['error'] !== UPLOAD_ERR_OK) erro(422, 'Envie uma imagem.');
    if ($f['size'] > 4 * 1024 * 1024) erro(422, 'Imagem maior que 4 MB.');
    $tipos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    $info = @getimagesize($f['tmp_name']);
    $mime = $info['mime'] ?? '';
    if (!isset($tipos[$mime])) erro(422, 'Use JPG, PNG ou WebP.');
    if (($info[0] ?? 0) > 4000 || ($info[1] ?? 0) > 4000) erro(422, 'Imagem grande demais (máximo 4000 px).');
    $nome = 't' . $u['tenant_id'] . '-p' . $p['id'] . '-' . bin2hex(random_bytes(6)) . '.' . $tipos[$mime];
    if (!move_uploaded_file($f['tmp_name'], UPLOAD_DIR . '/' . $nome)) erro(500, 'Não foi possível salvar a imagem.');
    db()->prepare('UPDATE products SET imagem = ? WHERE id = ?')->execute(['/arquivos/' . $nome, $p['id']]);
    apagar_arquivo($p['imagem']);
    responder(['ok' => true, 'imagem' => '/arquivos/' . $nome]);
}

function mover(string $tabela, string $grupo, int $tid, array $item, int $direcao): void
{
    $pdo = db();
    $st = $pdo->prepare("SELECT id FROM $tabela WHERE tenant_id = ? AND $grupo = ? ORDER BY ordem, id");
    $st->execute([$tid, $item[$grupo]]);
    $ids = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
    $i = array_search((int)$item['id'], $ids, true);
    $j = $i + ($direcao < 0 ? -1 : 1);
    if ($i === false || $j < 0 || $j >= count($ids)) return;
    [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
    $up = $pdo->prepare("UPDATE $tabela SET ordem = ? WHERE id = ?");
    foreach ($ids as $ordem => $id) $up->execute([$ordem, $id]);
}

function r_prod_mover(string $id): never
{
    $u = equipe('dono', 'gerente');
    $p = produto_do_tenant((int)$u['tenant_id'], (int)$id);
    mover('products', 'category_id', (int)$u['tenant_id'], $p, (int)(entrada()['direcao'] ?? 1));
    responder(['ok' => true]);
}

function r_prod_remover(string $id): never
{
    $u = equipe('dono', 'gerente');
    $p = produto_do_tenant((int)$u['tenant_id'], (int)$id);
    db()->prepare('DELETE FROM product_options WHERE product_id = ?')->execute([$p['id']]);
    db()->prepare('DELETE FROM products WHERE id = ?')->execute([$p['id']]);
    apagar_arquivo($p['imagem']);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'produto.removido', (string)$p['id'], ['nome' => $p['nome']]);
    responder(['ok' => true]);
}

function r_cat_criar(): never
{
    $u = equipe('dono', 'gerente');
    $nome = texto(entrada(), 'nome', 40);
    $o = db()->prepare('SELECT COALESCE(MAX(ordem), -1) + 1 FROM categories WHERE tenant_id = ?');
    $o->execute([$u['tenant_id']]);
    db()->prepare('INSERT INTO categories (tenant_id, nome, ordem) VALUES (?,?,?)')->execute([$u['tenant_id'], $nome, (int)$o->fetchColumn()]);
    responder(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
}

function r_cat_salvar(string $id): never
{
    $u = equipe('dono', 'gerente');
    $c = categoria_do_tenant((int)$u['tenant_id'], (int)$id);
    db()->prepare('UPDATE categories SET nome = ? WHERE id = ?')->execute([texto(entrada(), 'nome', 40), $c['id']]);
    responder(['ok' => true]);
}

function r_cat_mover(string $id): never
{
    $u = equipe('dono', 'gerente');
    $c = categoria_do_tenant((int)$u['tenant_id'], (int)$id);
    $c['grupo'] = $u['tenant_id'];
    $pdo = db();
    $st = $pdo->prepare('SELECT id FROM categories WHERE tenant_id = ? ORDER BY ordem, id');
    $st->execute([$u['tenant_id']]);
    $ids = array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
    $i = array_search((int)$c['id'], $ids, true);
    $j = $i + ((int)(entrada()['direcao'] ?? 1) < 0 ? -1 : 1);
    if ($i !== false && $j >= 0 && $j < count($ids)) {
        [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
        $up = $pdo->prepare('UPDATE categories SET ordem = ? WHERE id = ?');
        foreach ($ids as $ordem => $cid) $up->execute([$ordem, $cid]);
    }
    responder(['ok' => true]);
}

function r_cat_remover(string $id): never
{
    $u = equipe('dono', 'gerente');
    $c = categoria_do_tenant((int)$u['tenant_id'], (int)$id);
    $n = db()->prepare('SELECT COUNT(*) FROM products WHERE category_id = ?');
    $n->execute([$c['id']]);
    if ($n->fetchColumn()) erro(409, 'Remova ou mova os produtos desta categoria antes de apagá-la.');
    db()->prepare('DELETE FROM categories WHERE id = ?')->execute([$c['id']]);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- mesas */

function mesa_qualquer_do_tenant(int $tid, int $id): array
{
    $st = db()->prepare('SELECT * FROM tables WHERE id = ? AND tenant_id = ?');
    $st->execute([$id, $tid]);
    return $st->fetch() ?: erro(404, 'Mesa não encontrada.');
}

function r_mesas_listar(): never
{
    $u = equipe('dono', 'gerente');
    $st = db()->prepare("SELECT m.id, m.numero, m.nome,
        (SELECT d.nome FROM devices d WHERE d.table_id = m.id AND d.status <> 'bloqueado' LIMIT 1) AS tablet,
        (SELECT 1 FROM table_sessions s WHERE s.table_id = m.id AND s.status IN ('aberta','conta_solicitada')) AS ocupada
        FROM tables m WHERE m.tenant_id = ? AND m.ativo = 1 ORDER BY m.numero");
    $st->execute([$u['tenant_id']]);
    responder(['mesas' => $st->fetchAll()]);
}

function numero_mesa($v): int
{
    $n = (int)$v;
    if ($n < 1 || $n > 999) erro(422, 'Número da mesa deve ser de 1 a 999.');
    return $n;
}

function r_mesas_criar(): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $in = entrada();
    $numero = numero_mesa($in['numero'] ?? 0);
    $nome = texto($in, 'nome', 30, false) ?: sprintf('Mesa %02d', $numero);
    $st = db()->prepare('SELECT * FROM tables WHERE tenant_id = ? AND numero = ?');
    $st->execute([$tid, $numero]);
    $existente = $st->fetch();
    if ($existente && $existente['ativo']) erro(409, "Já existe a mesa $numero.");
    if ($existente) {
        db()->prepare('UPDATE tables SET ativo = 1, nome = ? WHERE id = ?')->execute([$nome, $existente['id']]);
        responder(['ok' => true, 'id' => (int)$existente['id']], 201);
    }
    db()->prepare('INSERT INTO tables (tenant_id, numero, nome) VALUES (?,?,?)')->execute([$tid, $numero, $nome]);
    responder(['ok' => true, 'id' => (int)db()->lastInsertId()], 201);
}

function r_mesas_salvar(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $m = mesa_qualquer_do_tenant($tid, (int)$id);
    if (!$m['ativo']) erro(404, 'Mesa não encontrada.');
    $in = entrada();
    $numero = array_key_exists('numero', $in) ? numero_mesa($in['numero']) : (int)$m['numero'];
    $nome = array_key_exists('nome', $in) ? (texto($in, 'nome', 30, false) ?: sprintf('Mesa %02d', $numero)) : $m['nome'];
    if ($numero !== (int)$m['numero']) {
        $st = db()->prepare('SELECT ativo FROM tables WHERE tenant_id = ? AND numero = ? AND id <> ?');
        $st->execute([$tid, $numero, $m['id']]);
        $outro = $st->fetch();
        if ($outro && $outro['ativo']) erro(409, "Já existe a mesa $numero.");
        if ($outro) erro(409, "O número $numero pertence a uma mesa removida. Crie a mesa $numero para reativá-la.");
    }
    db()->prepare('UPDATE tables SET numero = ?, nome = ? WHERE id = ?')->execute([$numero, $nome, $m['id']]);
    responder(['ok' => true]);
}

function r_mesas_remover(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $m = mesa_qualquer_do_tenant($tid, (int)$id);
    if (sessao_aberta($tid, (int)$m['id'])) erro(409, 'Esta mesa está com a conta aberta. Feche a conta antes de remover.');
    $pdo = db();
    $pdo->prepare('UPDATE devices SET table_id = NULL WHERE table_id = ?')->execute([$m['id']]);
    $h = $pdo->prepare('SELECT 1 FROM table_sessions WHERE table_id = ? UNION SELECT 1 FROM service_calls WHERE table_id = ? LIMIT 1');
    $h->execute([$m['id'], $m['id']]);
    if ($h->fetchColumn()) $pdo->prepare('UPDATE tables SET ativo = 0 WHERE id = ?')->execute([$m['id']]);
    else $pdo->prepare('DELETE FROM tables WHERE id = ?')->execute([$m['id']]);
    auditar($tid, 'usuario:' . $u['id'], 'mesa.removida', (string)$m['id']);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- equipe */

const PAPEIS_EQUIPE = ['dono', 'gerente', 'caixa', 'cozinha'];

function senha_valida($s): string
{
    $s = (string)$s;
    if (strlen($s) < 8) erro(422, 'A senha precisa ter pelo menos 8 caracteres.');
    if (strlen($s) > 200) erro(422, 'Senha muito longa.');
    return $s;
}

function email_valido($e): string
{
    $e = strtolower(trim((string)$e));
    if (!filter_var($e, FILTER_VALIDATE_EMAIL) || strlen($e) > 120) erro(422, 'E-mail inválido.');
    return $e;
}

function email_livre(string $e, int $exceto = 0): void
{
    $st = db()->prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?');
    $st->execute([$e, $exceto]);
    if ($st->fetchColumn()) erro(409, 'Este e-mail já está em uso.');
}

function r_equipe_listar(): never
{
    $u = equipe('dono', 'gerente');
    $st = db()->prepare('SELECT id, nome, email, papel, ativo FROM users WHERE tenant_id = ? ORDER BY ativo DESC, nome');
    $st->execute([$u['tenant_id']]);
    responder(['equipe' => $st->fetchAll(), 'eu' => $u['id']]);
}

function r_equipe_criar(): never
{
    $u = equipe('dono', 'gerente');
    $in = entrada();
    $papel = (string)($in['papel'] ?? '');
    if (!in_array($papel, PAPEIS_EQUIPE, true)) erro(422, 'Escolha a função.');
    if ($papel === 'dono' && $u['papel'] !== 'dono') erro(403, 'Só o dono pode cadastrar outro dono.');
    $nome = texto($in, 'nome', 60);
    $email = email_valido($in['email'] ?? '');
    email_livre($email);
    db()->prepare('INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?,?,?)')
        ->execute([$u['tenant_id'], $nome, $email, password_hash(senha_valida($in['senha'] ?? ''), PASSWORD_DEFAULT), $papel, agora()]);
    auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'equipe.criado', $email, ['papel' => $papel]);
    responder(['ok' => true], 201);
}

function r_equipe_salvar(string $id): never
{
    $u = equipe('dono', 'gerente');
    $tid = (int)$u['tenant_id'];
    $st = db()->prepare('SELECT * FROM users WHERE id = ? AND tenant_id = ?');
    $st->execute([(int)$id, $tid]);
    $alvo = $st->fetch() ?: erro(404, 'Pessoa não encontrada.');
    $in = entrada();
    if ($alvo['papel'] === 'dono' && $u['papel'] !== 'dono') erro(403, 'Só o dono pode alterar outro dono.');
    $papel = array_key_exists('papel', $in) ? (string)$in['papel'] : $alvo['papel'];
    if (!in_array($papel, PAPEIS_EQUIPE, true)) erro(422, 'Função inválida.');
    if ($papel === 'dono' && $u['papel'] !== 'dono') erro(403, 'Só o dono pode tornar alguém dono.');
    $ativo = array_key_exists('ativo', $in) ? ($in['ativo'] ? 1 : 0) : (int)$alvo['ativo'];
    if ((int)$alvo['id'] === $u['id'] && ($papel !== $alvo['papel'] || !$ativo)) erro(409, 'Você não pode mudar a sua própria função nem se desativar.');
    if ($alvo['papel'] === 'dono' && ($papel !== 'dono' || !$ativo)) {
        $n = db()->prepare("SELECT COUNT(*) FROM users WHERE tenant_id = ? AND papel = 'dono' AND ativo = 1 AND id <> ?");
        $n->execute([$tid, $alvo['id']]);
        if (!$n->fetchColumn()) erro(409, 'O estabelecimento precisa ter pelo menos um dono ativo.');
    }
    $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 60) : $alvo['nome'];
    $email = array_key_exists('email', $in) ? email_valido($in['email']) : $alvo['email'];
    email_livre($email, (int)$alvo['id']);
    db()->prepare('UPDATE users SET nome = ?, email = ?, papel = ?, ativo = ? WHERE id = ?')->execute([$nome, $email, $papel, $ativo, $alvo['id']]);
    if (!empty($in['senha'])) db()->prepare('UPDATE users SET senha_hash = ? WHERE id = ?')->execute([password_hash(senha_valida($in['senha']), PASSWORD_DEFAULT), $alvo['id']]);
    auditar($tid, 'usuario:' . $u['id'], 'equipe.alterado', (string)$alvo['id'], ['papel' => $papel, 'ativo' => $ativo, 'senha' => !empty($in['senha'])]);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- configurações */

function r_config_ler(): never
{
    $u = equipe('dono', 'gerente');
    $st = db()->prepare('SELECT nome, slug FROM tenants WHERE id = ?');
    $st->execute([$u['tenant_id']]);
    responder($st->fetch());
}

function r_config_salvar(): never
{
    $u = equipe('dono', 'gerente');
    $in = entrada();
    if (array_key_exists('nome', $in)) db()->prepare('UPDATE tenants SET nome = ? WHERE id = ?')->execute([texto($in, 'nome', 60), $u['tenant_id']]);
    if (!empty($in['pin'])) {
        if (!preg_match('/^\d{4}$/', (string)$in['pin'])) erro(422, 'O PIN precisa ter 4 números.');
        db()->prepare('UPDATE tenants SET pin_gerente_hash = ? WHERE id = ?')->execute([password_hash((string)$in['pin'], PASSWORD_DEFAULT), $u['tenant_id']]);
        auditar((int)$u['tenant_id'], 'usuario:' . $u['id'], 'config.pin_alterado');
    }
    responder(['ok' => true]);
}

function r_minha_senha(): never
{
    $u = usuario_logado();
    $in = entrada();
    $st = db()->prepare('SELECT senha_hash FROM users WHERE id = ?');
    $st->execute([$u['id']]);
    if (!password_verify((string)($in['atual'] ?? ''), (string)$st->fetchColumn())) erro(422, 'Senha atual incorreta.');
    db()->prepare('UPDATE users SET senha_hash = ? WHERE id = ?')->execute([password_hash(senha_valida($in['nova'] ?? ''), PASSWORD_DEFAULT), $u['id']]);
    responder(['ok' => true]);
}

/* -------------------------------------------------------------- plataforma */

function r_plat_listar(): never
{
    plataforma();
    $desde = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
    $st = db()->prepare("SELECT t.id, t.nome, t.slug, t.status, t.created_at,
        (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.papel = 'dono' ORDER BY u.id LIMIT 1) AS dono_email,
        (SELECT COUNT(*) FROM tables m WHERE m.tenant_id = t.id AND m.ativo = 1) AS mesas,
        (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.status = 'ativo') AS tablets,
        (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.created_at > ? AND o.status <> 'cancelado') AS pedidos_30d,
        (SELECT COALESCE(SUM(total), 0) FROM table_sessions s WHERE s.tenant_id = t.id AND s.status = 'fechada' AND s.fechada_em > ?) AS faturado_30d
        FROM tenants t ORDER BY t.nome");
    $st->execute([$desde, $desde]);
    responder(['estabelecimentos' => $st->fetchAll(), 'sem_volume' => SEM_VOLUME]);
}

function r_plat_criar(): never
{
    $u = plataforma();
    $in = entrada();
    $nome = texto($in, 'nome', 60, true, 'Nome do estabelecimento');
    $donoNome = texto($in, 'dono_nome', 60, true, 'Nome do responsável');
    $email = email_valido($in['dono_email'] ?? '');
    email_livre($email);
    $senha = senha_valida($in['dono_senha'] ?? '');
    $pin = (string)($in['pin'] ?? '');
    if (!preg_match('/^\d{4}$/', $pin)) erro(422, 'O PIN do tablet precisa ter 4 números.');
    $mesas = (int)($in['mesas'] ?? 0);
    if ($mesas < 0 || $mesas > 200) erro(422, 'Quantidade de mesas de 0 a 200.');
    $pdo = db();
    $pdo->beginTransaction();
    $tid = criar_estabelecimento($pdo, $nome, $pin, $donoNome, $email, $senha, $mesas);
    $pdo->commit();
    auditar(null, 'usuario:' . $u['id'], 'plataforma.estabelecimento_criado', (string)$tid, ['nome' => $nome]);
    responder(['ok' => true, 'id' => $tid], 201);
}

function r_plat_salvar(string $id): never
{
    $u = plataforma();
    $st = db()->prepare('SELECT * FROM tenants WHERE id = ?');
    $st->execute([(int)$id]);
    $t = $st->fetch() ?: erro(404, 'Estabelecimento não encontrado.');
    $in = entrada();
    $status = array_key_exists('status', $in) ? (string)$in['status'] : $t['status'];
    if (!in_array($status, ['ativo', 'bloqueado'], true)) erro(422, 'Situação inválida.');
    $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 60) : $t['nome'];
    db()->prepare('UPDATE tenants SET status = ?, nome = ? WHERE id = ?')->execute([$status, $nome, $t['id']]);
    auditar((int)$t['id'], 'usuario:' . $u['id'], 'plataforma.estabelecimento_alterado', (string)$t['id'], ['status' => $status]);
    responder(['ok' => true]);
}

function r_plat_backup(): never
{
    $u = plataforma();
    $arq = DATA_DIR . '/backup-' . bin2hex(random_bytes(6)) . '.sqlite';
    try {
        db()->exec('VACUUM INTO ' . db()->quote($arq));
        auditar(null, 'usuario:' . $u['id'], 'plataforma.backup');
        header('Content-Type: application/vnd.sqlite3');
        header('Content-Disposition: attachment; filename="deufome-backup-' . gmdate('Y-m-d-His') . '.sqlite"');
        header('Content-Length: ' . filesize($arq));
        header('Cache-Control: no-store');
        readfile($arq);
    } finally {
        @unlink($arq);
    }
    exit;
}
