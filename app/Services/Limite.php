<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Limite
{
    public static function contar(string $chave, int $maximo, int $segundos): void
    {
        $desde = gmdate('Y-m-d H:i:s', time() - $segundos);
        if ((int) DB::scalar('SELECT COUNT(*) FROM limites WHERE chave = ? AND created_at > ?', [$chave, $desde]) >= $maximo) {
            erro(429, 'Muitas tentativas. Espere um pouco e tente de novo.');
        }
        DB::insert('INSERT INTO limites (chave, created_at) VALUES (?,?)', [$chave, agora()]);
    }
}
