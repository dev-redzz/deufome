<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/** Só aceita JSON (ou upload) nos POST e recusa POST vindo de outro site. */
class ProtegerApi
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('POST')) {
            $tipo = (string) $request->header('Content-Type', '');
            if (! str_starts_with($tipo, 'multipart/form-data') && ! str_starts_with($tipo, 'application/json')) {
                erro(415, 'Envie JSON.');
            }
            $origem = (string) $request->header('Origin', '');
            if ($origem !== '') {
                $host = parse_url($origem, PHP_URL_HOST).(parse_url($origem, PHP_URL_PORT) ? ':'.parse_url($origem, PHP_URL_PORT) : '');
                if (strcasecmp($host, $request->getHttpHost()) !== 0 && strcasecmp($host, (string) $request->server('HTTP_HOST')) !== 0) {
                    erro(403, 'Origem não permitida.');
                }
            }
        }
        $resposta = $next($request);
        $resposta->headers->set('Cache-Control', 'no-store');

        return $resposta;
    }
}
