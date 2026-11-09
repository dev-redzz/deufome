<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

class ConsultaSqlite extends PDOStatement
{
    protected function __construct()
    {
    }

    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed
    {
        $r = parent::fetch($mode, $cursorOrientation, $cursorOffset);
        $this->closeCursor();
        return $r;
    }

    public function fetchColumn(int $column = 0): mixed
    {
        $r = parent::fetchColumn($column);
        $this->closeCursor();
        return $r;
    }
}

final class BancoSqlite extends PDO
{
    private bool $emTransacao = false;

    public function beginTransaction(): bool
    {
        $this->exec('BEGIN IMMEDIATE');
        $this->emTransacao = true;
        return true;
    }

    public function commit(): bool
    {
        $this->exec('COMMIT');
        $this->emTransacao = false;
        return true;
    }

    public function rollBack(): bool
    {
        $this->emTransacao = false;
        try {
            $this->exec('ROLLBACK');
        } catch (PDOException $e) {
        }
        return true;
    }

    public function inTransaction(): bool
    {
        return $this->emTransacao;
    }
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;
    $pdo = new BancoSqlite('sqlite:' . DB_PATH, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_TIMEOUT => 10,
    ]);
    $pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [ConsultaSqlite::class]);
    $pdo->exec('PRAGMA busy_timeout = 10000');
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    migrar($pdo);
    garantir_plataforma($pdo);
    return $pdo;
}

function agora(): string
{
    return gmdate('Y-m-d H:i:s');
}

function uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function migracoes(): array
{
    return [
        1 => <<<SQL
CREATE TABLE tenants (
  id INTEGER PRIMARY KEY, nome TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
  pin_gerente_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ativo', created_at TEXT NOT NULL
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY, tenant_id INTEGER REFERENCES tenants(id),
  nome TEXT NOT NULL, email TEXT UNIQUE NOT NULL, senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE login_tentativas (id INTEGER PRIMARY KEY, ip TEXT NOT NULL, email TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX login_tentativas_ip ON login_tentativas(ip, created_at);
CREATE INDEX login_tentativas_email ON login_tentativas(email, created_at);
CREATE TABLE tables (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  numero INTEGER NOT NULL, nome TEXT NOT NULL, ativo INTEGER NOT NULL DEFAULT 1, UNIQUE(tenant_id, numero)
);
CREATE TABLE devices (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  table_id INTEGER REFERENCES tables(id), nome TEXT NOT NULL,
  token_hash TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pendente',
  last_seen_at TEXT, app_version TEXT, ip TEXT, created_at TEXT NOT NULL
);
CREATE TABLE device_pairings (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  device_id INTEGER NOT NULL REFERENCES devices(id), codigo TEXT NOT NULL,
  expira_em TEXT NOT NULL, usado_em TEXT
);
CREATE TABLE categories (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  nome TEXT NOT NULL, ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE products (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  category_id INTEGER NOT NULL REFERENCES categories(id), nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '', preco INTEGER NOT NULL, imagem TEXT,
  disponivel INTEGER NOT NULL DEFAULT 1, ordem INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE product_options (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, nome TEXT NOT NULL, preco INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE table_sessions (
  id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  table_id INTEGER NOT NULL REFERENCES tables(id), device_id INTEGER REFERENCES devices(id),
  status TEXT NOT NULL, aberta_em TEXT NOT NULL, conta_em TEXT, fechada_em TEXT,
  fechada_por INTEGER, forma_pagamento TEXT, total INTEGER
);
CREATE UNIQUE INDEX uma_sessao_por_mesa ON table_sessions(table_id) WHERE status IN ('aberta','conta_solicitada');
CREATE TABLE orders (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  session_id TEXT NOT NULL REFERENCES table_sessions(id), table_id INTEGER NOT NULL REFERENCES tables(id),
  numero INTEGER NOT NULL, status TEXT NOT NULL, total INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL, origem TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(session_id, idempotency_key)
);
CREATE INDEX orders_cozinha ON orders(tenant_id, status);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER, nome TEXT NOT NULL, preco_unit INTEGER NOT NULL, quantidade INTEGER NOT NULL,
  adicionais TEXT NOT NULL DEFAULT '[]', observacao TEXT NOT NULL DEFAULT '', subtotal INTEGER NOT NULL
);
CREATE TABLE service_calls (
  id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  session_id TEXT, table_id INTEGER NOT NULL REFERENCES tables(id),
  tipo TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'aberto', created_at TEXT NOT NULL, atendido_em TEXT
);
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY, tenant_id INTEGER, ator TEXT NOT NULL, acao TEXT NOT NULL,
  alvo TEXT, dados TEXT, created_at TEXT NOT NULL
);
SQL,
    ];
}

function migrar(PDO $pdo): void
{
    $lista = migracoes();
    $alvo = max(array_keys($lista));
    if ((int)$pdo->query('PRAGMA user_version')->fetchColumn() >= $alvo) return;
    $trava = fopen(DATA_DIR . '/.migracao.lock', 'c');
    flock($trava, LOCK_EX);
    try {
        $atual = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
        foreach ($lista as $versao => $sql) {
            if ($versao <= $atual) continue;
            $pdo->beginTransaction();
            $pdo->exec($sql);
            if ($versao === 1 && DEMO) popular_demo($pdo);
            $pdo->exec('PRAGMA user_version = ' . (int)$versao);
            $pdo->commit();
        }
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    } finally {
        flock($trava, LOCK_UN);
        fclose($trava);
    }
}

function variavel(string $nome): string
{
    $v = trim((string)getenv($nome));
    if (strlen($v) >= 2 && ($v[0] === '"' || $v[0] === "'") && $v[0] === substr($v, -1)) $v = trim(substr($v, 1, -1));
    return $v;
}

function garantir_plataforma(PDO $pdo): void
{
    $email = strtolower(variavel('PLATAFORMA_EMAIL'));
    $senha = variavel('PLATAFORMA_SENHA');
    if ($email === '' || strlen($senha) < 8) return;
    $st = $pdo->prepare('SELECT id, papel, senha_hash, ativo FROM users WHERE email = ?');
    $st->execute([$email]);
    $u = $st->fetch();
    if (!$u) {
        try {
            $pdo->prepare("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (NULL, 'Administrador', ?, ?, 'plataforma', ?)")
                ->execute([$email, password_hash($senha, PASSWORD_DEFAULT), agora()]);
        } catch (PDOException $e) {
        }
        return;
    }
    if (variavel('PLATAFORMA_REDEFINIR') === '1' && $u['papel'] === 'plataforma' && (!$u['ativo'] || !password_verify($senha, $u['senha_hash']))) {
        $pdo->prepare('UPDATE users SET senha_hash = ?, ativo = 1 WHERE id = ?')->execute([password_hash($senha, PASSWORD_DEFAULT), $u['id']]);
        $pdo->prepare('DELETE FROM login_tentativas WHERE email = ?')->execute([$email]);
    }
}

function situacao_plataforma(PDO $pdo): array
{
    $email = strtolower(variavel('PLATAFORMA_EMAIL'));
    $senha = variavel('PLATAFORMA_SENHA');
    $st = $pdo->prepare("SELECT papel FROM users WHERE email = ?");
    $st->execute([$email]);
    $papel = $st->fetchColumn();
    return [
        'variavel_email' => $email !== '',
        'variavel_senha_ok' => strlen($senha) >= 8,
        'administrador_criado' => $papel === 'plataforma',
        'volume' => !SEM_VOLUME,
    ];
}

function slug_unico(PDO $pdo, string $nome): string
{
    $base = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '-', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nome) ?: $nome), '-')) ?: 'estabelecimento';
    $slug = substr($base, 0, 40);
    $n = 1;
    $st = $pdo->prepare('SELECT 1 FROM tenants WHERE slug = ?');
    while (true) {
        $st->execute([$slug]);
        if (!$st->fetchColumn()) return $slug;
        $slug = substr($base, 0, 36) . '-' . (++$n);
    }
}

