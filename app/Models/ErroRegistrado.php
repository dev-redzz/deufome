<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ErroRegistrado extends Model
{
    protected $table = 'erros';

    public $timestamps = false;

    protected $guarded = [];


    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }
}
