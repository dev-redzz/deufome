<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use Illuminate\Support\Facades\DB;

class MesaController extends Controller
{
    private static function numero($v): int
    {
        $n = (int) $v;
        if ($n < 1 || $n > 999) {
            erro(422, 'Número da mesa deve ser de 1 a 999.');
        }

        return $n;
    }

    private static function mesa(int $tid, int $id): array
    {
        return DB::selectOne('SELECT * FROM tables WHERE id = ? AND tenant_id = ?', [$id, $tid]) ?? erro(404, 'Mesa não encontrada.');
    }

    public function listar()
    {
        return response()->json(['mesas' => DB::select("SELECT m.id, m.numero, m.nome, m.pos_x, m.pos_y, m.formato, m.lugares,
            (SELECT d.nome FROM devices d WHERE d.table_id = m.id AND d.status <> 'bloqueado' LIMIT 1) AS tablet,
            (SELECT 1 FROM table_sessions s WHERE s.table_id = m.id AND s.status IN ('aberta','conta_solicitada')) AS ocupada
            FROM tables m WHERE m.tenant_id = ? AND m.ativo = 1 ORDER BY m.numero", [usuario()['tenant_id']])]);
    }

    public function criar()
    {
        $tid = (int) usuario()['tenant_id'];
        $in = entrada();
        $numero = self::numero($in['numero'] ?? 0);
        $nome = texto($in, 'nome', 30, false) ?: sprintf('Mesa %02d', $numero);
        $existente = DB::selectOne('SELECT * FROM tables WHERE tenant_id = ? AND numero = ?', [$tid, $numero]);
        if ($existente && $existente['ativo']) {
            erro(409, "Já existe a mesa $numero.");
        }
        if ($existente) {
            DB::update('UPDATE tables SET ativo = 1, nome = ? WHERE id = ?', [$nome, $existente['id']]);

            return response()->json(['ok' => true, 'id' => (int) $existente['id']], 201);
        }
        $id = DB::table('tables')->insertGetId(['tenant_id' => $tid, 'numero' => $numero, 'nome' => $nome]);

        return response()->json(['ok' => true, 'id' => $id], 201);
    }

    /** Cria várias mesas de uma vez, a partir do próximo número livre. */
    public function criarVarias()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $qtd = (int) (entrada()['quantidade'] ?? 0);
        if ($qtd < 1 || $qtd > 100) {
            erro(422, 'Escolha de 1 a 100 mesas.');
        }
        $criadas = DB::transaction(function () use ($tid, $qtd) {
            $usados = array_map('intval', array_column(DB::select('SELECT numero FROM tables WHERE tenant_id = ? AND ativo = 1', [$tid]), 'numero'));
            $criadas = 0;
            for ($n = 1; $criadas < $qtd && $n <= 999; $n++) {
                if (in_array($n, $usados, true)) {
                    continue;
                }
                $inativa = DB::scalar('SELECT id FROM tables WHERE tenant_id = ? AND numero = ?', [$tid, $n]);
                if ($inativa) {
                    DB::update('UPDATE tables SET ativo = 1, nome = ? WHERE id = ?', [sprintf('Mesa %02d', $n), $inativa]);
                } else {
                    DB::insert('INSERT INTO tables (tenant_id, numero, nome) VALUES (?,?,?)', [$tid, $n, sprintf('Mesa %02d', $n)]);
                }
                $criadas++;
            }

            return $criadas;
        });
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'mesa.lote', null, ['quantidade' => $criadas]);

        return response()->json(['ok' => true, 'criadas' => $criadas], 201);
    }

    public function salvar(string $id)
    {
        $tid = (int) usuario()['tenant_id'];
        $m = self::mesa($tid, (int) $id);
        if (! $m['ativo']) {
            erro(404, 'Mesa não encontrada.');
        }
        $in = entrada();
        $numero = array_key_exists('numero', $in) ? self::numero($in['numero']) : (int) $m['numero'];
        $nome = array_key_exists('nome', $in) ? (texto($in, 'nome', 30, false) ?: sprintf('Mesa %02d', $numero)) : $m['nome'];
        if ($numero !== (int) $m['numero']) {
            $outro = DB::selectOne('SELECT ativo FROM tables WHERE tenant_id = ? AND numero = ? AND id <> ?', [$tid, $numero, $m['id']]);
            if ($outro && $outro['ativo']) {
                erro(409, "Já existe a mesa $numero.");
            }
            if ($outro) {
                erro(409, "O número $numero pertence a uma mesa removida. Crie a mesa $numero para reativá-la.");
            }
        }
        $formato = array_key_exists('formato', $in) ? (in_array($in['formato'], ['quadrada', 'redonda', 'retangular'], true) ? $in['formato'] : erro(422, 'Formato inválido.')) : $m['formato'];
        $lugares = array_key_exists('lugares', $in) ? max(1, min(30, (int) $in['lugares'])) : (int) $m['lugares'];
        DB::update('UPDATE tables SET numero = ?, nome = ?, formato = ?, lugares = ? WHERE id = ?', [$numero, $nome, $formato, $lugares, $m['id']]);

        return response()->json(['ok' => true]);
    }

    /** Salva as posições das mesas no mapa do salão (0 a 1000 em cada eixo). */
    public function mapa()
    {
        $tid = (int) usuario()['tenant_id'];
        $lista = entrada()['posicoes'] ?? null;
        if (! is_array($lista) || count($lista) > 500) {
            erro(422, 'Posições inválidas.');
        }
        DB::transaction(function () use ($lista, $tid) {
            foreach ($lista as $p) {
                $x = isset($p['x']) ? max(0, min(1000, (int) $p['x'])) : null;
                $y = isset($p['y']) ? max(0, min(1000, (int) $p['y'])) : null;
                DB::update('UPDATE tables SET pos_x = ?, pos_y = ? WHERE id = ? AND tenant_id = ?', [$x, $y, (int) ($p['id'] ?? 0), $tid]);
            }
        });

        return response()->json(['ok' => true]);
    }

    public function remover(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $m = self::mesa($tid, (int) $id);
        if (Atendimento::sessaoAberta($tid, (int) $m['id'])) {
            erro(409, 'Esta mesa está com a conta aberta. Feche a conta antes de remover.');
        }
        DB::update('UPDATE devices SET table_id = NULL WHERE table_id = ?', [$m['id']]);
        if (DB::scalar('SELECT 1 FROM table_sessions WHERE table_id = ? UNION SELECT 1 FROM service_calls WHERE table_id = ? LIMIT 1', [$m['id'], $m['id']])) {
            DB::update('UPDATE tables SET ativo = 0 WHERE id = ?', [$m['id']]);
        } else {
            DB::delete('DELETE FROM tables WHERE id = ?', [$m['id']]);
        }
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'mesa.removida', (string) $m['id']);

        return response()->json(['ok' => true]);
    }
}