function criar_estabelecimento(PDO $pdo, string $nome, string $pin, string $donoNome, string $donoEmail, string $donoSenha, int $mesas): int
{
    $pdo->prepare('INSERT INTO tenants (nome, slug, pin_gerente_hash, created_at) VALUES (?,?,?,?)')
        ->execute([$nome, slug_unico($pdo, $nome), password_hash($pin, PASSWORD_DEFAULT), agora()]);
    $tid = (int)$pdo->lastInsertId();
    $pdo->prepare("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?, 'dono', ?)")
        ->execute([$tid, $donoNome, strtolower($donoEmail), password_hash($donoSenha, PASSWORD_DEFAULT), agora()]);
    $ins = $pdo->prepare('INSERT INTO tables (tenant_id, numero, nome) VALUES (?,?,?)');
    for ($m = 1; $m <= $mesas; $m++) $ins->execute([$tid, $m, sprintf('Mesa %02d', $m)]);
    return $tid;
}

function popular_demo(PDO $pdo): void
{
    $t1 = criar_estabelecimento($pdo, 'Cantinho Deu Fome', '1234', 'Gerente', 'admin@cantinho.test', '123456', 6);
    $pdo->prepare("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?,?,?)")
        ->execute([$t1, 'Cozinha', 'cozinha@cantinho.test', password_hash('123456', PASSWORD_DEFAULT), 'cozinha', agora()]);
    $pdo->prepare("INSERT INTO users (tenant_id, nome, email, senha_hash, papel, created_at) VALUES (?,?,?,?,?,?)")
        ->execute([$t1, 'Caixa', 'caixa@cantinho.test', password_hash('123456', PASSWORD_DEFAULT), 'caixa', agora()]);
    $t2 = criar_estabelecimento($pdo, 'Outro Restaurante', '9999', 'Gerente', 'admin@outro.test', '123456', 2);

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
        $pdo->prepare('INSERT INTO categories (tenant_id, nome, ordem) VALUES (?,?,?)')->execute([$t1, $cat, $oc++]);
        $cid = (int)$pdo->lastInsertId();
        foreach ($itens as $op => [$nome, $desc, $preco, $img, $opcoes]) {
            $pdo->prepare('INSERT INTO products (tenant_id, category_id, nome, descricao, preco, imagem, ordem) VALUES (?,?,?,?,?,?,?)')
                ->execute([$t1, $cid, $nome, $desc, $preco, "/img/produtos/$img.svg", $op]);
            $pid = (int)$pdo->lastInsertId();
            foreach ($opcoes as [$on, $optPreco]) {
                $pdo->prepare('INSERT INTO product_options (tenant_id, product_id, nome, preco) VALUES (?,?,?,?)')->execute([$t1, $pid, $on, $optPreco]);
            }
        }
    }
    $pdo->prepare('INSERT INTO categories (tenant_id, nome, ordem) VALUES (?,?,0)')->execute([$t2, 'Pizzas']);
    $c2 = (int)$pdo->lastInsertId();
    $pdo->prepare('INSERT INTO products (tenant_id, category_id, nome, descricao, preco, imagem) VALUES (?,?,?,?,?,?)')
        ->execute([$t2, $c2, 'Pizza Secreta', 'Produto do outro restaurante.', 5000, '/img/produtos/prato.svg']);
}

function auditar(?int $tenantId, string $ator, string $acao, ?string $alvo = null, array $dados = []): void
{
    db()->prepare('INSERT INTO audit_logs (tenant_id, ator, acao, alvo, dados, created_at) VALUES (?,?,?,?,?,?)')
        ->execute([$tenantId, $ator, $acao, $alvo, json_encode($dados, JSON_UNESCAPED_UNICODE), agora()]);
}
