<?php

namespace App\Services;

/** Cria arquivos .zip sem depender da extensão zip do PHP. */
class Zip
{
    /** @param array<string, string> $arquivos nome => conteúdo */
    public static function criar(array $arquivos): string
    {
        $dados = '';
        $central = '';
        $n = 0;
        $d = getdate();
        $hora = ($d['hours'] << 11) | ($d['minutes'] << 5) | intdiv($d['seconds'], 2);
        $data = (($d['year'] - 1980) << 9) | ($d['mon'] << 5) | $d['mday'];
        foreach ($arquivos as $nome => $conteudo) {
            $comprimido = gzdeflate($conteudo, 6);
            $crc = crc32($conteudo);
            $nome = (string) $nome;
            $local = pack('VvvvvvVVVvv', 0x04034B50, 20, 0x0800, 8, $hora, $data, $crc, strlen($comprimido), strlen($conteudo), strlen($nome), 0).$nome;
            $deslocamento = strlen($dados);
            $dados .= $local.$comprimido;
            $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014B50, 20, 20, 0x0800, 8, $hora, $data, $crc, strlen($comprimido), strlen($conteudo), strlen($nome), 0, 0, 0, 0, 0, $deslocamento).$nome;
            $n++;
        }

        return $dados.$central.pack('VvvvvVVv', 0x06054B50, 0, 0, $n, $n, strlen($central), strlen($dados), 0);
    }
}
