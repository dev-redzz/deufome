<?php

use Illuminate\Support\Str;

if (! function_exists('variavel')) {
    function variavel(string $nome): string
    {
        $v = trim((string) getenv($nome));
        if ($v === '' && isset($_ENV[$nome])) {
            $v = trim((string) $_ENV[$nome]);
        }
        if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[0] === substr($v, -1)) {
            $v = trim(substr($v, 1, -1));
        }

        return $v;
    }
}

function pasta_dados(string $sub = ''): string
{
    $base = rtrim(variavel('RAILWAY_VOLUME_MOUNT_PATH') ?: (variavel('DATA_DIR') ?: storage_path('dados')), '/');

    return $sub === '' ? $base : $base.'/'.ltrim($sub, '/');
}

function sem_volume(): bool
{
    return variavel('RAILWAY_ENVIRONMENT') !== '' && variavel('RAILWAY_VOLUME_MOUNT_PATH') === '';
}

function modo_demo(): bool
{
    return variavel('DEMO') === '1';
}

function agora(): string
{
    return gmdate('Y-m-d H:i:s');
}

function novo_uuid(): string
{
    return (string) Str::uuid();
}

function erro(int $status, string $mensagem): never
{
    abort($status, $mensagem);
}

function entrada(): array
{
    static $cache = [];
    $req = request();
    $id = spl_object_id($req);
    if (isset($cache[$id])) {
        return $cache[$id];
    }
    if ($req->isJson()) {
        $dados = json_decode($req->getContent(), true);

        return $cache[$id] = is_array($dados) ? $dados : [];
    }

    return $cache[$id] = $req->all();
}

function ip_cliente(): string
{
    $s = request()->server;
    if ($s->get('HTTP_X_REAL_IP')) {
        return substr(trim($s->get('HTTP_X_REAL_IP')), 0, 64);
    }
    if ($s->get('HTTP_X_FORWARDED_FOR')) {
        $partes = array_map('trim', explode(',', $s->get('HTTP_X_FORWARDED_FOR')));

        return substr((string) end($partes), 0, 64);
    }

    return (string) request()->server('REMOTE_ADDR', '');
}

function url_app(): string
{
    $v = rtrim(variavel('APP_URL'), '/');
    if ($v !== '') {
        return $v;
    }

    return rtrim(request()->getSchemeAndHttpHost(), '/');
}

function nome_empresa(): string
{
    return variavel('EMPRESA_NOME') ?: 'Deu Fome';
}

function email_contato(): string
{
    return variavel('EMAIL_CONTATO') ?: (variavel('PLATAFORMA_EMAIL') ?: 'contato@deufome.app');
}

function versao_app(): string
{
    static $v = null;
    if ($v !== null) {
        return $v;
    }
    $base = '';
    foreach (['public/build/manifest.json', 'resources/views/app/tablet.blade.php'] as $a) {
        $base .= @filemtime(base_path($a)).@filesize(base_path($a));
    }

    return $v = substr(md5($base), 0, 10);
}

function texto(array $in, string $campo, int $max, bool $obrigatorio = true, string $rotulo = 'Nome'): string
{
    $v = trim((string) preg_replace('/\s+/u', ' ', strip_tags((string) ($in[$campo] ?? ''))));
    if ($obrigatorio && $v === '') {
        erro(422, "Preencha: $rotulo.");
    }
    if (mb_strlen($v) > $max) {
        erro(422, "$rotulo muito longo (até $max letras).");
    }

    return $v;
}

function centavos($v, string $rotulo = 'Preço'): int
{
    if (! is_numeric($v)) {
        erro(422, "$rotulo inválido.");
    }
    $c = (int) round((float) $v);
    if ($c < 0 || $c > 10000000) {
        erro(422, "$rotulo inválido.");
    }

    return $c;
}

function senha_valida($s): string
{
    $s = (string) $s;
    if (strlen($s) < 8) {
        erro(422, 'A senha precisa ter pelo menos 8 caracteres.');
    }
    if (strlen($s) > 200) {
        erro(422, 'Senha muito longa.');
    }

    return $s;
}

function email_valido($e): string
{
    $e = strtolower(trim((string) $e));
    if (! filter_var($e, FILTER_VALIDATE_EMAIL) || strlen($e) > 120) {
        erro(422, 'E-mail inválido.');
    }

    return $e;
}

function reais(int $centavos): string
{
    return number_format($centavos / 100, 2, ',', '.');
}

/** Pessoa logada (preenchida pelo middleware "papel"). */
function usuario(): array
{
    return request()->attributes->get('usuario') ?? erro(401, 'Faça login.');
}

/** Tablet que fez a requisição (preenchido pelo middleware "tablet"). */
function dispositivo(): array
{
    return request()->attributes->get('dispositivo') ?? erro(401, 'Dispositivo não ativado.');
}
