<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Cardapio
{
    public static function versao(int $tenantId): string
    {
        $v = DB::scalar('SELECT
            (SELECT group_concat(id || ":" || category_id || ":" || preco || ":" || disponivel || ":" || COALESCE(selo,"") || ":" || ordem || ":" || COALESCE(imagem,"") || ":" || nome || ":" || descricao, "|") FROM products WHERE tenant_id = ?)
            || "#" || (SELECT group_concat(id || ":" || ordem || ":" || nome, "|") FROM categories WHERE tenant_id = ?)
            || "#" || (SELECT group_concat(id || ":" || product_id || ":" || preco || ":" || nome, "|") FROM product_options WHERE tenant_id = ?)
            || "#" || (SELECT COALESCE(logo,"") || COALESCE(capa,"") || preferencias || nome FROM tenants WHERE id = ?)', [$tenantId, $tenantId, $tenantId, $tenantId]);

        return substr(md5((string) $v), 0, 12);
    }

    public const SELOS = ['novo' => 'Novidade', 'promocao' => 'Promoção', 'chef' => 'Sugestão do chef', 'picante' => 'Picante', 'vegetariano' => 'Vegetariano'];

    /** Os mais pedidos dos últimos 30 dias (ids), para o tablet destacar. */
    public static function destaques(int $tenantId, int $limite = 3): array
    {
        return array_map('intval', array_column(DB::select("SELECT oi.product_id, SUM(oi.quantidade) AS q FROM order_items oi
            JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id AND p.tenant_id = o.tenant_id AND p.disponivel = 1
            WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? GROUP BY oi.product_id HAVING q >= 3 ORDER BY q DESC LIMIT ?",
            [$tenantId, gmdate('Y-m-d H:i:s', time() - 30 * 86400), $limite]), 'product_id'));
    }

    public static function montar(int $tenantId): array
    {
        $categorias = DB::select('SELECT id, nome FROM categories WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
        $produtos = DB::select('SELECT id, category_id, nome, descricao, preco, imagem, disponivel, selo FROM products WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
        $porProduto = [];
        foreach (DB::select('SELECT id, product_id, nome, preco FROM product_options WHERE tenant_id = ? ORDER BY id', [$tenantId]) as $o) {
            $porProduto[$o['product_id']][] = ['id' => $o['id'], 'nome' => $o['nome'], 'preco' => (int) $o['preco']];
        }
        foreach ($categorias as &$c) {
            $c['produtos'] = [];
            foreach ($produtos as $p) {
                if ($p['category_id'] != $c['id']) {
                    continue;
                }
                $p['preco'] = (int) $p['preco'];
                $p['disponivel'] = (bool) $p['disponivel'];
                $p['adicionais'] = $porProduto[$p['id']] ?? [];
                unset($p['category_id']);
                $c['produtos'][] = $p;
            }
        }

        return $categorias;
    }
}
