<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $t) {
            $t->id();
            $t->integer('tenant_id')->nullable();
            $t->string('ator');
            $t->string('acao');
            $t->string('alvo')->nullable();
            $t->text('dados')->nullable();
            $t->dateTime('created_at');
        });

        Schema::create('limites', function (Blueprint $t) {
            $t->id();
            $t->string('chave');
            $t->dateTime('created_at');
            $t->index(['chave', 'created_at']);
        });

        Schema::create('erros', function (Blueprint $t) {
            $t->id();
            $t->string('chave')->unique();
            $t->string('origem');
            $t->text('mensagem');
            $t->text('detalhe')->default('');
            $t->text('url')->default('');
            $t->integer('tenant_id')->nullable();
            $t->integer('contagem')->default(1);
            $t->dateTime('primeira_em');
            $t->dateTime('ultima_em');
            $t->boolean('resolvido')->default(false);
            $t->dateTime('avisado_em')->nullable();
        });

        Schema::create('sugestoes', function (Blueprint $t) {
            $t->id();
            $t->integer('tenant_id')->nullable();
            $t->integer('user_id')->nullable();
            $t->string('tipo');
            $t->text('texto');
            $t->boolean('lida')->default(false);
            $t->dateTime('created_at');
        });

        Schema::create('tarefas', function (Blueprint $t) {
            $t->string('nome')->primary();
            $t->dateTime('ultima_em');
            $t->text('detalhe')->default('');
        });
    }

    public function down(): void
    {
        foreach (['tarefas', 'sugestoes', 'erros', 'limites', 'audit_logs'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
