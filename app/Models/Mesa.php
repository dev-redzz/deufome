<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Mesa extends Model
{
    protected $table = 'tables';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }

    public function dispositivos()
    {
        return $this->hasMany(Dispositivo::class, 'table_id');
    }

    public function sessoes()
    {
        return $this->hasMany(SessaoMesa::class, 'table_id');
    }
}
