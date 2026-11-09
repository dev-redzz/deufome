<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CabecalhosSeguranca
{
    public function handle(Request $request, Closure $next)
    {
        $r = $next($request);
        $r->headers->set('X-Content-Type-Options', 'nosniff');
        $r->headers->set('Referrer-Policy', 'same-origin');
        if ($request->isSecure()) {
            $r->headers->set('Strict-Transport-Security', 'max-age=31536000');
        }
        if (str_contains((string) $r->headers->get('Content-Type'), 'text/html')) {
            $r->headers->set('X-Frame-Options', 'DENY');
            $r->headers->set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com");
            if (! $r->headers->has('Cache-Control') || str_contains((string) $r->headers->get('Cache-Control'), 'private')) {
                $r->headers->set('Cache-Control', 'no-cache');
            }
        }

        return $r;
    }
}
