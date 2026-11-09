<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/* -------------------------------------------------------------- endereço do site */

function url_app(): string
{
    $v = rtrim(variavel('APP_URL'), '/');
    if ($v !== '') return $v;
    $host = preg_replace('/[^a-z0-9.:\-]/i', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return (https() ? 'https' : 'http') . '://' . $host;
}

function nome_empresa(): string
{
    return variavel('EMPRESA_NOME') ?: 'Deu Fome';
}

function email_contato(): string
{
    return variavel('EMAIL_CONTATO') ?: (variavel('PLATAFORMA_EMAIL') ?: 'contato@deufome.app');
}

/* -------------------------------------------------------------- limites de uso */

function limite(string $chave, int $maximo, int $segundos): void
{
    $pdo = db();
    $desde = gmdate('Y-m-d H:i:s', time() - $segundos);
    $st = $pdo->prepare('SELECT COUNT(*) FROM limites WHERE chave = ? AND created_at > ?');
    $st->execute([$chave, $desde]);
    if ((int)$st->fetchColumn() >= $maximo) erro(429, 'Muitas tentativas. Espere um pouco e tente de novo.');
    $pdo->prepare('INSERT INTO limites (chave, created_at) VALUES (?,?)')->execute([$chave, agora()]);
}

/* -------------------------------------------------------------- e-mail (Brevo) */

function http_json(string $url, array $corpo, array $cabecalhos = [], int $timeout = 12, bool $form = false): array
{
    $conteudo = $form ? http_build_query($corpo) : json_encode($corpo, JSON_UNESCAPED_UNICODE);
    $linhas = array_merge(['Content-Type: ' . ($form ? 'application/x-www-form-urlencoded' : 'application/json'), 'Accept: application/json'], $cabecalhos);
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'header' => implode("\r\n", $linhas), 'content' => $conteudo,
        'timeout' => $timeout, 'ignore_errors' => true,
    ]]);
    $resposta = @file_get_contents($url, false, $ctx);
    $status = 0;
    foreach ($http_response_header ?? [] as $h) {
        if (preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) $status = (int)$m[1];
    }
    return [$status, $resposta === false ? null : json_decode($resposta, true), $resposta];
}

function email_configurado(): bool
{
    return variavel('BREVO_API_KEY') !== '' && variavel('EMAIL_REMETENTE') !== '';
}

