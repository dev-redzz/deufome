<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Pareamento extends Model
{
    protected $table = 'device_pairings';

    public $timestamps = false;

    protected $guarded = [];


    public function dispositivo()
    {
        return $this->belongsTo(Dispositivo::class, 'device_id');
    }
}
