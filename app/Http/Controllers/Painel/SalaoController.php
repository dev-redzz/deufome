<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use App\Services\Preferencias;
use Illuminate\Support\Facades\DB;

class SalaoController extends Controller
{
    public function mesas()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $lista = DB::select('SELECT id, numero, nome FROM tables WHERE tenant_id = ? AND ativo = 1 ORDER BY numero', [$tid]);
        foreach ($lista as &$m) {
            $s = Atendimento::sessaoAberta($tid, (int) $m['id']);
            $m['sessao'] = $s ? ['id' => $s['id'], 'status' => $s['status'], 'aberta_em' => $s['aberta_em'], 'total' => Atendimento::totalSessao($tid, $s['id'])] : null;
            $d = DB::selectOne("SELECT id, nome, status, last_seen_at FROM devices WHERE tenant_id = ? AND table_id = ? AND status <> 'bloqueado'", [$tid, $m['id']]);
            $m['tablet'] = $d ? ['nome' => $d['nome'], 'online' => Atendimento::online($d['last_seen_at']), 'status' => $d['status']] : null;
            $m['chamados'] = DB::select("SELECT id, tipo, created_at FROM service_calls WHERE tenant_id = ? AND table_id = ? AND status = 'aberto' ORDER BY id", [$tid, $m['id']]);
        }
        $t = Atendimento::tenant($tid);
        $inicio = [
            'mesas' => (int) DB::scalar('SELECT COUNT(*) FROM tables WHERE tenant_id = ? AND ativo = 1', [$tid]),
            'produtos' => (int) DB::scalar('SELECT COUNT(*) FROM products WHERE tenant_id = ?', [$tid]),
            'tablets' => (int) DB::scalar("SELECT COUNT(*) FROM devices WHERE tenant_id = ? AND status = 'ativo'", [$tid]),
            'pin' => (bool) $t['pin_gerente_hash'],
        ];

