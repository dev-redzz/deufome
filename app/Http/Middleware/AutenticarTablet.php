<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/** Identifica o tablet pela credencial que ele recebeu na ativação. */
class AutenticarTablet
{
    public function handle(Request $request, Closure $next)
    {
        $token = (string) $request->header('X-Device-Token', '');
        if (strlen($token) < 40) {
            erro(401, 'Dispositivo não ativado.');
        }
        $d = DB::selectOne('SELECT d.*, t.nome AS estabelecimento, t.status AS tenant_status, t.horarios, t.fuso, t.taxa_servico, t.logo, t.capa, t.preferencias,
                m.numero AS mesa_numero, m.nome AS mesa_nome
            FROM devices d JOIN tenants t ON t.id = d.tenant_id
            LEFT JOIN tables m ON m.id = d.table_id AND m.tenant_id = d.tenant_id AND m.ativo = 1
            WHERE d.token_hash = ?', [hash('sha256', $token)]);
        if (! $d) {
            erro(401, 'Dispositivo não ativado.');
        }
        if ($d['status'] === 'bloqueado') {
            erro(403, 'Dispositivo bloqueado.');
        }
        if ($d['status'] !== 'ativo') {
            erro(401, 'Dispositivo não ativado.');
        }
        if ($d['tenant_status'] !== 'ativo') {
            erro(403, 'Estabelecimento bloqueado.');
        }
        if (! $d['mesa_numero']) {
            $d['table_id'] = null;
        }
        $ip = ip_cliente();
        $versao = substr((string) $request->header('X-App-Version', ''), 0, 20);
        if (! $d['last_seen_at'] || time() - strtotime($d['last_seen_at'].' UTC') >= 20 || $d['ip'] !== $ip || $d['app_version'] !== $versao) {
            DB::update('UPDATE devices SET last_seen_at = ?, ip = ?, app_version = ? WHERE id = ?', [agora(), $ip, $versao, $d['id']]);
        }
        $request->attributes->set('dispositivo', $d);

        return $next($request);
    }
}
