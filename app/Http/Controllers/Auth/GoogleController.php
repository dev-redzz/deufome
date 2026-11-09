<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\MonitorErros;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GoogleController extends Controller
{
    public static function configurado(): bool
    {
        return variavel('GOOGLE_CLIENT_ID') !== '' && variavel('GOOGLE_CLIENT_SECRET') !== '';
    }

    private static function retornoUrl(): string
    {
        return url_app().'/auth/google/retorno';
    }

    public function inicio(Request $request)
    {
        if (! self::configurado()) {
            return $this->ir('/admin#erro=google-off');
        }
        $estado = bin2hex(random_bytes(16));
        $request->session()->put('oauth_state', $estado);
        $url = (variavel('GOOGLE_AUTH_URL') ?: 'https://accounts.google.com/o/oauth2/v2/auth').'?'.http_build_query([
            'client_id' => variavel('GOOGLE_CLIENT_ID'),
            'redirect_uri' => self::retornoUrl(),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $estado,
            'prompt' => 'select_account',
        ]);

        return $this->ir($url);
    }

    public function retorno(Request $request)
    {
        try {
            return $this->processar($request);
        } catch (Throwable $e) {
            MonitorErros::registrar('servidor', get_class($e).': '.$e->getMessage(), $e->getFile().':'.$e->getLine(), '/auth/google/retorno');

            return $this->ir('/admin#erro=google-falhou');
        }
    }

    private function processar(Request $request)
    {
        $esperado = (string) $request->session()->pull('oauth_state', '');
        if ($request->query('error')) {
            return $this->ir('/admin#erro=google-cancelado');
        }
        if ($esperado === '' || ! hash_equals($esperado, (string) $request->query('state', '')) || ! $request->query('code')) {
            return $this->ir('/admin#erro=google-sessao');
        }
        $r = Http::asForm()->acceptJson()->timeout(12)->post(variavel('GOOGLE_TOKEN_URL') ?: 'https://oauth2.googleapis.com/token', [
            'code' => (string) $request->query('code'),
            'client_id' => variavel('GOOGLE_CLIENT_ID'),
            'client_secret' => variavel('GOOGLE_CLIENT_SECRET'),
            'redirect_uri' => self::retornoUrl(),
            'grant_type' => 'authorization_code',
        ]);
        $c = ($r->status() === 200 && $r->json('id_token')) ? self::lerJwt((string) $r->json('id_token')) : null;
        $validos = ['accounts.google.com', 'https://accounts.google.com'];
        if (! $c || ! in_array($c['iss'] ?? '', $validos, true) || ($c['aud'] ?? '') !== variavel('GOOGLE_CLIENT_ID') || (int) ($c['exp'] ?? 0) < time()
            || empty($c['sub']) || empty($c['email']) || ! filter_var($c['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            Log::warning('[google] resposta inválida status='.$r->status());

            return $this->ir('/admin#erro=google-falhou');
        }
        $email = strtolower((string) $c['email']);
        $sub = (string) $c['sub'];
        $u = DB::selectOne('SELECT u.*, t.status AS tenant_status FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
            WHERE u.google_sub = ? OR u.email = ? ORDER BY (u.google_sub = ?) DESC LIMIT 1', [$sub, $email, $sub]);
        if ($u) {
            if (! $u['ativo']) {
                return $this->ir('/admin#erro=desativado');
            }
            if ($u['tenant_id'] && $u['tenant_status'] !== 'ativo') {
                return $this->ir('/admin#erro=bloqueado');
            }
            if (! $u['google_sub']) {
                DB::update('UPDATE users SET google_sub = ? WHERE id = ?', [$sub, $u['id']]);
            }
            SessaoController::entrarComo((int) $u['id']);

            return $this->ir($u['papel'] === 'cozinha' ? '/cozinha' : '/admin');
        }
        if (! CadastroController::aberto()) {
            return $this->ir('/admin#erro=sem-conta');
        }
        $request->session()->put('google_pendente', ['sub' => $sub, 'email' => $email, 'nome' => mb_substr((string) ($c['name'] ?? ''), 0, 60), 'em' => time()]);

        return $this->ir('/cadastro#google');
    }

    private static function lerJwt(string $jwt): ?array
    {
        $partes = explode('.', $jwt);
        if (count($partes) !== 3) {
            return null;
        }
        $json = base64_decode(strtr($partes[1], '-_', '+/').str_repeat('=', (4 - strlen($partes[1]) % 4) % 4), true);
        $dados = $json ? json_decode($json, true) : null;

        return is_array($dados) ? $dados : null;
    }

    private function ir(string $para)
    {
        return redirect()->away($para)->header('Cache-Control', 'no-store');
    }
}
