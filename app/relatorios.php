<?php
declare(strict_types=1);

function periodo(array $t, array $in): array
{
    $fuso = fuso_do($t);
    $hoje = new DateTimeImmutable('today', $fuso);
    $p = (string)($in['periodo'] ?? '7d');
    $data = function ($v) use ($fuso) {
        $d = DateTimeImmutable::createFromFormat('!Y-m-d', (string)$v, $fuso);
        if (!$d) erro(422, 'Data inválida.');
        return $d;
    };
    switch ($p) {
        case 'hoje': $de = $hoje; $ate = $hoje; break;
        case 'ontem': $de = $hoje->modify('-1 day'); $ate = $de; break;
        case '30d': $de = $hoje->modify('-29 days'); $ate = $hoje; break;
        case 'mes': $de = $hoje->modify('first day of this month'); $ate = $hoje; break;
        case 'personalizado':
            $de = $data($in['de'] ?? ''); $ate = $data($in['ate'] ?? '');
            if ($ate < $de) [$de, $ate] = [$ate, $de];
            if ($de->diff($ate)->days > 366) erro(422, 'Escolha um período de até 1 ano.');
            break;
        default: $p = '7d'; $de = $hoje->modify('-6 days'); $ate = $hoje;
    }
    $utc = new DateTimeZone('UTC');
    return [
        'periodo' => $p, 'de' => $de->format('Y-m-d'), 'ate' => $ate->format('Y-m-d'), 'fuso' => $fuso,
        'ini' => $de->setTimezone($utc)->format('Y-m-d H:i:s'),
        'fim' => $ate->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s'),
        'dias' => (int)$de->diff($ate)->days + 1, 'de_dt' => $de,
    ];
}

function local(string $utc, DateTimeZone $fuso): DateTimeImmutable
{
    return (new DateTimeImmutable($utc, new DateTimeZone('UTC')))->setTimezone($fuso);
}

