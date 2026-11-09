<?php

namespace Database\Seeders;

use App\Services\Estabelecimentos;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Dois restaurantes de exemplo e 29 dias de movimento para testar o sistema (só com DEMO=1). */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function () {
            $t1 = $this->restaurantes();
            $this->historico($t1);
        });
    }

    private function restaurantes(): int
    {
        $t1 = Estabelecimentos::criar('Cantinho Deu Fome', '1234', 'Gerente', 'admin@cantinho.test', '123456', 6);
        foreach ([['Cozinha', 'cozinha@cantinho.test', 'cozinha'], ['Caixa', 'caixa@cantinho.test', 'caixa']] as [$n, $e, $p]) {
            DB::insert('INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?,?,?)', [$t1, $n, $e, password_hash('123456', PASSWORD_DEFAULT), $p, agora()]);
        }
        DB::update('UPDATE tenants SET preferencias = ? WHERE id = ?', [json_encode([
            'telefone' => '(99) 98888-7777', 'instagram' => 'cantinhodeufome', 'endereco' => 'Rua das Flores, 120 · Centro',
            'wifi_nome' => 'Cantinho Clientes', 'wifi_senha' => 'deufome2026', 'rodape_comanda' => 'Obrigado pela preferência!',
        ], JSON_UNESCAPED_UNICODE), $t1]);
        $t2 = Estabelecimentos::criar('Outro Restaurante', '9999', 'Gerente', 'admin@outro.test', '123456', 2);

        $cardapio = [
            'Hambúrgueres' => [
                ['Burger Clássico', 'Pão brioche, blend 160 g, queijo prato, alface, tomate e molho da casa.', 2890, 'burger', [['Bacon', 500], ['Queijo extra', 400], ['Ovo', 300]]],
                ['Burger Duplo Cheddar', 'Dois blends de 120 g, cheddar cremoso e cebola caramelizada.', 3690, 'burger2', [['Bacon', 500], ['Cheddar extra', 450]]],
                ['Smash Frango', 'Frango empanado crocante, maionese de ervas e picles.', 2690, 'frango', [['Queijo extra', 400]]],
            ],
            'Porções' => [
                ['Batata Frita', 'Porção de 400 g com sal de ervas.', 2290, 'batata', [['Cheddar e bacon', 900]]],
                ['Anéis de Cebola', '12 anéis empanados com molho barbecue.', 2490, 'cebola', []],
                ['Isca de Frango', '500 g com molho de alho.', 3490, 'isca', []],
            ],
            'Pratos' => [
                ['Filé com Fritas', 'Filé grelhado 250 g, arroz, fritas e salada.', 4890, 'prato', [['Ovo', 300]]],
                ['Espaguete à Bolonhesa', 'Massa fresca com molho de carne e parmesão.', 3590, 'massa', []],
            ],
            'Bebidas' => [
                ['Refrigerante Lata', 'Coca-Cola, Guaraná ou Fanta, 350 ml.', 700, 'refri', []],
                ['Suco Natural', 'Laranja, maracujá ou acerola, 500 ml.', 1090, 'suco', [['Sem açúcar', 0]]],
                ['Água Mineral', '500 ml, com ou sem gás.', 450, 'agua', []],
            ],
            'Sobremesas' => [
                ['Petit Gâteau', 'Bolo de chocolate com recheio cremoso e sorvete.', 2290, 'doce', []],
                ['Açaí 400 ml', 'Com granola, banana e leite condensado.', 1890, 'acai', [['Nutella', 600], ['Morango', 400]]],
            ],
        ];
        $oc = 0;
        foreach ($cardapio as $cat => $itens) {
            $cid = DB::table('categories')->insertGetId(['tenant_id' => $t1, 'nome' => $cat, 'ordem' => $oc++]);
            foreach ($itens as $op => [$nome, $desc, $preco, $img, $opcoes]) {
                $pid = DB::table('products')->insertGetId(['tenant_id' => $t1, 'category_id' => $cid, 'nome' => $nome, 'descricao' => $desc, 'preco' => $preco, 'imagem' => "/img/produtos/$img.svg", 'ordem' => $op]);
                foreach ($opcoes as [$on, $optPreco]) {
                    DB::insert('INSERT INTO product_options (tenant_id, product_id, nome, preco) VALUES (?,?,?,?)', [$t1, $pid, $on, $optPreco]);
                }
            }
        }
        $c2 = DB::table('categories')->insertGetId(['tenant_id' => $t2, 'nome' => 'Pizzas', 'ordem' => 0]);
        DB::insert('INSERT INTO products (tenant_id, category_id, nome, descricao, preco, imagem) VALUES (?,?,?,?,?,?)', [$t2, $c2, 'Pizza Secreta', 'Produto do outro restaurante.', 5000, '/img/produtos/prato.svg']);

        return $t1;
    }

    private function historico(int $tid): void
    {
        mt_srand(2026);
        $prods = DB::select('SELECT id, nome, preco FROM products WHERE tenant_id = ?', [$tid]);
        $mesas = array_column(DB::select('SELECT id FROM tables WHERE tenant_id = ?', [$tid]), 'id');
        $fuso = new DateTimeZone('America/Sao_Paulo');
        $utc = new DateTimeZone('UTC');
        $formas = ['pix', 'pix', 'pix', 'credito', 'credito', 'debito', 'dinheiro'];
        $tagsBoas = ['Comida ótima', 'Atendimento rápido', 'Ambiente agradável', 'Preço justo'];
        $tagsRuins = ['Demorou', 'Comida fria', 'Pedido errado'];
        $comentarios = ['Muito bom, voltaremos!', 'O hambúrguer estava perfeito.', 'Pedir pelo tablet é muito prático.', '', '', 'Batata podia vir mais quente.', 'Ótimo atendimento.', ''];
        $fmt = fn (DateTimeImmutable $d) => $d->setTimezone($utc)->format('Y-m-d H:i:s');
        $num = 0;
        for ($dia = 29; $dia >= 1; $dia--) {
            $base = new DateTimeImmutable("today -$dia days", $fuso);
            $fds = in_array((int) $base->format('w'), [0, 5, 6], true);
            $qtd = mt_rand($fds ? 9 : 4, $fds ? 16 : 10);
            for ($k = 0; $k < $qtd; $k++) {
                $h = mt_rand(0, 9) < 3 ? mt_rand(11, 13) : mt_rand(18, 22);
                $ab = $base->setTime($h, mt_rand(0, 59));
                $mesa = $mesas[array_rand($mesas)];
                $sid = novo_uuid();
                $subtotal = 0;
                $ultimo = $ab;
                $ordens = [];
                for ($o = 0, $np = mt_rand(0, 2) ? 1 : 2; $o < $np; $o++) {
                    $cri = $ab->modify('+'.($o * mt_rand(15, 35) + mt_rand(2, 8)).' minutes');
                    $prep = $cri->modify('+'.mt_rand(1, 6).' minutes');
                    $pron = $prep->modify('+'.mt_rand(8, 24).' minutes');
                    $ent = $pron->modify('+'.mt_rand(1, 4).' minutes');
                    $itens = [];
                    $totalO = 0;
                    for ($i = 0, $n = mt_rand(1, 3); $i < $n; $i++) {
                        $p = $prods[array_rand($prods)];
                        $q = mt_rand(0, 3) ? 1 : 2;
                        $itens[] = [$p, $q];
                        $totalO += (int) $p['preco'] * $q;
                    }
                    $subtotal += $totalO;
                    $ultimo = $ent;
                    $ordens[] = [$cri, $prep, $pron, $ent, $itens, $totalO];
                }
                $fech = $ultimo->modify('+'.mt_rand(15, 50).' minutes');
                $taxa = mt_rand(0, 9) < 7 ? (int) round($subtotal * 0.10) : 0;
                $total = $subtotal + $taxa;
                $pessoas = mt_rand(1, 5);
                $dividir = $pessoas > 2 && mt_rand(0, 1);
                $forma = $dividir ? 'dividido' : $formas[array_rand($formas)];
                DB::insert("INSERT INTO table_sessions (id, tenant_id, table_id, status, aberta_em, conta_em, fechada_em, fechada_por, forma_pagamento, subtotal, taxa, total, pessoas) VALUES (?,?,?, 'fechada', ?,?,?, NULL, ?,?,?,?,?)",
                    [$sid, $tid, $mesa, $fmt($ab), $fmt($fech->modify('-5 minutes')), $fmt($fech), $forma, $subtotal, $taxa, $total, $pessoas]);
                foreach ($ordens as [$cri, $prep, $pron, $ent, $itens, $totalO]) {
                    $num++;
                    $oid = DB::table('orders')->insertGetId([
                        'tenant_id' => $tid, 'session_id' => $sid, 'table_id' => $mesa, 'numero' => $num, 'status' => 'entregue', 'total' => $totalO,
                        'idempotency_key' => novo_uuid(), 'origem' => 'tablet', 'created_at' => $fmt($cri), 'updated_at' => $fmt($ent),
                        'preparo_em' => $fmt($prep), 'pronto_em' => $fmt($pron), 'entregue_em' => $fmt($ent),
                    ]);
                    foreach ($itens as [$p, $q]) {
                        DB::insert('INSERT INTO order_items (order_id, product_id, nome, preco_unit, quantidade, subtotal) VALUES (?,?,?,?,?,?)', [$oid, $p['id'], $p['nome'], $p['preco'], $q, (int) $p['preco'] * $q]);
                    }
                }
                $pag = $dividir ? [['pix', intdiv($total, 2)], ['credito', $total - intdiv($total, 2)]] : [[$forma, $total]];
                foreach ($pag as [$f, $v]) {
                    DB::insert('INSERT INTO payments (tenant_id, session_id, forma, valor, registrado_por, created_at) VALUES (?,?,?,?,NULL,?)', [$tid, $sid, $f, $v, $fmt($fech)]);
                }
                if (mt_rand(0, 9) < 6) {
                    $nota = [5, 5, 5, 4, 4, 4, 3, 5, 2, 5][mt_rand(0, 9)];
                    $tags = $nota >= 4 ? array_slice($tagsBoas, mt_rand(0, 2), mt_rand(1, 2)) : array_slice($tagsRuins, mt_rand(0, 1), 1);
                    DB::insert('INSERT INTO avaliacoes (tenant_id, session_id, table_id, nota, tags, comentario, created_at) VALUES (?,?,?,?,?,?,?)',
                        [$tid, $sid, $mesa, $nota, json_encode($tags, JSON_UNESCAPED_UNICODE), $comentarios[array_rand($comentarios)], $fmt($fech->modify('-4 minutes'))]);
                }
            }
        }
    }
}
