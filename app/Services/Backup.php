<?php

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

class Backup
{
    public static function copiaDoBanco(string $destino): void
    {
        DB::statement('VACUUM INTO '.DB::getPdo()->quote($destino));
    }

    public static function fazer(bool $enviar): array
    {
        $pasta = pasta_dados('backups');
        $nome = 'deufome-'.gmdate('Y-m-d-His').'.sqlite';
        $arq = $pasta.'/'.$nome;
        self::copiaDoBanco($arq);
        $zip = Zip::criar([$nome => (string) file_get_contents($arq)]);
        file_put_contents($arq.'.zip', $zip);
        @unlink($arq);
        $antigos = glob($pasta.'/deufome-*.sqlite.zip') ?: [];
        rsort($antigos);
        foreach (array_slice($antigos, 7) as $velho) {
            @unlink($velho);
        }
        $enviado = false;
        $para = variavel('PLATAFORMA_EMAIL');
        if ($enviar && $para) {
            $enviado = Email::enviar($para, '[Deu Fome] Backup de '.(new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('d/m/Y'),
                Email::modelo('Backup diário', '<p>Em anexo está a cópia completa do banco de dados do Deu Fome.</p><p style="color:#6B6478;font-size:13px">Guarde este arquivo fora do Railway. As fotos ficam na pasta <b>uploads</b> do volume.</p>'),
                [['nome' => $nome.'.zip', 'conteudo' => $zip]]);
        }
        $info = ['arquivo' => $nome.'.zip', 'bytes' => strlen($zip), 'email' => $enviado];
        Tarefas::marcar('backup', json_encode($info));

        return $info;
    }

    /** @return array<int, array{nome: string, bytes: int}> */
    public static function locais(): array
    {
        $lista = [];
        foreach (glob(pasta_dados('backups').'/deufome-*.sqlite.zip') ?: [] as $f) {
            $lista[] = ['nome' => basename($f), 'bytes' => filesize($f)];
        }
        rsort($lista);

        return $lista;
    }
}
