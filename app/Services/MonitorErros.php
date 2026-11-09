<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

class MonitorErros
{
    public static function registrar(string $origem, string $mensagem, string $detalhe = '', string $url = '', ?int $tenantId = null): void
    {
        try {
            $mensagem = mb_substr(trim($mensagem), 0, 500);
            if ($mensagem === '') {
                return;
            }
            if ($origem === 'servidor') {
                Log::error($mensagem.' '.strtok($detalhe, "\n"));
            }
            $base = preg_replace('/\d+/', '#', $mensagem).'|'.strtok($detalhe, "\n");
            $chave = sha1($origem.'|'.$base);
            $e = DB::selectOne('SELECT id, resolvido, avisado_em FROM erros WHERE chave = ?', [$chave]);
            if ($e) {
                DB::update('UPDATE erros SET contagem = contagem + 1, ultima_em = ?, resolvido = 0, url = ? WHERE id = ?', [agora(), mb_substr($url, 0, 300), $e['id']]);
                $avisar = (int) $e['resolvido'] === 1 || ! $e['avisado_em'] || strtotime($e['avisado_em'].' UTC') < time() - 6 * 3600;
                $id = (int) $e['id'];
            } else {
                $id = DB::table('erros')->insertGetId([
                    'chave' => $chave, 'origem' => $origem, 'mensagem' => $mensagem, 'detalhe' => mb_substr($detalhe, 0, 4000),
                    'url' => mb_substr($url, 0, 300), 'tenant_id' => $tenantId, 'primeira_em' => agora(), 'ultima_em' => agora(),
                ]);
                $avisar = true;
            }
            $hoje = (int) DB::scalar('SELECT COUNT(*) FROM erros WHERE avisado_em > ?', [gmdate('Y-m-d H:i:s', time() - 86400)]);
            $para = variavel('PLATAFORMA_EMAIL');
            if ($avisar && $para && $hoje < 20) {
                DB::update('UPDATE erros SET avisado_em = ? WHERE id = ?', [agora(), $id]);
                Email::enviar($para, '[Deu Fome] Erro '.($origem === 'servidor' ? 'no servidor' : 'no navegador'), Email::modelo(
                    'Um erro aconteceu',
                    '<p><b>'.e($mensagem).'</b></p><p style="color:#6B6478;font-size:13px">'.e($url).'</p><pre style="white-space:pre-wrap;font-size:12px;background:#F6F1EA;padding:12px;border-radius:10px">'.e(mb_substr($detalhe, 0, 1500)).'</pre>',
                    'Ver erros no painel', url_app().'/admin#erros'
                ));
            }
        } catch (Throwable $e) {
            Log::error('[monitor de erros] '.$e->getMessage());
        }
    }
}
