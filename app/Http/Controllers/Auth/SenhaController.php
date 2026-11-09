<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Email;
use App\Services\Limite;
use Illuminate\Support\Facades\DB;

class SenhaController extends Controller
{
    public function esqueci()
    {
        $email = strtolower(trim((string) (entrada()['email'] ?? '')));
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            erro(422, 'Digite um e-mail válido.');
        }
        Limite::contar('esqueci-ip:'.ip_cliente(), 10, 3600);
        Limite::contar('esqueci:'.$email, 3, 3600);
        $u = DB::selectOne('SELECT u.id, u.nome, u.ativo, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id WHERE u.email = ?', [$email]);
        if ($u && $u['ativo'] && ($u['tenant_status'] ?? 'ativo') === 'ativo') {
            $token = bin2hex(random_bytes(32));
            DB::update('UPDATE senha_tokens SET usado_em = ? WHERE user_id = ? AND usado_em IS NULL', ['substituido', $u['id']]);
            DB::insert('INSERT INTO senha_tokens (user_id, token_hash, expira_em) VALUES (?,?,?)', [$u['id'], hash('sha256', $token), gmdate('Y-m-d H:i:s', time() + 3600)]);
            Email::enviar($email, 'Redefinir sua senha do Deu Fome', Email::modelo('Redefinir senha',
                '<p>Olá, '.e($u['nome']).'. Recebemos um pedido para criar uma nova senha.</p><p>O link vale por 1 hora e só pode ser usado uma vez. Se não foi você, ignore este e-mail.</p>',
                'Criar nova senha', url_app().'/admin#redefinir='.$token));
        }

        return response()->json(['ok' => true]);
    }

    public function redefinir()
    {
        $in = entrada();
        $token = (string) ($in['token'] ?? '');
        if (! preg_match('/^[a-f0-9]{64}$/', $token)) {
            erro(422, 'Link inválido. Peça um novo.');
        }
        $senha = senha_valida($in['senha'] ?? '');
        $t = DB::selectOne('SELECT t.id, t.user_id, u.email FROM senha_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ? AND t.usado_em IS NULL AND t.expira_em > ?', [hash('sha256', $token), agora()]);
        if (! $t) {
            erro(422, 'Este link expirou ou já foi usado. Peça um novo.');
        }
        DB::transaction(function () use ($t, $senha) {
            DB::update('UPDATE users SET senha_hash = ? WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $t['user_id']]);
            DB::update('UPDATE senha_tokens SET usado_em = ? WHERE user_id = ? AND usado_em IS NULL', [agora(), $t['user_id']]);
            DB::delete('DELETE FROM login_tentativas WHERE email = ?', [$t['email']]);
        });
        Auditoria::registrar(null, 'usuario:'.$t['user_id'], 'senha.redefinida');

        return response()->json(['ok' => true]);
    }
}
