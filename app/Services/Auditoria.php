<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class Auditoria
{
    public static function registrar(?int $tenantId, string $ator, string $acao, ?string $alvo = null, array $dados = []): void
    {
        DB::insert('INSERT INTO audit_logs (tenant_id, ator, acao, alvo, dados, created_at) VALUES (?,?,?,?,?,?)', [
            $tenantId, $ator, $acao, $alvo, json_encode($dados, JSON_UNESCAPED_UNICODE), agora(),
        ]);
    }
}
