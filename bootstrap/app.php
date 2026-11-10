<?php

use App\Http\Middleware\AutenticarTablet;
use App\Http\Middleware\CabecalhosSeguranca;
use App\Http\Middleware\ExigirPapel;
use App\Http\Middleware\ProtegerApi;
use App\Http\Middleware\TarefasDiarias;
use App\Services\MonitorErros;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Session\Middleware\StartSession;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        apiPrefix: 'api',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->trustProxies(at: '*');
        $middleware->append(CabecalhosSeguranca::class);
        $middleware->web(append: [\App\Http\Middleware\ManterConectado::class]);
        $middleware->api(prepend: [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            \App\Http\Middleware\ManterConectado::class,
            ProtegerApi::class,
            TarefasDiarias::class,
        ]);
        $middleware->alias([
            'papel' => ExigirPapel::class,
            'tablet' => AutenticarTablet::class,
        ]);
        $middleware->remove([
            \Illuminate\Foundation\Http\Middleware\ConvertEmptyStringsToNull::class,
            \Illuminate\Foundation\Http\Middleware\TrimStrings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->dontReport([HttpExceptionInterface::class]);
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }
            if ($e instanceof HttpExceptionInterface) {
                $msg = $e->getMessage();
                if ($msg === '' || $e->getStatusCode() === 404 && str_starts_with($msg, 'The route')) {
                    $msg = $e->getStatusCode() === 404 ? 'Rota não encontrada.' : 'Não foi possível concluir.';
                }
                if ($e->getStatusCode() === 405) {
                    $msg = 'Rota não encontrada.';
                }

                return response()->json(['erro' => $msg], $e->getStatusCode(), ['Cache-Control' => 'no-store']);
            }
            try {
                if (\Illuminate\Support\Facades\DB::transactionLevel() > 0) {
                    \Illuminate\Support\Facades\DB::rollBack(0);
                }
            } catch (Throwable) {
            }
            MonitorErros::registrar('servidor', get_class($e).': '.$e->getMessage(), $e->getFile().':'.$e->getLine()."\n".$e->getTraceAsString(), $request->method().' '.$request->path());

            return response()->json(['erro' => 'Algo deu errado. Tente de novo em instantes.'], 500);
        });
    })->create();
