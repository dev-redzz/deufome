<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\Usuario;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SessaoController extends Controller
{
    public function entrar(Request $request)
    {
        $in = entrada();
        $email = strtolower(trim((string) ($in['email'] ?? '')));
        $senha = (string) ($in['senha'] ?? '');
        $ip = ip_cliente();
        $limite = gmdate('Y-m-d H:i:s', time() - 15 * 60);
        DB::delete('DELETE FROM login_tentativas WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 86400)]);
        $porEmail = (int) DB::scalar('SELECT COUNT(*) FROM login_tentativas WHERE email = ? AND created_at > ?', [$email, $limite]);
        $porIp = (int) DB::scalar('SELECT COUNT(*) FROM login_tentativas WHERE ip = ? AND created_at > ?', [$ip, $limite]);
        if ($porEmail >= 8 || $porIp >= 30) {
            erro(429, 'Muitas tentativas. Espere 15 minutos e tente de novo.');
        }
        $u = DB::selectOne('SELECT u.*, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = ?', [$email]);
        if (! $u || ! $u['ativo'] || ! password_verify($senha, $u['senha_hash'])) {
            DB::insert('INSERT INTO login_tentativas (ip, email, created_at) VALUES (?,?,?)', [$ip, $email, agora()]);
            usleep(400000);
            erro(422, 'E-mail ou senha incorretos.');
        }
        if ($u['tenant_id'] && $u['tenant_status'] !== 'ativo') {
            erro(403, 'Este estabelecimento está bloqueado. Fale com o suporte do Deu Fome.');
        }
        DB::delete('DELETE FROM login_tentativas WHERE email = ?', [$email]);
        if (password_needs_rehash($u['senha_hash'], PASSWORD_DEFAULT)) {
            DB::update('UPDATE users SET senha_hash = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $u['id']]);
        }
        self::entrarComo((int) $u['id']);
        $request->session()->put('lembrar', ! empty($in['lembrar']));

        return response()->json(['ok' => true, 'papel' => $u['papel']]);
    }

    public static function entrarComo(int $id): void
    {
        $s = request()->session();
        $s->forget(['google_pendente', 'oauth_state']);
        Auth::login(Usuario::findOrFail($id));
        $s->regenerate(true);
        $s->put('sv', (int) DB::scalar('SELECT sessao_versao FROM users WHERE id = ?', [$id]));
        DB::update('UPDATE users SET ultimo_acesso = ? WHERE id = ?', [agora(), $id]);
    }

    public function sair(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();

        return response()->json(['ok' => true]);
    }

    public function info()
    {
        return response()->json([
            'demo' => modo_demo(), 'versao' => versao_app(),
            'google' => GoogleController::configurado(), 'cadastro' => CadastroController::aberto(),
        ]);
    }

    public function eu()
    {
        $u = usuario();

        return response()->json([
            'id' => $u['id'], 'nome' => $u['nome'], 'email' => $u['email'], 'papel' => $u['papel'],
            'estabelecimento' => $u['estabelecimento'], 'sem_volume' => sem_volume() && $u['papel'] === 'plataforma',
            'google' => (bool) DB::scalar('SELECT google_sub IS NOT NULL FROM users WHERE id = ?', [$u['id']]),
            'desde' => DB::scalar('SELECT created_at FROM users WHERE id = ?', [$u['id']]),
        ]);
    }

    public function minhaConta()
    {
        $u = usuario();
        DB::update('UPDATE users SET nome = ? WHERE id = ?', [texto(entrada(), 'nome', 60), $u['id']]);

        return response()->json(['ok' => true]);
    }

    /** Encerra todas as outras sessões desta pessoa (mantém esta). */
    public function sairDeTodos(Request $request)
    {
        $u = usuario();
        DB::update('UPDATE users SET sessao_versao = sessao_versao + 1 WHERE id = ?', [$u['id']]);
        $request->session()->put('sv', (int) DB::scalar('SELECT sessao_versao FROM users WHERE id = ?', [$u['id']]));

        return response()->json(['ok' => true]);
    }

    public function minhaSenha()
    {
        $u = usuario();
        $in = entrada();
        if (! password_verify((string) ($in['atual'] ?? ''), (string) DB::scalar('SELECT senha_hash FROM users WHERE id = ?', [$u['id']]))) {
            erro(422, 'Senha atual incorreta.');
        }
        DB::update('UPDATE users SET senha_hash = ? WHERE id = ?', [password_hash(senha_valida($in['nova'] ?? ''), PASSWORD_DEFAULT), $u['id']]);

        return response()->json(['ok' => true]);
    }
}
