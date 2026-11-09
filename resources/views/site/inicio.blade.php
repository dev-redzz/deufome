@extends('layouts.site')

@php
  $tablets = [
    ['nome' => 'Cantinho', 'cor' => '#FF5A1F', 'frase' => 'Toque para ver o cardápio', 'mesa' => 'Mesa 04'],
    ['nome' => 'Sabor da Terra', 'cor' => '#2F9E44', 'frase' => 'Comida caseira feita na hora', 'mesa' => 'Mesa 12'],
    ['nome' => 'Mar Azul', 'cor' => '#2563EB', 'frase' => 'Peixe fresco todos os dias', 'mesa' => 'Varanda 2'],
  ];
@endphp

@section('conteudo')
<main>
  {{-- Abertura: do tablet da mesa para a comanda da cozinha --}}
  <section class="relative overflow-hidden">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
      <div>
        <h1 class="font-display font-extrabold text-[44px] leading-[1.02] sm:text-6xl lg:text-[68px] tracking-tight max-w-[12ch]">Cada mesa com seu próprio cardápio.</h1>
        <p class="mt-6 text-lg sm:text-xl text-texto-2 max-w-[44ch] leading-relaxed">Um tablet fixo em cada mesa. O cliente escolhe e envia o pedido sozinho, a cozinha recebe na hora e o caixa fecha a conta com tudo somado.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/cadastro" class="inline-flex items-center h-14 px-7 rounded-2xl bg-brasa text-white text-lg font-bold hover:bg-brasa-escura">Criar conta grátis</a>
          <a href="#como-funciona" class="inline-flex items-center h-14 px-7 rounded-2xl border-[1.5px] border-linha text-lg font-bold hover:border-[#C9CDDB]">Ver como funciona</a>
        </div>
        <p class="mt-4 text-sm font-semibold text-texto-2">Grátis durante o beta. Sem cartão de crédito.</p>
      </div>

      <div class="relative h-[400px] sm:h-[460px]" aria-hidden="true">
        <div class="absolute inset-0 rounded-[36px] bg-marinho overflow-hidden">
          <div class="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-brasa"></div>
          <div class="absolute right-24 bottom-10 w-24 h-24 rounded-full bg-mostarda"></div>
        </div>
        {{-- tablet --}}
        <div class="absolute left-[6%] top-[11%] w-[78%] max-w-[440px] rounded-[26px] bg-[#0C1438] p-2.5 shadow-[0_30px_60px_rgba(0,0,0,.35)] -rotate-2">
          <div class="rounded-[18px] overflow-hidden bg-nevoa">
            <div class="flex items-center gap-2 px-4 h-11 bg-brasa text-white"><span class="w-6 h-6 rounded-md bg-white"></span><b class="font-display text-[15px]">Cantinho</b><span class="ml-auto text-xs font-bold bg-black/20 rounded-md px-2 py-0.5">Mesa 04</span></div>
            <div class="grid grid-cols-[74px_1fr]">
              <div class="bg-white border-r border-linha p-2 flex flex-col gap-1 text-[11px] font-bold text-texto-2">
                <span class="rounded-md bg-brasa-clara text-brasa-escura px-2 py-1.5">Lanches</span><span class="px-2 py-1.5">Porções</span><span class="px-2 py-1.5">Bebidas</span><span class="px-2 py-1.5">Doces</span>
              </div>
              <div class="p-3 grid grid-cols-2 gap-2.5">
                @foreach ([['Burger Clássico', '28,90', 'burger'], ['Batata Frita', '22,90', 'batata'], ['Suco Natural', '10,90', 'suco'], ['Petit Gâteau', '22,90', 'doce']] as [$n, $p, $img])
                  <div class="rounded-xl bg-white border border-linha overflow-hidden">
                    <div class="h-14 bg-cover bg-center" style="background-image:url('/img/produtos/{{ $img }}.svg')"></div>
                    <div class="p-2 relative"><b class="block font-display text-[12px] leading-tight">{{ $n }}</b><span class="text-[11px] font-bold">R$ {{ $p }}</span><span class="absolute right-2 bottom-2 w-5 h-5 rounded-md bg-brasa text-white text-xs font-bold grid place-items-center leading-none">+</span></div>
                  </div>
                @endforeach
              </div>
            </div>
            <div class="flex items-center gap-2 px-3 h-11 bg-marinho text-white text-[12px] font-semibold"><span class="w-6 h-6 rounded-md bg-mostarda text-marinho grid place-items-center font-display font-extrabold">3</span>itens<b class="font-display text-base ml-1">R$ 62,70</b><span class="ml-auto bg-brasa rounded-lg px-3 py-1.5 font-bold">Enviar pedido</span></div>
          </div>
        </div>
        {{-- comanda que chega na cozinha --}}
        <div class="comanda-papel absolute! right-[3%] bottom-[7%] w-[210px]! sm:w-[240px]! rotate-3 text-[14px]">
          <div class="cp-cab"><b class="text-2xl!">Mesa 04</b><span>agora</span></div>
          <div class="cp-num">Pedido 128 · chegou na cozinha</div>
          <ul class="my-2.5!"><li class="text-[14px]! py-1.5!"><b>2×</b> Burger Clássico<small>sem cebola</small></li><li class="text-[14px]! py-1.5!"><b>1×</b> Batata Frita</li></ul>
          <div class="cp-btn text-[13px]! py-2!">Começar preparo</div>
        </div>
      </div>
    </div>
  </section>

  <section class="border-y border-linha bg-nevoa">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-8 grid sm:grid-cols-3 gap-6">
      <div><b class="font-display text-3xl">3 toques</b><p class="text-texto-2 font-medium">para pedir um prato no tablet</p></div>
      <div><b class="font-display text-3xl">Na hora</b><p class="text-texto-2 font-medium">o pedido aparece na tela da cozinha</p></div>
      <div><b class="font-display text-3xl">Zero</b><p class="text-texto-2 font-medium">comanda perdida ou letra ilegível</p></div>
    </div>
  </section>

  <section id="como-funciona" class="mx-auto max-w-6xl px-4 sm:px-6 py-20">
    <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[18ch]">Do sentar ao pagar, sem esperar o garçom</h2>
    <ol class="mt-10 grid md:grid-cols-2 lg:grid-cols-4 gap-5">
      @foreach ([
        ['O cliente toca no tablet', 'A mesa já vem identificada. Ninguém baixa app, lê QR Code ou faz login.'],
        ['Escolhe, confere e envia', 'Fotos grandes, adicionais, observações prontas e uma tela de confirmação.'],
        ['A cozinha prepara', 'O pedido chega na tela da cozinha com som. Cada etapa aparece no tablet da mesa.'],
        ['Pede a conta e o tablet zera', 'O caixa recebe, divide entre as pessoas se precisar, e o tablet volta limpo.'],
      ] as $i => [$t, $d])
        <li class="rounded-3xl border border-linha p-6 bg-white">
          <span class="w-11 h-11 rounded-xl bg-marinho text-white font-display font-extrabold text-xl grid place-items-center">{{ $i + 1 }}</span>
          <h3 class="mt-5 font-display font-extrabold text-xl">{{ $t }}</h3>
          <p class="mt-2 text-texto-2">{{ $d }}</p>
        </li>
      @endforeach
    </ol>
  </section>

  {{-- Personalização: o tablet com a cara de cada restaurante --}}
  <section class="bg-marinho text-white">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid lg:grid-cols-[1fr_1.4fr] gap-12 items-center">
      <div>
        <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[14ch]">O tablet com a cara do seu restaurante</h2>
        <p class="mt-5 text-lg text-[#C7CEEB] max-w-[42ch]">Seu logo, sua cor, uma foto do salão, o Wi-Fi e o Instagram na tela inicial. Você escolhe no painel e os tablets mudam em segundos.</p>
        <ul class="mt-6 space-y-2 font-semibold">
          <li class="flex gap-3"><span class="text-mostarda">✓</span> Tema claro ou escuro</li>
          <li class="flex gap-3"><span class="text-mostarda">✓</span> Mostrar ou esconder fotos, descrições e observações</li>
          <li class="flex gap-3"><span class="text-mostarda">✓</span> Rodapé próprio na conta impressa</li>
        </ul>
      </div>
      <div class="grid grid-cols-3 gap-2.5 sm:gap-4" aria-hidden="true">
        @foreach ($tablets as $i => $t)
          <div class="rounded-[22px] bg-[#0C1438] p-2 shadow-[0_20px_40px_rgba(0,0,0,.35)] {{ $i === 1 ? 'sm:-translate-y-6' : '' }}">
            <div class="rounded-2xl aspect-[3/4] p-2.5 sm:p-4 flex flex-col justify-between text-white relative overflow-hidden" style="background: {{ $t['cor'] }}">
              <span class="absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-white/10"></span>
              <span class="self-start rounded-lg bg-white px-2 py-0.5 font-display font-extrabold text-[9px] sm:text-xs" style="color: {{ $t['cor'] }}">{{ $t['mesa'] }}</span>
              <div class="relative">
                <span class="block w-6 h-6 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white mb-2 sm:mb-3"></span>
                <b class="block font-display font-extrabold text-sm sm:text-2xl leading-none">{{ $t['nome'] }}</b>
                <span class="hidden sm:block text-xs mt-2 opacity-90">{{ $t['frase'] }}</span>
                <span class="inline-block mt-2 sm:mt-3 rounded-md sm:rounded-lg bg-white text-marinho text-[9px] sm:text-xs font-extrabold px-2 py-1 sm:px-3 sm:py-2">Ver o cardápio</span>
              </div>
            </div>
          </div>
        @endforeach
      </div>
    </div>
  </section>

  <section id="recursos" class="mx-auto max-w-6xl px-4 sm:px-6 py-20">
    <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[20ch]">Tudo que o restaurante precisa, num lugar só</h2>
    <div class="mt-10 grid md:grid-cols-3 gap-5">
      @foreach ([
        ['Na mesa', ['Cardápio com fotos, adicionais e itens esgotados', 'Acompanhamento do pedido em tempo real', 'Botão para chamar o garçom e pedir a conta', 'Avaliação de 1 a 5 estrelas no fim', 'Modo quiosque: o cliente não sai do app']],
        ['Na cozinha', ['Pedidos em colunas: novos, em preparo e prontos', 'Aviso sonoro e destaque para pedido atrasado', 'Impressão em impressora térmica de 80 mm', 'Funciona numa TV, num tablet ou no computador']],
        ['Na gestão', ['Relatórios de vendas, mais vendidos e horários de pico', 'Fechamento de caixa por forma de pagamento', 'Taxa de serviço e divisão da conta', 'Horário de funcionamento e equipe com funções', 'Entrar com e-mail ou com a conta Google']],
      ] as [$titulo, $itens])
        <div class="rounded-3xl bg-nevoa p-7">
          <h3 class="font-display font-extrabold text-2xl">{{ $titulo }}</h3>
          <ul class="mt-4 space-y-3">
            @foreach ($itens as $item)
              <li class="flex gap-3 text-[15.5px]"><span class="mt-2 w-2 h-2 rounded-sm bg-brasa rotate-45 shrink-0"></span>{{ $item }}</li>
            @endforeach
          </ul>
        </div>
      @endforeach
    </div>
  </section>

  <section class="mx-auto max-w-6xl px-4 sm:px-6 pb-20 grid lg:grid-cols-2 gap-10 items-start">
    <div>
      <h2 class="font-display font-extrabold text-4xl tracking-tight max-w-[16ch]">Por que um tablet fixo e não só QR Code?</h2>
      <p class="mt-5 text-lg text-texto-2 max-w-[48ch]">Com QR Code, cada cliente usa o próprio celular: precisa de internet, bateria, e muita gente desiste. Com o tablet do restaurante, a mesa já está pronta para pedir, a experiência é igual para todos e o pedido sempre vai para a mesa certa.</p>
    </div>
    <ul class="space-y-3">
      @foreach ([['Mesa identificada sozinha', 'sem digitar número nem escanear nada'], ['Funciona para qualquer idade', 'botões grandes e telas simples'], ['Atualiza em todos os tablets', 'mudou o preço no painel, mudou nas mesas']] as [$t, $d])
        <li class="rounded-2xl border border-linha p-5 flex flex-col"><b class="font-display text-xl">{{ $t }}</b><span class="text-texto-2">{{ $d }}</span></li>
      @endforeach
    </ul>
  </section>

  <section id="duvidas" class="bg-nevoa">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 py-20">
      <h2 class="font-display font-extrabold text-4xl tracking-tight">Dúvidas frequentes</h2>
      <div class="mt-8 divide-y divide-linha border-y border-linha">
        @foreach ([
          ['Preciso comprar um tablet específico?', 'Não. Qualquer tablet Android com o Chrome funciona, inclusive modelos mais simples. iPad também funciona pelo Safari.'],
          ['Quanto custa?', 'Durante o beta o Deu Fome é gratuito. Avisaremos com antecedência antes de qualquer cobrança.'],
          ['E se a internet cair?', 'O tablet continua mostrando o cardápio e avisa que está sem conexão. Os pedidos ficam bloqueados até a internet voltar, para nenhum pedido se perder.'],
          ['O cliente pode sair do app e mexer no tablet?', 'Não, se o tablet estiver em modo quiosque. Para sair, é preciso tocar 5 vezes no logo e digitar o PIN do gerente.'],
          ['Consigo usar com impressora na cozinha?', 'Sim. A tela da cozinha imprime a comanda em impressoras térmicas de 80 mm, uma a uma ou automaticamente.'],
          ['Posso mudar as cores e colocar meu logo?', 'Sim. Em Personalizar você escolhe a cor, envia o logo e uma foto, e define o que aparece na tela inicial dos tablets.'],
        ] as [$p, $r])
          <details class="group py-5">
            <summary class="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-lg">{{ $p }}<span class="w-8 h-8 rounded-lg bg-white grid place-items-center text-brasa text-xl group-open:rotate-45 transition-transform">+</span></summary>
            <p class="mt-3 text-texto-2">{{ $r }}</p>
          </details>
        @endforeach
      </div>
    </div>
  </section>

  <section class="bg-brasa text-white">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-16 flex flex-col md:flex-row md:items-center gap-6">
      <div>
        <h2 class="font-display font-extrabold text-4xl tracking-tight max-w-[18ch]">Seu restaurante pedindo pelo tablet ainda hoje.</h2>
        <p class="mt-3 text-lg text-white/90">Crie a conta, monte o cardápio e ative o primeiro tablet em poucos minutos.</p>
      </div>
      <a href="/cadastro" class="md:ml-auto inline-flex items-center justify-center h-14 px-8 rounded-2xl bg-marinho text-white text-lg font-bold hover:bg-marinho-profundo shrink-0">Criar conta grátis</a>
    </div>
  </section>
</main>
@endsection
