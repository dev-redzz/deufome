<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Preferencias;
use Illuminate\Support\Facades\DB;

class CozinhaController extends Controller
{
    public function pedidos()
    {
        $u = usuario();
        $pedidos = DB::select("SELECT o.id, o.numero, o.status, o.total, o.created_at, o.updated_at, m.numero AS mesa, m.nome AS mesa_nome
            FROM orders o JOIN tables m ON m.id = o.table_id
            WHERE o.tenant_id = ? AND o.status IN ('recebido','preparo','pronto') ORDER BY o.id", [$u['tenant_id']]);
        foreach ($pedidos as &$p) {
            $p['itens'] = array_map(fn ($i) => [
                'nome' => $i['nome'], 'quantidade' => (int) $i['quantidade'],
                'adicionais' => array_column(json_decode($i['adicionais'], true) ?: [], 'nome'), 'observacao' => $i['observacao'],
            ], DB::select('SELECT nome, quantidade, adicionais, observacao FROM order_items WHERE order_id = ? ORDER BY id', [$p['id']]));
        }
        $pref = Preferencias::de(Atendimento::tenant($u['tenant_id']));

        return response()->json(['pedidos' => $pedidos, 'agora' => agora(), 'config' => [
            'atraso_min' => $pref['cozinha_atraso_min'], 'som' => $pref['cozinha_som'], 'rodape' => $pref['rodape_comanda'],
            'estabelecimento' => $u['estabelecimento'],
        ]]);
    }

    public function status(string $id)
    {
        $u = usuario();
        $novo = (string) (entrada()['status'] ?? '');
        $permitidos = ['recebido' => ['preparo'], 'preparo' => ['pronto', 'recebido'], 'pronto' => ['entregue', 'preparo']];
        $atual = DB::scalar('SELECT status FROM orders WHERE id = ? AND tenant_id = ?', [(int) $id, $u['tenant_id']]) ?: erro(404, 'Pedido não encontrado.');
        if (! in_array($novo, $permitidos[$atual] ?? [], true)) {
            erro(409, 'Mudança de status não permitida.');
        }
        $marca = ['preparo' => 'preparo_em', 'pronto' => 'pronto_em', 'entregue' => 'entregue_em', 'recebido' => null][$novo];
        if ($marca) {
            DB::update("UPDATE orders SET status = ?, updated_at = ?, $marca = COALESCE($marca, ?) WHERE id = ?", [$novo, agora(), agora(), (int) $id]);
        } else {
            DB::update('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', [$novo, agora(), (int) $id]);
        }

        return response()->json(['ok' => true]);
    }
}
