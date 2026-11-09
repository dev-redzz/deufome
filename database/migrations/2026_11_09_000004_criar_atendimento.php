<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('table_sessions', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignId('table_id')->constrained('tables');
            $t->foreignId('device_id')->nullable()->constrained('devices');
            $t->string('status');
            $t->dateTime('aberta_em');
            $t->dateTime('conta_em')->nullable();
            $t->dateTime('fechada_em')->nullable();
            $t->integer('fechada_por')->nullable();
            $t->string('forma_pagamento')->nullable();
            $t->integer('subtotal')->nullable();
            $t->integer('taxa')->nullable();
            $t->integer('total')->nullable();
            $t->integer('pessoas')->nullable();
            $t->index(['tenant_id', 'status', 'fechada_em'], 'sessoes_fechadas');
        });
        DB::statement("CREATE UNIQUE INDEX uma_sessao_por_mesa ON table_sessions(table_id) WHERE status IN ('aberta','conta_solicitada')");

        Schema::create('orders', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignUuid('session_id')->constrained('table_sessions');
            $t->foreignId('table_id')->constrained('tables');
            $t->integer('numero');
            $t->string('status');
            $t->integer('total');
            $t->string('idempotency_key');
            $t->string('origem');
            $t->dateTime('created_at');
            $t->dateTime('updated_at');
            $t->dateTime('preparo_em')->nullable();
            $t->dateTime('pronto_em')->nullable();
            $t->dateTime('entregue_em')->nullable();
            $t->unique(['session_id', 'idempotency_key']);
            $t->index(['tenant_id', 'status'], 'orders_cozinha');
            $t->index(['tenant_id', 'created_at'], 'pedidos_data');
        });

        Schema::create('order_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('order_id')->constrained('orders');
            $t->integer('product_id')->nullable();
            $t->string('nome');
            $t->integer('preco_unit');
            $t->integer('quantidade');
            $t->text('adicionais')->default('[]');
            $t->text('observacao')->default('');
            $t->integer('subtotal');
        });

        Schema::create('service_calls', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->uuid('session_id')->nullable();
            $t->foreignId('table_id')->constrained('tables');
            $t->string('tipo');
            $t->string('status')->default('aberto');
            $t->dateTime('created_at');
            $t->dateTime('atendido_em')->nullable();
        });

        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignUuid('session_id')->constrained('table_sessions');
            $t->string('forma');
            $t->integer('valor');
            $t->integer('registrado_por')->nullable();
            $t->dateTime('created_at');
            $t->index('session_id', 'pagamentos_sessao');
        });

        Schema::create('avaliacoes', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignUuid('session_id')->unique()->constrained('table_sessions');
            $t->integer('table_id');
            $t->integer('nota');
            $t->text('tags')->default('[]');
            $t->text('comentario')->default('');
            $t->dateTime('created_at');
            $t->index(['tenant_id', 'created_at'], 'avaliacoes_data');
        });
    }

    public function down(): void
    {
        foreach (['avaliacoes', 'payments', 'service_calls', 'order_items', 'orders', 'table_sessions'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
