<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;

class Imagens
{
    public static function salvar(?UploadedFile $f, string $prefixo, int $maxPx = 4000): string
    {
        if (! $f || ! $f->isValid()) {
            erro(422, 'Envie uma imagem.');
        }
        if ($f->getSize() > 4 * 1024 * 1024) {
            erro(422, 'Imagem maior que 4 MB.');
        }
        $tipos = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        $info = @getimagesize($f->getRealPath());
        $mime = $info['mime'] ?? '';
        if (! isset($tipos[$mime])) {
            erro(422, 'Use JPG, PNG ou WebP.');
        }
        if (($info[0] ?? 0) > $maxPx || ($info[1] ?? 0) > $maxPx) {
            erro(422, "Imagem grande demais (máximo $maxPx px).");
        }
        $nome = $prefixo.'-'.bin2hex(random_bytes(6)).'.'.$tipos[$mime];
        $f->move(pasta_dados('uploads'), $nome);

        return '/arquivos/'.$nome;
    }

    public static function apagar(?string $caminho): void
    {
        if ($caminho && preg_match('#^/arquivos/([a-z0-9-]+\.(jpg|png|webp))$#', $caminho, $m)) {
            @unlink(pasta_dados('uploads/'.$m[1]));
        }
    }
}
