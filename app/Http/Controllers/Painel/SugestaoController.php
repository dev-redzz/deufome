<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Email;
use App\Services\Limite;
use App\Services\MonitorErros;
use Illuminate\Support\Facades\DB;

class SugestaoController extends Controller
{
    public function criar()
    {
        $u = usuario();
        $in = entrada();
        $tipo = (string) ($in['tipo'] ?? '');
        $nomes = ['sugestao' => 'Sugestão', 'problema' => 'Problema', 'elogio' => 'Elogio'];
        if (! isset($nomes[$tipo])) {
            erro(422, 'Escolha o tipo.');
        }
        $texto = trim(strip_tags((string) ($in['texto'] ?? '')));
        if (mb_strlen($texto) < 5) {
            erro(422, 'Escreva um pouco mais.');
        }
        if (mb_strlen($texto) > 2000) {
            erro(422, 'Texto muito longo (até 2000 letras).');
        }
        Limite::contar('sugestao:'.$u['id'], 10, 3600);
        DB::insert('INSERT INTO sugestoes (tenant_id, user_id, tipo, texto, created_at) VALUES (?,?,?,?,?)', [$u['tenant_id'], $u['id'], $tipo, $texto, agora()]);
        if ($para = variavel('PLATAFORMA_EMAIL')) {
            Email::enviar($para, '[Deu Fome] '.$nomes[$tipo].' de '.($u['estabelecimento'] ?: $u['nome']), Email::modelo($nomes[$tipo],
                '<p style="white-space:pre-wrap">'.e($texto).'</p><p style="color:#6B6478;font-size:13px">'.e($u['nome'].' · '.$u['email'].($u['estabelecimento'] ? ' · '.$u['estabelecimento'] : '')).'</p>',
                'Ver sugestões', url_app().'/admin#sugestoes'));
        }

        return response()->json(['ok' => true], 201);
    }

    public function erroNavegador()
    {
        Limite::contar('js:'.ip_cliente(), 30, 3600);
        $in = entrada();
        $msg = mb_substr(trim((string) ($in['mensagem'] ?? '')), 0, 500);
        if ($msg !== '' && ! preg_match('/ResizeObserver loop|Script error\.?$/i', $msg)) {
            MonitorErros::registrar('navegador', $msg, mb_substr((string) ($in['detalhe'] ?? ''), 0, 3000), mb_substr((string) ($in['url'] ?? ''), 0, 300));
        }

        return response()->json(['ok' => true]);
    }
}
