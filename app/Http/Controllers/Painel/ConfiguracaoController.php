<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use App\Services\Horario;
use App\Services\Imagens;
use App\Services\Preferencias;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfiguracaoController extends Controller
{
    private function dados(array $t): array
    {
        $h = json_decode((string) $t['horarios'], true);

        return [
            'nome' => $t['nome'], 'slug' => $t['slug'], 'taxa_servico' => (int) $t['taxa_servico'], 'fuso' => $t['fuso'],
            'fusos' => Horario::FUSOS, 'horarios' => is_array($h) ? $h : Horario::padrao(), 'situacao' => Horario::situacao($t),
            'pin_definido' => (bool) $t['pin_gerente_hash'], 'logo' => $t['logo'], 'capa' => $t['capa'],
            'preferencias' => Preferencias::de($t), 'cores' => Preferencias::CORES,
        ];
    }

    public function ler()
    {
        return response()->json($this->dados(Atendimento::tenant((int) usuario()['tenant_id'])));
    }

    public function salvar()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $in = entrada();
        if (array_key_exists('nome', $in)) {
            DB::update('UPDATE tenants SET nome = ? WHERE id = ?', [texto($in, 'nome', 60), $tid]);
        }
        if (! empty($in['pin'])) {
            if (! preg_match('/^\d{4}$/', (string) $in['pin'])) {
                erro(422, 'O PIN precisa ter 4 números.');
            }
            DB::update('UPDATE tenants SET pin_gerente_hash = ? WHERE id = ?', [password_hash((string) $in['pin'], PASSWORD_DEFAULT), $tid]);
            Auditoria::registrar($tid, 'usuario:'.$u['id'], 'config.pin_alterado');
        }
        if (array_key_exists('taxa_servico', $in)) {
            $pct = (int) $in['taxa_servico'];
            if ($pct < 0 || $pct > 30) {
                erro(422, 'A taxa de serviço deve ser de 0 a 30%.');
            }
            DB::update('UPDATE tenants SET taxa_servico = ? WHERE id = ?', [$pct, $tid]);
        }
        if (array_key_exists('fuso', $in)) {
            if (! isset(Horario::FUSOS[$in['fuso']])) {
                erro(422, 'Fuso horário inválido.');
            }
            DB::update('UPDATE tenants SET fuso = ? WHERE id = ?', [$in['fuso'], $tid]);
        }
        if (array_key_exists('horarios', $in)) {
            DB::update('UPDATE tenants SET horarios = ? WHERE id = ?', [json_encode(Horario::validar($in['horarios'])), $tid]);
        }
        if (array_key_exists('preferencias', $in)) {
            if (! is_array($in['preferencias'])) {
                erro(422, 'Preferências inválidas.');
            }
            $atual = Preferencias::de(Atendimento::tenant($tid));
            DB::update('UPDATE tenants SET preferencias = ? WHERE id = ?', [json_encode(Preferencias::validar($atual, $in['preferencias']), JSON_UNESCAPED_UNICODE), $tid]);
        }
        $t = Atendimento::tenant($tid);

        return response()->json(['ok' => true, 'situacao' => Horario::situacao($t)] + $this->dados($t));
    }

    public function imagem(Request $request)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $tipo = (string) $request->input('tipo');
        if (! in_array($tipo, ['logo', 'capa'], true)) {
            erro(422, 'Tipo de imagem inválido.');
        }
        $t = Atendimento::tenant($tid);
        $caminho = Imagens::salvar($request->file('imagem'), 't'.$tid.'-'.$tipo, $tipo === 'logo' ? 2000 : 4000);
        DB::update("UPDATE tenants SET $tipo = ? WHERE id = ?", [$caminho, $tid]);
        Imagens::apagar($t[$tipo]);

        return response()->json(['ok' => true, $tipo => $caminho]);
    }

    public function removerImagem()
    {
        $tid = (int) usuario()['tenant_id'];
        $tipo = (string) (entrada()['tipo'] ?? '');
        if (! in_array($tipo, ['logo', 'capa'], true)) {
            erro(422, 'Tipo de imagem inválido.');
        }
        $t = Atendimento::tenant($tid);
        DB::update("UPDATE tenants SET $tipo = NULL WHERE id = ?", [$tid]);
        Imagens::apagar($t[$tipo]);

        return response()->json(['ok' => true]);
    }
}
