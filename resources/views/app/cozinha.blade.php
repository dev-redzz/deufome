@extends('layouts.app', ['script' => 'cozinha'])
@section('titulo', 'Cozinha')
@section('body')class="cozinha"@endsection
@section('conteudo')
<header>
  <img src="/img/icone-escuro.png" alt="Deu Fome">
  <h1 id="titulo">Cozinha</h1>
  <div class="setores" id="setores" role="tablist" aria-label="Setor">
    <button data-setor="" class="marcado">Tudo</button><button data-setor="cozinha">Cozinha</button><button data-setor="bar">Bar</button>
  </div>
  <button class="btn btn-p" id="esgotar">Esgotou algo?</button>
  <button class="btn btn-p" id="autoImp">Impressão automática</button>
  <button class="btn btn-p" id="som">Ativar som</button>
  <span class="relogio" id="relogio"></span>
  <button class="btn btn-p" id="sair">Sair</button>
</header>
<div class="colunas">
  <section class="coluna"><h2>Novos <span class="n" id="n-recebido">0</span></h2><div id="c-recebido"></div></section>
  <section class="coluna"><h2>Em preparo <span class="n" id="n-preparo">0</span></h2><div id="c-preparo"></div></section>
  <section class="coluna"><h2>Prontos <span class="n" id="n-pronto">0</span></h2><div id="c-pronto"></div></section>
</div>
@endsection
