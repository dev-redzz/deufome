<?php

namespace App\Database;

use PDO;
use PDOException;

/**
 * PDO do SQLite que abre transações com BEGIN IMMEDIATE.
 * Assim, dois tablets enviando pedido ao mesmo tempo esperam a vez em vez de dar "database is locked".
 */
class PdoSqlite extends PDO
{
    private bool $emTransacao = false;

    public function beginTransaction(): bool
    {
        $this->exec('BEGIN IMMEDIATE');
        $this->emTransacao = true;

        return true;
    }

    public function exec(string $sql): int|false
    {
        $r = parent::exec($sql);
        if (preg_match('/^\s*BEGIN\b/i', $sql)) {
            $this->emTransacao = true;
        }

        return $r;
    }

    public function commit(): bool
    {
        parent::exec('COMMIT');
        $this->emTransacao = false;

        return true;
    }

    public function rollBack(): bool
    {
        $this->emTransacao = false;
        try {
            parent::exec('ROLLBACK');
        } catch (PDOException) {
        }

        return true;
    }

    public function inTransaction(): bool
    {
        return $this->emTransacao;
    }
}
