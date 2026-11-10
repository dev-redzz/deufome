<?php

namespace App\Http\Controllers;

use App\Services\Atendimento;
use App\Services\Preferencias;
use Illuminate\Support\Facades\DB;

/** Avisos do sino no topo do painel. */
class AvisoController extends Controller
{
    public function listar()
    {
        $u = usuario();
        $avisos = [];
        if ($u['papel'] === 'plataforma') {
            $e = (int) DB::scalar('SELECT COUNT(*) FROM erros WHERE resolvido = 0');
            $s = (int) DB::scalar('SELECT COUNT(*) FROM sugestoes WHERE lida = 0');
            if ($e) {
                $avisos[] = ['tipo' => 'erro', 'texto' => $e === 1 ? '1 erro novo registrado' : "$e erros novos registrados", 'aba' => 'erros'];
            }
            if ($s) {
                $avisos[] = ['tipo' => 'sugestao', 'texto' => $s === 1 ? '1 sugestão nova' : "$s sugestões novas", 'aba' => 'sugestoes'];
            }
        } elseif ($u['tenant_id']) {
            $tid = (int) $u['tenant_id'];
            foreach (DB::select("SELECT c.tipo, c.created_at, m.nome AS mesa FROM service_calls c JOIN tables m ON m.id = c.table_id WHERE c.tenant_id = ? AND c.status = 'aberto' ORDER BY c.id", [$tid]) as $c) {
                $avisos[] = ['tipo' => $c['tipo'], 'texto' => $c['mesa'].($c['tipo'] === 'conta' ? ' pediu a conta' : ' chamou o garçom'), 'quando' => $c['created_at'], 'aba' => 'salao'];
            }
            if ($u['papel'] !== 'caixa') {
                $min = Preferencias::de(Atendimento::tenant($tid))['cozinha_atraso_min'];
                $n = (int) DB::scalar("SELECT COUNT(*) FROM orders WHERE tenant_id = ? AND status IN ('recebido','preparo') AND created_at < ?", [$tid, gmdate('Y-m-d H:i:s', time() - $min * 60)]);
                if ($n) {
                    $avisos[] = ['tipo' => 'atraso', 'texto' => $n === 1 ? "1 pedido atrasado na cozinha (mais de $min min)" : "$n pedidos atrasados na cozinha (mais de $min min)", 'aba' => 'inicio'];
                }
            }
        }

        return response()->json(['avisos' => $avisos]);
    }
}
