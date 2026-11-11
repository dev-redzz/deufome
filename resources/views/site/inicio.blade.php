@extends('layouts.site')

@php
  $icone = fn ($d, $t = 22) => '<svg width="'.$t.'" height="'.$t.'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.$d.'</svg>';
  $check = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
  $tablets = [
    ['nome' => 'Cantinho', 'cor' => '#FF5A1F', 'frase' => 'Toque para ver o cardápio', 'mesa' => 'Mesa 04'],
    ['nome' => 'Sabor da Terra', 'cor' => '#2F9E44', 'frase' => 'Comida caseira feita na hora', 'mesa' => 'Mesa 12'],
    ['nome' => 'Mar Azul', 'cor' => '#2563EB', 'frase' => 'Peixe fresco todos os dias', 'mesa' => 'Varanda 2'],
  ];
  $gestao = [
    ['<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', 'Relatórios', 'Vendas por dia, horário de pico, mais vendidos e ticket médio.'],
    ['<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>', 'Fechamento de caixa', 'O dia somado por forma de pagamento, pronto para imprimir.'],
    ['<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>', 'Equipe com funções', 'Dono, gerente, caixa e cozinha, cada um vê só o que precisa.'],
    ['<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', 'Horário de funcionamento', 'Fora do horário, o tablet mostra o cardápio e pausa os pedidos.'],
    ['<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/>', 'Avaliações', 'O cliente avalia ao pedir a conta e você acompanha a nota.'],
    ['<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 'Backup todo dia', 'Uma cópia dos dados vai para o seu e-mail todos os dias.'],
  ];
@endphp

@section('conteudo')
<main class="site-comanda">
  {{-- abertura --}}
  <section class="sc-hero">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-20 lg:pt-16 lg:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
      <div>
        <span class="carimbo carimbo-verde">Grátis no beta</span>
        <h1 class="mt-6 font-display font-extrabold text-[46px] leading-[.98] sm:text-6xl lg:text-[74px] tracking-[-.04em] max-w-[11ch]">A comanda saiu do papel.</h1>
        <p class="mt-6 text-lg sm:text-xl text-texto-2 max-w-[44ch] leading-relaxed">Um tablet fixo em cada mesa. O cliente pede sozinho, a cozinha recebe na hora e o caixa fecha a conta com tudo somado.</p>
        <div class="mt-9 flex flex-wrap gap-4">
          <a href="/cadastro" class="sc-btn sc-btn-brasa">Criar conta grátis {!! $icone('<path d="M9 5l7 7-7 7"/>', 20) !!}</a>
          <a href="#como-funciona" class="sc-btn sc-btn-papel">Ver como funciona</a>
        </div>
        <ul class="mt-9 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[14px] text-texto-2">
          @foreach (['Qualquer tablet Android', 'Sem app para o cliente', 'Pronto em minutos'] as $item)
            <li class="flex items-center gap-2"><span class="text-manjericao">{!! $icone($check, 18) !!}</span>{{ $item }}</li>
          @endforeach
        </ul>
      </div>

      <div class="relative" aria-hidden="true">
        <div class="sc-tablet">
          <div class="rounded-[14px] overflow-hidden bg-nevoa">
            <div class="flex items-center gap-2 px-4 h-11 bg-marinho text-white"><span class="w-6 h-6 rounded-md bg-brasa"></span><b class="font-display text-[15px]">Cantinho</b><span class="ml-auto font-mono text-[11px] font-bold bg-mostarda text-marinho rounded px-2 py-0.5 -rotate-2">Mesa 04</span></div>
            <div class="grid grid-cols-[78px_1fr] bg-[#E3E6EC]">
              <div class="p-2 flex flex-col gap-1 text-[11px] font-bold text-texto-2">
                <span class="rounded-l-md bg-papel text-marinho px-2 py-1.5 -mr-2">Lanches</span><span class="px-2 py-1.5">Porções</span><span class="px-2 py-1.5">Bebidas</span><span class="px-2 py-1.5">Doces</span>
              </div>
              <div class="p-3 bg-papel">
                <div class="inline-block text-[11px] font-display font-extrabold mb-2 bg-marinho text-white rounded px-2 py-0.5 -rotate-1">Mais pedidos da casa</div>
                <div class="grid grid-cols-2 gap-2.5">
                  @foreach ([['Burger Clássico', '28,90', 'burger'], ['Batata Frita', '22,90', 'batata'], ['Suco Natural', '10,90', 'suco'], ['Petit Gâteau', '22,90', 'doce']] as [$n, $p, $img])
                    <div class="sc-mini">
                      <div class="h-14 bg-cover bg-center" style="background-image:url('/img/produtos/{{ $img }}.svg')"></div>
                      <div class="p-2"><b class="block font-display text-[12px] leading-tight">{{ $n }}</b><span class="inline-block mt-1 font-mono text-[10px] font-bold bg-mostarda rounded px-1 -rotate-2">R$ {{ $p }}</span></div>
                    </div>
                  @endforeach
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3 h-11 bg-marinho text-white text-[12px] font-semibold"><span class="w-6 h-6 rounded bg-mostarda text-marinho grid place-items-center font-mono font-bold">3</span>itens no pedido<span class="ml-auto font-mono font-bold">R$ 62,70</span></div>
          </div>
        </div>
        <div class="sc-trilho hidden sm:block">
          <div class="sc-ticket">
            <div class="flex justify-between items-baseline"><b class="font-display text-2xl">Mesa 04</b><span class="font-mono text-xs bg-[#F0E8E0] rounded px-1.5">agora</span></div>
            <div class="font-mono text-[12px] text-[#7A6B62]">Pedido 128</div>
            <div class="sc-picote"></div>
            <div class="text-[14px] font-semibold"><b class="text-brasa">2×</b> Burger Clássico<small class="block text-tomate font-bold">sem cebola</small></div>
            <div class="sc-picote"></div>
            <div class="text-[14px] font-semibold"><b class="text-brasa">1×</b> Batata Frita</div>
            <span class="carimbo absolute! right-3 bottom-4 text-[11px]!">Na cozinha</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  {{-- como funciona: três comandas no trilho --}}
  <section id="como-funciona" class="sc-escuro">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-20">
      <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-[-.03em] max-w-[18ch] text-white">Do sentar ao pagar, sem esperar o garçom</h2>
      <p class="mt-4 text-lg text-[#B7BEDD] max-w-[56ch]">O pedido sai do tablet da mesa, aparece na tela da cozinha e chega pronto no caixa.</p>
      <div class="sc-trilho-largo mt-14">
        <div class="grid md:grid-cols-3 gap-6">
          @foreach ([
            ['1', 'Na mesa', 'O cliente escolhe com calma', ['Fotos grandes, tamanhos e meio a meio', 'Sugestões do que combina', 'Acompanha o preparo pela tela'], 'burger'],
            ['2', 'Na cozinha', 'Cada pedido vira uma comanda', ['Novos, em preparo e prontos', 'Som e alerta de atraso', 'Cozinha e bar separados, com impressão'], null],
            ['3', 'No caixa', 'A conta fecha sem calculadora', ['Taxa de serviço, cupom e divisão', 'Pix na mesa com QR code', 'O tablet volta limpo para a próxima mesa'], null],
          ] as [$n, $onde, $tit, $itens, $img])
            <article class="sc-ticket sc-ticket-g">
              <div class="flex items-center justify-between"><span class="font-mono text-sm text-[#7A6B62]">Passo {{ $n }} de 3</span><span class="carimbo text-[12px]!">{{ $onde }}</span></div>
              <h3 class="mt-4 font-display font-extrabold text-[28px] leading-tight">{{ $tit }}</h3>
              <div class="sc-picote"></div>
              <ul class="space-y-2.5 text-[16px]">
                @foreach ($itens as $item)
                  <li class="flex gap-2.5"><span class="mt-0.5 text-manjericao shrink-0">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
                @endforeach
              </ul>
            </article>
          @endforeach
        </div>
      </div>
    </div>
  </section>

  {{-- personalização --}}
  <section class="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid lg:grid-cols-[1fr_1.3fr] gap-12 items-center">
    <div>
      <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-[-.03em] max-w-[14ch]">O tablet com a cara da sua casa</h2>
      <p class="mt-5 text-lg text-texto-2 max-w-[42ch]">Logo, cor, fonte, foto do salão, Wi-Fi e Instagram na tela inicial. Você muda no painel e os tablets atualizam em segundos.</p>
      <ul class="mt-6 space-y-2 font-semibold">
        @foreach (['Tema claro ou escuro e 4 estilos de letra', 'Faixa de promoção e selos como "Novidade"', 'Os mais pedidos aparecem em destaque sozinhos'] as $item)
          <li class="flex gap-3"><span class="text-brasa">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
        @endforeach
      </ul>
    </div>
    <div class="grid grid-cols-3 gap-3 sm:gap-5" aria-hidden="true">
      @foreach ($tablets as $i => $t)
        <div class="sc-tablet p-2! {{ $i === 1 ? 'sm:-translate-y-6 rotate-1' : '-rotate-1' }}">
          <div class="rounded-xl aspect-[3/4] p-2.5 sm:p-4 flex flex-col justify-between text-white relative overflow-hidden" style="background: {{ $t['cor'] }}">
            <span class="self-start rounded bg-white px-2 py-0.5 font-mono font-bold text-[9px] sm:text-xs -rotate-3" style="color: {{ $t['cor'] }}">{{ $t['mesa'] }}</span>
            <div class="relative">
              <span class="block w-6 h-6 sm:w-10 sm:h-10 rounded-lg bg-white mb-2 sm:mb-3"></span>
              <b class="block font-display font-extrabold text-sm sm:text-2xl leading-none">{{ $t['nome'] }}</b>
              <span class="hidden sm:block text-xs mt-2 opacity-90">{{ $t['frase'] }}</span>
              <span class="inline-block mt-2 sm:mt-3 rounded bg-white text-marinho text-[9px] sm:text-xs font-extrabold px-2 py-1 sm:px-3 sm:py-2 shadow-[2px_2px_0_#172057]">Ver o cardápio</span>
            </div>
          </div>
        </div>
      @endforeach
    </div>
  </section>

  {{-- gestão --}}
  <section id="recursos" class="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
    <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-[-.03em] max-w-[20ch]">E um painel para cuidar do restaurante</h2>
    <p class="mt-4 text-lg text-texto-2 max-w-[56ch]">Vendas do dia, mapa do salão, cozinha e quem chamou o garçom na primeira tela. O resto fica a um toque.</p>
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-7">
      @foreach ($gestao as [$d, $t, $txt])
        <div class="sc-ticket">
          <span class="w-11 h-11 rounded-md bg-mostarda text-marinho grid place-items-center">{!! $icone($d) !!}</span>
          <h3 class="mt-4 font-display font-extrabold text-xl">{{ $t }}</h3>
          <p class="mt-1.5 text-texto-2">{{ $txt }}</p>
        </div>
      @endforeach
    </div>
  </section>

  {{-- tablet x QR --}}
  <section class="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
    <h2 class="font-display font-extrabold text-4xl tracking-[-.03em] max-w-[20ch]">Por que um tablet fixo e não só QR Code?</h2>
    <p class="mt-4 text-lg text-texto-2 max-w-[60ch]">Com QR Code, cada cliente usa o próprio celular: precisa de internet, bateria, e muita gente desiste. Com o tablet do restaurante, a mesa já está pronta para pedir.</p>
    <div class="mt-10 grid sm:grid-cols-2 gap-6 max-w-4xl">
      <div class="sc-ticket">
        <b class="font-display text-2xl">Tablet da mesa</b>
        <div class="sc-picote"></div>
        <ul class="space-y-2">@foreach (['Mesa identificada sozinha', 'Igual para todas as idades', 'Não depende do celular do cliente'] as $i)<li class="flex gap-2"><span class="text-manjericao">{!! $icone($check, 20) !!}</span>{{ $i }}</li>@endforeach</ul>
        <span class="carimbo carimbo-verde absolute! right-4 top-4">Aprovado</span>
      </div>
      <div class="sc-ticket opacity-80">
        <b class="font-display text-2xl">Só QR Code</b>
        <div class="sc-picote"></div>
        <ul class="space-y-2 text-texto-2">@foreach (['Cliente digita o número da mesa', 'Precisa de internet e bateria', 'Muita gente desiste no meio'] as $i)<li class="flex gap-2"><span class="text-tomate">{!! $icone('<path d="M6 6l12 12M18 6L6 18"/>', 20) !!}</span><span class="line-through decoration-tomate/50">{{ $i }}</span></li>@endforeach</ul>
      </div>
    </div>
  </section>

  {{-- preço: o cupom fiscal --}}
  <section class="sc-escuro">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid lg:grid-cols-[1fr_auto] gap-12 items-center">
      <div>
        <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-[-.03em] text-white max-w-[16ch]">Quanto custa? A conta é esta aqui.</h2>
        <p class="mt-4 text-lg text-[#B7BEDD] max-w-[48ch]">Todas as funções liberadas, sem limite de mesas ou tablets. Se um dia passarmos a cobrar, você fica sabendo com 30 dias de antecedência.</p>
        <a href="/cadastro" class="sc-btn sc-btn-brasa mt-8">Começar agora</a>
      </div>
      <div class="sc-cupom" aria-label="Preço durante o beta: zero reais">
        <div class="text-center font-display font-extrabold text-2xl">Deu <span class="text-brasa">Fome</span></div>
        <div class="text-center font-mono text-xs text-texto-2 mt-1">Plano beta</div>
        <div class="sc-picote"></div>
        @foreach (['Tablets ilimitados', 'Cozinha e bar', 'Pix na mesa', 'Relatórios e cupons', 'Suporte'] as $item)
          <div class="flex justify-between font-mono text-[14px] py-0.5"><span>1x {{ $item }}</span><span>0,00</span></div>
        @endforeach
        <div class="sc-picote"></div>
        <div class="flex justify-between font-mono font-bold text-xl"><span>TOTAL</span><span>R$ 0,00</span></div>
        <span class="carimbo carimbo-verde absolute! left-1/2 -translate-x-1/2 bottom-16 text-2xl! sc-carimbo-grande">Grátis</span>
      </div>
    </div>
  </section>

  <section id="duvidas">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 py-20">
      <h2 class="font-display font-extrabold text-4xl tracking-[-.03em]">Dúvidas frequentes</h2>
      <div class="mt-8 sc-ticket p-0! divide-y-2 divide-dashed divide-[#D9CFBC]">
        @foreach ([
          ['Preciso comprar um tablet específico?', 'Não. Qualquer tablet Android com o Chrome funciona, inclusive modelos mais simples. iPad também funciona pelo Safari.'],
          ['E se a internet cair?', 'O tablet continua mostrando o cardápio e avisa que está sem conexão. Os pedidos ficam bloqueados até a internet voltar, para nenhum pedido se perder.'],
          ['O cliente pode sair do app e mexer no tablet?', 'Não, se o tablet estiver em modo quiosque. Para sair, é preciso tocar 5 vezes no logo e digitar o PIN do gerente.'],
          ['Consigo usar com impressora na cozinha?', 'Sim. A tela da cozinha imprime a comanda em impressoras térmicas de 80 mm, separando cozinha e bar se você quiser.'],
          ['O cliente pode pagar pelo tablet?', 'Sim. Com o Pix na mesa ligado, o tablet mostra o QR code com o valor da conta e a gorjeta escolhida. O caixa confere e fecha.'],
          ['Meus dados ficam seguros?', 'Cada restaurante só vê os próprios dados, as senhas são guardadas criptografadas e uma cópia do banco é feita todos os dias.'],
        ] as [$p, $r])
          <details class="group px-6 py-5">
            <summary class="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-lg">{{ $p }}<span class="w-8 h-8 rounded-md bg-mostarda text-marinho grid place-items-center text-xl font-mono group-open:rotate-45 transition-transform">+</span></summary>
            <p class="mt-3 text-texto-2">{{ $r }}</p>
          </details>
        @endforeach
      </div>
    </div>
  </section>

  <section class="bg-brasa text-white border-y-4 border-marinho">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-16 flex flex-col md:flex-row md:items-center gap-6">
      <div>
        <h2 class="font-display font-extrabold text-4xl tracking-[-.03em] max-w-[18ch]">Seu restaurante pedindo pelo tablet ainda hoje.</h2>
        <p class="mt-3 text-lg text-white/90">Crie a conta e o painel guia você até o primeiro pedido.</p>
      </div>
      <a href="/cadastro" class="md:ml-auto sc-btn sc-btn-marinho shrink-0">Criar conta grátis</a>
    </div>
  </section>
</main>
@endsection