function r_relatorios(): never
{
    $u = equipe('dono', 'gerente');
    $t = tenant_atual($u);
    $tid = (int)$t['id'];
    $per = periodo($t, $_GET);
    $pdo = db();
    $fuso = $per['fuso'];

    $st = $pdo->prepare("SELECT s.id, s.table_id, s.aberta_em, s.fechada_em, COALESCE(s.subtotal, s.total) AS subtotal, COALESCE(s.taxa, 0) AS taxa, s.total, COALESCE(s.pessoas, 1) AS pessoas, s.forma_pagamento
        FROM table_sessions s WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ?");
    $st->execute([$tid, $per['ini'], $per['fim']]);
    $contas = $st->fetchAll();

    $porDia = [];
    for ($i = 0; $i < $per['dias']; $i++) $porDia[$per['de_dt']->modify("+$i day")->format('Y-m-d')] = ['dia' => $per['de_dt']->modify("+$i day")->format('Y-m-d'), 'total' => 0, 'contas' => 0];
    $faturado = $taxas = $pessoas = $permanencia = 0;
    $porMesa = [];
    foreach ($contas as $c) {
        $dia = local($c['fechada_em'], $fuso)->format('Y-m-d');
        if (isset($porDia[$dia])) { $porDia[$dia]['total'] += (int)$c['total']; $porDia[$dia]['contas']++; }
        $faturado += (int)$c['total'];
        $taxas += (int)$c['taxa'];
        $pessoas += max(1, (int)$c['pessoas']);
        $permanencia += max(0, strtotime($c['fechada_em'] . ' UTC') - strtotime($c['aberta_em'] . ' UTC'));
        $porMesa[$c['table_id']] = ['contas' => ($porMesa[$c['table_id']]['contas'] ?? 0) + 1, 'total' => ($porMesa[$c['table_id']]['total'] ?? 0) + (int)$c['total']];
    }
    $n = count($contas);

    $st = $pdo->prepare("SELECT o.id, o.status, o.created_at, o.preparo_em, o.pronto_em FROM orders o WHERE o.tenant_id = ? AND o.created_at >= ? AND o.created_at < ?");
    $st->execute([$tid, $per['ini'], $per['fim']]);
    $pedidos = $st->fetchAll();
    $porHora = array_fill(0, 24, 0);
    $validos = $cancelados = 0;
    $tPreparo = $tEspera = [];
    foreach ($pedidos as $o) {
        if ($o['status'] === 'cancelado') { $cancelados++; continue; }
        $validos++;
        $porHora[(int)local($o['created_at'], $fuso)->format('G')]++;
        if ($o['pronto_em']) $tPreparo[] = (strtotime($o['pronto_em'] . ' UTC') - strtotime($o['created_at'] . ' UTC')) / 60;
        if ($o['preparo_em']) $tEspera[] = (strtotime($o['preparo_em'] . ' UTC') - strtotime($o['created_at'] . ' UTC')) / 60;
    }
    $media = fn(array $l) => $l ? round(array_sum($l) / count($l), 1) : null;

    $st = $pdo->prepare("SELECT oi.nome, SUM(oi.quantidade) AS quantidade, SUM(oi.subtotal) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? AND o.created_at < ? GROUP BY oi.nome ORDER BY quantidade DESC, total DESC LIMIT 10");
    $st->execute([$tid, $per['ini'], $per['fim']]);
    $produtos = $st->fetchAll();
    $itens = $pdo->prepare("SELECT COALESCE(SUM(oi.quantidade), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? AND o.created_at < ?");
    $itens->execute([$tid, $per['ini'], $per['fim']]);

    $formas = formas_pagamento($tid, $per['ini'], $per['fim']);

    $nomesMesas = [];
    if ($porMesa) {
        $q = $pdo->prepare('SELECT id, nome FROM tables WHERE tenant_id = ?');
        $q->execute([$tid]);
        foreach ($q->fetchAll() as $m) $nomesMesas[$m['id']] = $m['nome'];
    }
    $mesas = [];
    foreach ($porMesa as $id => $v) $mesas[] = ['mesa' => $nomesMesas[$id] ?? 'Mesa removida'] + $v;
    usort($mesas, fn($a, $b) => $b['total'] <=> $a['total']);

    $st = $pdo->prepare("SELECT a.nota, a.tags, a.comentario, a.created_at, m.nome AS mesa FROM avaliacoes a LEFT JOIN tables m ON m.id = a.table_id
        WHERE a.tenant_id = ? AND a.created_at >= ? AND a.created_at < ? ORDER BY a.id DESC");
    $st->execute([$tid, $per['ini'], $per['fim']]);
    $avs = $st->fetchAll();
    $dist = array_fill(1, 5, 0);
    $tags = [];
    $soma = 0;
    $ultimas = [];
    foreach ($avs as $a) {
        $dist[(int)$a['nota']]++;
        $soma += (int)$a['nota'];
        $lt = json_decode($a['tags'], true) ?: [];
        foreach ($lt as $tg) $tags[$tg] = ($tags[$tg] ?? 0) + 1;
        if (count($ultimas) < 8 && ($a['comentario'] !== '' || $lt)) $ultimas[] = ['nota' => (int)$a['nota'], 'tags' => $lt, 'comentario' => $a['comentario'], 'mesa' => $a['mesa'], 'quando' => local($a['created_at'], $fuso)->format('d/m H:i')];
    }
    arsort($tags);

    responder([
        'periodo' => ['tipo' => $per['periodo'], 'de' => $per['de'], 'ate' => $per['ate']],
        'resumo' => [
            'faturado' => $faturado, 'taxas' => $taxas, 'contas' => $n, 'ticket_medio' => $n ? (int)round($faturado / $n) : 0,
            'por_pessoa' => $pessoas ? (int)round($faturado / $pessoas) : 0, 'pedidos' => $validos, 'cancelados' => $cancelados,
            'itens' => (int)$itens->fetchColumn(), 'permanencia_min' => $n ? (int)round($permanencia / $n / 60) : null,
            'preparo_min' => $media($tPreparo), 'espera_min' => $media($tEspera),
        ],
        'por_dia' => array_values($porDia),
        'por_hora' => $porHora,
        'produtos' => $produtos,
        'formas' => $formas,
        'mesas' => array_slice($mesas, 0, 10),
        'avaliacoes' => ['media' => count($avs) ? round($soma / count($avs), 1) : null, 'total' => count($avs), 'distribuicao' => $dist, 'tags' => $tags, 'ultimas' => $ultimas],
    ]);
}

function formas_pagamento(int $tid, string $ini, string $fim): array
{
    $pdo = db();
    $st = $pdo->prepare("SELECT p.forma, SUM(p.valor) AS total, COUNT(*) AS qtd FROM payments p JOIN table_sessions s ON s.id = p.session_id
        WHERE p.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? GROUP BY p.forma");
    $st->execute([$tid, $ini, $fim]);
    $r = [];
    foreach ($st->fetchAll() as $l) $r[$l['forma']] = ['total' => (int)$l['total'], 'qtd' => (int)$l['qtd']];
    $st = $pdo->prepare("SELECT s.forma_pagamento AS forma, SUM(s.total) AS total, COUNT(*) AS qtd FROM table_sessions s
        WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.session_id = s.id) GROUP BY s.forma_pagamento");
    $st->execute([$tid, $ini, $fim]);
    foreach ($st->fetchAll() as $l) {
        if (!in_array($l['forma'], FORMAS, true)) continue;
        $r[$l['forma']] = ['total' => ($r[$l['forma']]['total'] ?? 0) + (int)$l['total'], 'qtd' => ($r[$l['forma']]['qtd'] ?? 0) + (int)$l['qtd']];
    }
    $saida = [];
    foreach (FORMAS as $f) $saida[] = ['forma' => $f, 'total' => $r[$f]['total'] ?? 0, 'qtd' => $r[$f]['qtd'] ?? 0];
    return $saida;
}

function r_caixa(): never
{
    $u = equipe('dono', 'gerente', 'caixa');
    $t = tenant_atual($u);
    $tid = (int)$t['id'];
    $dia = (string)($_GET['dia'] ?? '');
    $per = periodo($t, $dia ? ['periodo' => 'personalizado', 'de' => $dia, 'ate' => $dia] : ['periodo' => 'hoje']);
    $fuso = $per['fuso'];
    $pdo = db();
    $st = $pdo->prepare("SELECT s.id, s.aberta_em, s.fechada_em, COALESCE(s.subtotal, s.total) AS subtotal, COALESCE(s.taxa, 0) AS taxa, s.total, COALESCE(s.pessoas, 1) AS pessoas, s.forma_pagamento, m.nome AS mesa, u.nome AS quem
        FROM table_sessions s LEFT JOIN tables m ON m.id = s.table_id LEFT JOIN users u ON u.id = s.fechada_por
        WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? ORDER BY s.fechada_em");
    $st->execute([$tid, $per['ini'], $per['fim']]);
    $contas = $st->fetchAll();
    $pg = $pdo->prepare('SELECT forma, valor FROM payments WHERE session_id = ? ORDER BY id');
    $soma = ['subtotal' => 0, 'taxa' => 0, 'total' => 0];
    foreach ($contas as &$c) {
        $pg->execute([$c['id']]);
        $c['pagamentos'] = $pg->fetchAll() ?: [['forma' => $c['forma_pagamento'], 'valor' => (int)$c['total']]];
        $c['hora'] = local($c['fechada_em'], $fuso)->format('H:i');
        foreach ($soma as $k => $v) $soma[$k] += (int)$c[$k];
        unset($c['id'], $c['forma_pagamento'], $c['aberta_em'], $c['fechada_em']);
    }
    unset($c);
    $canc = $pdo->prepare("SELECT COUNT(*), COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = ? AND status = 'cancelado' AND created_at >= ? AND created_at < ?");
    $canc->execute([$tid, $per['ini'], $per['fim']]);
    [$qCanc, $vCanc] = $canc->fetch(PDO::FETCH_NUM);
    $abertas = $pdo->prepare("SELECT id FROM table_sessions WHERE tenant_id = ? AND status IN ('aberta','conta_solicitada')");
    $abertas->execute([$tid]);
    $valorAberto = 0;
    $ids = $abertas->fetchAll(PDO::FETCH_COLUMN);
    foreach ($ids as $sid) $valorAberto += total_sessao($tid, $sid);
    responder([
        'estabelecimento' => $t['nome'], 'dia' => $per['de'], 'gerado_em' => (new DateTimeImmutable('now', $fuso))->format('d/m/Y H:i'),
        'contas' => $contas, 'totais' => $soma + ['contas' => count($contas)],
        'formas' => formas_pagamento($tid, $per['ini'], $per['fim']),
        'cancelados' => ['qtd' => (int)$qCanc, 'total' => (int)$vCanc],
        'em_aberto' => ['contas' => count($ids), 'total' => $valorAberto],
    ]);
}
