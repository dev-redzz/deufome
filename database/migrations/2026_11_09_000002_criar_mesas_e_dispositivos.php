<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tables', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->integer('numero');
            $t->string('nome');
            $t->boolean('ativo')->default(true);
            $t->unique(['tenant_id', 'numero']);
        });

        Schema::create('devices', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignId('table_id')->nullable()->constrained('tables');
            $t->string('nome');
            $t->string('token_hash')->nullable()->unique();
            $t->string('status')->default('pendente');
            $t->dateTime('last_seen_at')->nullable();
            $t->string('app_version')->nullable();
            $t->string('ip')->nullable();
            $t->dateTime('created_at');
        });

        Schema::create('device_pairings', function (Blueprint $t) {
            $t->id();
            $t->foreignId('tenant_id')->constrained('tenants');
            $t->foreignId('device_id')->constrained('devices');
            $t->string('codigo');
            $t->dateTime('expira_em');
            $t->string('usado_em')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_pairings');
        Schema::dropIfExists('devices');
        Schema::dropIfExists('tables');
    }
};
