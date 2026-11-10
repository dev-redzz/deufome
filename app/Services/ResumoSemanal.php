<?php

namespace App\Services;

use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Support\Facades\DB;

/** E-mail de segunda-feira com o resumo da semana anterior para os donos. */
class ResumoSemanal
{
    public static function dados(array $t): array
    {
        $fuso = Horario::fuso($t);
        $fim = new DateTimeImmutable('monday this week', $fuso);
        $ini = $fim->modify('-7 days');
        $antes = $ini->modify('-7 days');
        $utc = new DateTimeZone('UTC');
        $u = fn (DateTimeImmutable $d) => $d->setTimezone($utc)->format('Y-m-d H:i:s');
        $tid = (int) $t['id'];
        $soma = fn ($a, $b) => DB::selectOne("SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS contas FROM table_sessions WHERE tenant_id = ? AND status = 'fechada' AND fechada_em >= ? AND fechada_em < ?", [$tid, $u($a), $u($b)]);
        $agora = $soma($ini, $fim);
        $anterior = $soma($antes, $ini);
        $top = DB::select("SELECT oi.nome, SUM(oi.quantidade) AS q FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.tenant_id = ? AND o.status <> 'cancelado' AND o.created_at >= ? AND o.created_at < ? GROUP BY oi.nome ORDER BY q DESC LIMIT 3", [$tid, $u($ini), $u($fim)]);
        $nota = DB::selectOne('SELECT ROUND(AVG(nota),1) AS media, COUNT(*) AS n FROM avaliacoes WHERE tenant_id = ? AND created_at >= ? AND created_at < ?', [$tid, $u($ini), $u($fim)]);
        $pratos = DB::select('SELECT nome, ROUND(AVG(nota),1) AS media, COUNT(*) AS n FROM avaliacoes_itens WHERE tenant_id = ? AND created_at >= ? AND created_at < ? GROUP BY nome HAVING n >= 2 ORDER BY media DESC', [$tid, $u($ini), $u($fim)]);
        $dia = DB::selectOne("SELECT strftime('%w', datetime(fechada_em, ?)) AS d, SUM(total) AS t FROM table_sessions WHERE tenant_id = ? AND status = 'fechada' AND fechada_em >= ? AND fechada_em < ? GROUP BY d ORDER BY t DESC LIMIT 1",
            [($fuso->getOffset(new DateTimeImmutable) / 3600).' hours', $tid, $u($ini), $u($fim)]);

        return [
            'de' => $ini->format('d/m'), 'ate' => $fim->modify('-1 day')->format('d/m'),
            'total' => (int) $agora['total'], 'contas' => (int) $agora['contas'], 'anterior' => (int) $anterior['total'],
            'ticket' => $agora['contas'] ? (int) round($agora['total'] / $agora['contas']) : 0,
            'top' => $top, 'nota' => $nota['n'] ? (float) $nota['media'] : null, 'avaliacoes' => (int) $nota['n'],
            'melhor_prato' => $pratos[0] ?? null, 'pior_prato' => count($pratos) > 1 ? end($pratos) : null,
            'melhor_dia' => $dia ? ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][(int) $dia['d']] : null,
        ];
    }

    public static function html(array $t, array $d): string
    {
        $r = fn (int $c) => 'R$ '.reais($c);
        $var = $d['anterior'] > 0 ? (int) round(($d['total'] - $d['anterior']) * 100 / $d['anterior']) : null;
        $linha = fn ($k, $v) => '<tr><td style="padding:8px 0;color:#6B6478">'.$k.'</td><td style="padding:8px 0;text-align:right;font-weight:700">'.$v.'</td></tr>';
        $h = '<p>Veja como foi a semana de <b>'.e($t['nome']).'</b> ('.$d['de'].' a '.$d['ate'].').</p>';
        $h .= '<div style="background:#FFF4EE;border-radius:14px;padding:16px 18px;margin:16px 0"><div style="color:#6B6478;font-size:13px">Faturamento</div><div style="font-size:30px;font-weight:800">'.$r($d['total']).'</div>'
            .($var !== null ? '<div style="font-size:13px;color:'.($var >= 0 ? '#2F9E44' : '#E23B3B').'">'.($var >= 0 ? '+' : '').$var.'% em relação à semana anterior</div>' : '').'</div>';
        $h .= '<table style="width:100%;border-collapse:collapse;font-size:15px">'.$linha('Contas fechadas', $d['contas']).$linha('Ticket médio', $r($d['ticket']))
            .($d['melhor_dia'] ? $linha('Melhor dia', $d['melhor_dia']) : '')
            .($d['nota'] !== null ? $linha('Nota dos clientes', number_format($d['nota'], 1, ',', '').' de 5 ('.$d['avaliacoes'].' avaliações)') : '').'</table>';
        if ($d['top']) {
            $h .= '<h3 style="font-size:16px;margin:22px 0 6px">Mais pedidos</h3><ol style="padding-left:20px;margin:0">'.implode('', array_map(fn ($p) => '<li>'.e($p['nome']).' — '.$p['q'].'</li>', $d['top'])).'</ol>';
        }
        if ($d['melhor_prato']) {
            $h .= '<p style="margin-top:18px">Prato mais bem avaliado: <b>'.e($d['melhor_prato']['nome']).'</b> ('.number_format((float) $d['melhor_prato']['media'], 1, ',', '').').'
                .($d['pior_prato'] ? '<br>Precisa de atenção: <b>'.e($d['pior_prato']['nome']).'</b> ('.number_format((float) $d['pior_prato']['media'], 1, ',', '').').' : '').'</p>';
        }
        if (! $d['contas']) {
            $h .= '<p>Nenhuma conta foi fechada nesta semana.</p>';
        }

        return Email::modelo('Resumo da semana', $h, 'Abrir o painel', url_app().'/admin#relatorios');
    }

    public static function enviar(array $t, ?string $so = null): int
    {
        $d = self::dados($t);
        $html = self::html($t, $d);
        $para = $so ? [$so] : array_column(DB::select("SELECT email FROM users WHERE tenant_id = ? AND papel = 'dono' AND ativo = 1", [$t['id']]), 'email');
        $n = 0;
        foreach ($para as $e) {
            $n += Email::enviar($e, '[Deu Fome] Resumo da semana — '.$t['nome'], $html) ? 1 : 0;
        }

        return $n;
    }

    /** Roda junto das tarefas diárias; envia uma vez por semana, às segundas. */
    public static function talvezEnviar(): void
    {
        $hoje = new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
        if ($hoje->format('N') !== '1' || ! Tarefas::vencida('resumo_semanal', 5 * 86400)) {
            return;
        }
        Tarefas::marcar('resumo_semanal');
        foreach (DB::select("SELECT * FROM tenants WHERE status = 'ativo'") as $t) {
            if (Preferencias::de($t)['resumo_semanal']) {
                self::enviar($t);
            }
        }
    }
}
