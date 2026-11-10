<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Sem "Manter conectado", a sessão termina quando o navegador fecha. */
class ManterConectado
{
    public function handle(Request $request, Closure $next)
    {
        $resposta = $next($request);
        if ($request->hasSession()) {
            config(['session.expire_on_close' => ! $request->session()->get('lembrar', true)]);
        }

        return $resposta;
    }
}
