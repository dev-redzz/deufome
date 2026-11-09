<?php

use App\Http\Controllers\ArquivoController;
use App\Http\Controllers\Auth\GoogleController;
use App\Http\Controllers\PaginaController;
use Illuminate\Support\Facades\Route;

Route::controller(PaginaController::class)->group(function () {
    Route::get('/', 'inicio');
    Route::get('/termos', 'termos');
    Route::get('/privacidade', 'privacidade');
    Route::get('/admin', 'painel');
    Route::get('/cadastro', 'painel');
    Route::get('/tablet', 'tablet');
    Route::get('/cozinha', 'cozinha');
    Route::get('/saude', 'saude');
});

Route::get('/auth/google', [GoogleController::class, 'inicio']);
Route::get('/auth/google/retorno', [GoogleController::class, 'retorno']);

Route::get('/arquivos/{nome}', ArquivoController::class)->where('nome', '[a-z0-9-]+\.(jpg|png|webp)');
