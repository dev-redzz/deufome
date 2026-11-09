<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Dispositivo extends Model
{
    protected $table = 'devices';

    public $timestamps = false;

    protected $guarded = [];


    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'table_id');
    }

    public function pareamentos()
    {
        return $this->hasMany(Pareamento::class, 'device_id');
    }
}
