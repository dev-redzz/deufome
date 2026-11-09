<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Horario;
use App\Services\Preferencias;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

/** Resumo do dia para a tela "Início" do restaurante. */
class InicioController extends Controller
{
    public function resumo()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $t = Atendimento::tenant($tid);
        $fuso = Horario::fuso($t);
        $utc = new DateTimeZone('UTC');
        $hoje = new DateTimeImmutable('today', $fuso);
        $f = fn (DateTimeImmutable $d) => $d->setTimezone($utc)->format('Y-m-d H:i:s');
        [$iniHoje, $fimHoje, $iniOntem] = [$f($hoje), $f($hoje->modify('+1 day')), $f($hoje->modify('-1 day'))];
        $agoraOntem = $f((new DateTimeImmutable('now', $fuso))->modify('-1 day'));

        $vendas = fn (string $de, string $ate) => DB::selectOne("SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS contas FROM table_sessions
            WHERE tenant_id = ? AND status = 'fechada' AND fechada_em >= ? AND fechada_em < ?", [$tid, $de, $ate]);
        $h = $vendas($iniHoje, $fimHoje);
        $o = $vendas($iniOntem, $agoraOntem);

        $pedidosHoje = (int) DB::scalar("SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND status <> 'cancelado' AND created_at >= ?", [$tid, $iniHoje]);
        $abertas = DB::select("SELECT id FROM table_sessions WHERE tenant_id = ? AND status IN ('aberta','conta_solicitada')", [$tid]);
        $emAberto = 0;
        foreach ($abertas as $s) {
            $emAberto += Atendimento::totalSessao($tid, $s['id']);
        }
        $mesas = (int) DB::scalar('SELECT COUNT(*) FROM tables WHERE tenant_id = ? AND ativo = 1', [$tid]);

        $atraso = Preferencias::de($t)['cozinha_atraso_min'];
        $cozinha = ['recebido' => 0, 'preparo' => 0, 'pronto' => 0, 'atrasados' => 0];
        foreach (DB::select("SELECT status, created_at FROM orders WHERE tenant_id = ? AND status IN ('recebido','preparo','pronto')", [$tid]) as $p) {
            $cozinha[$p['status']]++;
            if ($p['status'] !== 'pronto' && strtotime($p['created_at'].' UTC') < time() - $atraso * 60) {
                $cozinha['atrasados']++;
            }
        }

        $porHora = array_fill(0, 24, 0);
        foreach (DB::select("SELECT created_at FROM orders WHERE tenant_id = ? AND status <> 'cancelado' AND created_at >= ?", [$tid, $iniHoje]) as $p) {
            $porHora[(int) (new DateTimeImmutable($p['created_at'], $utc))->setTimezone($fuso)->format('G')]++;
        }

        $av = DB::selectOne('SELECT AVG(nota) AS media, COUNT(*) AS total FROM avaliacoes WHERE tenant_id = ? AND created_at >= ?', [$tid, gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $tablets = DB::select("SELECT last_seen_at FROM devices WHERE tenant_id = ? AND status = 'ativo'", [$tid]);
        $online = count(array_filter($tablets, fn ($d) => Atendimento::online($d['last_seen_at'])));

        $ultimos = DB::select("SELECT o.numero, o.status, o.total, o.created_at, m.nome AS mesa FROM orders o JOIN tables m ON m.id = o.table_id
            WHERE o.tenant_id = ? ORDER BY o.id DESC LIMIT 6", [$tid]);
        $chamados = (int) DB::scalar("SELECT COUNT(*) FROM service_calls WHERE tenant_id = ? AND status = 'aberto'", [$tid]);

        return response()->json([
            'estabelecimento' => $t['nome'],
            'hoje' => [
                'vendas' => (int) $h['total'], 'contas' => (int) $h['contas'], 'pedidos' => $pedidosHoje,
                'ticket_medio' => $h['contas'] ? (int) round($h['total'] / $h['contas']) : 0,
                'ontem_mesma_hora' => (int) $o['total'],
            ],
            'salao' => ['mesas' => $mesas, 'ocupadas' => count($abertas), 'em_aberto' => $emAberto, 'chamados' => $chamados],
            'cozinha' => $cozinha + ['atraso_min' => $atraso],
            'tablets' => ['ativos' => count($tablets), 'online' => $online],
            'avaliacao' => ['media' => $av['total'] ? round((float) $av['media'], 1) : null, 'total' => (int) $av['total']],
            'por_hora' => $porHora,
            'ultimos' => $ultimos,
            'horario' => Horario::situacao($t),
            'inicio' => [
                'mesas' => $mesas,
                'produtos' => (int) DB::scalar('SELECT COUNT(*) FROM products WHERE tenant_id = ?', [$tid]),
                'tablets' => count($tablets),
                'pin' => (bool) $t['pin_gerente_hash'],
                'personalizado' => $t['logo'] !== null || $t['preferencias'] !== '{}',
            ],
            'saudacao' => explode(' ', trim($u['nome']))[0],
        ]);
    }
}