function enviar_email(string $para, string $assunto, string $html, array $anexos = []): bool
{
    if (variavel('EMAIL_LOG') === '1' || !email_configurado()) {
        $registro = ['para' => $para, 'assunto' => $assunto, 'html' => $html, 'anexos' => array_map(fn($a) => ['nome' => $a['nome'], 'bytes' => strlen($a['conteudo'])], $anexos), 'em' => agora()];
        @file_put_contents(DATA_DIR . '/emails.log', json_encode($registro, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
        if (!email_configurado()) {
            error_log("[e-mail não enviado: configure BREVO_API_KEY e EMAIL_REMETENTE] para=$para assunto=$assunto");
            return variavel('EMAIL_LOG') === '1';
        }
    }
    $corpo = [
        'sender' => ['name' => nome_empresa(), 'email' => variavel('EMAIL_REMETENTE')],
        'to' => [['email' => $para]],
        'subject' => $assunto,
        'htmlContent' => $html,
    ];
    if ($anexos) $corpo['attachment'] = array_map(fn($a) => ['name' => $a['nome'], 'content' => base64_encode($a['conteudo'])], $anexos);
    [$status, , $bruto] = http_json('https://api.brevo.com/v3/smtp/email', $corpo, ['api-key: ' . variavel('BREVO_API_KEY')]);
    if ($status < 200 || $status >= 300) {
        error_log("[e-mail falhou] status=$status resposta=" . substr((string)$bruto, 0, 300));
        return false;
    }
    return true;
}

function email_modelo(string $titulo, string $corpoHtml, ?string $botaoTexto = null, ?string $botaoUrl = null): string
{
    $botao = $botaoTexto ? '<p style="margin:28px 0"><a href="' . htmlspecialchars((string)$botaoUrl) . '" style="background:#FF5A1F;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:12px;display:inline-block">' . htmlspecialchars($botaoTexto) . '</a></p>' : '';
    return '<!doctype html><html><body style="margin:0;background:#FFF4EC;font-family:Arial,Helvetica,sans-serif;color:#14215A">'
        . '<div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#FF5A1F;color:#fff;border-radius:18px 18px 0 0;padding:18px 24px;font-size:22px;font-weight:800">Deu Fome</div>'
        . '<div style="background:#fff;border-radius:0 0 18px 18px;padding:24px;line-height:1.55"><h1 style="font-size:22px;margin:0 0 12px">' . htmlspecialchars($titulo) . '</h1>'
        . $corpoHtml . $botao . '</div><p style="color:#66617A;font-size:12px;text-align:center;margin-top:16px">' . htmlspecialchars(nome_empresa()) . '</p></div></body></html>';
}

/* -------------------------------------------------------------- zip simples (sem extensão) */

function zip_criar(array $arquivos): string
{
    $dados = '';
    $central = '';
    $n = 0;
    [$hora, $data] = dos_data_hora(time());
    foreach ($arquivos as $nome => $conteudo) {
        $comprimido = gzdeflate($conteudo, 6);
        $crc = crc32($conteudo);
        $nomeBin = (string)$nome;
        $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0x0800, 8, $hora, $data, $crc, strlen($comprimido), strlen($conteudo), strlen($nomeBin), 0) . $nomeBin;
        $deslocamento = strlen($dados);
        $dados .= $local . $comprimido;
        $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0x0800, 8, $hora, $data, $crc, strlen($comprimido), strlen($conteudo), strlen($nomeBin), 0, 0, 0, 0, 0, $deslocamento) . $nomeBin;
        $n++;
    }
    return $dados . $central . pack('VvvvvVVv', 0x06054b50, 0, 0, $n, $n, strlen($central), strlen($dados), 0);
}

function dos_data_hora(int $ts): array
{
    $d = getdate($ts);
    return [($d['hours'] << 11) | ($d['minutes'] << 5) | intdiv($d['seconds'], 2), (($d['year'] - 1980) << 9) | ($d['mon'] << 5) | $d['mday']];
}

/* -------------------------------------------------------------- monitor de erros */

function registrar_erro(string $origem, string $mensagem, string $detalhe = '', string $url = '', ?int $tenantId = null): void
{
    try {
        $mensagem = mb_substr(trim($mensagem), 0, 500);
        if ($mensagem === '') return;
        $base = preg_replace('/\d+/', '#', $mensagem) . '|' . strtok($detalhe, "\n");
        $chave = sha1($origem . '|' . $base);
        $pdo = db();
        $st = $pdo->prepare('SELECT id, resolvido, avisado_em FROM erros WHERE chave = ?');
        $st->execute([$chave]);
        $e = $st->fetch();
        $avisar = false;
        if ($e) {
            $pdo->prepare('UPDATE erros SET contagem = contagem + 1, ultima_em = ?, resolvido = 0, url = ? WHERE id = ?')->execute([agora(), mb_substr($url, 0, 300), $e['id']]);
            $avisar = (int)$e['resolvido'] === 1 || !$e['avisado_em'] || strtotime($e['avisado_em'] . ' UTC') < time() - 6 * 3600;
            $id = (int)$e['id'];
        } else {
            $pdo->prepare('INSERT INTO erros (chave, origem, mensagem, detalhe, url, tenant_id, primeira_em, ultima_em) VALUES (?,?,?,?,?,?,?,?)')
                ->execute([$chave, $origem, $mensagem, mb_substr($detalhe, 0, 4000), mb_substr($url, 0, 300), $tenantId, agora(), agora()]);
            $avisar = true;
            $id = (int)$pdo->lastInsertId();
        }
        $hoje = $pdo->query("SELECT COUNT(*) FROM erros WHERE avisado_em > '" . gmdate('Y-m-d H:i:s', time() - 86400) . "'")->fetchColumn();
        $para = variavel('PLATAFORMA_EMAIL');
        if ($avisar && $para && (int)$hoje < 20) {
            $pdo->prepare('UPDATE erros SET avisado_em = ? WHERE id = ?')->execute([agora(), $id]);
            enviar_email($para, '[Deu Fome] Erro ' . ($origem === 'servidor' ? 'no servidor' : 'no navegador'),
                email_modelo('Um erro aconteceu', '<p><b>' . htmlspecialchars($mensagem) . '</b></p><p style="color:#66617A;font-size:13px">' . htmlspecialchars($url) . '</p><pre style="white-space:pre-wrap;font-size:12px;background:#FFF4EC;padding:12px;border-radius:10px">' . htmlspecialchars(mb_substr($detalhe, 0, 1500)) . '</pre>', 'Ver erros no painel', url_app() . '/admin#erros'));
        }
    } catch (Throwable $e) {
        error_log('[monitor de erros] ' . $e->getMessage());
    }
}

