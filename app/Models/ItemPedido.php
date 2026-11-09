<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemPedido extends Model
{
    protected $table = 'order_items';

    public $timestamps = false;

    protected $guarded = [];


    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'order_id');
    }
}
