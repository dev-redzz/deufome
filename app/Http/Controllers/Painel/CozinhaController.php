<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use App\Services\Cardapio;
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
                'adicionais' => array_column(json_decode($i['adicionais'], true) ?: [], 'nome'), 'observacao' => $i['observacao'], 'setor' => $i['setor'] ?: 'cozinha',
            ], DB::select('SELECT nome, quantidade, adicionais, observacao, setor FROM order_items WHERE order_id = ? ORDER BY id', [$p['id']]));
        }
        $pref = Preferencias::de(Atendimento::tenant($u['tenant_id']));

        return response()->json(['pedidos' => $pedidos, 'agora' => agora(), 'config' => [
            'atraso_min' => $pref['cozinha_atraso_min'], 'som' => $pref['cozinha_som'], 'rodape' => $pref['rodape_comanda'],
            'estabelecimento' => $u['estabelecimento'], 'setores' => Cardapio::SETORES,
        ]]);
    }

    /** Lista simples do cardápio para a cozinha marcar o que acabou. */
    public function produtos()
    {
        $tid = (int) usuario()['tenant_id'];

        return response()->json(['categorias' => array_map(fn ($c) => [
            'id' => $c['id'], 'nome' => $c['nome'],
            'produtos' => array_map(fn ($p) => ['id' => $p['id'], 'nome' => $p['nome'], 'disponivel' => $p['disponivel']], $c['produtos']),
        ], Cardapio::montar($tid))]);
    }

    public function disponivel(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $p = DB::selectOne('SELECT id, nome FROM products WHERE id = ? AND tenant_id = ?', [(int) $id, $tid]) ?? erro(404, 'Produto não encontrado.');
        $disp = ! empty(entrada()['disponivel']) ? 1 : 0;
        DB::update('UPDATE products SET disponivel = ? WHERE id = ?', [$disp, $p['id']]);
        Auditoria::registrar($tid, 'usuario:'.$u['id'], $disp ? 'produto.voltou' : 'produto.esgotado', (string) $p['id'], ['nome' => $p['nome']]);

        return response()->json(['ok' => true, 'disponivel' => (bool) $disp]);
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
