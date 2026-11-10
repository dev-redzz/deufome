<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Cupons
{
    public static function normalizar(string $codigo): string
    {
        return strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $codigo));
    }

    public static function descricao(array $c): string
    {
        $d = $c['tipo'] === 'percentual' ? $c['valor'].'% de desconto' : 'R$ '.reais((int) $c['valor']).' de desconto';

        return $d.((int) $c['minimo'] > 0 ? ' acima de R$ '.reais((int) $c['minimo']) : '');
    }

    public static function desconto(array $c, int $subtotal): int
    {
        if ($subtotal <= 0 || $subtotal < (int) $c['minimo']) {
            return 0;
        }
        $d = $c['tipo'] === 'percentual' ? (int) round($subtotal * (int) $c['valor'] / 100) : (int) $c['valor'];

        return min($d, $subtotal);
    }

    /** Encontra um cupom que pode ser usado agora, ou para com uma mensagem clara. */
    public static function validar(array $tenant, string $codigo, int $subtotal): array
    {
        $codigo = self::normalizar($codigo);
        if ($codigo === '') {
            erro(422, 'Digite o código do cupom.');
        }
        $c = DB::selectOne('SELECT * FROM cupons WHERE tenant_id = ? AND codigo = ?', [$tenant['id'], $codigo]);
        if (! $c || ! $c['ativo']) {
            erro(422, 'Cupom não encontrado. Confira o código.');
        }
        $hoje = (new \DateTimeImmutable('now', Horario::fuso($tenant)))->format('Y-m-d');
        if ($c['validade'] && $c['validade'] < $hoje) {
            erro(422, 'Este cupom venceu.');
        }
        if ($c['limite'] !== null && (int) $c['usos'] >= (int) $c['limite']) {
            erro(422, 'Este cupom já foi usado o máximo de vezes.');
        }
        if ($subtotal < (int) $c['minimo']) {
            erro(422, 'Este cupom vale para contas a partir de R$ '.reais((int) $c['minimo']).'.');
        }

        return $c;
    }
}
