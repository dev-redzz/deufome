<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pagamento extends Model
{
    protected $table = 'payments';

    public $timestamps = false;

    protected $guarded = [];


    public function sessao()
    {
        return $this->belongsTo(SessaoMesa::class, 'session_id');
    }
}
