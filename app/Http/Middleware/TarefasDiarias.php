<?php

namespace App\Http\Middleware;

use App\Services\Tarefas;
use Closure;
use Illuminate\Http\Request;

class TarefasDiarias
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('GET')) {
            Tarefas::rodarSePreciso();
        }

        return $next($request);
    }
}
