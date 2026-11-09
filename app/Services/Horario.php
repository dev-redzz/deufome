<?php

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use Throwable;

class Horario
{
    public const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

    public const FUSOS = [
        'America/Sao_Paulo' => 'Brasília, São Paulo, Nordeste', 'America/Fortaleza' => 'Maranhão, Ceará, Piauí',
        'America/Belem' => 'Pará, Amapá', 'America/Manaus' => 'Amazonas', 'America/Cuiaba' => 'Mato Grosso',
        'America/Campo_Grande' => 'Mato Grosso do Sul', 'America/Porto_Velho' => 'Rondônia', 'America/Boa_Vista' => 'Roraima',
        'America/Rio_Branco' => 'Acre', 'America/Noronha' => 'Fernando de Noronha',
    ];

    public static function fuso(array $tenant): DateTimeZone
    {
        try {
            return new DateTimeZone(($tenant['fuso'] ?? '') ?: 'America/Sao_Paulo');
        } catch (Throwable) {
            return new DateTimeZone('America/Sao_Paulo');
        }
    }

    public static function validar($h): array
    {
        if (! is_array($h)) {
            erro(422, 'Horário inválido.');
        }
        $dias = [];
        for ($d = 0; $d < 7; $d++) {
            $turnos = $h['dias'][$d] ?? $h['dias'][(string) $d] ?? [];
            if (! is_array($turnos) || count($turnos) > 3) {
                erro(422, 'Horário inválido.');
            }
            $limpos = [];
            foreach ($turnos as $t) {
                if (! is_array($t) || count($t) !== 2) {
                    erro(422, 'Horário inválido.');
                }
                $t = array_values($t);
                foreach ($t as $hora) {
                    if (! preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string) $hora)) {
                        erro(422, 'Use horários no formato 18:30.');
                    }
                }
                if ($t[0] === $t[1]) {
                    erro(422, 'O turno precisa ter início e fim diferentes.');
                }
                $limpos[] = [(string) $t[0], (string) $t[1]];
            }
            $dias[(string) $d] = $limpos;
        }

        return ['ativo' => ! empty($h['ativo']), 'dias' => $dias];
    }

    public static function padrao(): array
    {
        return ['ativo' => false, 'dias' => array_fill_keys(['0', '1', '2', '3', '4', '5', '6'], [['18:00', '23:00']])];
    }

    public static function situacao(array $tenant, ?int $agora = null): array
    {
        $h = json_decode((string) ($tenant['horarios'] ?? ''), true);
        if (! is_array($h) || empty($h['ativo'])) {
            return ['aberto' => true, 'controle' => false, 'proxima' => null];
        }
        $agoraDt = (new DateTimeImmutable('@'.($agora ?? time())))->setTimezone(self::fuso($tenant));
        $min = (int) $agoraDt->format('G') * 60 + (int) $agoraDt->format('i');
        $dia = (int) $agoraDt->format('w');
        $paraMin = fn (string $hm) => (int) substr($hm, 0, 2) * 60 + (int) substr($hm, 3, 2);
        $turnos = fn (int $d) => $h['dias'][(string) (($d + 7) % 7)] ?? [];
        foreach ($turnos($dia) as [$i, $f]) {
            $a = $paraMin($i);
            $b = $paraMin($f);
            if (($b > $a && $min >= $a && $min < $b) || ($b < $a && $min >= $a)) {
                return ['aberto' => true, 'controle' => true, 'proxima' => null];
            }
        }
        foreach ($turnos($dia - 1) as [$i, $f]) {
            if ($paraMin($f) < $paraMin($i) && $min < $paraMin($f)) {
                return ['aberto' => true, 'controle' => true, 'proxima' => null];
            }
        }
        for ($k = 0; $k < 8; $k++) {
            $lista = $turnos($dia + $k);
            usort($lista, fn ($x, $y) => strcmp($x[0], $y[0]));
            foreach ($lista as [$i]) {
                if ($k === 0 && $paraMin($i) <= $min) {
                    continue;
                }
                $quando = $k === 0 ? 'hoje' : ($k === 1 ? 'amanhã' : self::DIAS[($dia + $k) % 7]);
                $hh = (int) substr($i, 0, 2);
                $mm = substr($i, 3, 2);

                return ['aberto' => false, 'controle' => true, 'proxima' => "$quando às ".$hh.($mm === '00' ? 'h' : ":$mm")];
            }
        }

        return ['aberto' => false, 'controle' => true, 'proxima' => null];
    }
}
