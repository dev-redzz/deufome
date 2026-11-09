<?php

use App\Http\Controllers\Auth\CadastroController;
use App\Http\Controllers\Auth\SenhaController;
use App\Http\Controllers\Auth\SessaoController;
use App\Http\Controllers\Painel\CardapioController;
use App\Http\Controllers\Painel\ConfiguracaoController;
use App\Http\Controllers\Painel\CozinhaController;
use App\Http\Controllers\Painel\DispositivoController;
use App\Http\Controllers\Painel\EquipeController;
use App\Http\Controllers\Painel\InicioController;
use App\Http\Controllers\Painel\MesaController;
use App\Http\Controllers\Painel\RelatorioController;
use App\Http\Controllers\Painel\SalaoController;
use App\Http\Controllers\Painel\SugestaoController;
use App\Http\Controllers\Plataforma\PlataformaController;
use App\Http\Controllers\Tablet\TabletController;
use Illuminate\Support\Facades\Route;

// Público: entrar, criar conta, recuperar senha
Route::post('login', [SessaoController::class, 'entrar']);
Route::post('logout', [SessaoController::class, 'sair']);
Route::get('info', [SessaoController::class, 'info']);
Route::post('cadastro', [CadastroController::class, 'criar']);
Route::get('cadastro/google', [CadastroController::class, 'lerGoogle']);
Route::post('cadastro/google', [CadastroController::class, 'criarGoogle']);
Route::post('senha/esqueci', [SenhaController::class, 'esqueci']);
Route::post('senha/redefinir', [SenhaController::class, 'redefinir']);
Route::post('erros', [SugestaoController::class, 'erroNavegador']);
Route::post('tablet/ativar', [TabletController::class, 'ativar']);

// Tablet da mesa (credencial do dispositivo)
Route::middleware('tablet')->prefix('tablet')->controller(TabletController::class)->group(function () {
    Route::get('estado', 'estado');
    Route::get('cardapio', 'cardapio');
    Route::post('pedidos', 'pedir');
    Route::post('chamar', 'chamar');
    Route::post('desbloquear', 'desbloquear');
    Route::post('avaliar', 'avaliar');
});

// Qualquer pessoa logada
Route::middleware('papel')->group(function () {
    Route::get('me', [SessaoController::class, 'eu']);
    Route::post('minha-senha', [SessaoController::class, 'minhaSenha']);
    Route::post('sugestoes', [SugestaoController::class, 'criar']);
});

// Cozinha
Route::middleware('papel:dono,gerente,caixa,cozinha')->controller(CozinhaController::class)->group(function () {
    Route::get('cozinha/pedidos', 'pedidos');
    Route::post('cozinha/pedidos/{id}/status', 'status')->whereNumber('id');
});

// Salão e caixa
Route::middleware('papel:dono,gerente,caixa')->group(function () {
    Route::controller(SalaoController::class)->prefix('salao')->group(function () {
        Route::get('mesas', 'mesas');
        Route::get('sessoes/{id}', 'sessao')->whereUuid('id');
        Route::post('sessoes/{id}/fechar', 'fechar')->whereUuid('id');
        Route::post('sessoes/{id}/reabrir', 'reabrir')->whereUuid('id');
        Route::post('pedidos/{id}/cancelar', 'cancelarPedido')->whereNumber('id');
        Route::post('chamados/{id}/atender', 'atender')->whereNumber('id');
    });
    Route::get('caixa', [RelatorioController::class, 'caixa']);
});

// Gestão do restaurante (dono e gerente)
Route::middleware('papel:dono,gerente')->group(function () {
    Route::get('relatorios', [RelatorioController::class, 'relatorios']);
    Route::get('inicio', [InicioController::class, 'resumo']);

    Route::controller(DispositivoController::class)->group(function () {
        Route::get('dispositivos', 'listar');
        Route::post('dispositivos', 'criar');
        Route::post('dispositivos/{id}/mesa', 'mudarMesa')->whereNumber('id');
        Route::post('dispositivos/{id}/bloquear', 'bloquear')->whereNumber('id');
        Route::post('dispositivos/{id}/credencial', 'credencial')->whereNumber('id');
        Route::post('dispositivos/{id}/excluir', 'excluir')->whereNumber('id');
    });

    Route::controller(CardapioController::class)->group(function () {
        Route::get('produtos', 'listar');
        Route::post('produtos', 'criarProduto');
        Route::post('produtos/{id}', 'salvarProduto')->whereNumber('id');
        Route::post('produtos/{id}/imagem', 'imagemProduto')->whereNumber('id');
        Route::post('produtos/{id}/mover', 'moverProduto')->whereNumber('id');
        Route::post('produtos/{id}/remover', 'removerProduto')->whereNumber('id');
        Route::post('categorias', 'criarCategoria');
        Route::post('categorias/{id}', 'salvarCategoria')->whereNumber('id');
        Route::post('categorias/{id}/mover', 'moverCategoria')->whereNumber('id');
        Route::post('categorias/{id}/remover', 'removerCategoria')->whereNumber('id');
    });

    Route::controller(MesaController::class)->group(function () {
        Route::get('mesas', 'listar');
        Route::post('mesas', 'criar');
        Route::post('mesas/lote', 'criarVarias');
        Route::post('mesas/{id}', 'salvar')->whereNumber('id');
        Route::post('mesas/{id}/remover', 'remover')->whereNumber('id');
    });

    Route::controller(EquipeController::class)->group(function () {
        Route::get('equipe', 'listar');
        Route::post('equipe', 'criar');
        Route::post('equipe/{id}', 'salvar')->whereNumber('id');
    });

    Route::controller(ConfiguracaoController::class)->group(function () {
        Route::get('config', 'ler');
        Route::post('config', 'salvar');
        Route::post('config/imagem', 'imagem');
        Route::post('config/imagem/remover', 'removerImagem');
    });
});

// Administrador do Deu Fome
Route::middleware('papel:plataforma')->prefix('plataforma')->controller(PlataformaController::class)->group(function () {
    Route::get('resumo', 'resumo');
    Route::get('estabelecimentos', 'estabelecimentos');
    Route::post('estabelecimentos', 'criar');
    Route::post('estabelecimentos/{id}', 'salvar')->whereNumber('id');
    Route::get('backup', 'baixarBackup');
    Route::post('backup/enviar', 'enviarBackup');
    Route::get('status', 'status');
    Route::get('erros', 'erros');
    Route::post('erros/{id}', 'salvarErro')->whereNumber('id');
    Route::get('sugestoes', 'sugestoes');
    Route::post('sugestoes/{id}', 'salvarSugestao')->whereNumber('id');
});

Route::fallback(fn () => response()->json(['erro' => 'Rota não encontrada.'], 404));
