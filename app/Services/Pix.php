<?php

namespace App\Services;

/** Gera o "Pix copia e cola" (BR Code estático) com valor, a partir da chave do restaurante. */
class Pix
{
    private static function campo(string $id, string $valor): string
    {
        return $id.str_pad((string) strlen($valor), 2, '0', STR_PAD_LEFT).$valor;
    }

    private static function limpar(string $s, int $max): string
    {
        $s = strtr($s, ['á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'ä' => 'a', 'é' => 'e', 'ê' => 'e', 'è' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ü' => 'u', 'ç' => 'c',
            'Á' => 'A', 'À' => 'A', 'Â' => 'A', 'Ã' => 'A', 'É' => 'E', 'Ê' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ô' => 'O', 'Õ' => 'O', 'Ú' => 'U', 'Ç' => 'C']);
        $s = preg_replace('/[^A-Za-z0-9 .\-]/', '', $s);

        return strtoupper(substr(trim($s), 0, $max));
    }

    public static function crc16(string $dados): string
    {
        $crc = 0xFFFF;
        for ($i = 0, $n = strlen($dados); $i < $n; $i++) {
            $crc ^= ord($dados[$i]) << 8;
            for ($b = 0; $b < 8; $b++) {
                $crc = ($crc & 0x8000) ? (($crc << 1) ^ 0x1021) : ($crc << 1);
                $crc &= 0xFFFF;
            }
        }

        return strtoupper(str_pad(dechex($crc), 4, '0', STR_PAD_LEFT));
    }

    public static function copiaECola(string $chave, string $nome, string $cidade, int $centavos, string $txid = '***'): string
    {
        $chave = trim($chave);
        if (preg_match('/^\(?\d{2}\)?\s?9?\d{4}-?\d{4}$/', $chave)) {
            $chave = '+55'.preg_replace('/\D/', '', $chave);
        } elseif (preg_match('/^[\d.\-\/]+$/', $chave)) {
            $chave = preg_replace('/\D/', '', $chave);
        }
        $txid = preg_replace('/[^A-Za-z0-9]/', '', $txid) ?: '***';
        $p = self::campo('00', '01')
            .self::campo('26', self::campo('00', 'br.gov.bcb.pix').self::campo('01', $chave))
            .self::campo('52', '0000').self::campo('53', '986')
            .($centavos > 0 ? self::campo('54', number_format($centavos / 100, 2, '.', '')) : '')
            .self::campo('58', 'BR').self::campo('59', self::limpar($nome, 25) ?: 'RESTAURANTE').self::campo('60', self::limpar($cidade, 15) ?: 'BRASIL')
            .self::campo('62', self::campo('05', substr($txid, 0, 25))).'6304';

        return $p.self::crc16($p);
    }
}
