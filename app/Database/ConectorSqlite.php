<?php

namespace App\Database;

use Illuminate\Database\Connectors\SQLiteConnector;

class ConectorSqlite extends SQLiteConnector
{
    protected function createPdoConnection($dsn, $username, #[\SensitiveParameter] $password, $options)
    {
        return new PdoSqlite($dsn, $username, $password, $options);
    }
}
