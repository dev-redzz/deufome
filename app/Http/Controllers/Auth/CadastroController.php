<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Email;
use App\Services\Estabelecimentos;
use App\Services\Limite;
use Illuminate\Support\Facades\DB;

class CadastroController extends Controller
{
    public static function aberto(): bool
    {
        return variavel('CADASTRO_ABERTO') !== '0';
    }

    private static function emailLivre(string $e): void
    {
        if (DB::scalar('SELECT 1 FROM users WHERE email = ?', [$e])) {
            erro(409, 'Este e-mail já está em uso.');
        }
    }

    private static function restaurante(array $in): string
    {
        if (empty($in['aceite'])) {
            erro(422, 'Para criar a conta, aceite os Termos de uso e a Política de privacidade.');
        }

        return texto($in, 'restaurante', 60, true, 'Nome do restaurante');
    }

    private static function googlePendente(): ?array
    {
        $p = request()->session()->get('google_pendente');

        return ($p && $p['em'] >= time() - 1800) ? $p : null;
    }

    private static function boasVindas(string $email, string $nome, string $restaurante): void
    {
        Email::enviar($email, 'Bem-vindo ao Deu Fome', Email::modelo("Olá, $nome!",
            '<p>A conta do <b>'.e($restaurante).'</b> foi criada. Os próximos passos são:</p><ol><li>Cadastre as mesas em <b>Mesas</b>.</li><li>Monte o cardápio em <b>Cardápio</b>.</li><li>Defina o PIN e a aparência do tablet em <b>Configurações</b>.</li><li>Cadastre os tablets em <b>Dispositivos</b> e ative cada um em <b>'.e(url_app()).'/tablet</b>.</li></ol>',
            'Abrir o painel', url_app().'/admin'));
        $plat = variavel('PLATAFORMA_EMAIL');
        if ($plat) {
            Email::enviar($plat, '[Deu Fome] Novo restaurante: '.$restaurante, Email::modelo('Novo cadastro',
                '<p><b>'.e($restaurante).'</b> criou uma conta.</p><p>Responsável: '.e($nome).' ('.e($email).')</p>', 'Ver estabelecimentos', url_app().'/admin'));
        }
    }

    public function criar()
    {
        if (! self::aberto()) {
            erro(403, 'O cadastro de novos restaurantes está fechado no momento.');
        }
        $in = entrada();
        $restaurante = self::restaurante($in);
        $nome = texto($in, 'nome', 60, true, 'Seu nome');
        $email = email_valido($in['email'] ?? '');
        $senha = senha_valida($in['senha'] ?? '');
        Limite::contar('cadastro:'.ip_cliente(), 5, 3600);
        self::emailLivre($email);
        $tid = DB::transaction(fn () => Estabelecimentos::criar($restaurante, null, $nome, $email, $senha, 0));
        SessaoController::entrarComo((int) DB::scalar('SELECT id FROM users WHERE email = ?', [$email]));
        Auditoria::registrar($tid, 'cadastro', 'estabelecimento.cadastrado', (string) $tid, ['origem' => 'email']);
        self::boasVindas($email, $nome, $restaurante);

        return response()->json(['ok' => true], 201);
    }

    public function lerGoogle()
    {
        $p = self::googlePendente() ?? erro(404, 'Entre com o Google novamente.');

        return response()->json(['email' => $p['email'], 'nome' => $p['nome']]);
    }

    public function criarGoogle()
    {
        if (! self::aberto()) {
            erro(403, 'O cadastro de novos restaurantes está fechado no momento.');
        }
        $p = self::googlePendente() ?? erro(409, 'Sua confirmação do Google expirou. Clique em "Continuar com Google" de novo.');
        $in = entrada();
        $restaurante = self::restaurante($in);
        $nome = texto($in, 'nome', 60, true, 'Seu nome');
        Limite::contar('cadastro:'.ip_cliente(), 5, 3600);
        self::emailLivre($p['email']);
        $tid = DB::transaction(function () use ($restaurante, $nome, $p) {
            $tid = Estabelecimentos::criar($restaurante, null, $nome, $p['email'], bin2hex(random_bytes(24)), 0);
            DB::update('UPDATE users SET google_sub = ? WHERE email = ?', [$p['sub'], $p['email']]);

            return $tid;
        });
        SessaoController::entrarComo((int) DB::scalar('SELECT id FROM users WHERE email = ?', [$p['email']]));
        Auditoria::registrar($tid, 'cadastro', 'estabelecimento.cadastrado', (string) $tid, ['origem' => 'google']);
        self::boasVindas($p['email'], $nome, $restaurante);

        return response()->json(['ok' => true], 201);
    }
}
