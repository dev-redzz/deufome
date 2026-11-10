<?php

namespace App\Http\Controllers\Painel;

use App\Http\Controllers\Controller;
use App\Services\Auditoria;
use App\Services\Cardapio;
use App\Services\Imagens;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CardapioController extends Controller
{
    private static function produto(int $tid, int $id): array
    {
        return DB::selectOne('SELECT * FROM products WHERE id = ? AND tenant_id = ?', [$id, $tid]) ?? erro(404, 'Produto não encontrado.');
    }

    private static function categoria(int $tid, int $id): array
    {
        return DB::selectOne('SELECT * FROM categories WHERE id = ? AND tenant_id = ?', [$id, $tid]) ?? erro(404, 'Categoria não encontrada.');
    }

    private static function salvarAdicionais(int $tid, int $pid, $lista): void
    {
        if (! is_array($lista)) {
            erro(422, 'Adicionais inválidos.');
        }
        if (count($lista) > 30) {
            erro(422, 'No máximo 30 adicionais por produto.');
        }
        $existentes = array_map('intval', array_column(DB::select('SELECT id FROM product_options WHERE product_id = ? AND tenant_id = ?', [$pid, $tid]), 'id'));
        $mantidos = [];
        foreach ($lista as $a) {
            if (! is_array($a)) {
                erro(422, 'Adicionais inválidos.');
            }
            $nome = texto($a, 'nome', 60, true, 'Nome do adicional');
            $preco = centavos($a['preco'] ?? 0, 'Preço do adicional');
            $id = (int) ($a['id'] ?? 0);
            if ($id && in_array($id, $existentes, true)) {
                DB::update('UPDATE product_options SET nome = ?, preco = ? WHERE id = ?', [$nome, $preco, $id]);
                $mantidos[] = $id;
            } else {
                DB::insert('INSERT INTO product_options (tenant_id, product_id, nome, preco) VALUES (?,?,?,?)', [$tid, $pid, $nome, $preco]);
            }
        }
        foreach (array_diff($existentes, $mantidos) as $id) {
            DB::delete('DELETE FROM product_options WHERE id = ?', [$id]);
        }
    }

    private static function reordenar(string $tabela, array $ids, int $id, int $direcao): void
    {
        $i = array_search($id, $ids, true);
        $j = $i === false ? -1 : $i + ($direcao < 0 ? -1 : 1);
        if ($i === false || $j < 0 || $j >= count($ids)) {
            return;
        }
        [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
        foreach ($ids as $ordem => $x) {
            DB::update("UPDATE $tabela SET ordem = ? WHERE id = ?", [$ordem, $x]);
        }
    }

    private static function selo(array $in, ?string $atual = null): ?string
    {
        if (! array_key_exists('selo', $in)) {
            return $atual;
        }
        $s = (string) $in['selo'];
        if ($s === '') {
            return null;
        }
        if (! isset(Cardapio::SELOS[$s])) {
            erro(422, 'Selo inválido.');
        }

        return $s;
    }

    private static function tamanhos($lista): string
    {
        if (! is_array($lista) || count($lista) > 6) {
            erro(422, 'Use até 6 tamanhos.');
        }
        $r = [];
        foreach ($lista as $t) {
            $nome = texto((array) $t, 'nome', 20, true, 'Nome do tamanho');
            if (in_array($nome, array_column($r, 'nome'), true)) {
                erro(422, "O tamanho $nome está repetido.");
            }
            $r[] = ['nome' => $nome, 'preco' => centavos($t['preco'] ?? null, "Preço do tamanho $nome")];
        }

        return json_encode($r, JSON_UNESCAPED_UNICODE);
    }

    private static function sugestoes(int $tid, $lista): string
    {
        $ids = array_slice(array_values(array_unique(array_map('intval', (array) $lista))), 0, 3);
        foreach ($ids as $i) {
            self::produto($tid, $i);
        }

        return json_encode($ids);
    }

    /** Campos novos do produto (tamanhos, meio a meio, combina com). */
    private static function extras(int $tid, array $in, array $atual = []): array
    {
        $r = [];
        if (array_key_exists('tamanhos', $in)) {
            $r['tamanhos'] = self::tamanhos($in['tamanhos']);
        }
        if (array_key_exists('meio_a_meio', $in)) {
            $r['meio_a_meio'] = $in['meio_a_meio'] ? 1 : 0;
        }
        if (array_key_exists('sugestoes', $in)) {
            $r['sugestoes'] = self::sugestoes($tid, $in['sugestoes']);
        }

        return $r;
    }

    private static function setor(array $in): ?string
    {
        if (! array_key_exists('setor', $in)) {
            return null;
        }
        if (! isset(Cardapio::SETORES[$in['setor']])) {
            erro(422, 'Setor inválido.');
        }

        return $in['setor'];
    }

    public function listar()
    {
        return response()->json(['categorias' => Cardapio::montar((int) usuario()['tenant_id']), 'selos' => Cardapio::SELOS, 'setores' => Cardapio::SETORES]);
    }

    public function criarProduto()
    {
        $tid = (int) usuario()['tenant_id'];
        $in = entrada();
        $cat = self::categoria($tid, (int) ($in['categoria_id'] ?? 0));
        $nome = texto($in, 'nome', 80);
        $desc = texto($in, 'descricao', 300, false, 'Descrição');
        $preco = centavos($in['preco'] ?? null);
        $pid = DB::transaction(function () use ($tid, $cat, $nome, $desc, $preco, $in) {
            $ordem = (int) DB::scalar('SELECT COALESCE(MAX(ordem), -1) + 1 FROM products WHERE category_id = ?', [$cat['id']]);
            $pid = DB::table('products')->insertGetId([
                'tenant_id' => $tid, 'category_id' => $cat['id'], 'nome' => $nome, 'descricao' => $desc, 'preco' => $preco,
                'disponivel' => empty($in['disponivel']) && array_key_exists('disponivel', $in) ? 0 : 1, 'ordem' => $ordem, 'selo' => self::selo($in),
            ] + self::extras($tid, $in));
            self::salvarAdicionais($tid, $pid, $in['adicionais'] ?? []);

            return $pid;
        });

        return response()->json(['ok' => true, 'id' => $pid], 201);
    }

    public function salvarProduto(string $id)
    {
        $tid = (int) usuario()['tenant_id'];
        $p = self::produto($tid, (int) $id);
        $in = entrada();
        $nome = array_key_exists('nome', $in) ? texto($in, 'nome', 80) : $p['nome'];
        $desc = array_key_exists('descricao', $in) ? texto($in, 'descricao', 300, false, 'Descrição') : $p['descricao'];
        $preco = array_key_exists('preco', $in) ? centavos($in['preco']) : (int) $p['preco'];
        $disp = array_key_exists('disponivel', $in) ? ($in['disponivel'] ? 1 : 0) : (int) $p['disponivel'];
        $cat = array_key_exists('categoria_id', $in) ? (int) self::categoria($tid, (int) $in['categoria_id'])['id'] : (int) $p['category_id'];
        $selo = self::selo($in, $p['selo']);
        DB::transaction(function () use ($nome, $desc, $preco, $disp, $cat, $p, $in, $tid, $selo) {
            DB::update('UPDATE products SET nome = ?, descricao = ?, preco = ?, disponivel = ?, category_id = ?, selo = ? WHERE id = ?', [$nome, $desc, $preco, $disp, $cat, $selo, $p['id']]);
            if ($extras = self::extras($tid, $in)) {
                DB::table('products')->where('id', $p['id'])->update($extras);
            }
            if (array_key_exists('adicionais', $in)) {
                self::salvarAdicionais($tid, (int) $p['id'], $in['adicionais']);
            }
        });

        return response()->json(['ok' => true]);
    }

    public function imagemProduto(Request $request, string $id)
    {
        $u = usuario();
        $p = self::produto((int) $u['tenant_id'], (int) $id);
        $caminho = Imagens::salvar($request->file('imagem'), 't'.$u['tenant_id'].'-p'.$p['id']);
        DB::update('UPDATE products SET imagem = ? WHERE id = ?', [$caminho, $p['id']]);
        Imagens::apagar($p['imagem']);

        return response()->json(['ok' => true, 'imagem' => $caminho]);
    }

    public function moverProduto(string $id)
    {
        $tid = (int) usuario()['tenant_id'];
        $p = self::produto($tid, (int) $id);
        $ids = array_map('intval', array_column(DB::select('SELECT id FROM products WHERE tenant_id = ? AND category_id = ? ORDER BY ordem, id', [$tid, $p['category_id']]), 'id'));
        self::reordenar('products', $ids, (int) $p['id'], (int) (entrada()['direcao'] ?? 1));

        return response()->json(['ok' => true]);
    }

    public function removerProduto(string $id)
    {
        $u = usuario();
        $p = self::produto((int) $u['tenant_id'], (int) $id);
        DB::delete('DELETE FROM product_options WHERE product_id = ?', [$p['id']]);
        DB::delete('DELETE FROM products WHERE id = ?', [$p['id']]);
        Imagens::apagar($p['imagem']);
        Auditoria::registrar((int) $u['tenant_id'], 'usuario:'.$u['id'], 'produto.removido', (string) $p['id'], ['nome' => $p['nome']]);

        return response()->json(['ok' => true]);
    }

    public function criarCategoria()
    {
        $tid = (int) usuario()['tenant_id'];
        $nome = texto(entrada(), 'nome', 40);
        $setor = self::setor(entrada());
        $ordem = (int) DB::scalar('SELECT COALESCE(MAX(ordem), -1) + 1 FROM categories WHERE tenant_id = ?', [$tid]);
        $id = DB::table('categories')->insertGetId(['tenant_id' => $tid, 'nome' => $nome, 'ordem' => $ordem, 'setor' => $setor ?? 'cozinha']);

        return response()->json(['ok' => true, 'id' => $id], 201);
    }

    public function salvarCategoria(string $id)
    {
        $c = self::categoria((int) usuario()['tenant_id'], (int) $id);
        $in = entrada();
        DB::update('UPDATE categories SET nome = ?, setor = ? WHERE id = ?', [array_key_exists('nome', $in) ? texto($in, 'nome', 40) : $c['nome'], self::setor($in) ?? $c['setor'], $c['id']]);

        return response()->json(['ok' => true]);
    }

    public function moverCategoria(string $id)
    {
        $tid = (int) usuario()['tenant_id'];
        $c = self::categoria($tid, (int) $id);
        $ids = array_map('intval', array_column(DB::select('SELECT id FROM categories WHERE tenant_id = ? ORDER BY ordem, id', [$tid]), 'id'));
        self::reordenar('categories', $ids, (int) $c['id'], (int) (entrada()['direcao'] ?? 1));

        return response()->json(['ok' => true]);
    }

    public function removerCategoria(string $id)
    {
        $c = self::categoria((int) usuario()['tenant_id'], (int) $id);
        if (DB::scalar('SELECT COUNT(*) FROM products WHERE category_id = ?', [$c['id']])) {
            erro(409, 'Remova ou mova os produtos desta categoria antes de apagá-la.');
        }
        DB::delete('DELETE FROM categories WHERE id = ?', [$c['id']]);

        return response()->json(['ok' => true]);
    }
}
