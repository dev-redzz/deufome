<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chamado extends Model
{
    protected $table = 'service_calls';

    public $timestamps = false;

    protected $guarded = [];


    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'table_id');
    }
}
