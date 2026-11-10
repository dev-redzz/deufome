import DF from './comum.js';
import qrcode from 'qrcode-generator';

(() => {
  const { icone, real, esc, uid, toast, api, modal } = DF;
  const VERSAO = document.body.dataset.versao || 'dev';
  const MODO_COMPUTADOR = navigator.maxTouchPoints > 1 && /X11; Linux x86_64/.test(navigator.userAgent) && !/CrOS|HeadlessChrome/.test(navigator.userAgent) && screen.width <= 1280;
  const CHAVE_TOKEN = 'deufome_dispositivo';
  const LARGO = matchMedia('(min-width: 1180px)');
  const MOVIMENTO = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let INATIVIDADE_MS = 3 * 60 * 1000;
  const INTERVALO_MS = 3000;
  const raiz = document.getElementById('raiz');

  const OBS_RAPIDAS = [
    [/burg|hamb|prato|porç|frango|lanche/i, ['Sem cebola', 'Sem tomate', 'Bem passado', 'Molho à parte']],
    [/pizza/i, ['Sem cebola', 'Bem assada', 'Cortar em 8']],
    [/bebida|suco|drink/i, ['Sem gelo', 'Com limão', 'Bem gelada', 'Sem açúcar']],
    [/sobremesa|açaí|doce/i, ['Sem calda', 'Colher extra']],
  ];

  let token = lerToken();
  let estado = null, categorias = [], versaoCardapio = null, sessaoConhecida = null;
  let carrinho = [], tela = 'descanso', categoriaAtiva = null, online = true, enviando = false, chavePendente = null;
  let timerInatividade, timerPoll, timerVitrine, toquesLogo = [], ultimoFechado = false;
  let ap = {}, destaques = [], selos = {}, combina = {};
  let primeiraVez = true;

  /* ---------------------------------------------------- aparência escolhida pelo restaurante */
  function misturar(hex, alvo, peso) {
    const n = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
    const [a, b] = [n(hex), n(alvo)];
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * peso).toString(16).padStart(2, '0')).join('');
  }
  function aplicarAparencia(nova) {
    ap = nova || {};
    const cor = /^#[0-9a-f]{6}$/i.test(ap.cor || '') ? ap.cor : '#FF5A1F';
    const st = document.documentElement.style;
    st.setProperty('--brasa', cor);
    st.setProperty('--brasa-escura', misturar(cor, '#000000', .2));
    st.setProperty('--brasa-clara', misturar(cor, ap.tema_tablet === 'escuro' ? '#15161F' : '#FFFFFF', .86));
    const h = document.documentElement.dataset;
    h.temaTablet = ap.tema_tablet === 'escuro' ? 'escuro' : 'claro';
    h.fonte = ap.fonte || 'padrao';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', cor);
    INATIVIDADE_MS = Math.min(15, Math.max(1, Number(ap.inatividade_min) || 3)) * 60 * 1000;
  }
  const logoRestaurante = () => ap.logo || '/img/icone-escuro.png';

  function lerToken() { try { return localStorage.getItem(CHAVE_TOKEN); } catch { return null; } }
  function gravarToken(t) { try { t ? localStorage.setItem(CHAVE_TOKEN, t) : localStorage.removeItem(CHAVE_TOKEN); } catch {} }
  const cabecalhos = () => ({ 'X-Device-Token': token || '', 'X-App-Version': VERSAO });
  const apiT = (c, o = {}) => api(c, { ...o, headers: cabecalhos() });

  /* ---------------------------------------------------- bloqueios de quiosque */
  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => history.pushState(null, '', location.href));
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, reiniciarInatividade, { passive: true }));
  LARGO.addEventListener?.('change', () => { if (tela !== 'descanso' && raiz.querySelector('.app')) { raiz.innerHTML = ''; irPara(tela); } });

  function telaCheia() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
  }

  /* ---------------------------------------------------- ativação */
  function telaAtivacao(msg) {
    pararPoll();
    let digitos = '';
    raiz.innerHTML = `<div class="ativacao"><div class="caixa">
      <img src="/img/logo.png" alt="Deu Fome" class="logo-df">
      <h2>Ativar este tablet</h2>
      <p style="color:var(--texto-2);margin:8px 0 0">No painel, abra <b>Dispositivos</b>, cadastre o tablet e digite aqui o código de 6 números.</p>
      ${msg ? `<p style="color:var(--tomate);font-weight:600">${esc(msg)}</p>` : ''}
      <div class="digitos">${'<span></span>'.repeat(6)}</div>
      <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="apagar" aria-label="Apagar">${icone('voltar', 28)}</button><button data-n="0">0</button><button data-n="ok" aria-label="Confirmar">${icone('check', 30)}</button></div>
    </div></div>`;
    const spans = raiz.querySelectorAll('.digitos span');
    const pintar = () => spans.forEach((s, i) => { s.textContent = digitos[i] || ''; s.classList.toggle('cheio', !!digitos[i]); });
    raiz.querySelector('.teclado').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const n = b.dataset.n;
      if (n === 'apagar') digitos = digitos.slice(0, -1);
      else if (n !== 'ok' && digitos.length < 6) digitos += n;
      pintar();
      if (digitos.length < 6 || n === 'apagar') return;
      try {
        const r = await api('/api/tablet/ativar', { metodo: 'POST', dados: { codigo: digitos } });
        token = r.token; gravarToken(token);
        iniciar();
      } catch (er) { digitos = ''; pintar(); toast(er.message, 'erro'); }
    });
  }

  function telaBloqueado(msg) {
    pararPoll();
    raiz.innerHTML = `<div class="ativacao"><div class="caixa">
      <img src="/img/logo.png" alt="Deu Fome" class="logo-df">
      <div style="color:var(--tomate);margin:10px auto">${icone('cadeado', 56)}</div>
      <h2>${esc(msg)}</h2>
      <p style="color:var(--texto-2)">Chame um atendente.</p>
      <button class="btn btn-borda" id="tentar" style="margin-top:12px">Tentar novamente</button>
    </div></div>`;
    raiz.querySelector('#tentar').onclick = () => iniciar();
    agendarPoll(15000);
  }

  /* ---------------------------------------------------- estado do servidor */
  async function buscarEstado() {
    try {
      const e = await apiT('/api/tablet/estado');
      definirOnline(true);
      await aplicarEstado(e);
    } catch (er) {
      if (er.status === 401) { gravarToken(null); token = null; return telaAtivacao('Este tablet precisa ser ativado novamente.'); }
      if (er.status === 403) return telaBloqueado('Este tablet foi desativado.');
      if (er.offline) definirOnline(false);
    }
  }

  function definirOnline(v) {
    if (online === v) return;
    online = v;
    document.querySelector('.offline-faixa')?.remove();
    if (!v) {
      const f = document.createElement('div');
      f.className = 'offline-faixa';
      f.textContent = 'Sem conexão. Pedidos ficam bloqueados até a internet voltar. Se precisar, chame um atendente.';
      document.body.appendChild(f);
    }
    atualizarComanda();
  }

  async function aplicarEstado(e) {
    const anterior = estado;
    const sessaoAnterior = sessaoConhecida;
    const sessaoAtual = e.sessao ? e.sessao.id : null;
    estado = e;
    if (sessaoAnterior && sessaoAnterior !== sessaoAtual) {
      limparTudo();
      sessaoConhecida = sessaoAtual;
      irPara('descanso');
      return;
    }
    sessaoConhecida = sessaoAtual;
    if (e.versao_app && e.versao_app !== VERSAO && VERSAO !== 'dev' && tela === 'descanso' && !carrinho.length && !document.querySelector('.modal-fundo')) {
      location.reload();
      return;
    }
    if (e.versao_cardapio !== versaoCardapio) await carregarCardapio();
    if (fechado() !== ultimoFechado) { ultimoFechado = fechado(); if (tela === 'cardapio') desenharCardapio(true); if (tela === 'descanso') desenharDescanso(); }
    if (!e.mesa) { mostrarSemMesa(); return; }
    document.querySelector('.sem-mesa')?.remove();
    avisarProntos(anterior, e);
    if (tela === 'descanso') { if (!raiz.querySelector('.descanso')) desenharDescanso(); }
    else if (tela === 'pedidos') desenharPedidos();
    else if (raiz.querySelector('#cats')) desenharCats();
    atualizarStatus();
    atualizarComanda();
  }

  /** Quando um pedido fica pronto, avisa na tela (sem precisar estar na aba de pedidos). */
  function avisarProntos(antes, depois) {
    if (!antes?.pedidos?.length) return;
    const st = Object.fromEntries(antes.pedidos.map(p => [p.id, p.status]));
    const pronto = depois.pedidos.find(p => p.status === 'pronto' && st[p.id] && st[p.id] !== 'pronto');
    if (pronto && tela !== 'descanso') toast(`Pedido ${pronto.numero} está pronto! Já vai chegar à mesa.`);
  }

  function limparTudo() {
    carrinho = [];
    chavePendente = null;
    enviando = false;
    primeiraVez = true;
    estado = estado ? { ...estado, pedidos: [], total: 0, sessao: null, conta: null, chamados_abertos: [] } : null;
    document.querySelectorAll('.modal-fundo, .painel-lateral, .sugestao-folha').forEach(el => el.remove());
    document.querySelector('.conteudo')?.scrollTo(0, 0);
  }

  function mostrarSemMesa() {
    if (document.querySelector('.sem-mesa')) return;
    const d = document.createElement('div');
    d.className = 'ativacao sem-mesa';
    d.innerHTML = `<div class="caixa"><img src="/img/logo.png" alt="Deu Fome" class="logo-df"><h2>Tablet sem mesa</h2><p style="color:var(--texto-2)">Este tablet ainda não está vinculado a uma mesa. Chame um atendente.</p></div>`;
    document.body.appendChild(d);
  }

  async function carregarCardapio() {
    try {
      const r = await apiT('/api/tablet/cardapio');
      categorias = r.categorias.filter(c => c.produtos.length);
      versaoCardapio = r.versao;
      destaques = r.destaques || [];
      selos = r.selos || {};
      combina = r.combina || {};
      aplicarAparencia(r.aparencia);
      if (tela === 'descanso' && estado?.mesa) desenharDescanso();
      const antes = carrinho.length;
      carrinho = carrinho.filter(i => produto(i.produtoId)?.disponivel && (!i.sabor2Id || produto(i.sabor2Id)?.disponivel));
      if (carrinho.length < antes) toast('Um item do seu carrinho acabou de esgotar e foi retirado.', 'erro');
      if (tela === 'cardapio') desenharCardapio(true);
    } catch {}
  }

  const produto = id => { for (const c of categorias) for (const p of c.produtos) if (p.id === id) return p; return null; };
  const categoriaDe = p => categorias.find(c => c.produtos.includes(p));
  const precoMinimo = p => p.tamanhos?.length ? Math.min(...p.tamanhos.map(t => t.preco)) : p.preco;

  /* ---------------------------------------------------- navegação */
  function irPara(t) {
    tela = t;
    clearInterval(timerVitrine);
    if (t !== 'descanso') document.querySelector('.aviso-pc')?.remove();
    if (t === 'descanso') desenharDescanso();
    if (t === 'cardapio') desenharCardapio();
    if (t === 'pedidos') { garantirLayout(); desenharPedidos(); }
  }

  function reiniciarInatividade() {
    clearTimeout(timerInatividade);
    timerInatividade = setTimeout(inatividade, INATIVIDADE_MS);
  }

  function inatividade() {
    if (tela === 'descanso' || !estado) return;
    if (carrinho.length) {
      let s = 30;
      const m = modal(`<div class="confirmar"><h2>Ainda está aí?</h2><p style="font-size:20px;color:var(--texto-2)">Seu pedido não enviado será apagado em <b id="seg">${s}</b> segundos.</p><div class="botoes"><button class="btn btn-azul btn-g" id="sim">Continuar pedindo</button></div></div>`);
      const iv = setInterval(() => {
        s--; const el = m.el.querySelector('#seg'); if (el) el.textContent = s;
        if (s <= 0) { clearInterval(iv); m.fechar(); carrinho = []; voltarAoInicio(); }
      }, 1000);
      m.el.querySelector('#sim').onclick = () => { clearInterval(iv); m.fechar(); reiniciarInatividade(); };
      return;
    }
    voltarAoInicio();
  }

  function voltarAoInicio() {
    document.querySelectorAll('.modal-fundo, .painel-lateral, .sugestao-folha').forEach(el => el.remove());
    irPara(estado?.sessao ? 'cardapio' : 'descanso');
  }

  /* ---------------------------------------------------- descanso */
  function avisoModoComputador() {
    if (!MODO_COMPUTADOR || document.querySelector('.aviso-pc')) return;
    const a = document.createElement('div');
    a.className = 'offline-faixa aviso-pc';
    a.style.background = 'var(--marinho)';
    a.textContent = 'O Chrome está em "Site para computador". Abra o menu (⋮) do Chrome, desmarque essa opção e recarregue.';
    document.body.appendChild(a);
  }

  function pratosDaVitrine() {
    const comFoto = categorias.flatMap(c => c.produtos).filter(p => p.disponivel && p.imagem && !p.imagem.includes('sem-foto'));
    const ids = new Set(destaques);
    return [...comFoto.filter(p => ids.has(p.id)), ...comFoto.filter(p => !ids.has(p.id))].slice(0, 8);
  }

  function desenharDescanso() {
    avisoModoComputador();
    clearInterval(timerVitrine);
    const infos = [
      ap.wifi_nome ? `<div class="info-descanso">${icone('wifi', 26)}<span><small>Wi-Fi</small><b>${esc(ap.wifi_nome)}</b>${ap.wifi_senha ? `<em>Senha: ${esc(ap.wifi_senha)}</em>` : ''}</span></div>` : '',
      ap.instagram ? `<div class="info-descanso">${icone('camera', 26)}<span><small>Instagram</small><b>@${esc(ap.instagram)}</b></span></div>` : '',
      ap.telefone ? `<div class="info-descanso">${icone('fone', 26)}<span><small>Telefone</small><b>${esc(ap.telefone)}</b></span></div>` : '',
    ].filter(Boolean).join('');
    const vitrine = ap.descanso_pratos === false || ap.mostrar_fotos === false ? [] : pratosDaVitrine();
    raiz.innerHTML = `<div class="descanso ${ap.capa ? 'com-capa' : ''} ${vitrine.length ? 'com-vitrine' : ''}">
      ${ap.capa ? `<div class="capa" style="background-image:url('${esc(ap.capa)}')"></div>` : ''}
      <div class="descanso-topo">
        ${estado?.mesa ? `<div class="mesa-tag">${esc(estado.mesa.nome)}</div>` : '<span></span>'}
        ${ap.endereco ? `<div class="endereco">${esc(ap.endereco)}</div>` : ''}
      </div>
      <div class="descanso-meio">
        <div class="texto">
          <img class="logo-restaurante" src="${esc(logoRestaurante())}" alt="">
          <h1>${esc(estado?.estabelecimento || 'Deu Fome')}</h1>
          ${fechado() ? `<div class="fechado-faixa">${icone('relogio', 24, 2.5)} ${esc(textoFechado())}</div>` : `<p>${esc(ap.boas_vindas || 'Toque na tela para ver o cardápio')}</p>`}
          ${ap.faixa_promocao ? `<div class="promo-descanso">${icone('raio', 22, 2.5)} ${esc(ap.faixa_promocao)}</div>` : ''}
          <button class="toque" id="comecar">Ver o cardápio<span class="seta">${icone('seta', 30, 3.5)}</span></button>
        </div>
        ${vitrine.length ? `<div class="vitrine" aria-hidden="true">${vitrine.map((p, i) => `<figure class="${i === 0 ? 'visivel' : ''}"><div class="vf" style="background-image:url('${esc(p.imagem)}')"></div><figcaption><b>${esc(p.nome)}</b><span>${p.tamanhos?.length ? 'a partir de ' : ''}${real(precoMinimo(p))}</span></figcaption></figure>`).join('')}<div class="vitrine-pontos">${vitrine.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div></div>` : ''}
      </div>
      ${infos ? `<div class="infos-descanso">${infos}</div>` : ''}
      <div class="assinatura">Pedidos por <b>Deu Fome</b></div>
    </div>`;
    raiz.querySelector('.descanso').onclick = () => { telaCheia(); irPara('cardapio'); };
    if (vitrine.length > 1) {
      let i = 0;
      timerVitrine = setInterval(() => {
        const figs = raiz.querySelectorAll('.vitrine figure'), pts = raiz.querySelectorAll('.vitrine-pontos i');
        if (!figs.length) return clearInterval(timerVitrine);
        figs[i].classList.remove('visivel'); pts[i]?.classList.remove('on');
        i = (i + 1) % figs.length;
        figs[i].classList.add('visivel'); pts[i]?.classList.add('on');
      }, 4500);
    }
  }

  /* ---------------------------------------------------- layout principal */
  function garantirLayout() {
    if (raiz.querySelector('.app')) return;
    const largo = LARGO.matches;
    raiz.innerHTML = `<div class="app ${largo ? 'largo' : ''}">
      <header class="topo">
        <img class="logo ${ap.logo ? 'proprio' : ''}" src="${esc(ap.logo || '/img/logo.png')}" alt="" id="logo">
        <div class="estab">${esc(estado.estabelecimento)}</div>
        <button class="status-pedido oculto" id="statusPedido"></button>
        <div class="mesa">${esc(estado.mesa?.nome || '')}</div>
        ${ap.chamar_garcom === false ? '' : `<button class="garcom" id="ajuda">${icone('sino', 24, 2.4)}<span>${esc(ap.texto_garcom || 'Chamar garçom')}</span></button>`}
      </header>
      <nav class="cats" id="cats"></nav>
      <main class="conteudo" id="conteudo"></main>
      ${largo ? '<aside class="comanda-fixa" id="comandaFixa"></aside>' : '<footer class="barra" id="barra"></footer>'}
    </div>`;
    raiz.querySelector('#logo').addEventListener('pointerdown', toqueNoLogo);
    raiz.querySelector('#conteudo').addEventListener('scroll', marcarCategoriaVisivel, { passive: true });
    raiz.querySelector('#ajuda')?.addEventListener('click', abrirAjuda);
    raiz.querySelector('#statusPedido').addEventListener('click', () => irPara('pedidos'));
    if (largo) raiz.querySelector('#comandaFixa').addEventListener('click', cliqueComanda);
    atualizarStatus();
  }

  /** Pílula no topo com o andamento do último pedido. */
  function atualizarStatus() {
    const b = raiz.querySelector('#statusPedido'); if (!b) return;
    const ativos = (estado?.pedidos || []).filter(p => ['recebido', 'preparo', 'pronto'].includes(p.status));
    if (!ativos.length) { b.classList.add('oculto'); return; }
    const p = ativos[ativos.length - 1];
    const txt = { recebido: 'Recebido pela cozinha', preparo: 'Sendo preparado', pronto: 'Pronto! Chegando' }[p.status];
    b.className = `status-pedido st-${p.status}`;
    b.innerHTML = `<span class="sp-ponto"></span><span><small>Pedido ${p.numero}${ativos.length > 1 ? ` e mais ${ativos.length - 1}` : ''}</small>${txt}</span>`;
  }

  function desenharCats() {
    const nav = raiz.querySelector('#cats');
    const temPedidos = estado?.pedidos?.length;
    nav.innerHTML = categorias.map(c => `<button data-cat="${c.id}" class="${tela === 'cardapio' && categoriaAtiva === c.id ? 'ativa' : ''}"><span>${esc(c.nome)}</span><small>${c.produtos.filter(p => p.disponivel).length}</small></button>`).join('')
      + `<div class="sep"></div><button data-cat="pedidos" class="meus ${tela === 'pedidos' ? 'ativa' : ''}">${icone('conta', 22, 2.2)}<span>${temPedidos ? 'Pedidos e conta' : 'Minha conta'}</span></button>`;
    nav.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cat === 'pedidos') return irPara('pedidos');
      const id = Number(b.dataset.cat);
      if (tela !== 'cardapio') { categoriaAtiva = id; desenharCardapio(); }
      categoriaAtiva = id;
      raiz.querySelector(`#cat-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      desenharCats();
    };
  }

  function marcarCategoriaVisivel() {
    if (tela !== 'cardapio') return;
    const cont = raiz.querySelector('#conteudo');
    let atual = categorias[0]?.id;
    for (const c of categorias) {
      const el = raiz.querySelector(`#cat-${c.id}`);
      if (el && el.offsetTop - cont.scrollTop < 140) atual = c.id;
    }
    if (atual !== categoriaAtiva) { categoriaAtiva = atual; desenharCats(); }
  }

  const qtdNoCarrinho = pid => carrinho.filter(i => i.produtoId === pid).reduce((s, i) => s + i.qtd, 0);

  /** Guia de 3 passos que acompanha o cliente (some depois do primeiro pedido). */
  function guia() {
    if (estado?.pedidos?.length || !primeiraVez) return '';
    const passo = carrinho.length ? 2 : 1;
    const passos = [['Escolha um prato', 'Toque na foto para ver os detalhes'], ['Confira o pedido', LARGO.matches ? 'Ele aparece na comanda ao lado' : 'Toque em "Ver pedido" lá embaixo'], ['Envie para a cozinha', 'E acompanhe o preparo por aqui']];
    return `<div class="guia" id="guia"><div class="guia-titulo">${icone('raio', 20, 2.5)} Como pedir</div><ol>${passos.map(([t, d], i) => `<li class="${i + 1 < passo ? 'feito' : i + 1 === passo ? 'atual' : ''}"><span>${i + 1 < passo ? icone('check', 16, 3.5) : i + 1}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ol><button class="guia-x" id="fecharGuia" aria-label="Fechar guia">${icone('x', 20, 3)}</button></div>`;
  }

  function desenharCardapio(manterRolagem) {
    garantirLayout();
    const vindoDeOutra = tela !== 'cardapio' || raiz.querySelector('#conteudo').dataset.tela !== 'cardapio';
    tela = 'cardapio';
    const cont = raiz.querySelector('#conteudo');
    const rol = cont.scrollTop;
    cont.dataset.tela = 'cardapio';
    if (!categoriaAtiva && categorias[0]) categoriaAtiva = categorias[0].id;
    cont.classList.toggle('sem-fotos', ap.mostrar_fotos === false);
    cont.classList.toggle('sem-descricao', ap.mostrar_descricao === false);
    cont.classList.toggle('em-lista', ap.layout_cards === 'lista');
    cont.classList.toggle('animar', MOVIMENTO && !manterRolagem && vindoDeOutra);
    const listaDestaques = ap.mostrar_destaques === false ? [] : destaques.map(produto).filter(p => p && p.disponivel);
    cont.innerHTML = guia()
      + (ap.faixa_promocao ? `<div class="faixa-promo">${icone('raio', 22, 2.5)}<span>${esc(ap.faixa_promocao)}</span></div>` : '')
      + (fechado() ? `<div class="aviso-fechado">${icone('relogio', 24, 2.5)} ${esc(textoFechado())} Você pode ver o cardápio, mas os pedidos estão pausados.</div>` : '')
      + (listaDestaques.length >= 2 ? `<section class="destaques"><h2>${icone('fogo', 30, 2.2)} Mais pedidos da casa</h2><div class="grade grade-destaques">${listaDestaques.map(p => cartao(p, true)).join('')}</div></section>` : '')
      + categorias.map(c => `<section id="cat-${c.id}" class="secao-cat"><h2>${esc(c.nome)}</h2><div class="grade">${c.produtos.map(p => cartao(p)).join('')}</div></section>`).join('');
    cont.onclick = e => {
      if (e.target.closest('#fecharGuia')) { primeiraVez = false; e.target.closest('#guia').remove(); return; }
      const b = e.target.closest('.card'); if (!b) return;
      const p = produto(Number(b.dataset.p));
      if (!p.disponivel) return toast('Este item esgotou por hoje.');
      abrirProduto(p);
    };
    cont.querySelectorAll('.card').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 14)));
    if (manterRolagem) cont.scrollTop = rol; else cont.scrollTop = 0;
    desenharCats();
    atualizarComanda();
  }

  function cartao(p, destaque = false) {
    const q = qtdNoCarrinho(p.id);
    const selo = p.selo && selos[p.selo] ? `<span class="selo-produto ${esc(p.selo)}">${esc(selos[p.selo])}</span>` : '';
    const opcoes = [p.tamanhos?.length ? `${p.tamanhos.length} tamanhos` : '', p.meio_a_meio ? 'meio a meio' : ''].filter(Boolean).join(' · ');
    return `<button class="card ${p.disponivel ? '' : 'indisp'} ${destaque ? 'card-destaque' : ''}" data-p="${p.id}">
      <div class="foto" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"></div>
      ${!p.disponivel ? '<span class="chip cinza selo">Esgotado</span>' : ''}
      ${q ? `<span class="qtd-no-carrinho">${q}</span>` : ''}
      <div class="info">
        ${selo}
        <div class="nome">${esc(p.nome)}</div>
        <div class="desc">${esc(p.descricao)}</div>
        ${opcoes ? `<div class="opcoes-card">${icone('pizza', 15, 2.2)} ${opcoes}</div>` : ''}
        <div class="rodape"><span class="preco">${p.tamanhos?.length ? '<small>a partir de</small>' : ''}${real(precoMinimo(p))}</span><span class="mais">${icone('mais', 30, 3)}</span></div>
      </div></button>`;
  }

  const fechado = () => estado?.horario && estado.horario.aberto === false;
  const textoFechado = () => 'Estamos fechados agora' + (estado?.horario?.proxima ? `. Abrimos ${estado.horario.proxima}.` : '.');
  const totalCarrinho = () => carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
  const qtdCarrinho = () => carrinho.reduce((s, i) => s + i.qtd, 0);

  /* ---------------------------------------------------- comanda (pedido em montagem) */
  function sugestoesDoCarrinho() {
    if (ap.mostrar_combina === false) return [];
    const no = new Set(carrinho.map(i => i.produtoId));
    const ids = [];
    for (const i of carrinho) for (const s of combina[i.produtoId] || []) if (!no.has(s) && !ids.includes(s)) ids.push(s);
    return ids.map(produto).filter(p => p?.disponivel).slice(0, 3);
  }

  function htmlComanda() {
    const total = totalCarrinho();
    const sugs = carrinho.length ? sugestoesDoCarrinho() : [];
    const conta = estado?.conta?.total || estado?.total || 0;
    return `<div class="comanda-papel-t">
        <header><h2>Seu pedido</h2>${carrinho.length ? `<span class="cp-qtd">${qtdCarrinho()} ${qtdCarrinho() === 1 ? 'item' : 'itens'}</span>` : ''}</header>
        <div class="lista">${carrinho.length ? carrinho.map(i => `<div class="item-carrinho" data-chave="${i.chave}">
          <div class="mini" style="background-image:url('${esc(i.imagem || '/img/sem-foto.svg')}')"></div>
          <div class="meio"><div class="nome">${esc(i.nome)}</div>
            ${i.nomesAdicionais.length ? `<div class="det">+ ${esc(i.nomesAdicionais.join(', '))}</div>` : ''}
            ${i.observacao ? `<div class="det obs">${esc(i.observacao)}</div>` : ''}
            <div class="preco">${real(i.unit * i.qtd)}</div></div>
          <div class="contador"><button data-i="${i.chave}" data-d="-1" aria-label="Diminuir">${i.qtd === 1 ? icone('lixo', 20) : icone('menos', 22, 3)}</button><span>${i.qtd}</span><button data-i="${i.chave}" data-d="1" aria-label="Aumentar">${icone('mais', 22, 3)}</button></div>
        </div>`).join('') : `<div class="comanda-vazia">${icone('sacola', 44, 1.8)}<b>Nada aqui ainda</b><span>Toque em um prato para adicionar ao pedido.</span></div>`}</div>
        ${sugs.length ? `<div class="combina"><b>${icone('coracao', 16, 2.4)} Combina com seu pedido</b><div>${sugs.map(p => `<button data-sug="${p.id}"><span class="cm-foto" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"></span><span class="cm-nome">${esc(p.nome)}</span><span class="cm-preco">${real(precoMinimo(p))}</span><i>${icone('mais', 18, 3)}</i></button>`).join('')}</div></div>` : ''}
        ${carrinho.length ? `<footer><div class="linha-total"><span>Total do pedido</span><strong>${real(total)}</strong></div>
          <button class="btn btn-azul btn-g" id="revisar">${icone('chef', 24, 2.2)} Enviar para a cozinha</button></footer>` : ''}
      </div>
      ${estado?.pedidos?.length ? `<button class="conta-mesa" data-ir="pedidos"><span>${icone('conta', 22, 2.2)}</span><div><small>Conta da mesa</small><b>${real(conta)}</b></div><em>Ver pedidos ${icone('seta', 16, 3)}</em></button>` : ''}`;
  }

  function atualizarComanda() {
    const fixa = raiz.querySelector('#comandaFixa');
    if (fixa) fixa.innerHTML = htmlComanda();
    const lateral = document.querySelector('.painel-lateral .painel-corpo');
    if (lateral) lateral.innerHTML = htmlComanda();
    atualizarBarra();
    const g = raiz.querySelector('#guia');
    if (g && tela === 'cardapio') { const novo = guia(); if (novo) g.outerHTML = novo; else g.remove(); }
  }

  function cliqueComanda(e) {
    const b = e.target.closest('[data-i]');
    if (b) {
      const it = carrinho.find(i => i.chave === b.dataset.i);
      it.qtd = Math.min(20, it.qtd + Number(b.dataset.d));
      if (it.qtd <= 0) carrinho = carrinho.filter(i => i !== it);
      chavePendente = null;
      if (tela === 'cardapio') desenharCardapio(true); else atualizarComanda();
      return;
    }
    const s = e.target.closest('[data-sug]');
    if (s) return adicionarRapido(produto(Number(s.dataset.sug)));
    if (e.target.closest('#revisar')) { document.querySelector('.painel-lateral')?.dispatchEvent(new Event('fechar')); return confirmarPedido(); }
    if (e.target.closest('[data-ir="pedidos"]')) { document.querySelector('.painel-lateral')?.dispatchEvent(new Event('fechar')); irPara('pedidos'); }
  }

  function atualizarBarra() {
    const barra = raiz.querySelector('#barra'); if (!barra) return;
    const qtd = qtdCarrinho(), total = totalCarrinho();
    const conta = estado?.conta?.total || estado?.total || 0;
    const antes = barra.dataset.qtd;
    barra.innerHTML = `<div class="resumo">${qtd ? `<span class="bolha">${qtd}</span><span class="rotulo">${qtd === 1 ? 'item' : 'itens'} no pedido</span><span class="total">${real(total)}</span>`
        : conta ? `<span class="rotulo" style="opacity:.8">Conta da mesa</span><span class="total">${real(conta)}</span>` : `<span class="dica">${icone('raio', 20, 2.5)} Toque em um prato para começar</span>`}</div>
      ${qtd ? `<button class="btn btn-azul" id="verCarrinho">${icone('sacola', 26)} Ver pedido</button>` : estado?.pedidos?.length && tela !== 'pedidos' ? `<button class="btn btn-azul" id="verPedidos">${icone('relogio', 26)} <span class="txt-longo">Acompanhar pedidos</span><span class="txt-curto">Pedidos</span></button>` : ''}`;
    if (antes !== undefined && Number(antes) < qtd && MOVIMENTO) barra.querySelector('.bolha')?.classList.add('pulo');
    barra.dataset.qtd = qtd;
    barra.querySelector('#verCarrinho')?.addEventListener('click', abrirCarrinho);
    barra.querySelector('#verPedidos')?.addEventListener('click', () => irPara('pedidos'));
  }

  function abrirCarrinho() {
    document.querySelector('.painel-lateral')?.remove();
    document.querySelector('.toast')?.remove();
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo fundo-lateral';
    const painel = document.createElement('aside');
    painel.className = 'painel-lateral';
    painel.innerHTML = `<button class="fechar-lateral" data-fechar aria-label="Fechar">${icone('x', 28, 3)}</button><div class="painel-corpo"></div>`;
    const fechar = () => { painel.remove(); fundo.remove(); };
    painel.addEventListener('fechar', fechar);
    fundo.onclick = fechar;
    document.body.append(fundo, painel);
    painel.addEventListener('click', e => { if (e.target.closest('[data-fechar]')) return fechar(); cliqueComanda(e); });
    atualizarComanda();
  }

  /* ---------------------------------------------------- adicionar ao pedido */
  function nomeDoItem(p, tamanho, sabor2) {
    return (sabor2 ? `½ ${p.nome} + ½ ${sabor2.nome}` : p.nome) + (tamanho ? ` (${tamanho})` : '');
  }

  function colocarNoCarrinho(p, { qtd = 1, tamanho = null, sabor2 = null, adicionais = [], observacao = '' } = {}) {
    const precoTam = prod => tamanho ? prod.tamanhos.find(t => t.nome === tamanho)?.preco : prod.preco;
    let unit = precoTam(p);
    if (sabor2) unit = Math.max(unit, precoTam(sabor2));
    unit += p.adicionais.filter(a => adicionais.includes(a.id)).reduce((s, a) => s + a.preco, 0);
    const ads = [...adicionais].sort((a, b) => a - b);
    const igual = carrinho.find(i => i.produtoId === p.id && i.tamanho === tamanho && (i.sabor2Id || null) === (sabor2?.id || null) && i.adicionais.join() === ads.join() && i.observacao === observacao);
    if (igual) igual.qtd = Math.min(20, igual.qtd + qtd);
    else carrinho.push({ chave: uid(), produtoId: p.id, nome: nomeDoItem(p, tamanho, sabor2), imagem: p.imagem, tamanho, sabor2Id: sabor2?.id || null, adicionais: ads, nomesAdicionais: p.adicionais.filter(a => ads.includes(a.id)).map(a => a.nome), observacao, unit, qtd });
    chavePendente = null;
  }

  function adicionarRapido(p) {
    if (!p) return;
    if (p.tamanhos?.length || p.adicionais.length) return abrirProduto(p);
    if (fechado()) return toast(textoFechado(), 'erro');
    colocarNoCarrinho(p);
    toast(`${p.nome} adicionado`);
    if (tela === 'cardapio') desenharCardapio(true); else atualizarComanda();
  }

  /** Depois de adicionar: sugere o que combina (bebida, sobremesa...). */
  function mostrarCombina(p) {
    document.querySelector('.sugestao-folha')?.remove();
    if (ap.mostrar_combina === false || LARGO.matches) return;
    const no = new Set(carrinho.map(i => i.produtoId));
    const sugs = (combina[p.id] || []).map(produto).filter(x => x?.disponivel && !no.has(x.id)).slice(0, 3);
    if (!sugs.length) return;
    const f = document.createElement('div');
    f.className = 'sugestao-folha';
    f.innerHTML = `<div class="sf-cab"><b>${icone('coracao', 18, 2.4)} Combina com ${esc(p.nome)}</b><button data-fechar aria-label="Fechar">${icone('x', 22, 3)}</button></div>
      <div class="sf-lista">${sugs.map(s => `<button data-sug="${s.id}"><span class="cm-foto" style="background-image:url('${esc(s.imagem || '/img/sem-foto.svg')}')"></span><span class="cm-nome">${esc(s.nome)}</span><span class="cm-preco">${real(precoMinimo(s))}</span><i>${icone('mais', 18, 3)}</i></button>`).join('')}</div>`;
    document.body.appendChild(f);
    const fechar = () => { f.classList.add('saindo'); setTimeout(() => f.remove(), 250); };
    const t = setTimeout(fechar, 9000);
    f.addEventListener('click', e => {
      if (e.target.closest('[data-fechar]')) { clearTimeout(t); return fechar(); }
      const s = e.target.closest('[data-sug]'); if (!s) return;
      clearTimeout(t); fechar(); adicionarRapido(produto(Number(s.dataset.sug)));
    });
  }

  /* ---------------------------------------------------- produto */
  function abrirProduto(p) {
    document.querySelector('.sugestao-folha')?.remove();
    let qtd = 1, tamanho = p.tamanhos?.length === 1 ? p.tamanhos[0].nome : null, sabor2 = null, meio = false;
    const sel = new Set(), obs = new Set();
    const cat = categoriaDe(p);
    const rapidas = ap.permitir_observacao === false ? [] : (OBS_RAPIDAS.find(([re]) => re.test(`${cat?.nome || ''} ${p.nome}`)) || [null, []])[1];
    const outrosSabores = p.meio_a_meio ? cat.produtos.filter(o => o.id !== p.id && o.meio_a_meio && o.disponivel) : [];
    const temTam = p.tamanhos?.length > 0;
    let n = 0;
    const passo = t => `<span class="passo-n">${++n}</span>${t}`;
    const m = modal(`<div class="produto-modal">
      <div class="foto ${ap.mostrar_fotos === false ? 'sem' : ''}" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"><button class="fechar" data-fechar aria-label="Fechar">${icone('x', 30, 3)}</button></div>
      <div class="corpo">
        ${p.selo && selos[p.selo] ? `<span class="selo-produto ${esc(p.selo)}">${esc(selos[p.selo])}</span>` : ''}
        <h2>${esc(p.nome)}</h2>
        <p class="desc">${esc(p.descricao)}</p>
        ${temTam ? '' : `<span class="preco" style="font-size:28px">${real(p.preco)}</span>`}
        ${temTam ? `<section class="etapa" id="etTam"><h3>${passo('Escolha o tamanho')} <em class="obrig">obrigatório</em></h3><div class="tamanhos">${p.tamanhos.map(t => `<button data-tam="${esc(t.nome)}" class="${tamanho === t.nome ? 'marcada' : ''}"><b>${esc(t.nome)}</b><span>${real(t.preco)}</span></button>`).join('')}</div></section>` : ''}
        ${outrosSabores.length ? `<section class="etapa"><h3>${passo('Sabores')}</h3>
          <div class="segmento-sabor"><button data-meio="0" class="marcada">Inteira de ${esc(p.nome)}</button><button data-meio="1">${icone('pizza', 20, 2.2)} Meio a meio</button></div>
          <div class="sabores oculto" id="sabores"><p class="sutil">Escolha o segundo sabor. Vale o preço do sabor mais caro.</p>${outrosSabores.map(o => `<button data-sabor="${o.id}"><span class="sb-foto" style="background-image:url('${esc(o.imagem || '/img/sem-foto.svg')}')"></span><b>${esc(o.nome)}</b></button>`).join('')}</div></section>` : ''}
        ${p.adicionais.length ? `<section class="etapa"><h3>${passo('Adicionais')} <em>opcional</em></h3>${p.adicionais.map(a => `<button class="opcao" data-a="${a.id}"><span class="check">${icone('check', 22, 3.5)}</span>${esc(a.nome)}<span class="v">${a.preco ? '+ ' + real(a.preco) : 'grátis'}</span></button>`).join('')}</section>` : ''}
        ${rapidas.length ? `<section class="etapa"><h3>${passo('Algum pedido especial?')} <em>opcional</em></h3><div class="obs-botoes">${rapidas.map(o => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div></section>` : ''}
        <div style="height:16px"></div>
      </div>
      <div class="acoes">
        <div class="contador"><button data-q="-1" aria-label="Menos">${icone('menos', 28, 3)}</button><span id="q">1</span><button data-q="1" aria-label="Mais">${icone('mais', 28, 3)}</button></div>
        <button class="btn btn-azul btn-g" id="add"></button>
      </div></div>`, { classe: 'modal-produto' });
    const precoTam = prod => tamanho ? prod.tamanhos.find(t => t.nome === tamanho)?.preco ?? prod.preco : prod.preco;
    const unit = () => Math.max(precoTam(p), sabor2 ? precoTam(sabor2) : 0) + p.adicionais.filter(a => sel.has(a.id)).reduce((s, a) => s + a.preco, 0);
    const falta = () => temTam && !tamanho ? 'Escolha o tamanho' : meio && !sabor2 ? 'Escolha o segundo sabor' : '';
    const pintar = () => {
      m.el.querySelector('#q').textContent = qtd;
      const b = m.el.querySelector('#add');
      b.classList.toggle('incompleto', !!falta());
      if (fechado()) { b.textContent = 'Fechado agora'; b.disabled = true; }
      else b.innerHTML = falta() ? falta() : `Adicionar · ${real(unit() * qtd)}`;
      m.el.querySelectorAll('[data-sabor]').forEach(x => { const o = produto(Number(x.dataset.sabor)); x.disabled = !!(tamanho && !o.tamanhos.some(t => t.nome === tamanho)); });
    };
    pintar();
    m.el.addEventListener('click', e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const t = e.target.closest('[data-tam]');
      if (t) { tamanho = t.dataset.tam; m.el.querySelectorAll('[data-tam]').forEach(x => x.classList.toggle('marcada', x === t)); if (sabor2 && !sabor2.tamanhos.some(x => x.nome === tamanho)) { sabor2 = null; m.el.querySelectorAll('[data-sabor]').forEach(x => x.classList.remove('marcada')); } pintar(); }
      const mm = e.target.closest('[data-meio]');
      if (mm) { meio = mm.dataset.meio === '1'; if (!meio) sabor2 = null; m.el.querySelectorAll('[data-meio]').forEach(x => x.classList.toggle('marcada', x === mm)); m.el.querySelector('#sabores').classList.toggle('oculto', !meio); m.el.querySelectorAll('[data-sabor]').forEach(x => x.classList.remove('marcada')); pintar(); }
      const sb = e.target.closest('[data-sabor]');
      if (sb && !sb.disabled) { sabor2 = produto(Number(sb.dataset.sabor)); m.el.querySelectorAll('[data-sabor]').forEach(x => x.classList.toggle('marcada', x === sb)); pintar(); }
      const a = e.target.closest('[data-a]');
      if (a) { const id = Number(a.dataset.a); sel.has(id) ? sel.delete(id) : sel.add(id); a.classList.toggle('marcada'); pintar(); }
      const o = e.target.closest('[data-o]');
      if (o) { const v = o.dataset.o; obs.has(v) ? obs.delete(v) : obs.add(v); o.classList.toggle('marcada'); }
      const q = e.target.closest('[data-q]');
      if (q) { qtd = Math.min(20, Math.max(1, qtd + Number(q.dataset.q))); pintar(); }
      if (e.target.closest('#add')) {
        if (falta()) {
          const alvo = temTam && !tamanho ? m.el.querySelector('#etTam') : m.el.querySelector('#sabores');
          alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          alvo?.classList.remove('chamar'); void alvo?.offsetWidth; alvo?.classList.add('chamar');
          return;
        }
        colocarNoCarrinho(p, { qtd, tamanho, sabor2, adicionais: [...sel], observacao: [...obs].join(', ') });
        m.fechar();
        toast(`${p.nome} adicionado ao pedido`);
        desenharCardapio(true);
        mostrarCombina(p);
      }
    });
  }

  /* ---------------------------------------------------- enviar pedido */
  function confirmarPedido() {
    if (!online) return toast('Sem conexão. Chame um atendente.', 'erro');
    if (fechado()) return toast(textoFechado(), 'erro');
    if (estado?.sessao?.status === 'conta_solicitada') return toast('A conta já foi pedida. Chame um atendente para pedir mais.', 'erro');
    if (!carrinho.length) return;
    const total = totalCarrinho();
    chavePendente = chavePendente || uid();
    const m = modal(`<div class="confirmar">
      <div style="color:var(--brasa)">${icone('chef', 56, 2)}</div>
      <h2>Confirma o pedido?</h2>
      <p style="color:var(--texto-2);font-size:19px;margin:0">Confira os itens. Depois de enviado, ele vai direto para a cozinha.</p>
      <div class="resumo-lista">${carrinho.map(i => `<div><span><b>${i.qtd}×</b> ${esc(i.nome)}${i.nomesAdicionais.length ? ` <small style="color:var(--texto-2)">(+ ${esc(i.nomesAdicionais.join(', '))})</small>` : ''}${i.observacao ? `<br><small style="color:var(--texto-2)">${esc(i.observacao)}</small>` : ''}</span><span>${real(i.unit * i.qtd)}</span></div>`).join('')}</div>
      <div class="linha-total" style="margin-bottom:22px"><span>Total</span><strong>${real(total)}</strong></div>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Voltar e mudar</button><button class="btn btn-azul btn-g" id="enviar">${icone('check', 28, 3)} Enviar pedido</button></div>
    </div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const b = e.target.closest('#enviar');
      if (!b || enviando) return;
      enviando = true; b.disabled = true; b.textContent = 'Enviando…';
      try {
        const r = await apiT('/api/tablet/pedidos', { metodo: 'POST', dados: {
          chave: chavePendente,
          itens: carrinho.map(i => ({ produto_id: i.produtoId, quantidade: i.qtd, adicionais: i.adicionais, observacao: i.observacao, tamanho: i.tamanho, sabor2_id: i.sabor2Id })),
        } });
        carrinho = []; chavePendente = null; primeiraVez = false;
        m.fechar();
        pedidoEnviado(r.numero);
        await buscarEstado();
      } catch (er) {
        b.disabled = false; b.innerHTML = `${icone('check', 28, 3)} Enviar pedido`;
        toast(er.offline ? 'Sem conexão. Tente de novo ou chame um atendente.' : er.message, 'erro');
        if (er.status === 409) { m.fechar(); await carregarCardapio(); await buscarEstado(); }
      } finally { enviando = false; }
    });
  }

  function pedidoEnviado(numero) {
    const m = modal(`<div class="enviado"><div class="selo-ok">${icone('check', 64, 3.5)}</div><h2>Pedido enviado!</h2><p>${numero ? `Pedido ${numero} · ` : ''}A cozinha já recebeu. Você acompanha o preparo por aqui.</p>
      <div class="caminho"><span class="on">${icone('check', 16, 3.5)} Recebido</span><i></i><span>Preparando</span><i></i><span>Pronto</span></div></div>`);
    setTimeout(() => { m.fechar(); irPara('pedidos'); }, 2800);
  }

  /* ---------------------------------------------------- pedidos e conta */
  const PASSOS = [['recebido', 'Recebido', 'A cozinha recebeu seu pedido'], ['preparo', 'Preparando', 'Seu pedido está sendo feito'], ['pronto', 'Pronto', 'Saindo da cozinha para a mesa'], ['entregue', 'Na mesa', 'Bom apetite!']];

  function desenharPedidos() {
    garantirLayout();
    tela = 'pedidos';
    const cont = raiz.querySelector('#conteudo');
    const pedidos = estado?.pedidos || [];
    const c = estado?.conta;
    const pediuConta = estado?.sessao?.status === 'conta_solicitada';
    const assinatura = JSON.stringify([pedidos.map(p => [p.id, p.status]), c, estado?.sessao, estado?.avaliado, ap.pix_ativo]);
    if (cont.dataset.assinatura === assinatura && cont.dataset.tela === 'pedidos') { desenharCats(); atualizarComanda(); return; }
    const primeira = cont.dataset.tela !== 'pedidos';
    const rol = primeira ? 0 : cont.scrollTop;
    cont.dataset.assinatura = assinatura;
    cont.dataset.tela = 'pedidos';
    cont.classList.toggle('animar', MOVIMENTO && primeira);
    requestAnimationFrame(() => { cont.scrollTop = rol; });
    const pagandoPix = pediuConta && c?.pagar_com === 'pix';
    cont.innerHTML = `<div class="pedidos-cab"><h2>Sua mesa</h2>${pedidos.length ? `<span class="sutil">${pedidos.filter(p => p.status !== 'cancelado').length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}</span>` : ''}</div>
      ${pediuConta ? `<div class="aviso-conta">${icone(pagandoPix ? 'qr' : 'conta', 24, 2.2)} <span><b>${pagandoPix ? 'Pagamento no Pix iniciado.' : 'Conta solicitada.'}</b> ${pagandoPix ? 'Depois de pagar, mostre o comprovante ao atendente.' : 'Um atendente já está a caminho para finalizar.'}</span></div>` : ''}
      ${pedidos.length ? pedidos.slice().reverse().map(p => {
        const i = PASSOS.findIndex(s => s[0] === p.status);
        const cancelado = p.status === 'cancelado';
        const pct = cancelado ? 0 : [12, 50, 85, 100][i];
        return `<div class="pedido-bloco st-${p.status}">
          <div class="cab"><div><strong>Pedido ${p.numero}</strong>${cancelado ? '' : `<small>${PASSOS[i][2]}</small>`}</div>${cancelado ? '<span class="chip vermelho">Cancelado</span>' : `<span class="preco" style="font-size:22px">${real(p.total)}</span>`}</div>
          ${cancelado ? '' : `<div class="trilha" style="--pct:${pct}%"><div class="trilha-fill"></div></div>
            <div class="linha-tempo">${PASSOS.map(([k, nome], j) => `<div class="passo ${j < i || (j === i && k === 'entregue') ? 'feito' : j === i ? (k === 'pronto' ? 'feito pronto' : 'atual') : ''}"><div class="bola">${j <= i ? icone(j === i && k === 'preparo' ? 'fogo' : 'check', 20, 3) : ''}</div>${nome}</div>`).join('')}</div>`}
          <div class="itens">${p.itens.map(it => `<div><span>${it.quantidade}× ${esc(it.nome)}${it.adicionais.length ? ' (+ ' + esc(it.adicionais.map(a => a.nome).join(', ')) + ')' : ''}${it.observacao ? ' · ' + esc(it.observacao) : ''}</span><span>${real(it.subtotal)}</span></div>`).join('')}</div>
        </div>`;
      }).join('') : `<div class="vazio"><div>${icone('cardapio', 64, 2)}</div><p>Nenhum pedido feito nesta mesa ainda.</p><button class="btn btn-azul btn-g" id="irCardapio">Ver o cardápio</button></div>`}
      ${pedidos.length && c ? `<div class="conta-bloco">
        <h3>Conta da mesa</h3>
        <div class="contas-tablet">
          <div class="lt"><span>Consumo</span><span>${real(c.subtotal)}</span></div>
          ${c.cupom ? `<div class="lt desconto"><span>Cupom ${esc(c.cupom.codigo)}${c.cupom.aplicado ? '' : ` <small>(vale acima de ${real(c.cupom.minimo)})</small>`}</span><span>${c.desconto ? '− ' + real(c.desconto) : '—'}</span></div>` : ''}
          ${c.taxa ? `<div class="lt"><span>Taxa de serviço (${c.taxa_pct}%, opcional)</span><span>${real(c.taxa)}</span></div>` : ''}
          ${c.gorjeta ? `<div class="lt"><span>Gorjeta (${c.gorjeta_pct}%)</span><span>${real(c.gorjeta)}</span></div>` : ''}
          <div class="lt total"><span>Total</span><strong>${real(c.total)}</strong></div>
        </div>
        ${!pediuConta ? `<div class="cupom-linha">${c.cupom ? `<span class="chip verde">${icone('cupom', 16, 2.2)} ${esc(c.cupom.codigo)}: ${esc(c.cupom.descricao)}</span><button class="link" id="tirarCupom">Remover</button>` : `<button class="btn btn-borda" id="usarCupom">${icone('cupom', 22, 2.2)} Tenho um cupom</button>`}</div>` : ''}
        <div class="conta-acoes">
          ${pediuConta ? (pagandoPix ? `<button class="btn btn-borda btn-g" id="verPix">${icone('qr', 24, 2.2)} Ver o Pix de novo</button>` : '') + (estado.avaliado || ap.pedir_avaliacao === false ? `<span class="chip verde obrigado">${esc(ap.agradecimento || 'Obrigado pela visita!')}</span>` : `<button class="btn btn-azul btn-g" id="avaliarBtn">${icone('estrela', 26, 2.5)} Avaliar a experiência</button>`)
            : `<button class="btn btn-borda btn-g" id="irCardapio">Pedir mais</button>
               ${ap.pix_ativo ? `<button class="btn btn-azul btn-g" id="pagarPix">${icone('qr', 26, 2.2)} Pagar com Pix aqui</button>` : ''}
               <button class="btn btn-marinho btn-g" id="pedirConta">${icone('conta', 26)} Pedir a conta</button>`}
        </div>
      </div>` : ''}`;
    cont.querySelectorAll('#irCardapio').forEach(b => b.onclick = () => irPara('cardapio'));
    cont.querySelector('#pedirConta')?.addEventListener('click', pedirConta);
    cont.querySelector('#pagarPix')?.addEventListener('click', () => pagarPix());
    cont.querySelector('#verPix')?.addEventListener('click', () => pagarPix(c.gorjeta_pct || 0));
    cont.querySelector('#avaliarBtn')?.addEventListener('click', () => abrirAvaliacao());
    cont.querySelector('#usarCupom')?.addEventListener('click', usarCupom);
    cont.querySelector('#tirarCupom')?.addEventListener('click', async () => { try { await apiT('/api/tablet/cupom', { metodo: 'POST', dados: { codigo: '' } }); await buscarEstado(); } catch (er) { toast(er.message, 'erro'); } });
    desenharCats();
    atualizarStatus();
    atualizarComanda();
  }

  /** Teclado na tela para o código do cupom (letras e números). */
  function usarCupom() {
    let cod = '';
    const teclas = 'QWERTYUIOPASDFGHJKLZXCVBNM1234567890'.split('');
    const m = modal(`<div class="confirmar cupom-modal"><div>${icone('cupom', 52, 2)}</div><h2>Código do cupom</h2>
      <div class="cupom-visor" id="visor"><span class="cursor"></span></div>
      <div class="teclado-letras">${teclas.map(t => `<button data-t="${t}">${t}</button>`).join('')}<button data-t="apagar" class="larga" aria-label="Apagar">${icone('voltar', 24)}</button></div>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Cancelar</button><button class="btn btn-azul btn-g" id="aplicar" disabled>Aplicar cupom</button></div></div>`);
    const pintar = () => { m.el.querySelector('#visor').innerHTML = `${esc(cod)}<span class="cursor"></span>`; m.el.querySelector('#aplicar').disabled = cod.length < 3; };
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const t = e.target.closest('[data-t]');
      if (t) { cod = t.dataset.t === 'apagar' ? cod.slice(0, -1) : (cod + t.dataset.t).slice(0, 20); return pintar(); }
      const b = e.target.closest('#aplicar'); if (!b) return;
      b.disabled = true;
      try {
        const r = await apiT('/api/tablet/cupom', { metodo: 'POST', dados: { codigo: cod } });
        m.fechar();
        toast(r.conta.desconto ? `Cupom aplicado: você economiza ${real(r.conta.desconto)}!` : 'Cupom aplicado.');
        await buscarEstado();
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; m.el.querySelector('#visor').classList.add('tremer'); setTimeout(() => m.el.querySelector('#visor')?.classList.remove('tremer'), 500); }
    });
  }

  function pedirConta() {
    const c = estado.conta;
    const m = modal(`<div class="confirmar"><div>${icone('conta', 56, 2)}</div><h2>Pedir a conta?</h2>
      <p style="font-size:20px;color:var(--texto-2)">Total: <b style="color:var(--texto)">${real(c.total)}</b>${c.taxa ? ` <small>(com ${c.taxa_pct}% de serviço)</small>` : ''}.<br>Um atendente vem até a mesa. Depois disso, novos pedidos só com ele.</p>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Ainda não</button><button class="btn btn-marinho btn-g" id="sim">Sim, pedir a conta</button></div></div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      if (!e.target.closest('#sim')) return;
      try { await apiT('/api/tablet/chamar', { metodo: 'POST', dados: { tipo: 'conta' } }); m.fechar(); await buscarEstado(); if (!estado?.avaliado && ap.pedir_avaliacao !== false) abrirAvaliacao(true); else toast('Conta solicitada. Já vamos até você!'); }
      catch (er) { toast(er.message, 'erro'); }
    });
  }

  /** Pix na mesa: escolhe a gorjeta, gera o QR e pede a conta. */
  function pagarPix(gorjetaPronta) {
    const c = estado.conta;
    const base = c.subtotal - c.desconto;
    const opcoes = ap.gorjeta_ativa === false ? [0] : [0, 5, 10, 15];
    let escolha = gorjetaPronta ?? (opcoes.length > 1 ? 10 : 0);
    const m = modal(`<div class="confirmar pix-modal"><div class="pix-corpo"></div></div>`);
    const totalCom = pct => base + c.taxa + Math.round(base * pct / 100);
    function passoGorjeta() {
      m.el.querySelector('.pix-corpo').innerHTML = `<div>${icone('coracao', 52, 2)}</div><h2>Quer deixar uma gorjeta?</h2>
        <p style="color:var(--texto-2);font-size:19px;margin:0">É opcional e vai para a equipe que atendeu você.</p>
        <div class="gorjetas">${opcoes.map(p => `<button data-g="${p}" class="${p === escolha ? 'marcada' : ''}"><b>${p ? p + '%' : 'Sem gorjeta'}</b><span>${p ? '+ ' + real(Math.round(base * p / 100)) : '—'}</span></button>`).join('')}</div>
        <div class="linha-total"><span>Total a pagar</span><strong id="totPix">${real(totalCom(escolha))}</strong></div>
        <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Voltar</button><button class="btn btn-azul btn-g" id="gerar">${icone('qr', 26, 2.2)} Gerar o Pix</button></div>`;
    }
    async function passoQr() {
      const corpo = m.el.querySelector('.pix-corpo');
      corpo.innerHTML = '<div class="carregando-pix"><span></span><p>Gerando o Pix…</p></div>';
      try {
        const r = await apiT('/api/tablet/pix', { metodo: 'POST', dados: { gorjeta_pct: escolha } });
        const qr = qrcode(0, 'M'); qr.addData(r.copia_e_cola); qr.make();
        corpo.innerHTML = `<h2>Pague com Pix</h2><p style="color:var(--texto-2);font-size:18px;margin:0">Abra o app do seu banco, escolha <b>Pix › Ler QR code</b> e aponte para a tela.</p>
          <div class="qr-area"><div class="qr">${qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true })}</div>
            <div class="qr-info"><small>Valor</small><b>${real(r.conta.total)}</b><small>Para</small><span>${esc(r.recebedor)}</span>${r.conta.gorjeta ? `<small>Inclui gorjeta de ${r.conta.gorjeta_pct}%</small>` : ''}</div></div>
          <details class="copia-cola"><summary>Prefere copiar o código?</summary><p class="cc">${esc(r.copia_e_cola)}</p></details>
          <div class="aviso-conta" style="text-align:left">${icone('sino', 22, 2.2)} <span>Já avisamos o atendente. Depois de pagar, mostre o comprovante para ele confirmar.</span></div>
          <div class="botoes"><button class="btn btn-azul btn-g" id="jaPaguei">${icone('check', 26, 3)} Já paguei</button></div>`;
        buscarEstado();
      } catch (er) { toast(er.message, 'erro'); passoGorjeta(); }
    }
    m.el.addEventListener('click', e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const g = e.target.closest('[data-g]');
      if (g) { escolha = Number(g.dataset.g); m.el.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('marcada', x === g)); m.el.querySelector('#totPix').textContent = real(totalCom(escolha)); }
      if (e.target.closest('#gerar')) passoQr();
      if (e.target.closest('#jaPaguei')) { m.fechar(); if (!estado?.avaliado && ap.pedir_avaliacao !== false) abrirAvaliacao(true); else toast('Obrigado! O atendente vai confirmar o pagamento.'); }
    });
    gorjetaPronta !== undefined ? passoQr() : passoGorjeta();
  }

  function abrirAvaliacao(posConta) {
    let nota = 0;
    const tags = new Set(), pratos = {};
    const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
    const BOAS = ['Comida ótima', 'Atendimento rápido', 'Ambiente agradável', 'Preço justo'];
    const RUINS = ['Demorou', 'Pedido errado', 'Comida fria', 'Tablet difícil de usar'];
    const nomes = ap.avaliar_pratos === false ? [] : [...new Set((estado?.pedidos || []).filter(p => p.status !== 'cancelado').flatMap(p => p.itens.map(i => i.nome)))].slice(0, 12);
    const estrelaCheia = t => icone('estrela', t, 0).replace('fill="none"', 'fill="currentColor"');
    const m = modal(`<div class="avaliar">
      ${posConta ? '<p class="chip verde" style="font-size:15px">Conta solicitada, um atendente já vem até você</p>' : ''}
      <h2>Como foi sua experiência?</h2>
      <p style="color:var(--texto-2);margin:0">Sua opinião ajuda o restaurante a melhorar.</p>
      <div class="notas">${[1, 2, 3, 4, 5].map(n => `<button data-nota="${n}" aria-label="${n} estrelas">${estrelaCheia(44)}</button>`).join('')}</div>
      <div class="rotulo-nota" id="rotulo">Toque nas estrelas</div>
      <div class="tags" id="tags"></div>
      ${nomes.length ? `<div class="aval-pratos oculto" id="avPratos"><h3>E cada prato?</h3>${nomes.map(n => `<div class="ap-linha"><span>${esc(n)}</span><div>${[1, 2, 3, 4, 5].map(k => `<button data-prato="${esc(n)}" data-k="${k}" aria-label="${k} estrelas para ${esc(n)}">${estrelaCheia(26)}</button>`).join('')}</div></div>`).join('')}</div>` : ''}
      <textarea id="coment" rows="2" maxlength="400" placeholder="Quer deixar um comentário? (opcional)"></textarea>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Agora não</button><button class="btn btn-azul btn-g" id="enviarAv" disabled>Enviar avaliação</button></div>
    </div>`);
    const pintar = () => {
      m.el.querySelectorAll('[data-nota]').forEach(b => b.classList.toggle('on', Number(b.dataset.nota) <= nota));
      m.el.querySelector('#rotulo').textContent = nota ? ROTULOS[nota] : 'Toque nas estrelas';
      const lista = nota >= 4 ? BOAS : nota ? [...RUINS, ...BOAS.slice(0, 2)] : [];
      [...tags].forEach(t => { if (!lista.includes(t)) tags.delete(t); });
      m.el.querySelector('#tags').innerHTML = lista.map(t => `<button data-tag="${esc(t)}" class="${tags.has(t) ? 'marcada' : ''}">${esc(t)}</button>`).join('');
      m.el.querySelector('#avPratos')?.classList.toggle('oculto', !nota);
      m.el.querySelectorAll('[data-prato]').forEach(b => b.classList.toggle('on', Number(b.dataset.k) <= (pratos[b.dataset.prato] || 0)));
      m.el.querySelector('#enviarAv').disabled = !nota;
    };
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const n = e.target.closest('[data-nota]'); if (n) { const primeira = !nota; nota = Number(n.dataset.nota); if (primeira) Object.keys(pratos).length || nomes.forEach(x => { pratos[x] = 0; }); return pintar(); }
      const pr = e.target.closest('[data-prato]'); if (pr) { pratos[pr.dataset.prato] = Number(pr.dataset.k); return pintar(); }
      const t = e.target.closest('[data-tag]'); if (t) { const v = t.dataset.tag; tags.has(v) ? tags.delete(v) : tags.add(v); return pintar(); }
      const b = e.target.closest('#enviarAv');
      if (b) {
        b.disabled = true;
        try {
          await apiT('/api/tablet/avaliar', { metodo: 'POST', dados: { nota, tags: [...tags], comentario: m.el.querySelector('#coment').value, pratos: Object.entries(pratos).filter(([, k]) => k).map(([nome, k]) => ({ nome, nota: k })) } });
          m.el.querySelector('.avaliar').innerHTML = `<div class="enviado" style="padding:20px 0"><div class="selo-ok">${icone('check', 64, 3.5)}</div><h2>Obrigado!</h2><p>${esc(ap.agradecimento || 'Sua avaliação foi enviada.')}</p></div>`;
          setTimeout(() => m.fechar(), 2200);
          buscarEstado();
        } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
      }
    });
  }

  function abrirAjuda() {
    const jaChamou = estado?.chamados_abertos?.includes('garcom');
    const m = modal(`<div class="confirmar"><div>${icone('sino', 56, 2)}</div><h2>Precisa de ajuda?</h2>
      <p style="font-size:20px;color:var(--texto-2)">${jaChamou ? 'Um atendente já foi chamado e está a caminho.' : 'Um atendente vai até a sua mesa.'}</p>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Fechar</button>${jaChamou ? '' : `<button class="btn btn-azul btn-g" id="chamar">${esc(ap.texto_garcom || 'Chamar garçom')}</button>`}</div></div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      if (!e.target.closest('#chamar')) return;
      try { await apiT('/api/tablet/chamar', { metodo: 'POST', dados: { tipo: 'garcom' } }); m.fechar(); toast('Pronto! Um atendente já vem.'); buscarEstado(); }
      catch (er) { toast(er.message, 'erro'); }
    });
  }

  /* ---------------------------------------------------- saída do quiosque */
  function toqueNoLogo() {
    const t = Date.now();
    toquesLogo = toquesLogo.filter(x => t - x < 3000).concat(t);
    if (toquesLogo.length >= 5) { toquesLogo = []; pedirPin(); }
  }

  function pedirPin() {
    let pin = '';
    const m = modal(`<div class="confirmar"><div style="color:var(--marinho)">${icone('cadeado', 48, 2)}</div><h2>Área do gerente</h2>
      <div class="digitos-pin">${'<span></span>'.repeat(4)}</div>
      <div class="teclado">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="x" aria-label="Fechar">${icone('x', 26)}</button><button data-n="0">0</button><button data-n="apagar" aria-label="Apagar">${icone('voltar', 26)}</button></div></div>`);
    const spans = m.el.querySelectorAll('.digitos-pin span');
    m.el.addEventListener('click', async e => {
      const b = e.target.closest('[data-n]'); if (!b) return;
      const n = b.dataset.n;
      if (n === 'x') return m.fechar();
      if (n === 'apagar') pin = pin.slice(0, -1); else if (pin.length < 4) pin += n;
      spans.forEach((s, i) => s.textContent = pin[i] ? '•' : '');
      if (pin.length === 4) {
        try { await apiT('/api/tablet/desbloquear', { metodo: 'POST', dados: { pin } }); m.fechar(); menuGerente(); }
        catch (er) { pin = ''; spans.forEach(s => s.textContent = ''); toast(er.message, 'erro'); }
      }
    });
  }

  function menuGerente() {
    const m = modal(`<div class="confirmar"><h2>Opções do tablet</h2>
      <p style="color:var(--texto-2)">${esc(estado?.dispositivo || '')} · ${esc(estado?.mesa?.nome || 'sem mesa')} · versão ${VERSAO}</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:20px">
        <button class="btn btn-claro btn-g" data-a="cheia">Tela cheia</button>
        <button class="btn btn-claro btn-g" data-a="recarregar">Recarregar o app</button>
        <button class="btn btn-perigo btn-g" data-a="desativar">Desativar este tablet</button>
        <button class="btn btn-borda btn-g" data-a="fechar">Voltar ao cardápio</button>
      </div></div>`);
    m.el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'fechar') m.fechar();
      if (a === 'cheia') { telaCheia(); m.fechar(); }
      if (a === 'recarregar') location.reload();
      if (a === 'desativar') { gravarToken(null); token = null; m.fechar(); telaAtivacao(); }
    });
  }

  /* ---------------------------------------------------- ciclo */
  function agendarPoll(ms = INTERVALO_MS) { pararPoll(); timerPoll = setTimeout(async () => { await buscarEstado(); if (token) agendarPoll(); }, ms); }
  function pararPoll() { clearTimeout(timerPoll); }

  async function iniciar() {
    if (!token) return telaAtivacao();
    raiz.innerHTML = '';
    try {
      const e = await apiT('/api/tablet/estado');
      estado = e;
      sessaoConhecida = e.sessao ? e.sessao.id : null;
      await carregarCardapio();
      if (!e.mesa) mostrarSemMesa();
      irPara(e.sessao ? 'cardapio' : 'descanso');
    } catch (er) {
      if (er.status === 401) { gravarToken(null); token = null; return telaAtivacao(); }
      if (er.status === 403) return telaBloqueado('Este tablet foi desativado.');
      raiz.innerHTML = `<div class="ativacao"><div class="caixa"><img src="/img/logo.png" alt="Deu Fome" class="logo-df"><h2>Sem conexão</h2><p style="color:var(--texto-2)">Tentando reconectar…</p></div></div>`;
      return setTimeout(iniciar, 4000);
    }
    reiniciarInatividade();
    agendarPoll();
  }

  iniciar();
})();
