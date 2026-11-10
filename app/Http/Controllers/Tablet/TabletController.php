<?php

namespace App\Http\Controllers\Tablet;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use App\Services\Cardapio;
use App\Services\Cupons;
use App\Services\Pix;
use App\Services\Horario;
use App\Services\Preferencias;
use Illuminate\Support\Facades\DB;

class TabletController extends Controller
{
    private const TAGS = ['Comida ótima', 'Atendimento rápido', 'Ambiente agradável', 'Preço justo', 'Demorou', 'Pedido errado', 'Comida fria', 'Tablet difícil de usar'];

    private static function exigirMesa(array $d): void
    {
        if (! $d['table_id'] || ! $d['mesa_numero']) {
            erro(409, 'Tablet sem mesa vinculada. Chame um atendente.');
        }
    }

    public function ativar()
    {
        $codigo = preg_replace('/\D/', '', (string) (entrada()['codigo'] ?? ''));
        $p = DB::selectOne('SELECT p.*, d.status AS d_status FROM device_pairings p JOIN devices d ON d.id = p.device_id AND d.tenant_id = p.tenant_id
            WHERE p.codigo = ? AND p.usado_em IS NULL AND p.expira_em > ?', [$codigo, agora()]);
        if (! $p || $p['d_status'] === 'bloqueado') {
            sleep(1);
            erro(422, 'Código inválido ou expirado.');
        }
        $token = bin2hex(random_bytes(32));
        DB::transaction(function () use ($p, $token) {
            DB::update('UPDATE device_pairings SET usado_em = ? WHERE id = ?', [agora(), $p['id']]);
            DB::update("UPDATE devices SET token_hash = ?, status = 'ativo', last_seen_at = ? WHERE id = ?", [hash('sha256', $token), agora(), $p['device_id']]);
        });
        Auditoria::registrar((int) $p['tenant_id'], 'dispositivo:'.$p['device_id'], 'dispositivo.ativado');

        return response()->json(['token' => $token]);
    }

    public function estado()
    {
        $d = dispositivo();
        $tid = (int) $d['tenant_id'];
        $sessao = $d['table_id'] ? Atendimento::sessaoAberta($tid, (int) $d['table_id']) : null;
        $chamados = $sessao ? array_column(DB::select("SELECT tipo FROM service_calls WHERE tenant_id = ? AND session_id = ? AND status = 'aberto'", [$tid, $sessao['id']]), 'tipo') : [];

        return response()->json([
            'estabelecimento' => $d['estabelecimento'],
            'dispositivo' => $d['nome'],
            'mesa' => $d['table_id'] ? ['numero' => (int) $d['mesa_numero'], 'nome' => $d['mesa_nome']] : null,
            'sessao' => $sessao ? ['id' => $sessao['id'], 'status' => $sessao['status']] : null,
            'pedidos' => $sessao ? Atendimento::pedidosDaSessao($tid, $sessao['id']) : [],
            'total' => $sessao ? Atendimento::totalSessao($tid, $sessao['id']) : 0,
            'taxa_servico' => (int) $d['taxa_servico'],
            'conta' => $sessao ? Atendimento::conta(Atendimento::tenant($tid), $sessao) : null,
            'avaliado_pratos' => $sessao ? (bool) DB::scalar('SELECT 1 FROM avaliacoes_itens WHERE session_id = ?', [$sessao['id']]) : false,
            'horario' => Horario::situacao($d),
            'avaliado' => $sessao ? (bool) DB::scalar('SELECT 1 FROM avaliacoes WHERE session_id = ?', [$sessao['id']]) : false,
            'chamados_abertos' => $chamados,
            'versao_cardapio' => Cardapio::versao($tid),
            'versao_app' => versao_app(),
        ]);
    }

    public function cardapio()
    {
        $d = dispositivo();
        $tid = (int) $d['tenant_id'];

        $categorias = Cardapio::montar($tid);

        return response()->json([
            'categorias' => $categorias,
            'combina' => (object) Cardapio::combina($tid, $categorias),
            'versao' => Cardapio::versao($tid),
            'destaques' => Cardapio::destaques($tid),
            'selos' => Cardapio::SELOS,
            'aparencia' => Preferencias::paraTablet($d),
        ]);
    }

    public function avaliar()
    {
        $d = dispositivo();
        self::exigirMesa($d);
        $sessao = Atendimento::sessaoAberta((int) $d['tenant_id'], (int) $d['table_id']) ?? erro(409, 'Não há atendimento aberto nesta mesa.');
        if (DB::scalar('SELECT 1 FROM avaliacoes WHERE session_id = ?', [$sessao['id']])) {
            erro(409, 'Esta mesa já avaliou o atendimento.');
        }
        $in = entrada();
        $nota = (int) ($in['nota'] ?? 0);
        if ($nota < 1 || $nota > 5) {
            erro(422, 'Escolha de 1 a 5 estrelas.');
        }
        $tags = array_values(array_intersect(self::TAGS, array_map('strval', (array) ($in['tags'] ?? []))));
        $coment = mb_substr(trim(strip_tags((string) ($in['comentario'] ?? ''))), 0, 400);
        $pedidos = array_column(DB::select("SELECT DISTINCT oi.nome, oi.product_id FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.session_id = ? AND o.status <> 'cancelado'", [$sessao['id']]), 'product_id', 'nome');
        $pratos = [];
        foreach (array_slice((array) ($in['pratos'] ?? []), 0, 40) as $pr) {
            $nome = (string) ($pr['nome'] ?? '');
            $n = (int) ($pr['nota'] ?? 0);
            if (array_key_exists($nome, $pedidos) && $n >= 1 && $n <= 5) {
                $pratos[$nome] = [$pedidos[$nome], $n];
            }
        }
        DB::transaction(function () use ($d, $sessao, $nota, $tags, $coment, $pratos) {
            DB::insert('INSERT INTO avaliacoes (tenant_id, session_id, table_id, nota, tags, comentario, created_at) VALUES (?,?,?,?,?,?,?)',
                [$d['tenant_id'], $sessao['id'], $d['table_id'], $nota, json_encode($tags, JSON_UNESCAPED_UNICODE), $coment, agora()]);
            foreach ($pratos as $nome => [$pid, $n]) {
                DB::insert('INSERT OR IGNORE INTO avaliacoes_itens (tenant_id, session_id, product_id, nome, nota, created_at) VALUES (?,?,?,?,?,?)', [$d['tenant_id'], $sessao['id'], $pid, $nome, $n, agora()]);
            }
        });

        return response()->json(['ok' => true], 201);
    }

    public function pedir()
    {
        $d = dispositivo();
        self::exigirMesa($d);
        $tid = (int) $d['tenant_id'];
        $mesa = (int) $d['table_id'];
        $in = entrada();
        $chave = (string) ($in['chave'] ?? '');
        if (! preg_match('/^[A-Za-z0-9-]{8,64}$/', $chave)) {
            erro(422, 'Chave do pedido inválida.');
        }
        $hor = Horario::situacao($d);
        if (! $hor['aberto']) {
            erro(409, 'Estamos fechados agora'.($hor['proxima'] ? ', abrimos '.$hor['proxima'] : '').'. Não é possível fazer pedidos.');
        }
        $itens = $in['itens'] ?? null;
        if (! is_array($itens) || count($itens) < 1 || count($itens) > 40) {
            erro(422, 'Carrinho vazio ou grande demais.');
        }
        $permitirObs = Preferencias::de($d)['permitir_observacao'];

        $r = DB::transaction(function () use ($tid, $mesa, $d, $chave, $itens, $permitirObs) {
            $sessao = Atendimento::sessaoAberta($tid, $mesa);
            if ($sessao && $sessao['status'] === 'conta_solicitada') {
                erro(409, 'A conta já foi solicitada. Chame um atendente para pedir mais.');
            }
            if (! $sessao) {
                $sid = novo_uuid();
                DB::insert("INSERT INTO table_sessions (id, tenant_id, table_id, device_id, status, aberta_em) VALUES (?,?,?,?, 'aberta', ?)", [$sid, $tid, $mesa, $d['id'], agora()]);
                $sessao = Atendimento::sessaoAberta($tid, $mesa);
                Auditoria::registrar($tid, 'dispositivo:'.$d['id'], 'sessao.aberta', $sid);
            }
            if ($existente = DB::scalar('SELECT id FROM orders WHERE session_id = ? AND idempotency_key = ?', [$sessao['id'], $chave])) {
                return ['repetido' => (int) $existente];
            }
            $linhas = [];
            $total = 0;
            foreach ($itens as $item) {
                $p = DB::selectOne('SELECT p.id, p.nome, p.preco, p.disponivel, p.tamanhos, p.meio_a_meio, p.category_id, c.setor FROM products p JOIN categories c ON c.id = p.category_id WHERE p.id = ? AND p.tenant_id = ?', [(int) ($item['produto_id'] ?? 0), $tid]) ?? erro(422, 'Produto não encontrado.');
                if (! $p['disponivel']) {
                    erro(409, "{$p['nome']} acabou de esgotar. Remova do carrinho.");
                }
                $qtd = (int) ($item['quantidade'] ?? 0);
                if ($qtd < 1 || $qtd > 20) {
                    erro(422, 'Quantidade inválida.');
                }
                [$unit, $nomeItem, $tamanho, $sabores] = self::precoDoItem($tid, $p, $item);
                $adds = [];
                foreach (array_unique(array_map('intval', (array) ($item['adicionais'] ?? []))) as $oid) {
                    $o = DB::selectOne('SELECT id, nome, preco FROM product_options WHERE id = ? AND product_id = ? AND tenant_id = ?', [$oid, $p['id'], $tid]) ?? erro(422, 'Adicional inválido.');
                    $unit += (int) $o['preco'];
                    $adds[] = ['nome' => $o['nome'], 'preco' => (int) $o['preco']];
                }
                $obs = $permitirObs ? mb_substr(trim(strip_tags((string) ($item['observacao'] ?? ''))), 0, 140) : '';
                $sub = $unit * $qtd;
                $total += $sub;
                $linhas[] = [$p['id'], $nomeItem, $unit, $qtd, json_encode($adds, JSON_UNESCAPED_UNICODE), $obs, $sub, $p['setor'] ?: 'cozinha', $tamanho, json_encode($sabores, JSON_UNESCAPED_UNICODE)];
            }
            $numero = (int) DB::scalar('SELECT COALESCE(MAX(numero),0)+1 FROM orders WHERE tenant_id = ?', [$tid]);
            $oid = DB::table('orders')->insertGetId([
                'tenant_id' => $tid, 'session_id' => $sessao['id'], 'table_id' => $mesa, 'numero' => $numero, 'status' => 'recebido',
                'total' => $total, 'idempotency_key' => $chave, 'origem' => 'tablet', 'created_at' => agora(), 'updated_at' => agora(),
            ]);
            foreach ($linhas as $l) {
                DB::insert('INSERT INTO order_items (order_id, product_id, nome, preco_unit, quantidade, adicionais, observacao, subtotal, setor, tamanho, sabores) VALUES (?,?,?,?,?,?,?,?,?,?,?)', [$oid, ...$l]);
            }

            return ['id' => $oid, 'numero' => $numero, 'total' => $total];
        });
        if (isset($r['repetido'])) {
            return response()->json(['ok' => true, 'pedido_id' => $r['repetido'], 'repetido' => true]);
        }

        return response()->json(['ok' => true, 'pedido_id' => $r['id'], 'numero' => $r['numero'], 'total' => $r['total']], 201);
    }

    /** Preço e nome do item, considerando tamanho (P/M/G) e meio a meio (vale o sabor mais caro). */
    private static function precoDoItem(int $tid, array $p, array $item): array
    {
        $tams = Cardapio::tamanhos($p['tamanhos']);
        $tamanho = null;
        $preco = (int) $p['preco'];
        $porTam = function (array $prod, ?string $t) {
            if ($t === null) {
                return (int) $prod['preco'];
            }
            foreach (Cardapio::tamanhos($prod['tamanhos']) as $x) {
                if ($x['nome'] === $t) {
                    return $x['preco'];
                }
            }

            return null;
        };
        if ($tams) {
            $tamanho = (string) ($item['tamanho'] ?? '');
            $preco = $porTam($p, $tamanho) ?? erro(422, "Escolha o tamanho de {$p['nome']}.");
        }
        $nome = $p['nome'];
        $sabores = [];
        $s2 = (int) ($item['sabor2_id'] ?? 0);
        if ($s2 && $s2 !== (int) $p['id']) {
            if (! $p['meio_a_meio']) {
                erro(422, "{$p['nome']} não pode ser meio a meio.");
            }
            $q = DB::selectOne('SELECT id, nome, preco, disponivel, tamanhos, meio_a_meio, category_id FROM products WHERE id = ? AND tenant_id = ?', [$s2, $tid]);
            if (! $q || ! $q['meio_a_meio'] || (int) $q['category_id'] !== (int) $p['category_id']) {
                erro(422, 'Este segundo sabor não pode ser combinado.');
            }
            if (! $q['disponivel']) {
                erro(409, "{$q['nome']} acabou de esgotar. Escolha outro sabor.");
            }
            $p2 = $porTam($q, $tamanho) ?? erro(422, "{$q['nome']} não tem o tamanho $tamanho.");
            $preco = max($preco, $p2);
            $sabores = [$p['nome'], $q['nome']];
            $nome = '½ '.$p['nome'].' + ½ '.$q['nome'];
        }
        if ($tamanho !== null) {
            $nome .= " ($tamanho)";
        }

        return [$preco, $nome, $tamanho, $sabores];
    }

    public function cupom()
    {
        $d = dispositivo();
        self::exigirMesa($d);
        $tid = (int) $d['tenant_id'];
        $t = Atendimento::tenant($tid);
        $sessao = Atendimento::sessaoAberta($tid, (int) $d['table_id']) ?? erro(409, 'Faça um pedido antes de usar o cupom.');
        $codigo = (string) (entrada()['codigo'] ?? '');
        if ($codigo === '') {
            DB::update('UPDATE table_sessions SET cupom_id = NULL, cupom_codigo = NULL WHERE id = ?', [$sessao['id']]);
        } else {
            $c = Cupons::validar($t, $codigo, Atendimento::totalSessao($tid, $sessao['id']));
            DB::update('UPDATE table_sessions SET cupom_id = ?, cupom_codigo = ? WHERE id = ?', [$c['id'], $c['codigo'], $sessao['id']]);
        }

        return response()->json(['ok' => true, 'conta' => Atendimento::conta($t, Atendimento::sessaoAberta($tid, (int) $d['table_id']))]);
    }

    /** Pix na mesa: guarda a gorjeta escolhida, pede a conta e devolve o código para pagar. */
    public function pix()
    {
        $d = dispositivo();
        self::exigirMesa($d);
        $tid = (int) $d['tenant_id'];
        $t = Atendimento::tenant($tid);
        $pref = Preferencias::de($t);
        if (! $pref['pix_ativo'] || $pref['pix_chave'] === '') {
            erro(409, 'O pagamento por Pix na mesa não está disponível. Chame um atendente.');
        }
        $sessao = Atendimento::sessaoAberta($tid, (int) $d['table_id']) ?? erro(409, 'Ainda não há pedidos nesta mesa.');
        $gpct = (int) (entrada()['gorjeta_pct'] ?? 0);
        if (! in_array($gpct, [0, 5, 10, 15], true) || (! $pref['gorjeta_ativa'] && $gpct)) {
            erro(422, 'Gorjeta inválida.');
        }
        DB::update("UPDATE table_sessions SET gorjeta_pct = ?, pagar_com = 'pix', status = 'conta_solicitada', conta_em = COALESCE(conta_em, ?) WHERE id = ?", [$gpct, agora(), $sessao['id']]);
        if (! DB::scalar("SELECT 1 FROM service_calls WHERE tenant_id = ? AND table_id = ? AND tipo = 'conta' AND status = 'aberto'", [$tid, $d['table_id']])) {
            DB::insert("INSERT INTO service_calls (tenant_id, session_id, table_id, tipo, created_at) VALUES (?,?,?, 'conta', ?)", [$tid, $sessao['id'], $d['table_id'], agora()]);
        }
        $conta = Atendimento::conta($t, Atendimento::sessaoAberta($tid, (int) $d['table_id']));
        Auditoria::registrar($tid, 'dispositivo:'.$d['id'], 'sessao.pix', $sessao['id'], ['gorjeta_pct' => $gpct, 'total' => $conta['total']]);

        return response()->json([
            'ok' => true, 'conta' => $conta,
            'copia_e_cola' => Pix::copiaECola($pref['pix_chave'], $pref['pix_nome'], $pref['pix_cidade'], $conta['total'], 'MESA'.$d['mesa_numero'].substr(str_replace('-', '', $sessao['id']), 0, 8)),
            'recebedor' => $pref['pix_nome'],
        ]);
    }

    public function chamar()
    {
        $d = dispositivo();
        self::exigirMesa($d);
        $tid = (int) $d['tenant_id'];
        $tipo = (string) (entrada()['tipo'] ?? '');
        if (! in_array($tipo, ['garcom', 'conta'], true)) {
            erro(422, 'Tipo de chamado inválido.');
        }
        if ($tipo === 'garcom' && ! Preferencias::de($d)['chamar_garcom']) {
            erro(409, 'Chame um atendente pessoalmente.');
        }
        $sessao = Atendimento::sessaoAberta($tid, (int) $d['table_id']);
        if ($tipo === 'conta') {
            if (! $sessao) {
                erro(409, 'Ainda não há pedidos nesta mesa.');
            }
            if ($sessao['status'] === 'aberta') {
                DB::update("UPDATE table_sessions SET status = 'conta_solicitada', conta_em = ? WHERE id = ?", [agora(), $sessao['id']]);
                Auditoria::registrar($tid, 'dispositivo:'.$d['id'], 'sessao.conta_solicitada', $sessao['id']);
            }
        }
        if (! DB::scalar("SELECT 1 FROM service_calls WHERE tenant_id = ? AND table_id = ? AND tipo = ? AND status = 'aberto'", [$tid, $d['table_id'], $tipo])) {
            DB::insert('INSERT INTO service_calls (tenant_id, session_id, table_id, tipo, created_at) VALUES (?,?,?,?,?)', [$tid, $sessao['id'] ?? null, $d['table_id'], $tipo, agora()]);
        }

        return response()->json(['ok' => true]);
    }

    public function desbloquear()
    {
        $d = dispositivo();
        $hash = (string) DB::scalar('SELECT pin_gerente_hash FROM tenants WHERE id = ?', [$d['tenant_id']]);
        if ($hash === '') {
            erro(409, 'O PIN ainda não foi definido. O gerente define em Configurações, no painel.');
        }
        if (! password_verify((string) (entrada()['pin'] ?? ''), $hash)) {
            sleep(1);
            Auditoria::registrar((int) $d['tenant_id'], 'dispositivo:'.$d['id'], 'quiosque.pin_incorreto');
            erro(422, 'PIN incorreto.');
        }
        Auditoria::registrar((int) $d['tenant_id'], 'dispositivo:'.$d['id'], 'quiosque.desbloqueado');

        return response()->json(['ok' => true]);
    }
}
