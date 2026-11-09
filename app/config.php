<?php
declare(strict_types=1);

define('RAIZ', dirname(__DIR__));
define('DATA_DIR', rtrim(getenv('RAILWAY_VOLUME_MOUNT_PATH') ?: (getenv('DATA_DIR') ?: RAIZ . '/data'), '/'));
define('DB_PATH', DATA_DIR . '/deufome.sqlite');
define('UPLOAD_DIR', DATA_DIR . '/uploads');
define('SESSAO_DIR', DATA_DIR . '/sessoes');
define('DEMO', getenv('DEMO') === '1');
define('NO_RAILWAY', (bool)getenv('RAILWAY_ENVIRONMENT'));
define('SEM_VOLUME', NO_RAILWAY && !getenv('RAILWAY_VOLUME_MOUNT_PATH'));

function versao_app(): string
{
    static $v = null;
    if ($v !== null) return $v;
    $arquivos = ['public/css/deufome.css', 'public/js/comum.js', 'public/js/tablet.js', 'public/js/admin.js', 'public/js/cozinha.js', 'public/tablet.html'];
    $base = '';
    foreach ($arquivos as $a) $base .= @filemtime(RAIZ . '/' . $a) . @filesize(RAIZ . '/' . $a);
    return $v = substr(md5($base), 0, 10);
}

function https(): bool
{
    return ($_SERVER['HTTPS'] ?? '') === 'on' || strtolower($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

function ip_cliente(): string
{
    if (!empty($_SERVER['HTTP_X_REAL_IP'])) return substr(trim($_SERVER['HTTP_X_REAL_IP']), 0, 64);
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $partes = array_map('trim', explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']));
        return substr((string)end($partes), 0, 64);
    }
    return $_SERVER['REMOTE_ADDR'] ?? '';
}

foreach ([DATA_DIR, UPLOAD_DIR, SESSAO_DIR] as $d) {
    if (!is_dir($d)) @mkdir($d, 0775, true);
}
