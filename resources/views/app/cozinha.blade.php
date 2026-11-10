@extends('layouts.app', ['script' => 'cozinha'])
@section('titulo', 'Cozinha')
@section('body')class="cozinha"@endsection
@section('conteudo')
<header class="coz-topo">
  <div class="coz-marca">
    <img src="/img/icone-escuro.png" alt="Deu Fome">
    <h1 id="titulo">Cozinha</h1>
  </div>
  <div class="setores" id="setores" role="tablist" aria-label="Setor">
    <button data-setor="" class="marcado">Tudo</button><button data-setor="cozinha">Cozinha</button><button data-setor="bar">Bar</button>
  </div>
  <div class="coz-ferramentas">
    <button class="ferr" id="esgotar"><span class="fi" data-ic="lixo"></span><span>Esgotou algo?</span></button>
    <button class="ferr" id="autoImp"><span class="fi" data-ic="impressora"></span><span>Impressão auto.</span></button>
    <button class="ferr" id="som"><span class="fi" data-ic="sino"></span><span>Ativar som</span></button>
  </div>
  <span class="relogio" id="relogio"></span>
  <button class="ferr so-icone" id="sair" aria-label="Sair"><span class="fi" data-ic="sair"></span></button>
</header>
<div class="coz-resumo" id="resumo"></div>
<div class="colunas">
  <section class="coluna recebido"><h2><i></i>Novos <span class="n" id="n-recebido">0</span></h2><div class="coluna-corpo" id="c-recebido"></div></section>
  <section class="coluna preparo"><h2><i></i>Em preparo <span class="n" id="n-preparo">0</span></h2><div class="coluna-corpo" id="c-preparo"></div></section>
  <section class="coluna pronto"><h2><i></i>Prontos para levar <span class="n" id="n-pronto">0</span></h2><div class="coluna-corpo" id="c-pronto"></div></section>
</div>
@endsection
