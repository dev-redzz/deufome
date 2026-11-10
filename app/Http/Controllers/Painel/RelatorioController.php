<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Horario;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RelatorioController extends Controller
{
    private static function periodo(array $t, array $in): array
    {
        $fuso = Horario::fuso($t);
        $hoje = new DateTimeImmutable('today', $fuso);
        $p = (string) ($in['periodo'] ?? '7d');
        $data = function ($v) use ($fuso) {
            return DateTimeImmutable::createFromFormat('!Y-m-d', (string) $v, $fuso) ?: erro(422, 'Data inválida.');
        };
        switch ($p) {
            case 'hoje': $de = $hoje; $ate = $hoje; break;
            case 'ontem': $de = $hoje->modify('-1 day'); $ate = $de; break;
            case '30d': $de = $hoje->modify('-29 days'); $ate = $hoje; break;
            case 'mes': $de = $hoje->modify('first day of this month'); $ate = $hoje; break;
            case 'mes_anterior': $de = $hoje->modify('first day of last month'); $ate = $hoje->modify('last day of last month'); break;
            case 'ano': $de = $hoje->setDate((int) $hoje->format('Y'), 1, 1); $ate = $hoje; break;
            case 'personalizado':
                $de = $data($in['de'] ?? '');
                $ate = $data($in['ate'] ?? '');
                if ($ate < $de) {
                    [$de, $ate] = [$ate, $de];
                }
                if ($de->diff($ate)->days > 366) {
                    erro(422, 'Escolha um período de até 1 ano.');
                }
                break;
            default: $p = '7d'; $de = $hoje->modify('-6 days'); $ate = $hoje;
        }
        $utc = new DateTimeZone('UTC');

        return [
            'periodo' => $p, 'de' => $de->format('Y-m-d'), 'ate' => $ate->format('Y-m-d'), 'fuso' => $fuso,
            'ini' => $de->setTimezone($utc)->format('Y-m-d H:i:s'),
            'fim' => $ate->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s'),
            'dias' => (int) $de->diff($ate)->days + 1, 'de_dt' => $de,
        ];
    }

    private static function local(string $utc, DateTimeZone $fuso): DateTimeImmutable
    {
        return (new DateTimeImmutable($utc, new DateTimeZone('UTC')))->setTimezone($fuso);
    }

    private static function formas(int $tid, string $ini, string $fim): array
    {
        $r = [];
        foreach (DB::select("SELECT p.forma, SUM(p.valor) AS total, COUNT(*) AS qtd FROM payments p JOIN table_sessions s ON s.id = p.session_id
            WHERE p.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? GROUP BY p.forma", [$tid, $ini, $fim]) as $l) {
            $r[$l['forma']] = ['total' => (int) $l['total'], 'qtd' => (int) $l['qtd']];
        }
        foreach (DB::select("SELECT s.forma_pagamento AS forma, SUM(s.total) AS total, COUNT(*) AS qtd FROM table_sessions s
            WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.session_id = s.id) GROUP BY s.forma_pagamento", [$tid, $ini, $fim]) as $l) {
            if (! in_array($l['forma'], Atendimento::FORMAS, true)) {
                continue;
            }
            $r[$l['forma']] = ['total' => ($r[$l['forma']]['total'] ?? 0) + (int) $l['total'], 'qtd' => ($r[$l['forma']]['qtd'] ?? 0) + (int) $l['qtd']];
        }
        $saida = [];
        foreach (Atendimento::FORMAS as $f) {
            $saida[] = ['forma' => $f, 'total' => $r[$f]['total'] ?? 0, 'qtd' => $r[$f]['qtd'] ?? 0];
        }

        return $saida;
    }

    public function relatorios(Request $request)
    {
        $t = Atendimento::tenant((int) usuario()['tenant_id']);
        $tid = (int) $t['id'];
        $per = self::periodo($t, $request->query());
        $fuso = $per['fuso'];
        $intervalo = [$tid, $per['ini'], $per['fim']];

        $contas = DB::select("SELECT s.id, s.table_id, s.aberta_em, s.fechada_em, COALESCE(s.subtotal, s.total) AS subtotal, COALESCE(s.taxa, 0) AS taxa, s.total, COALESCE(s.pessoas, 1) AS pessoas, s.forma_pagamento, s.desconto, s.gorjeta
            FROM table_sessions s WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ?", $intervalo);
        $porDia = [];
        for ($i = 0; $i < $per['dias']; $i++) {
            $d = $per['de_dt']->modify("+$i day")->format('Y-m-d');
            $porDia[$d] = ['dia' => $d, 'total' => 0, 'contas' => 0];
        }
        $faturado = $taxas = $pessoas = $permanencia = $descontos = $gorjetas = 0;
        $porMesa = [];
        foreach ($contas as $c) {
            $dia = self::local($c['fechada_em'], $fuso)->format('Y-m-d');
            if (isset($porDia[$dia])) {
                $porDia[$dia]['total'] += (int) $c['total'];
                $porDia[$dia]['contas']++;
            }
            $faturado += (int) $c['total'];
            $taxas += (int) $c['taxa'];
            $descontos += (int) $c['desconto'];
            $gorjetas += (int) $c['gorjeta'];
            $pessoas += max(1, (int) $c['pessoas']);
            $permanencia += max(0, strtotime($c['fechada_em'].' UTC') - strtotime($c['aberta_em'].' UTC'));
            $porMesa[$c['table_id']] = ['contas' => ($porMesa[$c['table_id']]['contas'] ?? 0) + 1, 'total' => ($porMesa[$c['table_id']]['total'] ?? 0) + (int) $c['total']];
        }
        $n = count($contas);

        $porHora = array_fill(0, 24, 0);
        $validos = $cancelados = 0;
        $tPreparo = $tEspera = [];
        foreach (DB::select('SELECT o.id, o.status, o.created_at, o.preparo_em, o.pronto_em FROM orders o WHERE o.tenant_id = ? AND o.created_at >= ? AND o.created_at < ?', $intervalo) as $o) {
            if ($o['status'] === 'cancelado') {
                $cancelados++;

                continue;
            }
            $validos++;
            $porHora[(int) self::local($o['created_at'], $fuso)->format('G')]++;
            if ($o['pronto_em']) {
                $tPreparo[] = (strtotime($o['pronto_em'].' UTC') - strtotime($o['created_at'].' UTC')) / 60;
            }
            if ($o['preparo_em']) {
                $tEspera[] = (strtotime($o['preparo_em'].' UTC') - strtotime($o['created_at'].' UTC')) / 60;
            }
        }
        $media = fn (array $l) => $l ? round(array_sum($l) / count($l), 1) : null;

        $produtos = DB::select("SELECT oi.nome, SUM(oi.quantidade) AS quantidade, SUM(oi.subtotal) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? AND o.created_at < ? GROUP BY oi.nome ORDER BY quantidade DESC, total DESC LIMIT 10", $intervalo);
        $itens = (int) DB::scalar("SELECT COALESCE(SUM(oi.quantidade), 0) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? AND o.created_at < ?", $intervalo);

        $nomesMesas = array_column(DB::select('SELECT id, nome FROM tables WHERE tenant_id = ?', [$tid]), 'nome', 'id');
        $mesas = [];
        foreach ($porMesa as $id => $v) {
            $mesas[] = ['mesa' => $nomesMesas[$id] ?? 'Mesa removida'] + $v;
        }
        usort($mesas, fn ($a, $b) => $b['total'] <=> $a['total']);

        $avs = DB::select('SELECT a.nota, a.tags, a.comentario, a.created_at, m.nome AS mesa FROM avaliacoes a LEFT JOIN tables m ON m.id = a.table_id
            WHERE a.tenant_id = ? AND a.created_at >= ? AND a.created_at < ? ORDER BY a.id DESC', $intervalo);
        $dist = array_fill(1, 5, 0);
        $tags = [];
        $soma = 0;
        $ultimas = [];
        foreach ($avs as $a) {
            $dist[(int) $a['nota']]++;
            $soma += (int) $a['nota'];
            $lt = json_decode($a['tags'], true) ?: [];
            foreach ($lt as $tg) {
                $tags[$tg] = ($tags[$tg] ?? 0) + 1;
            }
            if (count($ultimas) < 8 && ($a['comentario'] !== '' || $lt)) {
                $ultimas[] = ['nota' => (int) $a['nota'], 'tags' => $lt, 'comentario' => $a['comentario'], 'mesa' => $a['mesa'], 'quando' => self::local($a['created_at'], $fuso)->format('d/m H:i')];
            }
        }
        arsort($tags);

        $pratos = DB::select('SELECT nome, ROUND(AVG(nota), 1) AS media, COUNT(*) AS avaliacoes FROM avaliacoes_itens WHERE tenant_id = ? AND created_at >= ? AND created_at < ? GROUP BY nome ORDER BY media DESC, avaliacoes DESC', $intervalo);
        foreach ($pratos as &$pr) {
            $pr['media'] = (float) $pr['media'];
            $pr['avaliacoes'] = (int) $pr['avaliacoes'];
        }
        unset($pr);

        return response()->json([
            'periodo' => ['tipo' => $per['periodo'], 'de' => $per['de'], 'ate' => $per['ate']],
            'resumo' => [
                'faturado' => $faturado, 'taxas' => $taxas, 'descontos' => $descontos, 'gorjetas' => $gorjetas, 'contas' => $n, 'ticket_medio' => $n ? (int) round($faturado / $n) : 0,
                'por_pessoa' => $pessoas ? (int) round($faturado / $pessoas) : 0, 'pedidos' => $validos, 'cancelados' => $cancelados,
                'itens' => $itens, 'permanencia_min' => $n ? (int) round($permanencia / $n / 60) : null,
                'preparo_min' => $media($tPreparo), 'espera_min' => $media($tEspera),
            ],
            'por_dia' => array_values($porDia),
            'por_hora' => $porHora,
            'produtos' => $produtos,
            'formas' => self::formas($tid, $per['ini'], $per['fim']),
            'mesas' => array_slice($mesas, 0, 10),
            'pratos' => ['melhores' => array_slice($pratos, 0, 5), 'piores' => count($pratos) > 1 ? array_slice(array_reverse(array_filter($pratos, fn ($p) => $p['media'] < 4)), 0, 5) : []],
            'avaliacoes' => ['media' => count($avs) ? round($soma / count($avs), 1) : null, 'total' => count($avs), 'distribuicao' => $dist, 'tags' => (object) $tags, 'ultimas' => $ultimas],
        ]);
    }

    public function caixa(Request $request)
    {
        $t = Atendimento::tenant((int) usuario()['tenant_id']);
        $tid = (int) $t['id'];
        $dia = (string) $request->query('dia', '');
        $per = self::periodo($t, $dia ? ['periodo' => 'personalizado', 'de' => $dia, 'ate' => $dia] : ['periodo' => 'hoje']);
        $fuso = $per['fuso'];
        $contas = DB::select("SELECT s.id, s.aberta_em, s.fechada_em, COALESCE(s.subtotal, s.total) AS subtotal, COALESCE(s.taxa, 0) AS taxa, s.total, COALESCE(s.pessoas, 1) AS pessoas, s.forma_pagamento, m.nome AS mesa, u.nome AS quem
            FROM table_sessions s LEFT JOIN tables m ON m.id = s.table_id LEFT JOIN users u ON u.id = s.fechada_por
            WHERE s.tenant_id = ? AND s.status = 'fechada' AND s.fechada_em >= ? AND s.fechada_em < ? ORDER BY s.fechada_em", [$tid, $per['ini'], $per['fim']]);
        $soma = ['subtotal' => 0, 'taxa' => 0, 'total' => 0];
        foreach ($contas as &$c) {
            $c['pagamentos'] = DB::select('SELECT forma, valor FROM payments WHERE session_id = ? ORDER BY id', [$c['id']]) ?: [['forma' => $c['forma_pagamento'], 'valor' => (int) $c['total']]];
            $c['hora'] = self::local($c['fechada_em'], $fuso)->format('H:i');
            foreach ($soma as $k => $v) {
                $soma[$k] += (int) $c[$k];
            }
            unset($c['id'], $c['forma_pagamento'], $c['aberta_em'], $c['fechada_em']);
        }
        unset($c);
        $canc = DB::selectOne("SELECT COUNT(*) AS qtd, COALESCE(SUM(total), 0) AS total FROM orders WHERE tenant_id = ? AND status = 'cancelado' AND created_at >= ? AND created_at < ?", [$tid, $per['ini'], $per['fim']]);
        $ids = array_column(DB::select("SELECT id FROM table_sessions WHERE tenant_id = ? AND status IN ('aberta','conta_solicitada')", [$tid]), 'id');
        $valorAberto = 0;
        foreach ($ids as $sid) {
            $valorAberto += Atendimento::totalSessao($tid, $sid);
        }

        return response()->json([
            'estabelecimento' => $t['nome'], 'dia' => $per['de'], 'gerado_em' => (new DateTimeImmutable('now', $fuso))->format('d/m/Y H:i'),
            'contas' => $contas, 'totais' => $soma + ['contas' => count($contas)],
            'formas' => self::formas($tid, $per['ini'], $per['fim']),
            'cancelados' => ['qtd' => (int) $canc['qtd'], 'total' => (int) $canc['total']],
            'em_aberto' => ['contas' => count($ids), 'total' => $valorAberto],
        ]);
    }
}
