<?php

namespace App\Http\Controllers;

use App\Services\Estabelecimentos;
use Illuminate\Support\Facades\DB;
use Throwable;

class PaginaController extends Controller
{
    private function site(string $view)
    {
        return response()->view($view, [
            'empresa' => nome_empresa(), 'contato' => email_contato(), 'foro' => variavel('FORO') ?: 'Codó/MA',
            'dataTermos' => variavel('DATA_TERMOS') ?: '9 de novembro de 2026', 'url' => url_app(),
        ]);
    }

    public function inicio()
    {
        return $this->site('site.inicio');
    }

    public function termos()
    {
        return $this->site('site.termos');
    }

    public function privacidade()
    {
        return $this->site('site.privacidade');
    }

    public function painel()
    {
        return response()->view('app.painel');
    }

    public function tablet()
    {
        return response()->view('app.tablet');
    }

    public function cozinha()
    {
        return response()->view('app.cozinha');
    }

    public function saude()
    {
        try {
            DB::scalar('SELECT 1');

            return response()->json(['ok' => true, 'versao' => versao_app()] + Estabelecimentos::situacaoAdministrador(), 200, ['Cache-Control' => 'no-store']);
        } catch (Throwable $e) {
            report($e);

            return response()->json(['ok' => false], 503);
        }
    }
}
