<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Categoria extends Model
{
    protected $table = 'categories';

    public $timestamps = false;

    protected $guarded = [];


    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }

    public function produtos()
    {
        return $this->hasMany(Produto::class, 'category_id');
    }
}
