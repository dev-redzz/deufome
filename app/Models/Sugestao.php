<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sugestao extends Model
{
    protected $table = 'sugestoes';

    public $timestamps = false;

    protected $guarded = [];


    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }

    public function usuario()
    {
        return $this->belongsTo(Usuario::class, 'user_id');
    }
}
