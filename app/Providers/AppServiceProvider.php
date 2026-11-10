<?php

namespace App\Providers;

use Illuminate\Database\Events\StatementPrepared;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;
use PDO;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind('db.connector.sqlite', \App\Database\ConectorSqlite::class);

        $dados = pasta_dados();
        foreach (['', 'uploads', 'sessoes', 'cache', 'backups'] as $sub) {
            $p = $dados.($sub ? '/'.$sub : '');
            if (! is_dir($p)) {
                @mkdir($p, 0775, true);
            }
        }

        if (! config('app.key')) {
            $arq = $dados.'/.chave-app';
            if (! is_file($arq)) {
                @file_put_contents($arq, 'base64:'.base64_encode(random_bytes(32)), LOCK_EX);
                @chmod($arq, 0600);
            }
            config(['app.key' => trim((string) @file_get_contents($arq))]);
        }

        $banco = variavel('DB_DATABASE') ?: $dados.'/deufome.sqlite';
        if (! is_file($banco)) {
            @touch($banco);
        }
        config([
            'database.connections.sqlite.database' => $banco,
            'session.files' => $dados.'/sessoes',
            'cache.stores.file.path' => $dados.'/cache',
        ]);
    }

    public function boot(): void
    {
        Event::listen(StatementPrepared::class, function (StatementPrepared $e) {
            $e->statement->setFetchMode(PDO::FETCH_ASSOC);
        });

        if (! $this->app->runningInConsole()) {
            $seguro = request()->isSecure();
            config([
                'session.secure' => $seguro,
                'session.cookie' => $seguro ? '__Host-deufome' : 'deufome_sessao',
                'session.same_site' => 'lax',
                'session.http_only' => true,
                'session.lifetime' => 43200,
                'session.path' => '/',
                'session.domain' => null,
            ]);
        }
    }
}
