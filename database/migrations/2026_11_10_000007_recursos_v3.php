<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $t) {
            $t->text('tamanhos')->default('[]');
            $t->boolean('meio_a_meio')->default(false);
            $t->text('sugestoes')->default('[]');
        });
        Schema::table('categories', function (Blueprint $t) {
            $t->string('setor')->default('cozinha');
        });
        Schema::table('order_items', function (Blueprint $t) {
            $t->string('setor')->default('cozinha');
            $t->string('tamanho')->nullable();
            $t->text('sabores')->default('[]');
        });
        Schema::table('tables', function (Blueprint $t) {
            $t->integer('pos_x')->nullable();
            $t->integer('pos_y')->nullable();
            $t->string('formato')->default('quadrada');
            $t->integer('lugares')->default(4);
        });
        Schema::table('table_sessions', function (Blueprint $t) {
            $t->integer('cupom_id')->nullable();
            $t->string('cupom_codigo')->nullable();
            $t->integer('desconto')->default(0);
            $t->integer('gorjeta')->default(0);
            $t->integer('gorjeta_pct')->nullable();
            $t->string('pagar_com')->nullable();
        });
        Schema::table('users', function (Blueprint $t) {
            $t->dateTime('ultimo_acesso')->nullable();
            $t->integer('sessao_versao')->default(1);
        });

        Schema::create('cupons', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->string('codigo');
            $t->string('tipo');
            $t->integer('valor');
            $t->integer('minimo')->default(0);
            $t->date('validade')->nullable();
            $t->integer('limite')->nullable();
            $t->integer('usos')->default(0);
            $t->boolean('ativo')->default(true);
            $t->dateTime('created_at');
            $t->unique(['tenant_id', 'codigo']);
        });

        Schema::create('avaliacoes_itens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->uuid('session_id');
            $t->integer('product_id')->nullable();
            $t->string('nome');
            $t->integer('nota');
            $t->dateTime('created_at');
            $t->unique(['session_id', 'nome']);
            $t->index(['tenant_id', 'created_at'], 'aval_itens_data');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('avaliacoes_itens');
        Schema::dropIfExists('cupons');
    }
};