        return response()->json(['mesas' => $lista, 'agora' => agora(), 'inicio' => $inicio]);
    }

    public function sessao(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $s = Atendimento::sessaoDoTenant($tid, $id);
        $t = Atendimento::tenant($tid);
        $pref = Preferencias::de($t);

        return response()->json([
            'sessao' => $s, 'mesa' => DB::scalar('SELECT nome FROM tables WHERE id = ?', [$s['table_id']]), 'estabelecimento' => $t['nome'],
            'pedidos' => Atendimento::pedidosDaSessao($tid, $id), 'total' => Atendimento::totalSessao($tid, $id),
            'taxa_servico' => (int) $t['taxa_servico'],
            'pagamentos' => DB::select('SELECT forma, valor, created_at FROM payments WHERE session_id = ? ORDER BY id', [$id]),
            'avaliacao' => Atendimento::avaliacao($id),
            'impressao' => ['rodape' => $pref['rodape_comanda'], 'telefone' => $pref['telefone'], 'endereco' => $pref['endereco'], 'instagram' => $pref['instagram']],
        ]);
    }

    public function fechar(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $t = Atendimento::tenant($tid);
        $in = entrada();
        $r = DB::transaction(function () use ($tid, $t, $in, $id, $u) {
            $s = Atendimento::sessaoDoTenant($tid, $id);
            if (! in_array($s['status'], ['aberta', 'conta_solicitada'], true)) {
                erro(409, 'Esta conta já foi fechada.');
            }
            $subtotal = Atendimento::totalSessao($tid, $id);
            $pct = max(0, min(30, (int) $t['taxa_servico']));
            $taxa = ! empty($in['cobrar_taxa']) && $pct > 0 ? (int) round($subtotal * $pct / 100) : 0;
            $total = $subtotal + $taxa;
            $pessoas = max(1, min(50, (int) ($in['pessoas'] ?? 1)));
            $pagamentos = $in['pagamentos'] ?? null;
            if ($pagamentos === null && isset($in['forma'])) {
                $pagamentos = [['forma' => $in['forma'], 'valor' => $total]];
            }
            if (! is_array($pagamentos) || ! $pagamentos) {
                erro(422, 'Informe como a conta foi paga.');
            }
            if (count($pagamentos) > 50) {
                erro(422, 'Pagamentos demais.');
            }
            $soma = 0;
            $limpos = [];
            foreach ($pagamentos as $p) {
                $forma = (string) ($p['forma'] ?? '');
                if (! in_array($forma, Atendimento::FORMAS, true)) {
                    erro(422, 'Escolha a forma de cada pagamento.');
                }
                $valor = (int) ($p['valor'] ?? 0);
                if ($valor <= 0) {
                    erro(422, 'Cada pagamento precisa ter um valor.');
                }
                $soma += $valor;
                $limpos[] = [$forma, $valor];
            }
            if ($soma !== $total) {
                erro(422, 'Os pagamentos somam '.reais($soma).', mas a conta é '.reais($total).'.');
            }
            $porForma = [];
            foreach ($limpos as [$f, $v]) {
                $porForma[$f] = ($porForma[$f] ?? 0) + $v;
            }
            arsort($porForma);
            foreach ($limpos as [$forma, $valor]) {
                DB::insert('INSERT INTO payments (tenant_id, session_id, forma, valor, registrado_por, created_at) VALUES (?,?,?,?,?,?)', [$tid, $id, $forma, $valor, $u['id'], agora()]);
            }
            DB::update("UPDATE table_sessions SET status = 'fechada', fechada_em = ?, fechada_por = ?, forma_pagamento = ?, subtotal = ?, taxa = ?, total = ?, pessoas = ? WHERE id = ?",
                [agora(), $u['id'], count($porForma) > 1 ? 'dividido' : array_key_first($porForma), $subtotal, $taxa, $total, $pessoas, $id]);
            DB::update("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE tenant_id = ? AND (session_id = ? OR (table_id = ? AND status = 'aberto'))", [agora(), $tid, $id, $s['table_id']]);
            DB::update("UPDATE orders SET status = 'entregue', updated_at = ?, entregue_em = COALESCE(entregue_em, ?) WHERE session_id = ? AND status IN ('recebido','preparo','pronto')", [agora(), agora(), $id]);

            return compact('subtotal', 'taxa', 'total', 'limpos');
        });
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'sessao.fechada', $id, ['total' => $r['total'], 'taxa' => $r['taxa'], 'pagamentos' => $r['limpos']]);

        return response()->json(['ok' => true, 'subtotal' => $r['subtotal'], 'taxa' => $r['taxa'], 'total' => $r['total']]);
    }

    public function reabrir(string $id)
    {
        $u = usuario();
        $s = Atendimento::sessaoDoTenant((int) $u['tenant_id'], $id);
        if ($s['status'] !== 'conta_solicitada') {
            erro(409, 'Só é possível reabrir uma conta solicitada.');
        }
        DB::update("UPDATE table_sessions SET status = 'aberta', conta_em = NULL WHERE id = ?", [$id]);
        DB::update("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE session_id = ? AND tipo = 'conta' AND status = 'aberto'", [agora(), $id]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'sessao.reaberta', $id);

        return response()->json(['ok' => true]);
    }

    public function cancelarPedido(string $id)
    {
        $u = usuario();
        $motivo = trim((string) (entrada()['motivo'] ?? ''));
        if ($motivo === '') {
            erro(422, 'Informe o motivo.');
        }
        $o = DB::selectOne('SELECT o.id, s.status FROM orders o JOIN table_sessions s ON s.id = o.session_id WHERE o.id = ? AND o.tenant_id = ?', [(int) $id, $u['tenant_id']]) ?? erro(404, 'Pedido não encontrado.');
        if ($o['status'] === 'fechada') {
            erro(409, 'A conta desta mesa já foi fechada.');
        }
        DB::update("UPDATE orders SET status = 'cancelado', updated_at = ? WHERE id = ?", [agora(), (int) $id]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'pedido.cancelado', $id, ['motivo' => $motivo]);

        return response()->json(['ok' => true]);
    }

    public function atender(string $id)
    {
        $u = usuario();
        $n = DB::update("UPDATE service_calls SET status = 'atendido', atendido_em = ? WHERE id = ? AND tenant_id = ? AND tipo = 'garcom'", [agora(), (int) $id, $u['tenant_id']]);
        if (! $n) {
            erro(404, 'Chamado não encontrado.');
        }

        return response()->json(['ok' => true]);
    }
}
