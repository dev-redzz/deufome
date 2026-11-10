<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Throwable;

/** Tarefas diárias que rodam junto com as requisições (o Railway não tem cron neste plano). */
class Tarefas
{
    public static function vencida(string $nome, int $segundos): bool
    {
        $u = DB::scalar('SELECT ultima_em FROM tarefas WHERE nome = ?', [$nome]);

        return ! $u || strtotime($u.' UTC') <= time() - $segundos;
    }

    public static function marcar(string $nome, string $detalhe = ''): void
    {
        DB::insert('INSERT INTO tarefas (nome, ultima_em, detalhe) VALUES (?,?,?) ON CONFLICT(nome) DO UPDATE SET ultima_em = excluded.ultima_em, detalhe = excluded.detalhe', [$nome, agora(), $detalhe]);
    }

    public static function rodarSePreciso(): void
    {
        $marca = pasta_dados('.tarefas');
        if (is_file($marca) && filemtime($marca) > time() - 600) {
            return;
        }
        @touch($marca);
        $trava = @fopen(pasta_dados('.tarefas.lock'), 'c');
        if (! $trava || ! flock($trava, LOCK_EX | LOCK_NB)) {
            return;
        }
        try {
            self::rodar();
        } catch (Throwable $e) {
            MonitorErros::registrar('servidor', 'Tarefa diária falhou: '.$e->getMessage(), $e->getFile().':'.$e->getLine());
        } finally {
            flock($trava, LOCK_UN);
            fclose($trava);
        }
    }

    public static function rodar(): void
    {
        $ontem = gmdate('Y-m-d H:i:s', time() - 86400);
        DB::delete('DELETE FROM login_tentativas WHERE created_at < ?', [$ontem]);
        DB::delete('DELETE FROM limites WHERE created_at < ?', [$ontem]);
        DB::delete('DELETE FROM senha_tokens WHERE expira_em < ?', [$ontem]);
        if (self::vencida('backup', 23 * 3600)) {
            Backup::fazer(true);
        }
        ResumoSemanal::talvezEnviar();
    }
}
