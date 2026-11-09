<?php
declare(strict_types=1);

/* -------------------------------------------------------------- Google */

function google_configurado(): bool
{
    return variavel('GOOGLE_CLIENT_ID') !== '' && variavel('GOOGLE_CLIENT_SECRET') !== '';
}

function cadastro_aberto(): bool
{
    return variavel('CADASTRO_ABERTO') !== '0';
}

function redirecionar(string $para): never
{
    header('Cache-Control: no-store');
    header('Location: ' . $para, true, 302);
    exit;
}

function entrar_como(array $u): void
{
    iniciar_sessao_php();
    session_regenerate_id(true);
    unset($_SESSION['google_pendente'], $_SESSION['oauth_state']);
    $_SESSION['uid'] = (int)$u['id'];
}

function r_google_inicio(): never
{
    if (!google_configurado()) redirecionar('/admin#erro=google-off');
    iniciar_sessao_php();
    $_SESSION['oauth_state'] = bin2hex(random_bytes(16));
    $_SESSION['oauth_modo'] = ($_GET['modo'] ?? '') === 'cadastro' ? 'cadastro' : 'entrar';
    $url = (variavel('GOOGLE_AUTH_URL') ?: 'https://accounts.google.com/o/oauth2/v2/auth') . '?' . http_build_query([
        'client_id' => variavel('GOOGLE_CLIENT_ID'),
        'redirect_uri' => url_app() . '/auth/google/retorno',
        'response_type' => 'code',
        'scope' => 'openid email profile',
        'state' => $_SESSION['oauth_state'],
        'prompt' => 'select_account',
    ]);
    redirecionar($url);
}

function decodificar_jwt(string $jwt): ?array
{
    $partes = explode('.', $jwt);
    if (count($partes) !== 3) return null;
    $json = base64_decode(strtr($partes[1], '-_', '+/') . str_repeat('=', (4 - strlen($partes[1]) % 4) % 4), true);
    $dados = $json ? json_decode($json, true) : null;
    return is_array($dados) ? $dados : null;
}

