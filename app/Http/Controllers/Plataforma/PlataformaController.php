<?php

namespace App\Http\Controllers\Plataforma;

use App\Http\Controllers\Auth\CadastroController;
use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Backup;
use App\Services\Email;
use App\Services\Estabelecimentos;
use Illuminate\Support\Facades\DB;

class PlataformaController extends Controller
{
    public function estabelecimentos()
    {
        $desde = gmdate('Y-m-d H:i:s', time() - 30 * 86400);

        return response()->json(['estabelecimentos' => DB::select("SELECT t.id, t.nome, t.slug, t.status, t.created_at,
            (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.papel = 'dono' ORDER BY u.id LIMIT 1) AS dono_email,
            (SELECT COUNT(*) FROM tables m WHERE m.tenant_id = t.id AND m.ativo = 1) AS mesas,
            (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.status = 'ativo') AS tablets,
            (SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id AND o.created_at > ? AND o.status <> 'cancelado') AS pedidos_30d,
            (SELECT COALESCE(SUM(total), 0) FROM table_sessions s WHERE s.tenant_id = t.id AND s.status = 'fechada' AND s.fechada_em > ?) AS faturado_30d
            FROM tenants t ORDER BY t.nome", [$desde, $desde]), 'sem_volume' => sem_volume()]);
    }

    public function resumo()
    {
        $d7 = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
        $d30 = gmdate('Y-m-d H:i:s', time() - 30 * 86400);
        $porDia = [];
        for ($i = 29; $i >= 0; $i--) {
            $porDia[gmdate('Y-m-d', time() - $i * 86400)] = 0;
        }
        foreach (DB::select('SELECT substr(created_at, 1, 10) AS dia, COUNT(*) AS n FROM tenants WHERE created_at >= ? GROUP BY dia', [gmdate('Y-m-d', time() - 29 * 86400)]) as $l) {
            if (isset($porDia[$l['dia']])) {
                $porDia[$l['dia']] = (int) $l['n'];
            }
        }
        $lista = DB::select("SELECT t.id, t.nome, t.status, t.created_at,
            (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.papel = 'dono' ORDER BY u.id LIMIT 1) AS dono_email,
            (SELECT COUNT(*) FROM tables m WHERE m.tenant_id = t.id AND m.ativo = 1) AS mesas,
            (SELECT COUNT(*) FROM products p WHERE p.tenant_id = t.id) AS produtos,
            (SELECT COUNT(*) FROM devices d WHERE d.tenant_id = t.id AND d.status = 'ativo') AS tablets,
            (SELECT MAX(last_seen_at) FROM devices d WHERE d.tenant_id = t.id) AS ultimo_sinal
            FROM tenants t ORDER BY t.id DESC");
        $emUso = $configurando = 0;
        $ajuda = [];
        foreach ($lista as $t) {
            $pronto = $t['mesas'] > 0 && $t['produtos'] > 0 && $t['tablets'] > 0;
            if ($t['status'] !== 'ativo') {
                continue;
            }
            $pronto ? $emUso++ : $configurando++;
            if (! $pronto && $t['created_at'] < gmdate('Y-m-d H:i:s', time() - 2 * 86400)) {
                $ajuda[] = $t;
            }
        }
        $b = DB::selectOne("SELECT ultima_em FROM tarefas WHERE nome = 'backup'");

        return response()->json([
            'restaurantes' => ['ativos' => (int) DB::scalar("SELECT COUNT(*) FROM tenants WHERE status = 'ativo'"), 'bloqueados' => (int) DB::scalar("SELECT COUNT(*) FROM tenants WHERE status <> 'ativo'"),
                'em_uso' => $emUso, 'configurando' => $configurando],
            'cadastros' => ['d7' => (int) DB::scalar('SELECT COUNT(*) FROM tenants WHERE created_at >= ?', [$d7]), 'd30' => (int) DB::scalar('SELECT COUNT(*) FROM tenants WHERE created_at >= ?', [$d30])],
            'usuarios' => ['total' => (int) DB::scalar("SELECT COUNT(*) FROM users WHERE papel <> 'plataforma' AND ativo = 1"), 'google' => (int) DB::scalar('SELECT COUNT(*) FROM users WHERE google_sub IS NOT NULL')],
            'tablets_ativados' => (int) DB::scalar("SELECT COUNT(*) FROM devices WHERE status = 'ativo'"),
            'cadastros_por_dia' => array_map(fn ($d, $n) => ['dia' => $d, 'n' => $n], array_keys($porDia), $porDia),
            'recentes' => array_slice($lista, 0, 6),
            'precisam_ajuda' => array_slice($ajuda, 0, 6),
            'erros_abertos' => (int) DB::scalar('SELECT COUNT(*) FROM erros WHERE resolvido = 0'),
            'sugestoes_novas' => (int) DB::scalar('SELECT COUNT(*) FROM sugestoes WHERE lida = 0'),
            'servicos' => ['email' => Email::configurado(), 'google' => GoogleController::configurado(), 'cadastro' => CadastroController::aberto(), 'volume' => ! sem_volume(),
                'backup' => $b['ultima_em'] ?? null],
        ]);
    }

    public function criar()
    {
        $u = usuario();
        $in = entrada();
        $nome = texto($in, 'nome', 60, true, 'Nome do estabelecimento');
        $donoNome = texto($in, 'dono_nome', 60, true, 'Nome do responsável');
        $email = email_valido($in['dono_email'] ?? '');
        if (DB::scalar('SELECT 1 FROM users WHERE email = ?', [$email])) {
            erro(409, 'Este e-mail já está em uso.');
        }
        $senha = senha_valida($in['dono_senha'] ?? '');
        $pin = (string) ($in['pin'] ?? '');
        if ($pin !== '' && ! preg_match('/^\d{4}$/', $pin)) {
            erro(422, 'O PIN do tablet precisa ter 4 números.');
        }
        $mesas = (int) ($in['mesas'] ?? 0);
        if ($mesas < 0 || $mesas > 200) {
            erro(422, 'Quantidade de mesas de 0 a 200.');
        }
        $tid = DB::transaction(fn () => Estabelecimentos::criar($nome, $pin !== '' ? $pin : null, $donoNome, $email, $senha, $mesas));
        Auditoria::registrar(null, 'usuario:'.$u['id'], 'plataforma.estabelecimento_criado', (string) $tid, ['nome' => $nome]);

        return response()->json(['ok' => true, 'id' => $tid], 201);
    }

    public function salvar(string $id)
    {
        $u = usuario();
        $t = DB::selectOne('SELECT * FROM tenants WHERE id = ?', [(int) $id]) ?? erro(404, 'Estabelecimento não encontrado.');
        $in = entrada();
        $status = array_key_exists('status', $in) ? (string) $in['status'] : $t['status'];
        if (! in_array($status, ['ativo', 'bloqueado'], true)) {
            erro(422, 'Situação inválida.');
        }
        $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 60) : $t['nome'];
        DB::update('UPDATE tenants SET status = ?, nome = ? WHERE id = ?', [$status, $nome, $t['id']]);
        Auditoria::registrar((int) $t['id'], 'usuario:'.$u['id'], 'plataforma.estabelecimento_alterado', (string) $t['id'], ['status' => $status]);

        return response()->json(['ok' => true]);
    }

    public function baixarBackup()
    {
        $u = usuario();
        $arq = pasta_dados('backup-'.bin2hex(random_bytes(6)).'.sqlite');
        Backup::copiaDoBanco($arq);
        Auditoria::registrar(null, 'usuario:'.$u['id'], 'plataforma.backup');

        return response()->download($arq, 'deufome-backup-'.gmdate('Y-m-d-His').'.sqlite', [
            'Content-Type' => 'application/vnd.sqlite3', 'Cache-Control' => 'no-store',
        ])->deleteFileAfterSend(true);
    }

    public function status()
    {
        $b = DB::selectOne("SELECT ultima_em, detalhe FROM tarefas WHERE nome = 'backup'");

        return response()->json([
            'email' => Email::configurado(), 'google' => GoogleController::configurado(), 'cadastro' => CadastroController::aberto(), 'sem_volume' => sem_volume(),
            'backup' => $b ? ['quando' => $b['ultima_em'], 'info' => json_decode($b['detalhe'], true)] : null, 'backups' => Backup::locais(),
            'erros_abertos' => (int) DB::scalar('SELECT COUNT(*) FROM erros WHERE resolvido = 0'),
            'sugestoes_novas' => (int) DB::scalar('SELECT COUNT(*) FROM sugestoes WHERE lida = 0'),
            'url' => url_app(),
        ]);
    }

    public function enviarBackup()
    {
        $info = Backup::fazer(true);
        if (! $info['email']) {
            erro(409, Email::configurado() ? 'O backup foi gerado, mas o e-mail falhou. Veja os logs do Railway.' : 'Backup gerado no volume. Para receber por e-mail, configure BREVO_API_KEY e EMAIL_REMETENTE.');
        }

        return response()->json(['ok' => true] + $info);
    }

    public function erros()
    {
        return response()->json(['erros' => DB::select('SELECT e.*, t.nome AS estabelecimento FROM erros e LEFT JOIN tenants t ON t.id = e.tenant_id ORDER BY e.resolvido, e.ultima_em DESC LIMIT 200')]);
    }

    public function salvarErro(string $id)
    {
        if (! DB::update('UPDATE erros SET resolvido = ? WHERE id = ?', [empty(entrada()['resolvido']) ? 0 : 1, (int) $id])) {
            erro(404, 'Erro não encontrado.');
        }

        return response()->json(['ok' => true]);
    }

    public function sugestoes()
    {
        return response()->json(['sugestoes' => DB::select('SELECT s.*, t.nome AS estabelecimento, u.nome AS autor, u.email FROM sugestoes s LEFT JOIN tenants t ON t.id = s.tenant_id LEFT JOIN users u ON u.id = s.user_id ORDER BY s.lida, s.id DESC LIMIT 300')]);
    }

    public function salvarSugestao(string $id)
    {
        if (! DB::update('UPDATE sugestoes SET lida = ? WHERE id = ?', [empty(entrada()['lida']) ? 0 : 1, (int) $id])) {
            erro(404, 'Sugestão não encontrada.');
        }

        return response()->json(['ok' => true]);
    }
}
