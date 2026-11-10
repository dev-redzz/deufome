<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use Illuminate\Support\Facades\DB;

class EquipeController extends Controller
{
    private const PAPEIS = ['dono', 'gerente', 'caixa', 'cozinha'];

    private static function emailLivre(string $e, int $exceto = 0): void
    {
        if (DB::scalar('SELECT 1 FROM users WHERE email = ? AND id <> ?', [$e, $exceto])) {
            erro(409, 'Este e-mail já está em uso.');
        }
    }

    public function listar()
    {
        $u = usuario();

        return response()->json([
            'equipe' => array_map(function ($p) {
                $p['google'] = (bool) $p['google'];

                return $p;
            }, DB::select('SELECT id, nome, email, papel, ativo, ultimo_acesso, created_at, google_sub IS NOT NULL AS google FROM users WHERE tenant_id = ? ORDER BY ativo DESC, nome', [$u['tenant_id']])),
            'eu' => $u['id'],
        ]);
    }

    private const ACOES = [
        'sessao.fechada' => 'fechou a conta', 'sessao.reaberta' => 'reabriu a conta', 'pedido.cancelado' => 'cancelou um pedido',
        'produto.removido' => 'removeu um produto', 'produto.esgotado' => 'marcou como esgotado', 'produto.voltou' => 'voltou a oferecer',
        'equipe.criado' => 'cadastrou na equipe', 'equipe.alterado' => 'alterou uma pessoa da equipe', 'mesa.removida' => 'removeu uma mesa',
        'mesa.lote' => 'criou mesas', 'config.pin_alterado' => 'trocou o PIN dos tablets', 'cupom.criado' => 'criou o cupom', 'cupom.removido' => 'removeu o cupom',
        'dispositivo.ativado' => 'tablet ativado', 'sessao.pix' => 'mesa escolheu pagar no Pix', 'quiosque.desbloqueado' => 'tablet desbloqueado com PIN',
    ];

    /** Últimas ações da equipe, em linguagem simples. */
    public function atividade()
    {
        $tid = (int) usuario()['tenant_id'];
        $nomes = array_column(DB::select('SELECT id, nome FROM users WHERE tenant_id = ?', [$tid]), 'nome', 'id');
        $saida = [];
        foreach (DB::select('SELECT ator, acao, alvo, dados, created_at FROM audit_logs WHERE tenant_id = ? AND acao IN ('.implode(',', array_fill(0, count(self::ACOES), '?')).') ORDER BY id DESC LIMIT 60', [$tid, ...array_keys(self::ACOES)]) as $l) {
            [$tipo, $id] = array_pad(explode(':', $l['ator'], 2), 2, '');
            $dados = json_decode((string) $l['dados'], true) ?: [];
            $detalhe = $dados['nome'] ?? (in_array($l['acao'], ['equipe.criado', 'cupom.criado', 'cupom.removido'], true) ? $l['alvo'] : null);
            if ($l['acao'] === 'sessao.fechada' && isset($dados['total'])) {
                $detalhe = 'R$ '.reais((int) $dados['total']);
            }
            if ($l['acao'] === 'pedido.cancelado' && isset($dados['motivo'])) {
                $detalhe = $dados['motivo'];
            }
            $saida[] = [
                'quem' => $tipo === 'usuario' ? ($nomes[$id] ?? 'Pessoa removida') : 'Tablet',
                'pessoa' => $tipo === 'usuario' ? (int) $id : null,
                'acao' => self::ACOES[$l['acao']], 'detalhe' => $detalhe, 'quando' => $l['created_at'],
            ];
        }

        return response()->json(['atividade' => $saida]);
    }

    public function criar()
    {
        $u = usuario();
        $in = entrada();
        $papel = (string) ($in['papel'] ?? '');
        if (! in_array($papel, self::PAPEIS, true)) {
            erro(422, 'Escolha a função.');
        }
        if ($papel === 'dono' && $u['papel'] !== 'dono') {
            erro(403, 'Só o dono pode cadastrar outro dono.');
        }
        $nome = texto($in, 'nome', 60);
        $email = email_valido($in['email'] ?? '');
        self::emailLivre($email);
        DB::insert('INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?,?,?)',
            [$u['tenant_id'], $nome, $email, password_hash(senha_valida($in['senha'] ?? ''), PASSWORD_DEFAULT), $papel, agora()]);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'equipe.criado', $email, ['papel' => $papel]);

        return response()->json(['ok' => true], 201);
    }

    public function salvar(string $id)
    {
        $u = usuario();
        $tid = (int) $u['tenant_id'];
        $alvo = DB::selectOne('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [(int) $id, $tid]) ?? erro(404, 'Pessoa não encontrada.');
        $in = entrada();
        if ($alvo['papel'] === 'dono' && $u['papel'] !== 'dono') {
            erro(403, 'Só o dono pode alterar outro dono.');
        }
        $papel = array_key_exists('papel', $in) ? (string) $in['papel'] : $alvo['papel'];
        if (! in_array($papel, self::PAPEIS, true)) {
            erro(422, 'Função inválida.');
        }
        if ($papel === 'dono' && $u['papel'] !== 'dono') {
            erro(403, 'Só o dono pode tornar alguém dono.');
        }
        $ativo = array_key_exists('ativo', $in) ? ($in['ativo'] ? 1 : 0) : (int) $alvo['ativo'];
        if ((int) $alvo['id'] === $u['id'] && ($papel !== $alvo['papel'] || ! $ativo)) {
            erro(409, 'Você não pode mudar a sua própria função nem se desativar.');
        }
        if ($alvo['papel'] === 'dono' && ($papel !== 'dono' || ! $ativo)
            && ! DB::scalar("SELECT COUNT(*) FROM users WHERE tenant_id = ? AND papel = 'dono' AND ativo = 1 AND id <> ?", [$tid, $alvo['id']])) {
            erro(409, 'O estabelecimento precisa ter pelo menos um dono ativo.');
        }
        $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 60) : $alvo['nome'];
        $email = array_key_exists('email', $in) ? email_valido($in['email']) : $alvo['email'];
        self::emailLivre($email, (int) $alvo['id']);
        DB::update('UPDATE users SET nome = ?, email = ?, papel = ?, ativo = ? WHERE id = ?', [$nome, $email, $papel, $ativo, $alvo['id']]);
        if (! empty($in['senha'])) {
            DB::update('UPDATE users SET senha_hash = ? WHERE id = ?', [password_hash(senha_valida($in['senha']), PASSWORD_DEFAULT), $alvo['id']]);
        }
        Auditoria::registrar($tid, 'usuario:'.$u['id'], 'equipe.alterado', (string) $alvo['id'], ['papel' => $papel, 'ativo' => $ativo, 'senha' => ! empty($in['senha'])]);

        return response()->json(['ok' => true]);
    }
}