/* -------------------------------------------------------------- tarefas diárias */

function tarefa_vencida(string $nome, int $segundos): bool
{
    $st = db()->prepare('SELECT ultima_em FROM tarefas WHERE nome = ?');
    $st->execute([$nome]);
    $u = $st->fetchColumn();
    return !$u || strtotime($u . ' UTC') <= time() - $segundos;
}

function marcar_tarefa(string $nome, string $detalhe = ''): void
{
    db()->prepare('INSERT INTO tarefas (nome, ultima_em, detalhe) VALUES (?,?,?) ON CONFLICT(nome) DO UPDATE SET ultima_em = excluded.ultima_em, detalhe = excluded.detalhe')
        ->execute([$nome, agora(), $detalhe]);
}

function tarefas_diarias(): void
{
    $marca = DATA_DIR . '/.tarefas';
    if (is_file($marca) && filemtime($marca) > time() - 600) return;
    @touch($marca);
    $trava = @fopen(DATA_DIR . '/.tarefas.lock', 'c');
    if (!$trava || !flock($trava, LOCK_EX | LOCK_NB)) return;
    try {
        $pdo = db();
        $ontem = gmdate('Y-m-d H:i:s', time() - 86400);
        $pdo->prepare('DELETE FROM login_tentativas WHERE created_at < ?')->execute([$ontem]);
        $pdo->prepare('DELETE FROM limites WHERE created_at < ?')->execute([$ontem]);
        $pdo->prepare('DELETE FROM senha_tokens WHERE expira_em < ?')->execute([$ontem]);
        if (tarefa_vencida('backup', 23 * 3600)) fazer_backup(true);
    } catch (Throwable $e) {
        registrar_erro('servidor', 'Tarefa diária falhou: ' . $e->getMessage(), $e->getFile() . ':' . $e->getLine());
    } finally {
        flock($trava, LOCK_UN);
        fclose($trava);
    }
}

