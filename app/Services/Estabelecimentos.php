<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class Estabelecimentos
{
    public static function slugUnico(string $nome): string
    {
        $base = Str::slug($nome) ?: 'estabelecimento';
        $slug = substr($base, 0, 40);
        $n = 1;
        while (DB::scalar('SELECT 1 FROM tenants WHERE slug = ?', [$slug])) {
            $slug = substr($base, 0, 36).'-'.(++$n);
        }

        return $slug;
    }

    public static function criar(string $nome, ?string $pin, string $donoNome, string $donoEmail, string $donoSenha, int $mesas): int
    {
        $tid = DB::table('tenants')->insertGetId([
            'nome' => $nome, 'slug' => self::slugUnico($nome),
            'pin_gerente_hash' => $pin !== null ? password_hash($pin, PASSWORD_DEFAULT) : null,
            'horarios' => '', 'preferencias' => '{}', 'created_at' => agora(),
        ]);
        DB::insert("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?, 'dono', ?)",
            [$tid, $donoNome, strtolower($donoEmail), password_hash($donoSenha, PASSWORD_DEFAULT), agora()]);
        for ($m = 1; $m <= $mesas; $m++) {
            DB::insert('INSERT INTO tables (tenant_id, numero, nome) VALUES (?,?,?)', [$tid, $m, sprintf('Mesa %02d', $m)]);
        }

        return $tid;
    }

    public static function garantirAdministrador(): void
    {
        $email = strtolower(variavel('PLATAFORMA_EMAIL'));
        $senha = variavel('PLATAFORMA_SENHA');
        if ($email === '' || strlen($senha) < 8) {
            return;
        }
        $u = DB::selectOne('SELECT id, papel, senha_hash, ativo FROM users WHERE email = ?', [$email]);
        if (! $u) {
            DB::insert("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (NULL, 'Administrador', ?, ?, 'plataforma', ?)",
                [$email, password_hash($senha, PASSWORD_DEFAULT), agora()]);

            return;
        }
        if (variavel('PLATAFORMA_REDEFINIR') === '1' && $u['papel'] === 'plataforma' && (! $u['ativo'] || ! password_verify($senha, $u['senha_hash']))) {
            DB::update('UPDATE users SET senha_hash = ?, ativo = 1 WHERE id = ?', [password_hash($senha, PASSWORD_DEFAULT), $u['id']]);
            DB::delete('DELETE FROM login_tentativas WHERE email = ?', [$email]);
        }
    }

    public static function situacaoAdministrador(): array
    {
        $email = strtolower(variavel('PLATAFORMA_EMAIL'));

        return [
            'variavel_email' => $email !== '',
            'variavel_senha_ok' => strlen(variavel('PLATAFORMA_SENHA')) >= 8,
            'administrador_criado' => DB::scalar('SELECT papel FROM users WHERE email = ?', [$email]) === 'plataforma',
            'volume' => ! sem_volume(),
        ];
    }
}
