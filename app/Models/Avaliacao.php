<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Avaliacao extends Model
{
    protected $table = 'avaliacoes';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['tags' => 'array'];
    }

    public function sessao()
    {
        return $this->belongsTo(SessaoMesa::class, 'session_id');
    }

    public function mesa()
    {
        return $this->belongsTo(Mesa::class, 'table_id');
    }
}
