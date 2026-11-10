<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Cupons;
use Illuminate\Support\Facades\DB;

class CupomController extends Controller
{
    private static function cupom(int $tid, int $id): array
    {
        return DB::selectOne('SELECT * FROM cupons WHERE id = ? AND tenant_id = ?', [$id, $tid]) ?? erro(404, 'Cupom não encontrado.');
    }

    private static function campos(array $in, ?array $atual = null): array
    {
        $tipo = (string) ($in['tipo'] ?? $atual['tipo'] ?? '');
        if (! in_array($tipo, ['percentual', 'valor'], true)) {
            erro(422, 'Escolha se o desconto é em % ou em reais.');
        }
        if ($tipo === 'percentual') {
            $valor = (int) ($in['valor'] ?? $atual['valor'] ?? 0);
            if ($valor < 1 || $valor > 100) {
                erro(422, 'O desconto deve ser de 1% a 100%.');
            }
        } else {
            $valor = array_key_exists('valor', $in) ? centavos($in['valor'], 'Valor do desconto') : (int) $atual['valor'];
            if ($valor < 1) {
                erro(422, 'Informe o valor do desconto.');
            }
        }
        $minimo = array_key_exists('minimo', $in) ? ($in['minimo'] === '' || $in['minimo'] === null ? 0 : centavos($in['minimo'], 'Valor mínimo')) : (int) ($atual['minimo'] ?? 0);
        $validade = array_key_exists('validade', $in) ? ((string) $in['validade'] ?: null) : ($atual['validade'] ?? null);
        if ($validade !== null && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $validade)) {
            erro(422, 'Data de validade inválida.');
        }
        $limite = array_key_exists('limite', $in) ? ($in['limite'] === '' || $in['limite'] === null ? null : max(1, min(100000, (int) $in['limite']))) : ($atual['limite'] ?? null);
        $ativo = array_key_exists('ativo', $in) ? ($in['ativo'] ? 1 : 0) : (int) ($atual['ativo'] ?? 1);

        return compact('tipo', 'valor', 'minimo', 'validade', 'limite', 'ativo');
    }

    public function listar()
    {
        $lista = DB::select('SELECT id, codigo, tipo, valor, minimo, validade, limite, usos, ativo, created_at FROM cupons WHERE tenant_id = ? ORDER BY ativo DESC, id DESC', [usuario()['tenant_id']]);
        foreach ($lista as &$c) {
            $c['descricao'] = Cupons::descricao($c);
            $c['economia'] = (int) DB::scalar("SELECT COALESCE(SUM(desconto),0) FROM table_sessions WHERE cupom_id = ? AND status = 'fechada'", [$c['id']]);
        }

        return response()->json(['cupons' => $lista]);
    }

    public function criar()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $in = entrada();
        $codigo = Cupons::normalizar((string) ($in['codigo'] ?? ''));
        if (strlen($codigo) < 3 || strlen($codigo) > 20) {
            erro(422, 'O código precisa ter de 3 a 20 letras ou números.');
        }
        if (DB::scalar('SELECT 1 FROM cupons WHERE tenant_id = ? AND codigo = ?', [$tid, $codigo])) {
            erro(409, "Já existe o cupom $codigo.");
        }
        $id = DB::table('cupons')->insertGetId(['tenant_id' => $tid, 'codigo' => $codigo, 'created_at' => agora()] + self::campos($in));
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'cupom.criado', $codigo);

        return response()->json(['ok' => true, 'id' => $id], 201);
    }

    public function salvar(string $id)
    {
        $u = usuario();
        $c = self::cupom((int) $u['tenant_id'], (int) $id);
        DB::table('cupons')->where('id', $c['id'])->update(self::campos(entrada(), $c));

        return response()->json(['ok' => true]);
    }

    public function remover(string $id)
    {
        $u = usuario();
        $c = self::cupom((int) $u['tenant_id'], (int) $id);
        if ((int) $c['usos'] > 0 || DB::scalar('SELECT 1 FROM table_sessions WHERE cupom_id = ?', [$c['id']])) {
            DB::update('UPDATE cupons SET ativo = 0 WHERE id = ?', [$c['id']]);

            return response()->json(['ok' => true, 'desativado' => true]);
        }
        DB::delete('DELETE FROM cupons WHERE id = ?', [$c['id']]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'cupom.removido', $c['codigo']);

        return response()->json(['ok' => true]);
    }
}
