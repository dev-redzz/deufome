<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/** Consultas de mesas, sessões e pedidos usadas por tablet, salão e caixa. */
class Atendimento
{
    public const STATUS_PEDIDO = ['recebido', 'preparo', 'pronto', 'entregue', 'cancelado'];

    public const FORMAS = ['pix', 'dinheiro', 'credito', 'debito'];

    public const ONLINE_SEGUNDOS = 90;

    public static function sessaoAberta(int $tenantId, int $tableId): ?array
    {
        return DB::selectOne("SELECT * FROM table_sessions WHERE tenant_id = ? AND table_id = ? AND status IN ('aberta','conta_solicitada')", [$tenantId, $tableId]);
    }

    public static function sessaoDoTenant(int $tenantId, string $id): array
    {
        return DB::selectOne('SELECT * FROM table_sessions WHERE id = ? AND tenant_id = ?', [$id, $tenantId]) ?? erro(404, 'Sessão não encontrada.');
    }

    public static function pedidosDaSessao(int $tenantId, string $sessaoId): array
    {
        $pedidos = DB::select('SELECT id, numero, status, total, origem, created_at, updated_at FROM orders WHERE tenant_id = ? AND session_id = ? ORDER BY id', [$tenantId, $sessaoId]);
        foreach ($pedidos as &$p) {
            $p['itens'] = array_map(function ($i) {
                $i['adicionais'] = json_decode($i['adicionais'], true);

                return $i;
            }, DB::select('SELECT nome, product_id, preco_unit, quantidade, adicionais, observacao, subtotal, setor FROM order_items WHERE order_id = ? ORDER BY id', [$p['id']]));
        }

        return $pedidos;
    }

    public static function totalSessao(int $tenantId, string $sessaoId): int
    {
        return (int) DB::scalar("SELECT COALESCE(SUM(total),0) FROM orders WHERE tenant_id = ? AND session_id = ? AND status <> 'cancelado'", [$tenantId, $sessaoId]);
    }

    /** Valores da conta: subtotal, taxa de serviço, desconto do cupom, gorjeta e total. */
    public static function conta(array $tenant, array $sessao, bool $cobrarTaxa = true): array
    {
        $tid = (int) $tenant['id'];
        $subtotal = self::totalSessao($tid, $sessao['id']);
        $pct = max(0, min(30, (int) $tenant['taxa_servico']));
        $taxa = $cobrarTaxa && $pct > 0 ? (int) round($subtotal * $pct / 100) : 0;
        $desconto = 0;
        $cupom = null;
        if ($sessao['cupom_id'] ?? null) {
            $c = DB::selectOne('SELECT * FROM cupons WHERE id = ? AND tenant_id = ?', [$sessao['cupom_id'], $tid]);
            if ($c) {
                $desconto = Cupons::desconto($c, $subtotal);
                $cupom = ['codigo' => $c['codigo'], 'descricao' => Cupons::descricao($c), 'minimo' => (int) $c['minimo'], 'aplicado' => $desconto > 0];
            }
        }
        $base = max(0, $subtotal - $desconto);
        $gpct = (int) ($sessao['gorjeta_pct'] ?? 0);
        $gorjeta = $gpct > 0 ? (int) round($base * $gpct / 100) : 0;

        return [
            'subtotal' => $subtotal, 'taxa' => $taxa, 'taxa_pct' => $pct, 'desconto' => $desconto, 'cupom' => $cupom,
            'gorjeta' => $gorjeta, 'gorjeta_pct' => $gpct, 'pagar_com' => $sessao['pagar_com'] ?? null,
            'total' => $base + $taxa + $gorjeta,
        ];
    }

    public static function avaliacao(string $sessaoId): ?array
    {
        $a = DB::selectOne('SELECT nota, tags, comentario, created_at FROM avaliacoes WHERE session_id = ?', [$sessaoId]);
        if (! $a) {
            return null;
        }
        $a['tags'] = json_decode($a['tags'], true) ?: [];

        return $a;
    }

    public static function online(?string $visto): bool
    {
        return $visto !== null && (time() - strtotime($visto.' UTC')) <= self::ONLINE_SEGUNDOS;
    }

    public static function tenant(int $id): array
    {
        return DB::selectOne('SELECT * FROM tenants WHERE id = ?', [$id]) ?? erro(404, 'Estabelecimento não encontrado.');
    }
}
