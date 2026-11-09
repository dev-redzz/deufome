<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class Email
{
    public static function configurado(): bool
    {
        return variavel('BREVO_API_KEY') !== '' && variavel('EMAIL_REMETENTE') !== '';
    }

    /** @param array<int, array{nome: string, conteudo: string}> $anexos */
    public static function enviar(string $para, string $assunto, string $html, array $anexos = []): bool
    {
        $log = variavel('EMAIL_LOG') === '1';
        if ($log || ! self::configurado()) {
            $registro = [
                'para' => $para, 'assunto' => $assunto, 'html' => $html,
                'anexos' => array_map(fn ($a) => ['nome' => $a['nome'], 'bytes' => strlen($a['conteudo'])], $anexos),
                'em' => agora(),
            ];
            @file_put_contents(pasta_dados('emails.log'), json_encode($registro, JSON_UNESCAPED_UNICODE)."\n", FILE_APPEND | LOCK_EX);
            if (! self::configurado()) {
                Log::warning("[e-mail não enviado: configure BREVO_API_KEY e EMAIL_REMETENTE] para=$para assunto=$assunto");

                return $log;
            }
        }
        $corpo = [
            'sender' => ['name' => nome_empresa(), 'email' => variavel('EMAIL_REMETENTE')],
            'to' => [['email' => $para]],
            'subject' => $assunto,
            'htmlContent' => $html,
        ];
        if ($anexos) {
            $corpo['attachment'] = array_map(fn ($a) => ['name' => $a['nome'], 'content' => base64_encode($a['conteudo'])], $anexos);
        }
        try {
            $r = Http::timeout(15)->acceptJson()->withHeaders(['api-key' => variavel('BREVO_API_KEY')])
                ->post('https://api.brevo.com/v3/smtp/email', $corpo);
            if (! $r->successful()) {
                Log::error('[e-mail falhou] status='.$r->status().' resposta='.substr($r->body(), 0, 300));

                return false;
            }

            return true;
        } catch (Throwable $e) {
            Log::error('[e-mail falhou] '.$e->getMessage());

            return false;
        }
    }

    public static function modelo(string $titulo, string $corpoHtml, ?string $botaoTexto = null, ?string $botaoUrl = null): string
    {
        return view('emails.modelo', [
            'titulo' => $titulo, 'corpo' => $corpoHtml, 'botaoTexto' => $botaoTexto, 'botaoUrl' => $botaoUrl, 'empresa' => nome_empresa(),
        ])->render();
    }
}
