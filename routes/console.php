<?php

use App\Services\Backup;
use App\Services\Estabelecimentos;
use App\Services\Tarefas;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

Artisan::command('deufome:preparar', function () {
    // Banco da versão 1.x (PHP puro, sem Laravel): guarda uma cópia e começa um banco novo.
    if (Schema::hasTable('tenants') && ! Schema::hasTable('migrations')) {
        $banco = config('database.connections.sqlite.database');
        DB::disconnect();
        $copia = preg_replace('/\.sqlite$/', '', $banco).'-versao-1-'.date('Y-m-d-His').'.sqlite';
        rename($banco, $copia);
        foreach (['-wal', '-shm'] as $x) {
            if (is_file($banco.$x)) {
                rename($banco.$x, $copia.$x);
            }
        }
        touch($banco);
        DB::reconnect();
        $this->warn('Banco da versão 1 guardado em '.basename($copia).'. Um banco novo foi criado.');
    }
    $this->call('migrate', ['--force' => true]);
    if (modo_demo() && ! DB::scalar('SELECT 1 FROM tenants LIMIT 1')) {
        $this->call('db:seed', ['--class' => DemoSeeder::class, '--force' => true]);
    }
    Estabelecimentos::garantirAdministrador();
    $s = Estabelecimentos::situacaoAdministrador();
    $this->info('Banco pronto. Administrador '.($s['administrador_criado'] ? 'ok' : 'ainda não criado (confira PLATAFORMA_EMAIL e PLATAFORMA_SENHA)').'.');
})->purpose('Atualiza o banco, cria os dados de demonstração (DEMO=1) e o administrador');

Artisan::command('deufome:backup', function () {
    $info = Backup::fazer(true);
    $this->info('Backup '.$info['arquivo'].' ('.round($info['bytes'] / 1024).' KB)'.($info['email'] ? ', enviado por e-mail' : ''));
})->purpose('Faz uma cópia do banco agora');

Artisan::command('deufome:tarefas', fn () => Tarefas::rodar())->purpose('Limpeza diária e backup');
