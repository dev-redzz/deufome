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
<main>
  {{-- abertura --}}
  <section class="relative overflow-hidden">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1fr_1.05fr] gap-14 items-center">
      <div>
        <span class="inline-flex items-center gap-2 rounded-full bg-brasa-clara text-brasa-escura text-sm font-bold px-3 py-1.5"><span class="w-2 h-2 rounded-full bg-brasa"></span>Grátis durante o beta</span>
        <h1 class="mt-5 font-display font-extrabold text-[44px] leading-[1.02] sm:text-6xl lg:text-[66px] tracking-tight max-w-[12ch]">Cada mesa com seu próprio cardápio.</h1>
        <p class="mt-6 text-lg sm:text-xl text-texto-2 max-w-[44ch] leading-relaxed">Um tablet fixo em cada mesa. O cliente pede sozinho, a cozinha recebe na hora e o caixa fecha a conta com tudo somado.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <a href="/cadastro" class="inline-flex items-center gap-2 h-14 px-7 rounded-2xl bg-brasa text-white text-lg font-bold hover:bg-brasa-escura">Criar conta grátis {!! $icone('<path d="M9 5l7 7-7 7"/>', 20) !!}</a>
          <a href="#como-funciona" class="inline-flex items-center h-14 px-7 rounded-2xl border-[1.5px] border-linha text-lg font-bold hover:border-[#C9CDDB]">Ver como funciona</a>
        </div>
        <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[15px] font-semibold text-texto-2">
          @foreach (['Qualquer tablet Android', 'Sem app para o cliente', 'Pronto em minutos'] as $item)
            <li class="flex items-center gap-2"><span class="text-manjericao">{!! $icone($check, 18) !!}</span>{{ $item }}</li>
          @endforeach
        </ul>
      </div>

      <div class="relative px-5 py-10 sm:px-12 sm:py-14" aria-hidden="true">
        <div class="absolute inset-0 rounded-[40px] bg-marinho overflow-hidden">
          <div class="absolute -right-20 -top-24 w-80 h-80 rounded-full bg-brasa"></div>
          <div class="absolute left-10 -bottom-10 w-32 h-32 rounded-full bg-mostarda/90"></div>
        </div>
        <div class="relative mx-auto max-w-[480px] rounded-[28px] bg-[#0C1438] p-2.5 shadow-[0_30px_60px_rgba(0,0,0,.35)]">
          <div class="rounded-[20px] overflow-hidden bg-nevoa">
            <div class="flex items-center gap-2 px-4 h-11 bg-brasa text-white"><span class="w-6 h-6 rounded-md bg-white"></span><b class="font-display text-[15px]">Cantinho</b><span class="ml-auto text-xs font-bold bg-black/20 rounded-md px-2 py-0.5">Mesa 04</span></div>
            <div class="grid grid-cols-[78px_1fr]">
              <div class="bg-white border-r border-linha p-2 flex flex-col gap-1 text-[11px] font-bold text-texto-2">
                <span class="rounded-md bg-brasa-clara text-brasa-escura px-2 py-1.5">Lanches</span><span class="px-2 py-1.5">Porções</span><span class="px-2 py-1.5">Bebidas</span><span class="px-2 py-1.5">Doces</span>
              </div>
              <div class="p-3">
                <div class="text-[12px] font-display font-extrabold mb-2">Mais pedidos da casa</div>
                <div class="grid grid-cols-2 gap-2.5">
                  @foreach ([['Burger Clássico', '28,90', 'burger', 'Sugestão do chef'], ['Batata Frita', '22,90', 'batata', null], ['Suco Natural', '10,90', 'suco', 'Novidade'], ['Petit Gâteau', '22,90', 'doce', null]] as [$n, $p, $img, $selo])
                    <div class="rounded-xl bg-white border border-linha overflow-hidden">
                      <div class="h-14 bg-cover bg-center" style="background-image:url('/img/produtos/{{ $img }}.svg')"></div>
                      <div class="p-2 relative">
                        @if ($selo)<span class="inline-block text-[8px] font-extrabold rounded px-1.5 py-0.5 bg-brasa-clara text-brasa-escura mb-0.5">{{ $selo }}</span>@endif
                        <b class="block font-display text-[12px] leading-tight">{{ $n }}</b><span class="text-[11px] font-bold">R$ {{ $p }}</span><span class="absolute right-2 bottom-2 w-5 h-5 rounded-md bg-brasa text-white text-xs font-bold grid place-items-center leading-none">+</span>
                      </div>
                    </div>
                  @endforeach
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 px-3 h-11 bg-marinho text-white text-[12px] font-semibold"><span class="w-6 h-6 rounded-md bg-mostarda text-marinho grid place-items-center font-display font-extrabold">3</span>itens<b class="font-display text-base ml-1">R$ 62,70</b><span class="ml-auto bg-brasa rounded-lg px-3 py-1.5 font-bold">Ver carrinho</span></div>
          </div>
        </div>
        <div class="comanda-papel absolute! -left-14 -bottom-16 w-[190px]! -rotate-6 text-[14px] hidden! xl:block!">
          <div class="cp-cab"><b class="text-2xl!">Mesa 04</b><span>agora</span></div>
          <div class="cp-num">Pedido 128 · na cozinha</div>
          <ul class="my-2.5!"><li class="text-[14px]! py-1.5!"><b>2×</b> Burger Clássico<small>sem cebola</small></li><li class="text-[14px]! py-1.5!"><b>1×</b> Batata Frita</li></ul>
        </div>
      </div>
    </div>
  </section>

  {{-- como funciona: mesa, cozinha, caixa --}}
  <section id="como-funciona" class="bg-nevoa">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-20">
      <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[18ch]">Do sentar ao pagar, sem esperar o garçom</h2>
      <p class="mt-4 text-lg text-texto-2 max-w-[56ch]">O pedido sai do tablet da mesa, aparece na tela da cozinha e chega pronto no caixa, sem comanda de papel no meio do caminho.</p>

      <div class="mt-14 space-y-16">
        {{-- mesa --}}
        <div class="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span class="font-display font-extrabold text-brasa text-lg">1 · Na mesa</span>
            <h3 class="mt-2 font-display font-extrabold text-3xl">O cliente escolhe com calma, do jeito dele</h3>
            <ul class="mt-5 space-y-3 text-[16.5px]">
              @foreach (['Fotos grandes, adicionais e observações prontas, como "sem cebola"', 'Confere o pedido antes de enviar e acompanha o preparo pela tela', 'Chama o garçom ou pede a conta com um toque'] as $item)
                <li class="flex gap-3"><span class="mt-0.5 text-manjericao shrink-0">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
              @endforeach
            </ul>
          </div>
          <div class="rounded-[28px] bg-white border border-linha p-5 sm:p-7 shadow-[0_8px_24px_rgba(20,33,90,.06)]" aria-hidden="true">
            <div class="grid grid-cols-[120px_1fr] sm:grid-cols-[160px_1fr] gap-5">
              <div class="rounded-2xl bg-cover bg-center aspect-square" style="background-image:url('/img/produtos/burger.svg')"></div>
              <div>
                <span class="inline-block text-xs font-extrabold rounded-md px-2 py-0.5 bg-mostarda-clara text-[#7A5200]">Sugestão do chef</span>
                <b class="block font-display font-extrabold text-2xl mt-1">Burger Clássico</b>
                <span class="text-texto-2 text-sm">Pão brioche, blend 160 g e queijo prato.</span>
                <div class="mt-3 space-y-2 text-[14px] font-semibold">
                  <div class="flex items-center gap-3 rounded-xl border-[1.5px] border-brasa bg-brasa-clara px-3 py-2"><span class="w-5 h-5 rounded-md bg-brasa text-white grid place-items-center">{!! $icone($check, 14) !!}</span>Bacon<span class="ml-auto text-texto-2">+ R$ 5,00</span></div>
                  <div class="flex items-center gap-3 rounded-xl border-[1.5px] border-linha px-3 py-2"><span class="w-5 h-5 rounded-md border-[1.5px] border-[#C9CDDB]"></span>Queijo extra<span class="ml-auto text-texto-2">+ R$ 4,00</span></div>
                </div>
              </div>
            </div>
            <div class="mt-5 flex gap-3"><span class="rounded-xl bg-nevoa px-4 py-3 font-display font-extrabold">− 1 +</span><span class="flex-1 rounded-xl bg-brasa text-white font-bold grid place-items-center">Adicionar · R$ 33,90</span></div>
          </div>
        </div>

        {{-- cozinha --}}
        <div class="grid lg:grid-cols-2 gap-10 items-center">
          <div class="lg:order-2">
            <span class="font-display font-extrabold text-brasa text-lg">2 · Na cozinha</span>
            <h3 class="mt-2 font-display font-extrabold text-3xl">Cada pedido vira uma comanda na tela</h3>
            <ul class="mt-5 space-y-3 text-[16.5px]">
              @foreach (['Colunas de novos, em preparo e prontos, numa TV ou tablet', 'Som quando chega pedido e alerta para o que está atrasado', 'Imprime em impressora térmica de 80 mm, se você quiser'] as $item)
                <li class="flex gap-3"><span class="mt-0.5 text-manjericao shrink-0">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
              @endforeach
            </ul>
          </div>
          <div class="lg:order-1 rounded-[28px] bg-[#10121B] p-5 sm:p-6 grid grid-cols-3 gap-3" aria-hidden="true">
            @foreach ([['Novos', 'bg-white', [['Mesa 04', '2 min', ['2× Burger', '1× Batata']]]], ['Em preparo', 'bg-mostarda', [['Mesa 07', '9 min', ['1× Filé com fritas']]]], ['Prontos', 'bg-[#7FE0A8]', [['Mesa 02', '15 min', ['2× Açaí 400 ml']]]]] as [$col, $cor, $tickets])
              <div>
                <div class="text-[#E8E9F0] font-display font-extrabold text-sm mb-2 flex items-center gap-1.5">{{ $col }} <span class="{{ $cor }} text-[#10121B] rounded px-1.5 text-xs">1</span></div>
                @foreach ($tickets as [$mesa, $tempo, $itens])
                  <div class="bg-papel rounded-t text-[#2A1E17] p-2.5 border-t-4 {{ $col === 'Novos' ? 'border-white' : ($col === 'Em preparo' ? 'border-mostarda' : 'border-manjericao') }}">
                    <div class="flex justify-between items-center"><b class="font-display text-[15px] sm:text-lg">{{ $mesa }}</b><span class="text-[10px] font-bold bg-[#F0E8E0] rounded px-1">{{ $tempo }}</span></div>
                    @foreach ($itens as $it)<div class="text-[11px] sm:text-[13px] font-semibold border-t-2 border-dashed border-[#E9DCD1] mt-1.5 pt-1.5">{{ $it }}</div>@endforeach
                  </div>
                @endforeach
              </div>
            @endforeach
          </div>
        </div>

        {{-- caixa --}}
        <div class="grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <span class="font-display font-extrabold text-brasa text-lg">3 · No caixa</span>
            <h3 class="mt-2 font-display font-extrabold text-3xl">A conta fecha sem calculadora</h3>
            <ul class="mt-5 space-y-3 text-[16.5px]">
              @foreach (['Taxa de serviço sugerida, que o caixa pode tirar', 'Divide entre as pessoas e mistura Pix, cartão e dinheiro com troco', 'Ao receber, o tablet volta limpo para o próximo cliente'] as $item)
                <li class="flex gap-3"><span class="mt-0.5 text-manjericao shrink-0">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
              @endforeach
            </ul>
          </div>
          <div class="rounded-[28px] bg-white border border-linha p-6 sm:p-7 shadow-[0_8px_24px_rgba(20,33,90,.06)] text-[15px]" aria-hidden="true">
            <b class="font-display font-extrabold text-2xl">Comanda · Mesa 04</b>
            <div class="mt-4 space-y-2">
              <div class="flex justify-between"><span>Consumo</span><b>R$ 124,60</b></div>
              <div class="flex justify-between"><span class="flex items-center gap-2"><span class="w-4 h-4 rounded bg-brasa text-white grid place-items-center">{!! $icone($check, 12) !!}</span>Taxa de serviço (10%)</span><b>R$ 12,46</b></div>
              <div class="flex justify-between items-baseline pt-2"><span class="font-bold text-lg">Total</span><b class="font-display text-3xl">R$ 137,06</b></div>
            </div>
            <div class="mt-4 rounded-xl bg-nevoa px-3 py-2.5 text-sm font-semibold">Dividir entre 2 pessoas · R$ 68,53 cada</div>
            <div class="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold">
              <div class="rounded-xl border border-linha px-3 py-2.5 flex justify-between"><span>Pix</span><span>68,53</span></div>
              <div class="rounded-xl border border-linha px-3 py-2.5 flex justify-between"><span>Dinheiro</span><span>68,53</span></div>
            </div>
            <div class="mt-3 text-manjericao font-bold text-sm">Troco de R$ 31,47 · pagamentos conferem com o total</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {{-- personalização --}}
  <section class="bg-marinho text-white">
    <div class="mx-auto max-w-6xl px-4 sm:px-6 py-20 grid lg:grid-cols-[1fr_1.4fr] gap-12 items-center">
      <div>
        <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[14ch]">O tablet com a cara do seu restaurante</h2>
        <p class="mt-5 text-lg text-[#C7CEEB] max-w-[42ch]">Seu logo, sua cor, uma foto do salão, o Wi-Fi e o Instagram na tela inicial. Você muda no painel e os tablets atualizam em segundos.</p>
        <ul class="mt-6 space-y-2 font-semibold">
          @foreach (['Tema claro ou escuro', 'Selos como "Novidade" e "Sugestão do chef"', 'Os mais pedidos aparecem em destaque sozinhos'] as $item)
            <li class="flex gap-3"><span class="text-mostarda">{!! $icone($check, 20) !!}</span>{{ $item }}</li>
          @endforeach
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

  {{-- gestão --}}
  <section id="recursos" class="mx-auto max-w-6xl px-4 sm:px-6 py-20">
    <h2 class="font-display font-extrabold text-4xl sm:text-5xl tracking-tight max-w-[20ch]">E um painel para cuidar do restaurante</h2>
    <p class="mt-4 text-lg text-texto-2 max-w-[56ch]">A tela Início mostra as vendas do dia, o que está na cozinha e quem chamou o garçom. O resto fica a um toque.</p>
    <div class="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      @foreach ($gestao as [$d, $t, $txt])
        <div class="rounded-3xl border border-linha p-6">
          <span class="w-11 h-11 rounded-xl bg-brasa-clara text-brasa-escura grid place-items-center">{!! $icone($d) !!}</span>
          <h3 class="mt-4 font-display font-extrabold text-xl">{{ $t }}</h3>
          <p class="mt-1.5 text-texto-2">{{ $txt }}</p>
        </div>
      @endforeach
    </div>
  </section>

  {{-- tablet x QR --}}
  <section class="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
    <div class="rounded-[32px] bg-nevoa p-8 sm:p-12 grid lg:grid-cols-2 gap-10 items-center">
      <div>
        <h2 class="font-display font-extrabold text-4xl tracking-tight max-w-[16ch]">Por que um tablet fixo e não só QR Code?</h2>
        <p class="mt-5 text-lg text-texto-2 max-w-[48ch]">Com QR Code, cada cliente usa o próprio celular: precisa de internet, bateria, e muita gente desiste. Com o tablet do restaurante, a mesa já está pronta para pedir.</p>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 text-[15px]">
        <div class="rounded-2xl bg-white p-5"><b class="font-display text-lg">Tablet da mesa</b>
          <ul class="mt-3 space-y-2">@foreach (['Mesa identificada sozinha', 'Igual para todas as idades', 'Não depende do celular do cliente'] as $i)<li class="flex gap-2"><span class="text-manjericao">{!! $icone($check, 18) !!}</span>{{ $i }}</li>@endforeach</ul></div>
        <div class="rounded-2xl bg-white/60 p-5 text-texto-2"><b class="font-display text-lg text-marinho">Só QR Code</b>
          <ul class="mt-3 space-y-2">@foreach (['Cliente digita o número da mesa', 'Precisa de internet e bateria', 'Muita gente desiste no meio'] as $i)<li class="flex gap-2"><span class="text-tomate">{!! $icone('<path d="M6 6l12 12M18 6L6 18"/>', 18) !!}</span>{{ $i }}</li>@endforeach</ul></div>
      </div>
    </div>
  </section>

  {{-- preço --}}
  <section class="mx-auto max-w-6xl px-4 sm:px-6 pb-20">
    <div class="rounded-[32px] border-2 border-brasa p-8 sm:p-12 grid lg:grid-cols-[1fr_auto] gap-8 items-center">
      <div>
        <span class="inline-flex items-center gap-2 rounded-full bg-brasa-clara text-brasa-escura text-sm font-bold px-3 py-1.5">Beta</span>
        <h2 class="mt-4 font-display font-extrabold text-4xl tracking-tight">Grátis enquanto estiver em beta</h2>
        <p class="mt-3 text-lg text-texto-2 max-w-[52ch]">Todas as funções liberadas, sem limite de mesas ou tablets. Se um dia passarmos a cobrar, você fica sabendo com 30 dias de antecedência.</p>
      </div>
      <a href="/cadastro" class="inline-flex items-center justify-center h-14 px-8 rounded-2xl bg-brasa text-white text-lg font-bold hover:bg-brasa-escura">Começar agora</a>
    </div>
  </section>

  <section id="duvidas" class="bg-nevoa">
    <div class="mx-auto max-w-3xl px-4 sm:px-6 py-20">
      <h2 class="font-display font-extrabold text-4xl tracking-tight">Dúvidas frequentes</h2>
      <div class="mt-8 divide-y divide-linha border-y border-linha">
        @foreach ([
          ['Preciso comprar um tablet específico?', 'Não. Qualquer tablet Android com o Chrome funciona, inclusive modelos mais simples. iPad também funciona pelo Safari.'],
          ['E se a internet cair?', 'O tablet continua mostrando o cardápio e avisa que está sem conexão. Os pedidos ficam bloqueados até a internet voltar, para nenhum pedido se perder.'],
          ['O cliente pode sair do app e mexer no tablet?', 'Não, se o tablet estiver em modo quiosque. Para sair, é preciso tocar 5 vezes no logo e digitar o PIN do gerente.'],
          ['Consigo usar com impressora na cozinha?', 'Sim. A tela da cozinha imprime a comanda em impressoras térmicas de 80 mm, uma a uma ou automaticamente.'],
          ['Posso mudar as cores e colocar meu logo?', 'Sim. Em Personalizar você escolhe a cor, envia o logo e uma foto, e define o que aparece na tela inicial dos tablets.'],
          ['Meus dados ficam seguros?', 'Cada restaurante só vê os próprios dados, as senhas são guardadas criptografadas e uma cópia do banco é feita todos os dias.'],
        ] as [$p, $r])
          <details class="group py-5">
            <summary class="flex items-center justify-between gap-4 cursor-pointer list-none font-bold text-lg">{{ $p }}<span class="w-8 h-8 rounded-lg bg-white grid place-items-center text-brasa text-xl group-open:rotate-45 transition-transform shrink-0">+</span></summary>
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
        <p class="mt-3 text-lg text-white/90">Crie a conta e o painel guia você até o primeiro pedido.</p>
      </div>
      <a href="/cadastro" class="md:ml-auto inline-flex items-center justify-center h-14 px-8 rounded-2xl bg-marinho text-white text-lg font-bold hover:bg-marinho-profundo shrink-0">Criar conta grátis</a>
    </div>
  </section>
</main>
@endsection
