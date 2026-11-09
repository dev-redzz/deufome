<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;

class Usuario extends Authenticatable
{
    protected $table = 'users';

    public $timestamps = false;

    protected $guarded = [];

    protected $hidden = ['senha_hash', 'google_sub'];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function getAuthPassword(): string
    {
        return $this->senha_hash;
    }

    public function getRememberTokenName(): ?string
    {
        return null;
    }

    public function estabelecimento()
    {
        return $this->belongsTo(Estabelecimento::class, 'tenant_id');
    }
}
