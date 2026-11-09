<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Auditoria extends Model
{
    protected $table = 'audit_logs';

    public $timestamps = false;

    protected $guarded = [];

}
