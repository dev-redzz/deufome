<?php

namespace App\Services;

/** O que cada restaurante pode personalizar no tablet, na cozinha e na comanda impressa. */
class Preferencias
{
    public const PADRAO = [
        'cor' => '#FF5A1F',
        'tema_tablet' => 'claro',
        'boas_vindas' => 'Toque na tela para ver o cardápio',
        'agradecimento' => 'Obrigado pela visita! Volte sempre.',
        'telefone' => '',
        'instagram' => '',
        'endereco' => '',
        'wifi_nome' => '',
        'wifi_senha' => '',
        'mostrar_fotos' => true,
        'mostrar_descricao' => true,
        'permitir_observacao' => true,
        'chamar_garcom' => true,
        'pedir_avaliacao' => true,
        'inatividade_min' => 3,
        'cozinha_atraso_min' => 15,
        'cozinha_som' => true,
        'rodape_comanda' => '',
    ];

    public const TEXTOS = [
        'boas_vindas' => 80, 'agradecimento' => 80, 'telefone' => 20, 'instagram' => 40, 'endereco' => 120,
        'wifi_nome' => 40, 'wifi_senha' => 40, 'rodape_comanda' => 160,
    ];

    public const CORES = ['#FF5A1F', '#E23B3B', '#D9467F', '#7C4DDB', '#2563EB', '#0E9F8E', '#2F9E44', '#B7791F', '#8B5E34', '#14215A'];

    public static function de(array $tenant): array
    {
        $p = json_decode((string) ($tenant['preferencias'] ?? '{}'), true);

        return array_merge(self::PADRAO, is_array($p) ? array_intersect_key($p, self::PADRAO) : []);
    }

    public static function validar(array $atual, array $in): array
    {
        $p = $atual;
        foreach ($in as $k => $v) {
            if (! array_key_exists($k, self::PADRAO)) {
                continue;
            }
            if (isset(self::TEXTOS[$k])) {
                $v = trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) $v)));
                if (mb_strlen($v) > self::TEXTOS[$k]) {
                    erro(422, 'Texto muito longo (até '.self::TEXTOS[$k].' letras).');
                }
                if ($k === 'instagram') {
                    $v = ltrim($v, '@');
                }
                $p[$k] = $v;
            } elseif (is_bool(self::PADRAO[$k])) {
                $p[$k] = (bool) $v;
            } elseif ($k === 'cor') {
                if (! preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $v)) {
                    erro(422, 'Cor inválida.');
                }
                $p[$k] = strtoupper((string) $v);
            } elseif ($k === 'tema_tablet') {
                if (! in_array($v, ['claro', 'escuro'], true)) {
                    erro(422, 'Tema inválido.');
                }
                $p[$k] = $v;
            } elseif ($k === 'inatividade_min') {
                $n = (int) $v;
                if ($n < 1 || $n > 15) {
                    erro(422, 'O tempo para voltar ao início deve ser de 1 a 15 minutos.');
                }
                $p[$k] = $n;
            } elseif ($k === 'cozinha_atraso_min') {
                $n = (int) $v;
                if ($n < 5 || $n > 90) {
                    erro(422, 'O alerta de atraso deve ser de 5 a 90 minutos.');
                }
                $p[$k] = $n;
            }
        }

        return $p;
    }

    /** O que o tablet precisa saber (sem dados internos). */
    public static function paraTablet(array $tenant): array
    {
        $p = self::de($tenant);

        return $p + ['logo' => $tenant['logo'] ?: null, 'capa' => $tenant['capa'] ?: null];
    }
}
