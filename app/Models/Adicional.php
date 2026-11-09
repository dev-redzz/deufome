<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Adicional extends Model
{
    protected $table = 'product_options';

    public $timestamps = false;

    protected $guarded = [];


    public function produto()
    {
        return $this->belongsTo(Produto::class, 'product_id');
    }
}
