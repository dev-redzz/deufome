<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $t) {
            $t->id();
            $t->string('nome');
            $t->string('slug')->unique();
            $t->string('pin_gerente_hash')->nullable();
            $t->string('status')->default('ativo');
            $t->string('fuso')->default('America/Sao_Paulo');
            $t->integer('taxa_servico')->default(10);
            $t->text('horarios')->default('');
            $t->string('logo')->nullable();
            $t->string('capa')->nullable();
            $t->text('preferencias')->default('{}');
            $t->dateTime('created_at');
        });

        Schema::create('users', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->nullable()->constrained('tenants');
            $t->string('nome');
            $t->string('email')->unique();
            $t->string('senha_hash');
            $t->string('papel');
            $t->boolean('ativo')->default(true);
            $t->string('google_sub')->nullable();
            $t->dateTime('created_at');
        });
        DB::statement('CREATE UNIQUE INDEX users_google ON users(google_sub) WHERE google_sub IS NOT NULL');

        Schema::create('login_tentativas', function (Blueprint $t) {
            $t->id();
            $t->string('ip');
            $t->string('email');
            $t->dateTime('created_at');
            $t->index(['ip', 'created_at']);
            $t->index(['email', 'created_at']);
        });

        Schema::create('senha_tokens', function (Blueprint $t) {
            $t->id();
            $t->foreignId('user_id')->constrained('users');
            $t->string('token_hash')->unique();
            $t->dateTime('expira_em');
            $t->string('usado_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('senha_tokens');
        Schema::dropIfExists('login_tentativas');
        Schema::dropIfExists('users');
        Schema::dropIfExists('tenants');
    }
};