function fazer_backup(bool $enviar): array
{
    $pasta = DATA_DIR . '/backups';
    if (!is_dir($pasta)) @mkdir($pasta, 0775, true);
    $nome = 'deufome-' . gmdate('Y-m-d-His') . '.sqlite';
    $arq = $pasta . '/' . $nome;
    db()->exec('VACUUM INTO ' . db()->quote($arq));
    $zip = zip_criar([$nome => (string)file_get_contents($arq)]);
    file_put_contents($arq . '.zip', $zip);
    @unlink($arq);
    $antigos = glob($pasta . '/deufome-*.sqlite.zip') ?: [];
    rsort($antigos);
    foreach (array_slice($antigos, 7) as $velho) @unlink($velho);
    $enviado = false;
    $para = variavel('PLATAFORMA_EMAIL');
    if ($enviar && $para) {
        $enviado = enviar_email($para, '[Deu Fome] Backup de ' . (new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo')))->format('d/m/Y'),
            email_modelo('Backup diário', '<p>Em anexo está a cópia completa do banco de dados do Deu Fome.</p><p style="color:#66617A;font-size:13px">Guarde este arquivo fora do Railway. As fotos dos produtos ficam na pasta <b>uploads</b> do volume.</p>'),
            [['nome' => $nome . '.zip', 'conteudo' => $zip]]);
    }
    $info = ['arquivo' => $nome . '.zip', 'bytes' => strlen($zip), 'email' => $enviado];
    marcar_tarefa('backup', json_encode($info));
    return $info;
}

/* -------------------------------------------------------------- horário de funcionamento */

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function fuso_do(array $tenant): DateTimeZone
{
    try {
        return new DateTimeZone($tenant['fuso'] ?: 'America/Sao_Paulo');
    } catch (Throwable $e) {
        return new DateTimeZone('America/Sao_Paulo');
    }
}

function horarios_validos($h): array
{
    if (!is_array($h)) erro(422, 'Horário inválido.');
    $dias = [];
    for ($d = 0; $d < 7; $d++) {
        $turnos = $h['dias'][$d] ?? $h['dias'][(string)$d] ?? [];
        if (!is_array($turnos) || count($turnos) > 3) erro(422, 'Horário inválido.');
        $limpos = [];
        foreach ($turnos as $t) {
            if (!is_array($t) || count($t) !== 2) erro(422, 'Horário inválido.');
            foreach ($t as $hora) if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', (string)$hora)) erro(422, 'Use horários no formato 18:30.');
            if ($t[0] === $t[1]) erro(422, 'O turno precisa ter início e fim diferentes.');
            $limpos[] = [(string)$t[0], (string)$t[1]];
        }
        $dias[(string)$d] = $limpos;
    }
    return ['ativo' => !empty($h['ativo']), 'dias' => $dias];
}

function situacao_horario(array $tenant, ?int $agora = null): array
{
    $h = json_decode((string)$tenant['horarios'], true);
    if (!is_array($h) || empty($h['ativo'])) return ['aberto' => true, 'controle' => false, 'proxima' => null];
    $fuso = fuso_do($tenant);
    $agoraDt = (new DateTimeImmutable('@' . ($agora ?? time())))->setTimezone($fuso);
    $min = (int)$agoraDt->format('G') * 60 + (int)$agoraDt->format('i');
    $dia = (int)$agoraDt->format('w');
    $paraMin = fn(string $hm) => (int)substr($hm, 0, 2) * 60 + (int)substr($hm, 3, 2);
    $turnos = fn(int $d) => $h['dias'][(string)(($d + 7) % 7)] ?? [];
    foreach ($turnos($dia) as [$i, $f]) {
        $a = $paraMin($i); $b = $paraMin($f);
        if (($b > $a && $min >= $a && $min < $b) || ($b < $a && $min >= $a)) return ['aberto' => true, 'controle' => true, 'proxima' => null];
    }
    foreach ($turnos($dia - 1) as [$i, $f]) {
        if ($paraMin($f) < $paraMin($i) && $min < $paraMin($f)) return ['aberto' => true, 'controle' => true, 'proxima' => null];
    }
    for ($k = 0; $k < 8; $k++) {
        $lista = $turnos($dia + $k);
        usort($lista, fn($x, $y) => strcmp($x[0], $y[0]));
        foreach ($lista as [$i]) {
            if ($k === 0 && $paraMin($i) <= $min) continue;
            $quando = $k === 0 ? 'hoje' : ($k === 1 ? 'amanhã' : DIAS_SEMANA[($dia + $k) % 7]);
            $hh = (int)substr($i, 0, 2); $mm = substr($i, 3, 2);
            return ['aberto' => false, 'controle' => true, 'proxima' => "$quando às " . $hh . ($mm === '00' ? 'h' : ":$mm")];
        }
    }
    return ['aberto' => false, 'controle' => true, 'proxima' => null];
}
