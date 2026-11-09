<?php

namespace App\Http\Controllers;

/** Entrega as fotos enviadas pelos restaurantes (ficam no volume, fora da pasta public). */
class ArquivoController extends Controller
{
    public function __invoke(string $nome)
    {
        $arq = pasta_dados('uploads/'.$nome);
        if (! is_file($arq)) {
            abort(404);
        }
        $tipos = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];

        return response()->file($arq, [
            'Content-Type' => $tipos[pathinfo($nome, PATHINFO_EXTENSION)],
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Security-Policy' => "default-src 'none'",
        ]);
    }
}
