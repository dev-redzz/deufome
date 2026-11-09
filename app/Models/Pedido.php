<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pedido extends Model
{
    protected $table = 'orders';

    public $timestamps = false;

    protected $guarded = [];


    public function sessao()
    {
        return $this->belongsTo(SessaoMesa::class, 'session_id');
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'table_id');
    }

    public function itens()
    {
        return $this->hasMany(ItemPedido::class, 'order_id');
    }
}
