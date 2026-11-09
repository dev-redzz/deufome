<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->string('nome');
            $t->integer('ordem')->default(0);
        });

        Schema::create('products', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignId('category_id')->constrained('categories');
            $t->string('nome');
            $t->text('descricao')->default('');
            $t->integer('preco');
            $t->string('imagem')->nullable();
            $t->boolean('disponivel')->default(true);
            $t->integer('ordem')->default(0);
        });

        Schema::create('product_options', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $t->string('nome');
            $t->integer('preco')->default(0);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_options');
        Schema::dropIfExists('products');
        Schema::dropIfExists('categories');
    }
};
