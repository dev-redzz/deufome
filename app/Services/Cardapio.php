<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Cardapio
{
    public static function versao(int $tenantId): string
    {
        $v = DB::scalar('SELECT
            (SELECT group_concat(id || ":" || category_id || ":" || preco || ":" || disponivel || ":" || COALESCE(selo,"") || ":" || tamanhos || ":" || meio_a_meio || ":" || sugestoes || ":" || ordem || ":" || COALESCE(imagem,"") || ":" || nome || ":" || descricao, "|") FROM products WHERE tenant_id = ?)
            || "#" || (SELECT group_concat(id || ":" || ordem || ":" || setor || ":" || nome, "|") FROM categories WHERE tenant_id = ?)
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

    public const SETORES = ['cozinha' => 'Cozinha', 'bar' => 'Bar'];

    public static function tamanhos(?string $json): array
    {
        $l = json_decode((string) $json, true);

        return is_array($l) ? array_values(array_map(fn ($t) => ['nome' => (string) $t['nome'], 'preco' => (int) $t['preco']], $l)) : [];
    }

    /**
     * "Combina com": para cada produto, até 3 sugestões de outras categorias.
     * Usa o que o dono escolheu; senão, o que mais sai junto nos pedidos; senão, bebidas e sobremesas.
     */
    public static function combina(int $tenantId, array $categorias): array
    {
        $catDe = $disp = $manual = [];
        foreach ($categorias as $c) {
            foreach ($c['produtos'] as $p) {
                $catDe[$p['id']] = $c['id'];
                if ($p['disponivel']) {
                    $disp[$p['id']] = $c['nome'];
                }
                $manual[$p['id']] = $p['sugestoes'];
            }
        }
        $juntos = [];
        foreach (DB::select("SELECT a.product_id AS a, b.product_id AS b, COUNT(*) AS n FROM order_items a JOIN order_items b ON b.order_id = a.order_id AND b.product_id <> a.product_id
            JOIN orders o ON o.id = a.order_id WHERE o.tenant_id = ? AND o.created_at >= ? AND a.product_id IS NOT NULL AND b.product_id IS NOT NULL
            GROUP BY a.product_id, b.product_id ORDER BY n DESC", [$tenantId, gmdate('Y-m-d H:i:s', time() - 60 * 86400)]) as $l) {
            $juntos[(int) $l['a']][] = (int) $l['b'];
        }
        $complementos = [];
        foreach ($disp as $id => $cat) {
            if (preg_match('/bebida|drink|suco|refri|sobremesa|doce|cerveja|vinho/iu', $cat)) {
                $complementos[] = $id;
            }
        }
        $r = [];
        foreach ($catDe as $id => $cat) {
            $lista = [];
            foreach (array_merge($manual[$id], $juntos[$id] ?? [], $complementos) as $s) {
                if ($s !== $id && isset($disp[$s]) && ($catDe[$s] ?? 0) !== $cat && ! in_array($s, $lista, true)) {
                    $lista[] = $s;
                }
                if (count($lista) >= 3) {
                    break;
                }
            }
            if ($lista) {
                $r[$id] = $lista;
            }
        }

        return $r;
    }

    public static function montar(int $tenantId): array
    {
        $categorias = DB::select('SELECT id, nome, setor FROM categories WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
        $produtos = DB::select('SELECT id, category_id, nome, descricao, preco, imagem, disponivel, selo, tamanhos, meio_a_meio, sugestoes FROM products WHERE tenant_id = ? ORDER BY ordem, id', [$tenantId]);
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
                $p['tamanhos'] = self::tamanhos($p['tamanhos']);
                $p['meio_a_meio'] = (bool) $p['meio_a_meio'];
                $p['sugestoes'] = array_values(array_map('intval', json_decode((string) $p['sugestoes'], true) ?: []));
                unset($p['category_id']);
                $c['produtos'][] = $p;
            }
        }

        return $categorias;
    }
}
