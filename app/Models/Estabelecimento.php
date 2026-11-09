<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Estabelecimento extends Model
{
    protected $table = 'tenants';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['preferencias' => 'array'];
    }

    public function usuarios()
    {
        return $this->hasMany(Usuario::class, 'tenant_id');
    }

    public function mesas()
    {
        return $this->hasMany(Mesa::class, 'tenant_id');
    }

    public function dispositivos()
    {
        return $this->hasMany(Dispositivo::class, 'tenant_id');
    }

    public function categorias()
    {
        return $this->hasMany(Categoria::class, 'tenant_id');
    }

    public function produtos()
    {
        return $this->hasMany(Produto::class, 'tenant_id');
    }
}
