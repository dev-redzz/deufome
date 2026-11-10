<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Atendimento;
use App\Services\Auditoria;
use App\Services\Horario;
use App\Services\Imagens;
use App\Services\Limite;
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
            'email_configurado' => \App\Services\Email::configurado(), 'criado_em' => $t['created_at'],
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

    public function resumoTeste()
    {
        $u = usuario();
        Limite::contar('resumo:'.$u['id'], 3, 3600);
        if (! \App\Services\Email::configurado() && variavel('EMAIL_LOG') !== '1') {
            erro(409, 'O envio de e-mails ainda não foi configurado no servidor (Brevo).');
        }
        \App\Services\ResumoSemanal::enviar(Atendimento::tenant((int) $u['tenant_id']), $u['email']);

        return response()->json(['ok' => true, 'para' => $u['email']]);
    }

    /** Baixa os dados do restaurante (LGPD): cardápio, mesas, equipe, contas e pedidos. */
    public function exportar()
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $t = Atendimento::tenant($tid);
        $dados = [
            'gerado_em' => agora(), 'estabelecimento' => ['nome' => $t['nome'], 'criado_em' => $t['created_at'], 'preferencias' => Preferencias::de($t)],
            'cardapio' => \App\Services\Cardapio::montar($tid),
            'mesas' => DB::select('SELECT numero, nome, lugares FROM tables WHERE tenant_id = ? AND ativo = 1', [$tid]),
            'equipe' => DB::select('SELECT nome, email, papel, ativo, created_at FROM users WHERE tenant_id = ?', [$tid]),
            'cupons' => DB::select('SELECT codigo, tipo, valor, minimo, validade, limite, usos, ativo FROM cupons WHERE tenant_id = ?', [$tid]),
            'contas' => DB::select('SELECT id, table_id, aberta_em, fechada_em, subtotal, taxa, desconto, gorjeta, total, pessoas, forma_pagamento FROM table_sessions WHERE tenant_id = ? AND status = ? ORDER BY fechada_em', [$tid, 'fechada']),
            'pedidos' => DB::select('SELECT o.numero, o.session_id, o.status, o.total, o.created_at, oi.nome, oi.quantidade, oi.subtotal FROM orders o JOIN order_items oi ON oi.order_id = o.id WHERE o.tenant_id = ? ORDER BY o.id', [$tid]),
            'avaliacoes' => DB::select('SELECT nota, tags, comentario, created_at FROM avaliacoes WHERE tenant_id = ?', [$tid]),
        ];
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'config.exportado');

        return response()->json($dados, 200, ['Content-Disposition' => 'attachment; filename="deufome-'.$t['slug'].'-'.gmdate('Y-m-d').'.json"'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    /** Pedido de exclusão da conta: confirma com o nome do restaurante e avisa a equipe do Deu Fome. */
    public function pedirExclusao()
    {
        $u = usuario();
        if ($u['papel'] !== 'dono') {
            erro(403, 'Só o dono pode pedir a exclusão da conta.');
        }
        $t = Atendimento::tenant((int) $u['tenant_id']);
        if (mb_strtolower(trim((string) (entrada()['confirmacao'] ?? ''))) !== mb_strtolower($t['nome'])) {
            erro(422, 'Digite o nome do restaurante exatamente como aparece para confirmar.');
        }
        DB::insert('INSERT INTO sugestoes (tenant_id, user_id, tipo, texto, created_at) VALUES (?,?,?,?,?)',
            [$t['id'], $u['id'], 'exclusao', 'Pedido de exclusão da conta de '.$t['nome'].' feito por '.$u['nome'].' ('.$u['email'].').', agora()]);
        Auditoria::registrar((int) $t['id'], 'usuario:'.$u['id'], 'config.exclusao_pedida');
        if ($admin = email_contato()) {
            \App\Services\Email::enviar($admin, '[Deu Fome] Pedido de exclusão: '.$t['nome'], \App\Services\Email::modelo('Pedido de exclusão de conta', '<p>'.e($u['nome']).' pediu a exclusão da conta de <b>'.e($t['nome']).'</b>.</p>'));
        }

        return response()->json(['ok' => true]);
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
