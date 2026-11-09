<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

$caminho = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
$publico = realpath(RAIZ . '/public');

header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
if (https()) header('Strict-Transport-Security: max-age=31536000');

if (str_starts_with($caminho, '/api/')) {
    require __DIR__ . '/api.php';
    rotear($_SERVER['REQUEST_METHOD'], $caminho);
}

if ($caminho === '/auth/google' || $caminho === '/auth/google/retorno') {
    require __DIR__ . '/api.php';
    try {
        $caminho === '/auth/google' ? r_google_inicio() : r_google_retorno();
    } catch (Throwable $e) {
        error_log((string)$e);
        registrar_erro('servidor', get_class($e) . ': ' . $e->getMessage(), $e->getFile() . ':' . $e->getLine(), $caminho);
        header('Location: /admin#erro=google-falhou', true, 302);
    }
    return true;
}

if ($caminho === '/saude') {
    require __DIR__ . '/db.php';
    header('Content-Type: application/json');
    header('Cache-Control: no-store');
    try {
        db()->query('SELECT 1')->fetchColumn();
        echo json_encode(['ok' => true, 'versao' => versao_app()] + situacao_plataforma(db()));
    } catch (Throwable $e) {
        error_log((string)$e);
        http_response_code(503);
        echo json_encode(['ok' => false]);
    }
    return true;
}

if (preg_match('#^/arquivos/([a-z0-9-]+\.(jpg|png|webp))$#', $caminho, $m)) {
    $arq = UPLOAD_DIR . '/' . $m[1];
    if (!is_file($arq)) {
        http_response_code(404);
        return true;
    }
    header('Content-Type: ' . ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'][$m[2]]);
    header('Content-Length: ' . filesize($arq));
    header('Cache-Control: public, max-age=31536000, immutable');
    header("Content-Security-Policy: default-src 'none'");
    readfile($arq);
    return true;
}

$paginas = ['/' => 'index.html', '/admin' => 'admin.html', '/cadastro' => 'admin.html', '/tablet' => 'tablet.html', '/cozinha' => 'cozinha.html', '/termos' => 'termos.html', '/privacidade' => 'privacidade.html'];
if (isset($paginas[$caminho])) {
    require_once __DIR__ . '/db.php';
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Frame-Options: DENY');
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com");
    $h = fn(string $v) => htmlspecialchars($v, ENT_QUOTES);
    $trocas = [
        '{{v}}' => versao_app(),
        '{{empresa}}' => $h(variavel('EMPRESA_NOME') ?: 'Deu Fome'),
        '{{contato}}' => $h(variavel('EMAIL_CONTATO') ?: (variavel('PLATAFORMA_EMAIL') ?: 'contato@deufome.app')),
        '{{foro}}' => $h(variavel('FORO') ?: 'Codó/MA'),
        '{{data}}' => $h(variavel('DATA_TERMOS') ?: '9 de novembro de 2026'),
        '{{ano}}' => date('Y'),
        '{{url}}' => $h(rtrim(variavel('APP_URL') ?: ((https() ? 'https' : 'http') . '://' . preg_replace('/[^a-z0-9.:\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost')), '/')),
    ];
    echo strtr((string)file_get_contents($publico . '/' . $paginas[$caminho]), $trocas);
    return true;
}

$arquivo = realpath($publico . $caminho);
if ($arquivo && str_starts_with($arquivo, $publico . '/') && is_file($arquivo)) {
    $tipos = ['css' => 'text/css; charset=utf-8', 'js' => 'text/javascript; charset=utf-8', 'webmanifest' => 'application/manifest+json', 'svg' => 'image/svg+xml', 'png' => 'image/png', 'woff2' => 'font/woff2', 'txt' => 'text/plain; charset=utf-8'];
    $ext = strtolower(pathinfo($arquivo, PATHINFO_EXTENSION));
    if (!isset($tipos[$ext])) {
        http_response_code(404);
        return true;
    }
    $etag = '"' . md5(filemtime($arquivo) . filesize($arquivo)) . '"';
    header('ETag: ' . $etag);
    header('Content-Type: ' . $tipos[$ext]);
    if (!empty($_GET['v']) || str_starts_with($caminho, '/fonts/')) header('Cache-Control: public, max-age=31536000, immutable');
    elseif (in_array($ext, ['css', 'js', 'webmanifest'], true)) header('Cache-Control: no-cache');
    else header('Cache-Control: public, max-age=3600');
    if (($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        return true;
    }
    header('Content-Length: ' . filesize($arquivo));
    readfile($arquivo);
    return true;
}

http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
echo 'Página não encontrada';
return true;