function r_google_retorno(): never
{
    iniciar_sessao_php();
    $esperado = (string)($_SESSION['oauth_state'] ?? '');
    unset($_SESSION['oauth_state']);
    if (!empty($_GET['error'])) redirecionar('/admin#erro=google-cancelado');
    if ($esperado === '' || !hash_equals($esperado, (string)($_GET['state'] ?? '')) || empty($_GET['code'])) redirecionar('/admin#erro=google-sessao');
    [$status, $resp] = http_json(variavel('GOOGLE_TOKEN_URL') ?: 'https://oauth2.googleapis.com/token', [
        'code' => (string)$_GET['code'],
        'client_id' => variavel('GOOGLE_CLIENT_ID'),
        'client_secret' => variavel('GOOGLE_CLIENT_SECRET'),
        'redirect_uri' => url_app() . '/auth/google/retorno',
        'grant_type' => 'authorization_code',
    ], [], 12, true);
    $c = ($status === 200 && !empty($resp['id_token'])) ? decodificar_jwt((string)$resp['id_token']) : null;
    $validos = ['accounts.google.com', 'https://accounts.google.com'];
    if (!$c || !in_array($c['iss'] ?? '', $validos, true) || ($c['aud'] ?? '') !== variavel('GOOGLE_CLIENT_ID') || (int)($c['exp'] ?? 0) < time()
        || empty($c['sub']) || empty($c['email']) || !filter_var($c['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
        error_log('[google] resposta inválida status=' . $status);
        redirecionar('/admin#erro=google-falhou');
    }
    $email = strtolower((string)$c['email']);
    $sub = (string)$c['sub'];
    $pdo = db();
    $st = $pdo->prepare('SELECT u.*, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.google_sub = ? OR u.email = ? ORDER BY (u.google_sub = ?) DESC LIMIT 1');
    $st->execute([$sub, $email, $sub]);
    $u = $st->fetch();
    if ($u) {
        if (!$u['ativo']) redirecionar('/admin#erro=desativado');
        if ($u['tenant_id'] && $u['tenant_status'] !== 'ativo') redirecionar('/admin#erro=bloqueado');
        if (!$u['google_sub']) $pdo->prepare('UPDATE users SET google_sub = ? WHERE id = ?')->execute([$sub, $u['id']]);
        entrar_como($u);
        redirecionar($u['papel'] === 'cozinha' ? '/cozinha' : '/admin');
    }
    if (!cadastro_aberto()) redirecionar('/admin#erro=sem-conta');
    $_SESSION['google_pendente'] = ['sub' => $sub, 'email' => $email, 'nome' => mb_substr((string)($c['name'] ?? ''), 0, 60), 'em' => time()];
    redirecionar('/cadastro#google');
}

function google_pendente(): ?array
{
    iniciar_sessao_php();
    $p = $_SESSION['google_pendente'] ?? null;
    if (!$p || $p['em'] < time() - 1800) return null;
    return $p;
}

/* -------------------------------------------------------------- cadastro */

function dados_restaurante(array $in): array
{
    if (empty($in['aceite'])) erro(422, 'Para criar a conta, aceite os Termos de uso e a Política de privacidade.');
    $nome = texto($in, 'restaurante', 60, true, 'Nome do restaurante');
    $pin = (string)($in['pin'] ?? '');
    if (!preg_match('/^\d{4}$/', $pin)) erro(422, 'O PIN dos tablets precisa ter 4 números.');
    $mesas = (int)($in['mesas'] ?? 10);
    if ($mesas < 0 || $mesas > 200) erro(422, 'Quantidade de mesas de 0 a 200.');
    return [$nome, $pin, $mesas];
}

function boas_vindas(string $email, string $nome, string $restaurante): void
{
    enviar_email($email, 'Bem-vindo ao Deu Fome', email_modelo("Olá, $nome!",
        '<p>A conta do <b>' . htmlspecialchars($restaurante) . '</b> foi criada. Os próximos passos são:</p><ol><li>Monte o cardápio em <b>Cardápio</b>.</li><li>Cadastre os tablets em <b>Dispositivos</b> e ative cada um em <b>' . htmlspecialchars(url_app()) . '/tablet</b>.</li><li>Adicione sua equipe em <b>Equipe</b>.</li></ol>',
        'Abrir o painel', url_app() . '/admin'));
    $plat = variavel('PLATAFORMA_EMAIL');
    if ($plat) enviar_email($plat, '[Deu Fome] Novo restaurante: ' . $restaurante, email_modelo('Novo cadastro', '<p><b>' . htmlspecialchars($restaurante) . '</b> criou uma conta.</p><p>Responsável: ' . htmlspecialchars($nome) . ' (' . htmlspecialchars($email) . ')</p>', 'Ver estabelecimentos', url_app() . '/admin'));
}

function r_cadastro(): never
{
    if (!cadastro_aberto()) erro(403, 'O cadastro de novos restaurantes está fechado no momento.');
    $in = entrada();
    [$restaurante, $pin, $mesas] = dados_restaurante($in);
    $nome = texto($in, 'nome', 60, true, 'Seu nome');
    $email = email_valido($in['email'] ?? '');
    $senha = senha_valida($in['senha'] ?? '');
    limite('cadastro:' . ip_cliente(), 5, 3600);
    email_livre($email);
    $pdo = db();
    $pdo->beginTransaction();
    $tid = criar_estabelecimento($pdo, $restaurante, $pin, $nome, $email, $senha, $mesas);
    $pdo->commit();
    $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([$email]);
    entrar_como($st->fetch());
    auditar($tid, 'cadastro', 'estabelecimento.cadastrado', (string)$tid, ['origem' => 'email']);
    boas_vindas($email, $nome, $restaurante);
    responder(['ok' => true], 201);
}

function r_cadastro_google_ler(): never
{
    $p = google_pendente();
    if (!$p) erro(404, 'Entre com o Google novamente.');
    responder(['email' => $p['email'], 'nome' => $p['nome']]);
}

function r_cadastro_google(): never
{
    if (!cadastro_aberto()) erro(403, 'O cadastro de novos restaurantes está fechado no momento.');
    $p = google_pendente();
    if (!$p) erro(409, 'Sua confirmação do Google expirou. Clique em "Continuar com Google" de novo.');
    $in = entrada();
    [$restaurante, $pin, $mesas] = dados_restaurante($in);
    $nome = texto($in, 'nome', 60, true, 'Seu nome');
    limite('cadastro:' . ip_cliente(), 5, 3600);
    email_livre($p['email']);
    $pdo = db();
    $pdo->beginTransaction();
    $tid = criar_estabelecimento($pdo, $restaurante, $pin, $nome, $p['email'], bin2hex(random_bytes(24)), $mesas);
    $pdo->prepare('UPDATE users SET google_sub = ? WHERE email = ?')->execute([$p['sub'], $p['email']]);
    $pdo->commit();
    $st = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([$p['email']]);
    entrar_como($st->fetch());
    auditar($tid, 'cadastro', 'estabelecimento.cadastrado', (string)$tid, ['origem' => 'google']);
    boas_vindas($p['email'], $nome, $restaurante);
    responder(['ok' => true], 201);
}

/* -------------------------------------------------------------- esqueci a senha */

function r_senha_esqueci(): never
{
    $email = strtolower(trim((string)(entrada()['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) erro(422, 'Digite um e-mail válido.');
    limite('esqueci-ip:' . ip_cliente(), 10, 3600);
    limite('esqueci:' . $email, 3, 3600);
    $st = db()->prepare('SELECT u.id, u.nome, u.ativo, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = ?');
    $st->execute([$email]);
    $u = $st->fetch();
    if ($u && $u['ativo'] && ($u['tenant_status'] ?? 'ativo') === 'ativo') {
        $token = bin2hex(random_bytes(32));
        db()->prepare('UPDATE senha_tokens SET usado_em = ? WHERE user_id = ? AND usado_em IS NULL')->execute(['substituido', $u['id']]);
        db()->prepare('INSERT INTO senha_tokens (user_id, token_hash, expira_em) VALUES (?,?,?)')
            ->execute([$u['id'], hash('sha256', $token), gmdate('Y-m-d H:i:s', time() + 3600)]);
        enviar_email($email, 'Redefinir sua senha do Deu Fome', email_modelo('Redefinir senha',
            '<p>Olá, ' . htmlspecialchars($u['nome']) . '. Recebemos um pedido para criar uma nova senha.</p><p>O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail.</p>',
            'Criar nova senha', url_app() . '/admin#redefinir=' . $token));
    }
    responder(['ok' => true]);
}

function r_senha_redefinir(): never
{
    $in = entrada();
    $token = (string)($in['token'] ?? '');
    if (!preg_match('/^[a-f0-9]{64}$/', $token)) erro(422, 'Link inválido. Peça um novo.');
    $senha = senha_valida($in['senha'] ?? '');
    $pdo = db();
    $st = $pdo->prepare('SELECT t.id, t.user_id, u.email FROM senha_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.usado_em IS NULL AND t.expira_em > ?');
    $st->execute([hash('sha256', $token), agora()]);
    $t = $st->fetch();
    if (!$t) erro(422, 'Este link expirou ou já foi usado. Peça um novo.');
    $pdo->beginTransaction();
    $pdo->prepare('UPDATE users SET senha_hash = ? WHERE id = ?')->execute([password_hash($senha, PASSWORD_DEFAULT), $t['user_id']]);
    $pdo->prepare('UPDATE senha_tokens SET usado_em = ? WHERE user_id = ? AND usado_em IS NULL')->execute([agora(), $t['user_id']]);
    $pdo->prepare('DELETE FROM login_tentativas WHERE email = ?')->execute([$t['email']]);
    $pdo->commit();
    auditar(null, 'usuario:' . $t['user_id'], 'senha.redefinida');
    responder(['ok' => true]);
}
