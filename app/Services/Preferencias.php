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
        'fonte' => 'padrao',
        'layout_cards' => 'grade',
        'faixa_promocao' => '',
        'mostrar_destaques' => true,
        'texto_garcom' => 'Chamar garçom',
        'descanso_pratos' => true,
        'mostrar_combina' => true,
        'avaliar_pratos' => true,
        'pix_ativo' => false,
        'pix_chave' => '',
        'pix_nome' => '',
        'pix_cidade' => '',
        'gorjeta_ativa' => true,
        'resumo_semanal' => true,
    ];

    public const ENUMS = [
        'tema_tablet' => ['claro', 'escuro'],
        'fonte' => ['padrao', 'arredondada', 'classica', 'moderna'],
        'layout_cards' => ['grade', 'lista'],
    ];

    public const TEXTOS = [
        'boas_vindas' => 80, 'agradecimento' => 80, 'telefone' => 20, 'instagram' => 40, 'endereco' => 120,
        'wifi_nome' => 40, 'wifi_senha' => 40, 'rodape_comanda' => 160,
        'faixa_promocao' => 90, 'texto_garcom' => 24, 'pix_chave' => 77, 'pix_nome' => 25, 'pix_cidade' => 15,
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
            } elseif (isset(self::ENUMS[$k])) {
                if (! in_array($v, self::ENUMS[$k], true)) {
                    erro(422, 'Opção inválida.');
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

        if ($p['texto_garcom'] === '') {
            $p['texto_garcom'] = self::PADRAO['texto_garcom'];
        }
        if ($p['pix_ativo'] && ($p['pix_chave'] === '' || $p['pix_nome'] === '' || $p['pix_cidade'] === '')) {
            erro(422, 'Para ativar o Pix na mesa, preencha a chave, o nome do recebedor e a cidade.');
        }

        return $p;
    }

    /** O que o tablet precisa saber (sem dados internos). */
    public static function paraTablet(array $tenant): array
    {
        $p = self::de($tenant);
        $p['pix_ativo'] = $p['pix_ativo'] && $p['pix_chave'] !== '';
        unset($p['pix_chave'], $p['pix_nome'], $p['pix_cidade'], $p['resumo_semanal'], $p['cozinha_som'], $p['cozinha_atraso_min'], $p['rodape_comanda']);

        return $p + ['logo' => $tenant['logo'] ?: null, 'capa' => $tenant['capa'] ?: null];
    }
}
