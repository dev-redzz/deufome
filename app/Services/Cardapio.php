<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Cardapio
{
    public static function versao(int $tenantId): string
    {
        $v = DB::scalar('SELECT
            (SELECT group_concat(id || ":" || category_id || ":" || preco || ":" || disponivel || ":" || ordem || ":" || COALESCE(imagem,"") || ":" || nome || ":" || descricao, "|") FROM products WHERE tenant_id = ?)
            || "#" || (SELECT group_concat(id || ":" || ordem || ":" || nome, "|") FROM categories WHERE tenant_id = ?)
            || "#" || (SELECT group_concat(id || ":" || product_id || ":" || preco || ":" || nome, "|") FROM product_options WHERE tenant_id = ?)
            || "#" || (SELECT COALESCE(logo,"") || COALESCE(capa,"") || preferencias || nome FROM tenants WHERE id = ?)', [$tenantId, $tenantId, $tenantId, $tenantId]);

        return substr(md5((string) $v), 0, 12);
    }

    public static function montar(int $tenantId): array
    {
        $categorias = DB::select('SELECT id, nome FROM categories WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
        $produtos = DB::select('SELECT id, category_id, nome, descricao, preco, imagem, disponivel FROM products WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
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
