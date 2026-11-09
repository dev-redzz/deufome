<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SessaoMesa extends Model
{
    protected $table = 'table_sessions';

    public $timestamps = false;

    protected $guarded = [];

    public $incrementing = false;

    protected $keyType = 'string';


    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'table_id');
    }

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'session_id');
    }

    public function pagamentos()
    {
        return $this->hasMany(Pagamento::class, 'session_id');
    }

    public function avaliacao()
    {
        return $this->hasOne(Avaliacao::class, 'session_id');
    }
}
