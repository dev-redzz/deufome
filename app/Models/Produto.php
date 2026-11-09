<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Produto extends Model
{
    protected $table = 'products';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return ['disponivel' => 'boolean', 'preco' => 'integer'];
    }

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'category_id');
    }

    public function adicionais()
    {
        return $this->hasMany(Adicional::class, 'product_id');
    }
}
