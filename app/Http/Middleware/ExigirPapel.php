<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Uso: ->middleware('papel') qualquer pessoa logada,
 *      ->middleware('papel:plataforma') só o administrador do Deu Fome,
 *      ->middleware('papel:dono,gerente') só essas funções de um restaurante.
 */
class ExigirPapel
{
    public function handle(Request $request, Closure $next, string ...$papeis)
    {
        $id = Auth::id();
        if (! $id) {
            erro(401, 'Faça login.');
        }
        $u = DB::selectOne('SELECT u.id, u.nome, u.email, u.papel, u.ativo, u.tenant_id, u.sessao_versao, u.ultimo_acesso, t.nome AS estabelecimento, t.status AS tenant_status
            FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.id = ?', [$id]);
        if (! $u || ! $u['ativo']) {
            erro(401, 'Faça login.');
        }
        $sv = $request->session()->get('sv');
        if ($sv === null) {
            $request->session()->put('sv', (int) $u['sessao_versao']);
        } elseif ((int) $sv !== (int) $u['sessao_versao']) {
            Auth::logout();
            $request->session()->invalidate();
            erro(401, 'Sua sessão foi encerrada. Entre de novo.');
        }
        if (! $u['ultimo_acesso'] || strtotime($u['ultimo_acesso'].' UTC') < time() - 300) {
            DB::update('UPDATE users SET ultimo_acesso = ? WHERE id = ?', [agora(), $u['id']]);
        }
        if ($u['tenant_id'] && $u['tenant_status'] !== 'ativo') {
            erro(403, 'Este estabelecimento está bloqueado. Fale com o suporte do Deu Fome.');
        }
        $u['id'] = (int) $u['id'];
        $u['tenant_id'] = $u['tenant_id'] === null ? null : (int) $u['tenant_id'];

        if ($papeis === ['plataforma']) {
            if ($u['papel'] !== 'plataforma') {
                erro(403, 'Área restrita ao administrador do Deu Fome.');
            }
        } elseif ($papeis) {
            if (! $u['tenant_id']) {
                erro(403, 'Entre com um usuário do estabelecimento.');
            }
            if (! in_array($u['papel'], $papeis, true)) {
                erro(403, 'Seu usuário não tem acesso a esta área.');
            }
        }
        $request->attributes->set('usuario', $u);

        return $next($request);
    }
}
