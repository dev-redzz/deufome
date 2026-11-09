import DF from './comum.js';

(() => {
  const { icone, real, esc, uid, toast, api, modal } = DF;
  const VERSAO = document.body.dataset.versao || 'dev';
  const MODO_COMPUTADOR = navigator.maxTouchPoints > 1 && /X11; Linux x86_64/.test(navigator.userAgent) && !/CrOS|HeadlessChrome/.test(navigator.userAgent) && screen.width <= 1280;
  const CHAVE_TOKEN = 'deufome_dispositivo';
  let INATIVIDADE_MS = 3 * 60 * 1000;
  const INTERVALO_MS = 3000;
  const raiz = document.getElementById('raiz');

  const OBS_RAPIDAS = [
    [/burg|hamb|prato|porç|frango/i, ['Sem cebola', 'Sem tomate', 'Bem passado', 'Molho à parte']],
    [/bebida/i, ['Sem gelo', 'Com limão', 'Bem gelada']],
    [/sobremesa|açaí/i, ['Sem calda', 'Colher extra']],
  ];

  let token = lerToken();
  let estado = null;
  let categorias = [];
  let versaoCardapio = null;
  let sessaoConhecida = null;
  let carrinho = [];
  let tela = 'descanso';
  let categoriaAtiva = null;
  let online = true;
  let enviando = false;
  let chavePendente = null;
  let timerInatividade, timerPoll, toquesLogo = [], ultimoFechado = false;
  let ap = {}, destaques = [], selos = {};

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
    document.documentElement.dataset.temaTablet = ap.tema_tablet === 'escuro' ? 'escuro' : 'claro';
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
      <div class="teclado">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="apagar">${icone('voltar', 28)}</button><button data-n="0">0</button><button data-n="ok" style="background:var(--brasa);color:#fff">${icone('check', 30)}</button></div>
    </div></div>`;
    const spans = raiz.querySelectorAll('.digitos span');
    const pintar = () => spans.forEach((s, i) => { s.textContent = digitos[i] || ''; s.style.borderColor = digitos[i] ? 'var(--brasa)' : ''; });
    raiz.querySelector('.teclado').addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      const n = b.dataset.n;
      if (n === 'apagar') digitos = digitos.slice(0, -1);
      else if (n !== 'ok' && digitos.length < 6) digitos += n;
      pintar();
      if (digitos.length < 6 || (n !== 'ok' && digitos.length === 6 && n === 'apagar')) return;
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
      aplicarEstado(e);
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
    atualizarBarra();
  }

  async function aplicarEstado(e) {
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
    if (fechado() !== ultimoFechado) { ultimoFechado = fechado(); if (tela === 'cardapio') desenharCardapio(true); }
    if (!e.mesa) { mostrarSemMesa(); return; }
    document.querySelector('.sem-mesa')?.remove();
    if (tela === 'descanso') desenharDescanso();
    else if (tela === 'pedidos') desenharPedidos();
    else if (raiz.querySelector('#cats')) desenharCats();
    atualizarBarra();
  }

  function limparTudo() {
    carrinho = [];
    chavePendente = null;
    enviando = false;
    estado = estado ? { ...estado, pedidos: [], total: 0, sessao: null, chamados_abertos: [] } : null;
    document.querySelectorAll('.modal-fundo, .painel-lateral').forEach(el => el.remove());
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
      aplicarAparencia(r.aparencia);
      if (tela === 'descanso' && estado?.mesa) desenharDescanso();
      carrinho = carrinho.filter(i => produto(i.produtoId)?.disponivel);
      if (tela === 'cardapio') desenharCardapio(true);
    } catch {}
  }

  const produto = id => { for (const c of categorias) for (const p of c.produtos) if (p.id === id) return p; return null; };

  /* ---------------------------------------------------- navegação */
  function irPara(t) {
    tela = t;
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
      const m = modal(`<div class="confirmar"><h2>Ainda está aí?</h2><p style="font-size:20px;color:var(--texto-2)">Seu carrinho será esvaziado em <b id="seg">${s}</b> segundos.</p><div class="botoes"><button class="btn btn-azul btn-g" id="sim">Continuar pedindo</button></div></div>`);
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
    document.querySelectorAll('.modal-fundo, .painel-lateral').forEach(el => el.remove());
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

  function desenharDescanso() {
    avisoModoComputador();
    const infos = [
      ap.wifi_nome ? `<div class="info-descanso">${icone('wifi', 26)}<span><small>Wi-Fi</small><b>${esc(ap.wifi_nome)}</b>${ap.wifi_senha ? `<em>Senha: ${esc(ap.wifi_senha)}</em>` : ''}</span></div>` : '',
      ap.instagram ? `<div class="info-descanso">${icone('camera', 26)}<span><small>Instagram</small><b>@${esc(ap.instagram)}</b></span></div>` : '',
      ap.telefone ? `<div class="info-descanso">${icone('fone', 26)}<span><small>Telefone</small><b>${esc(ap.telefone)}</b></span></div>` : '',
    ].filter(Boolean).join('');
    raiz.innerHTML = `<div class="descanso ${ap.capa ? 'com-capa' : ''}">
      ${ap.capa ? `<div class="capa" style="background-image:url('${esc(ap.capa)}')"></div>` : ''}
      <div class="descanso-topo">
        ${estado?.mesa ? `<div class="mesa-tag">${esc(estado.mesa.nome)}</div>` : '<span></span>'}
        ${ap.endereco ? `<div class="endereco">${esc(ap.endereco)}</div>` : ''}
      </div>
      <div class="texto">
        <img class="logo-restaurante" src="${esc(logoRestaurante())}" alt="">
        <h1>${esc(estado?.estabelecimento || 'Deu Fome')}</h1>
        ${fechado() ? `<div class="fechado-faixa">${icone('relogio', 24, 2.5)} ${esc(textoFechado())}</div>` : `<p>${esc(ap.boas_vindas || 'Toque na tela para ver o cardápio')}</p>`}
        <button class="toque" id="comecar">Ver o cardápio<span class="seta">${icone('seta', 30, 3.5)}</span></button>
      </div>
      ${infos ? `<div class="infos-descanso">${infos}</div>` : ''}
      <div class="assinatura">Pedidos por <b>Deu Fome</b></div>
    </div>`;
    raiz.querySelector('#comecar').onclick = () => { telaCheia(); irPara('cardapio'); };
  }

  /* ---------------------------------------------------- layout principal */
  function garantirLayout() {
    if (raiz.querySelector('.app')) return;
    raiz.innerHTML = `<div class="app">
      <header class="topo">
        <img class="logo ${ap.logo ? 'proprio' : ''}" src="${esc(ap.logo || '/img/logo.png')}" alt="" id="logo">
        <div class="estab">${esc(estado.estabelecimento)}</div>
        <div class="mesa">${esc(estado.mesa?.nome || '')}</div>
      </header>
      <nav class="cats" id="cats"></nav>
      <main class="conteudo" id="conteudo"></main>
      <footer class="barra" id="barra"></footer>
    </div>`;
    raiz.querySelector('#logo').addEventListener('pointerdown', toqueNoLogo);
    raiz.querySelector('#conteudo').addEventListener('scroll', marcarCategoriaVisivel, { passive: true });
  }

  function desenharCats() {
    const nav = raiz.querySelector('#cats');
    const temPedidos = estado?.pedidos?.length;
    nav.innerHTML = categorias.map(c => `<button data-cat="${c.id}" class="${tela === 'cardapio' && categoriaAtiva === c.id ? 'ativa' : ''}">${esc(c.nome)}</button>`).join('')
      + `<div class="sep"></div><button data-cat="pedidos" class="meus ${tela === 'pedidos' ? 'ativa' : ''}">${temPedidos ? 'Meus pedidos e conta' : 'Minha conta'}</button>`;
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

  function qtdNoCarrinho(pid) { return carrinho.filter(i => i.produtoId === pid).reduce((s, i) => s + i.qtd, 0); }

  function desenharCardapio(manterRolagem) {
    garantirLayout();
    tela = 'cardapio';
    const cont = raiz.querySelector('#conteudo');
    const rol = cont.scrollTop;
    cont.dataset.tela = 'cardapio';
    if (!categoriaAtiva && categorias[0]) categoriaAtiva = categorias[0].id;
    cont.classList.toggle('sem-fotos', ap.mostrar_fotos === false);
    cont.classList.toggle('sem-descricao', ap.mostrar_descricao === false);
    const listaDestaques = destaques.map(produto).filter(p => p && p.disponivel);
    cont.innerHTML = (listaDestaques.length >= 2 ? `<section class="destaques"><h2>${icone('fogo', 30, 2.2)} Mais pedidos da casa</h2><div class="grade grade-destaques">${listaDestaques.map(p => cartao(p, true)).join('')}</div></section>` : '') + (fechado() ? `<div class="aviso-fechado">${icone('relogio', 24, 2.5)} ${esc(textoFechado())} Você pode ver o cardápio, mas os pedidos estão pausados.</div>` : '') + categorias.map(c => `<section id="cat-${c.id}">
      <h2>${esc(c.nome)}</h2>
      <div class="grade">${c.produtos.map(p => cartao(p)).join('')}</div></section><div style="height:28px"></div>`).join('');
    cont.onclick = e => {
      const b = e.target.closest('.card'); if (!b) return;
      const p = produto(Number(b.dataset.p));
      if (!p.disponivel) return toast('Este item está indisponível agora.');
      abrirProduto(p);
    };
    if (manterRolagem) cont.scrollTop = rol; else cont.scrollTop = 0;
    desenharCats();
    atualizarBarra();
  }

  function cartao(p, destaque = false) {
    const q = qtdNoCarrinho(p.id);
    const selo = p.selo && selos[p.selo] ? `<span class="selo-produto ${esc(p.selo)}">${esc(selos[p.selo])}</span>` : '';
    return `<button class="card ${p.disponivel ? '' : 'indisp'} ${destaque ? 'card-destaque' : ''}" data-p="${p.id}">
      <div class="foto" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"></div>
      ${!p.disponivel ? '<span class="chip cinza selo">Indisponível</span>' : ''}
      ${q ? `<span class="qtd-no-carrinho">${q}</span>` : ''}
      <div class="info">
        ${selo}
        <div class="nome">${esc(p.nome)}</div>
        <div class="desc">${esc(p.descricao)}</div>
        <div class="rodape"><span class="preco">${real(p.preco)}</span><span class="mais">${icone('mais', 30, 3)}</span></div>
      </div></button>`;
  }

  function atualizarBarra() {
    const barra = raiz.querySelector('#barra'); if (!barra) return;
    const qtd = carrinho.reduce((s, i) => s + i.qtd, 0);
    const total = carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
    const conta = estado?.total || 0;
    barra.innerHTML = `${ap.chamar_garcom === false ? '' : `<button class="btn ajuda" id="ajuda">${icone('sino', 26)}<span>Chamar garçom</span></button>`}
      <div class="resumo">${qtd ? `<span class="bolha">${qtd}</span><span class="rotulo">${qtd === 1 ? 'item' : 'itens'} no carrinho</span><span class="total">${real(total)}</span>`
        : conta ? `<span class="rotulo" style="opacity:.8">Conta da mesa até agora</span><span class="total">${real(conta)}</span>` : '<span class="dica" style="opacity:.75">Toque em um prato para ver os detalhes e adicionar</span>'}</div>
      ${qtd ? `<button class="btn btn-azul" id="verCarrinho">${icone('sacola', 26)} Ver carrinho</button>` : estado?.pedidos?.length && tela !== 'pedidos' ? `<button class="btn btn-azul" id="verPedidos">${icone('relogio', 26)} <span class="txt-longo">Acompanhar pedidos</span><span class="txt-curto">Pedidos</span></button>` : ''}`;
    barra.querySelector('#ajuda')?.addEventListener('click', abrirAjuda);
    barra.querySelector('#verCarrinho')?.addEventListener('click', abrirCarrinho);
    barra.querySelector('#verPedidos')?.addEventListener('click', () => irPara('pedidos'));
  }

  const fechado = () => estado?.horario && estado.horario.aberto === false;
  const textoFechado = () => 'Estamos fechados agora' + (estado?.horario?.proxima ? `. Abrimos ${estado.horario.proxima}.` : '.');
  const taxaDe = v => estado?.taxa_servico > 0 ? Math.round(v * estado.taxa_servico / 100) : 0;

  /* ---------------------------------------------------- produto */
  function abrirProduto(p) {
    let qtd = 1;
    const sel = new Set();
    const obs = new Set();
    const cat = categorias.find(c => c.produtos.includes(p));
    const rapidas = ap.permitir_observacao === false ? [] : (OBS_RAPIDAS.find(([re]) => re.test(cat?.nome || '')) || [null, []])[1];
    const m = modal(`<div class="produto-modal">
      <div class="foto ${ap.mostrar_fotos === false ? 'sem' : ''}" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"><button class="fechar" data-fechar>${icone('x', 30, 3)}</button></div>
      <div class="corpo">
        ${p.selo && selos[p.selo] ? `<span class="selo-produto ${esc(p.selo)}">${esc(selos[p.selo])}</span>` : ''}
        <h2>${esc(p.nome)}</h2>
        <p class="desc">${esc(p.descricao)}</p>
        <span class="preco" style="font-size:28px">${real(p.preco)}</span>
        ${p.adicionais.length ? `<h3>Adicionais</h3>${p.adicionais.map(a => `<button class="opcao" data-a="${a.id}"><span class="check">${icone('check', 22, 3.5)}</span>${esc(a.nome)}<span class="v">${a.preco ? '+ ' + real(a.preco) : 'grátis'}</span></button>`).join('')}` : ''}
        ${rapidas.length ? `<h3>Observações</h3><div class="obs-botoes">${rapidas.map(o => `<button data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div>` : ''}
        <div style="height:16px"></div>
      </div>
      <div class="acoes">
        <div class="contador"><button data-q="-1">${icone('menos', 28, 3)}</button><span id="q">1</span><button data-q="1">${icone('mais', 28, 3)}</button></div>
        <button class="btn btn-azul btn-g" id="add"></button>
      </div></div>`, { classe: 'modal-produto' });
    const unit = () => p.preco + p.adicionais.filter(a => sel.has(a.id)).reduce((s, a) => s + a.preco, 0);
    const pintar = () => {
      m.el.querySelector('#q').textContent = qtd;
      const b = m.el.querySelector('#add');
      if (fechado()) { b.textContent = 'Fechado agora'; b.disabled = true; } else b.textContent = `Adicionar · ${real(unit() * qtd)}`;
    };
    pintar();
    m.el.addEventListener('click', e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const a = e.target.closest('[data-a]');
      if (a) { const id = Number(a.dataset.a); sel.has(id) ? sel.delete(id) : sel.add(id); a.classList.toggle('marcada'); pintar(); }
      const o = e.target.closest('[data-o]');
      if (o) { const v = o.dataset.o; obs.has(v) ? obs.delete(v) : obs.add(v); o.classList.toggle('marcada'); }
      const q = e.target.closest('[data-q]');
      if (q) { qtd = Math.min(20, Math.max(1, qtd + Number(q.dataset.q))); pintar(); }
      if (e.target.closest('#add')) {
        const adicionais = [...sel].sort();
        const observacao = [...obs].join(', ');
        const igual = carrinho.find(i => i.produtoId === p.id && i.adicionais.join() === adicionais.join() && i.observacao === observacao);
        if (igual) igual.qtd = Math.min(20, igual.qtd + qtd);
        else carrinho.push({ chave: uid(), produtoId: p.id, nome: p.nome, imagem: p.imagem, adicionais, nomesAdicionais: p.adicionais.filter(a => sel.has(a.id)).map(a => a.nome), observacao, unit: unit(), qtd });
        chavePendente = null;
        m.fechar();
        toast(`${p.nome} adicionado ao carrinho`);
        desenharCardapio(true);
      }
    });
  }

  /* ---------------------------------------------------- carrinho */
  function abrirCarrinho() {
    document.querySelector('.painel-lateral')?.remove();
    document.querySelector('.toast')?.remove();
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.style.background = 'rgba(11,31,92,.35)';
    const painel = document.createElement('aside');
    painel.className = 'painel-lateral';
    const fechar = () => { painel.remove(); fundo.remove(); };
    fundo.onclick = fechar;
    document.body.append(fundo, painel);
    function pintar() {
      const total = carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
      painel.innerHTML = `<header><h2>Seu carrinho</h2><button class="btn btn-claro" data-fechar style="height:60px;width:60px;padding:0">${icone('x', 28, 3)}</button></header>
        <div class="lista">${carrinho.length ? carrinho.map(i => `<div class="item-carrinho">
          <div class="mini" style="background-image:url('${esc(i.imagem || '/img/sem-foto.svg')}')"></div>
          <div class="meio"><div class="nome">${esc(i.nome)}</div>
            ${i.nomesAdicionais.length ? `<div class="det">+ ${esc(i.nomesAdicionais.join(', '))}</div>` : ''}
            ${i.observacao ? `<div class="det">${esc(i.observacao)}</div>` : ''}
            <div class="preco" style="font-size:19px;margin-top:4px">${real(i.unit * i.qtd)}</div></div>
          <div class="contador"><button data-i="${i.chave}" data-d="-1">${i.qtd === 1 ? icone('lixo', 22) : icone('menos', 24, 3)}</button><span>${i.qtd}</span><button data-i="${i.chave}" data-d="1">${icone('mais', 24, 3)}</button></div>
        </div>`).join('') : `<div class="vazio"><div style="color:var(--brasa)">${icone('sacola', 64, 2)}</div><p>Seu carrinho está vazio.</p></div>`}</div>
        <footer>${carrinho.length ? `<div class="linha-total"><span>Total do pedido</span><strong>${real(total)}</strong></div>
          <button class="btn btn-azul btn-g" id="revisar">Revisar e enviar pedido</button>` : ''}
          <button class="btn btn-borda btn-g" data-fechar>Continuar escolhendo</button></footer>`;
    }
    pintar();
    painel.addEventListener('click', e => {
      if (e.target.closest('[data-fechar]')) return fechar();
      const b = e.target.closest('[data-i]');
      if (b) {
        const it = carrinho.find(i => i.chave === b.dataset.i);
        it.qtd += Number(b.dataset.d);
        if (it.qtd <= 0) carrinho = carrinho.filter(i => i !== it);
        if (it.qtd > 20) it.qtd = 20;
        chavePendente = null;
        pintar();
        if (tela === 'cardapio') desenharCardapio(true); else atualizarBarra();
      }
      if (e.target.closest('#revisar')) { fechar(); confirmarPedido(); }
    });
  }

  function confirmarPedido() {
    if (!online) return toast('Sem conexão. Chame um atendente.', 'erro');
    if (fechado()) return toast(textoFechado(), 'erro');
    if (estado?.sessao?.status === 'conta_solicitada') return toast('A conta já foi pedida. Chame um atendente para pedir mais.', 'erro');
    const total = carrinho.reduce((s, i) => s + i.unit * i.qtd, 0);
    chavePendente = chavePendente || uid();
    const m = modal(`<div class="confirmar">
      <div style="color:var(--brasa)">${icone('chef', 56, 2)}</div>
      <h2>Confirmar pedido?</h2>
      <p style="color:var(--texto-2);font-size:19px;margin:0">Depois de enviado, ele vai direto para a cozinha.</p>
      <div class="resumo-lista">${carrinho.map(i => `<div><span><b>${i.qtd}×</b> ${esc(i.nome)}${i.nomesAdicionais.length ? ` <small style="color:var(--texto-2)">(+ ${esc(i.nomesAdicionais.join(', '))})</small>` : ''}${i.observacao ? `<br><small style="color:var(--texto-2)">${esc(i.observacao)}</small>` : ''}</span><span>${real(i.unit * i.qtd)}</span></div>`).join('')}</div>
      <div class="linha-total" style="margin-bottom:22px"><span>Total</span><strong>${real(total)}</strong></div>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Voltar</button><button class="btn btn-azul btn-g" id="enviar">${icone('check', 28, 3)} Enviar pedido</button></div>
    </div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const b = e.target.closest('#enviar');
      if (!b || enviando) return;
      enviando = true; b.disabled = true; b.textContent = 'Enviando…';
      try {
        await apiT('/api/tablet/pedidos', { metodo: 'POST', dados: {
          chave: chavePendente,
          itens: carrinho.map(i => ({ produto_id: i.produtoId, quantidade: i.qtd, adicionais: i.adicionais, observacao: i.observacao })),
        } });
        carrinho = []; chavePendente = null;
        m.fechar();
        pedidoEnviado();
        await buscarEstado();
      } catch (er) {
        b.disabled = false; b.innerHTML = `${icone("check", 28, 3)} Enviar pedido`;
        toast(er.offline ? 'Sem conexão. Tente de novo ou chame um atendente.' : er.message, 'erro');
        if (er.status === 409) { m.fechar(); await carregarCardapio(); await buscarEstado(); }
      } finally { enviando = false; }
    });
  }

  function pedidoEnviado() {
    const m = modal(`<div class="enviado"><div class="selo-ok">${icone('check', 64, 3.5)}</div><h2>Pedido enviado!</h2><p>A cozinha já recebeu. Acompanhe o andamento por aqui.</p></div>`);
    setTimeout(() => { m.fechar(); irPara('pedidos'); }, 2600);
  }

  /* ---------------------------------------------------- pedidos e conta */
  const PASSOS = [['recebido', 'Recebido'], ['preparo', 'Em preparo'], ['pronto', 'Pronto'], ['entregue', 'Entregue']];

  function desenharPedidos() {
    garantirLayout();
    tela = 'pedidos';
    const cont = raiz.querySelector('#conteudo');
    const pedidos = estado?.pedidos || [];
    const pediuConta = estado?.sessao?.status === 'conta_solicitada';
    const assinatura = JSON.stringify([pedidos, estado?.total, estado?.sessao, estado?.avaliado, estado?.taxa_servico]);
    if (cont.dataset.assinatura === assinatura && cont.dataset.tela === 'pedidos') { desenharCats(); atualizarBarra(); return; }
    const rol = cont.dataset.tela === 'pedidos' ? cont.scrollTop : 0;
    cont.dataset.assinatura = assinatura;
    cont.dataset.tela = 'pedidos';
    requestAnimationFrame(() => { cont.scrollTop = rol; });
    cont.innerHTML = `<h2>Meus pedidos</h2>
      ${pediuConta ? `<div class="aviso-conta">${icone('conta', 22)} <b>Conta solicitada.</b> Um atendente já está a caminho para finalizar.</div>` : ''}
      ${pedidos.length ? pedidos.slice().reverse().map(p => {
        const i = PASSOS.findIndex(s => s[0] === p.status);
        const cancelado = p.status === 'cancelado';
        return `<div class="pedido-bloco">
          <div class="cab"><strong>Pedido ${p.numero}</strong>${cancelado ? '<span class="chip vermelho">Cancelado</span>' : `<span class="preco" style="font-size:20px">${real(p.total)}</span>`}</div>
          ${cancelado ? '' : `<div class="linha-tempo">${PASSOS.map(([k, n], j) => {
            const cls = j < i || (j === i && k === 'entregue') ? 'feito' : j === i ? (k === 'pronto' ? 'feito pronto' : 'atual') : '';
            return `<div class="passo ${cls}"><div class="bola">${j <= i ? icone(j === i && k === 'preparo' ? 'fogo' : 'check', 22, 3) : ''}</div>${n}</div>`;
          }).join('')}</div>`}
          <div class="itens">${p.itens.map(it => `<div><span>${it.quantidade}× ${esc(it.nome)}${it.adicionais.length ? ' (+ ' + esc(it.adicionais.map(a => a.nome).join(', ')) + ')' : ''}${it.observacao ? ' · ' + esc(it.observacao) : ''}</span><span>${real(it.subtotal)}</span></div>`).join('')}</div>
        </div>`;
      }).join('') : `<div class="vazio"><div style="color:var(--brasa)">${icone('cardapio', 64, 2)}</div><p>Nenhum pedido feito nesta mesa ainda.</p><button class="btn btn-azul btn-g" id="irCardapio">Ver cardápio</button></div>`}
      ${pedidos.length ? `<div class="pedido-bloco" style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
        <div class="contas-tablet">${taxaDe(estado.total) ? `<div class="lt"><span>Consumo</span><span>${real(estado.total)}</span></div><div class="lt"><span>Taxa de serviço (${estado.taxa_servico}%, opcional)</span><span>${real(taxaDe(estado.total))}</span></div>` : ''}
          <div style="color:var(--texto-2)">Total da conta</div><div style="font-family:var(--display);font-weight:800;font-size:36px">${real(estado.total + taxaDe(estado.total))}</div></div>
        ${pediuConta ? (estado.avaliado || ap.pedir_avaliacao === false ? `<span class="chip verde" style="font-size:16px;padding:8px 14px">${esc(ap.agradecimento || 'Obrigado pela visita!')}</span>` : `<button class="btn btn-azul btn-g" id="avaliarBtn">${icone('estrela', 26, 2.5)} Avaliar atendimento</button>`) : `<button class="btn btn-borda btn-g" id="irCardapio">Pedir mais</button><button class="btn btn-marinho btn-g" id="pedirConta">${icone('conta', 26)} Pedir a conta</button>`}
      </div>` : ''}`;
    cont.querySelectorAll('#irCardapio').forEach(b => b.onclick = () => irPara('cardapio'));
    cont.querySelector('#pedirConta')?.addEventListener('click', pedirConta);
    cont.querySelector('#avaliarBtn')?.addEventListener('click', abrirAvaliacao);
    desenharCats();
    atualizarBarra();
  }

  function pedirConta() {
    const m = modal(`<div class="confirmar"><div style="color:var(--brasa)">${icone('conta', 56, 2)}</div><h2>Pedir a conta?</h2>
      <p style="font-size:20px;color:var(--texto-2)">Total até agora: <b style="color:var(--marinho)">${real(estado.total + taxaDe(estado.total))}</b>${taxaDe(estado.total) ? ` <small>(com ${estado.taxa_servico}% de serviço)</small>` : ''}.<br>Depois disso, novos pedidos só com o atendente.</p>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Ainda não</button><button class="btn btn-marinho btn-g" id="sim">Sim, pedir a conta</button></div></div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      if (!e.target.closest('#sim')) return;
      try { await apiT('/api/tablet/chamar', { metodo: 'POST', dados: { tipo: 'conta' } }); m.fechar(); await buscarEstado(); if (!estado?.avaliado && ap.pedir_avaliacao !== false) abrirAvaliacao(true); else toast('Conta solicitada. Já vamos até você!'); }
      catch (er) { toast(er.message, 'erro'); }
    });
  }

  function abrirAvaliacao(posConta) {
    let nota = 0;
    const tags = new Set();
    const ROTULOS = ['', 'Muito ruim', 'Ruim', 'Regular', 'Bom', 'Excelente'];
    const BOAS = ['Comida ótima', 'Atendimento rápido', 'Ambiente agradável', 'Preço justo'];
    const RUINS = ['Demorou', 'Pedido errado', 'Comida fria', 'Tablet difícil de usar'];
    const m = modal(`<div class="avaliar">
      ${posConta ? '<p class="chip verde" style="font-size:15px">Conta solicitada, um atendente já vem até você</p>' : ''}
      <h2>Como foi sua experiência?</h2>
      <p style="color:var(--texto-2);margin:0">Sua opinião ajuda o restaurante a melhorar.</p>
      <div class="notas">${[1, 2, 3, 4, 5].map(n => `<button data-nota="${n}" aria-label="${n} estrelas">${icone('estrela', 44, 0).replace('fill="none"', 'fill="currentColor"')}</button>`).join('')}</div>
      <div class="rotulo-nota" id="rotulo">Toque nas estrelas</div>
      <div class="tags" id="tags"></div>
      <textarea id="coment" rows="2" maxlength="400" placeholder="Quer deixar um comentário? (opcional)"></textarea>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Agora não</button><button class="btn btn-azul btn-g" id="enviarAv" disabled>Enviar avaliação</button></div>
    </div>`);
    const pintar = () => {
      m.el.querySelectorAll('[data-nota]').forEach(b => b.classList.toggle('on', Number(b.dataset.nota) <= nota));
      m.el.querySelector('#rotulo').textContent = nota ? ROTULOS[nota] : 'Toque nas estrelas';
      const lista = nota >= 4 ? BOAS : nota ? [...RUINS, ...BOAS.slice(0, 2)] : [];
      [...tags].forEach(t => { if (!lista.includes(t)) tags.delete(t); });
      m.el.querySelector('#tags').innerHTML = lista.map(t => `<button data-tag="${esc(t)}" class="${tags.has(t) ? 'marcada' : ''}">${esc(t)}</button>`).join('');
      m.el.querySelector('#enviarAv').disabled = !nota;
    };
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const n = e.target.closest('[data-nota]'); if (n) { nota = Number(n.dataset.nota); return pintar(); }
      const t = e.target.closest('[data-tag]'); if (t) { const v = t.dataset.tag; tags.has(v) ? tags.delete(v) : tags.add(v); return pintar(); }
      const b = e.target.closest('#enviarAv');
      if (b) {
        b.disabled = true;
        try {
          await apiT('/api/tablet/avaliar', { metodo: 'POST', dados: { nota, tags: [...tags], comentario: m.el.querySelector('#coment').value } });
          m.el.querySelector('.avaliar').innerHTML = `<div class="enviado" style="padding:20px 0"><div class="selo-ok">${icone('check', 64, 3.5)}</div><h2>Obrigado!</h2><p>${esc(ap.agradecimento || 'Sua avaliação foi enviada.')}</p></div>`;
          setTimeout(() => m.fechar(), 2200);
          buscarEstado();
        } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
      }
    });
  }

  function abrirAjuda() {
    const jaChamou = estado?.chamados_abertos?.includes('garcom');
    const m = modal(`<div class="confirmar"><div style="color:var(--brasa)">${icone('sino', 56, 2)}</div><h2>Precisa de ajuda?</h2>
      <p style="font-size:20px;color:var(--texto-2)">${jaChamou ? 'Um atendente já foi chamado e está a caminho.' : 'Um atendente vai até a sua mesa.'}</p>
      <div class="botoes"><button class="btn btn-borda btn-g" data-fechar>Fechar</button>${jaChamou ? '' : `<button class="btn btn-azul btn-g" id="chamar">Chamar garçom</button>`}</div></div>`);
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      if (!e.target.closest('#chamar')) return;
      try { await apiT('/api/tablet/chamar', { metodo: 'POST', dados: { tipo: 'garcom' } }); m.fechar(); toast('Garçom chamado!'); buscarEstado(); }
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
      <div class="digitos" style="display:flex;gap:10px;justify-content:center;margin:20px 0">${'<span style="width:52px;height:60px;border-radius:14px;border:2px solid var(--linha);display:grid;place-items:center;font-size:30px"></span>'.repeat(4)}</div>
      <div class="teclado">${[1,2,3,4,5,6,7,8,9].map(n => `<button data-n="${n}">${n}</button>`).join('')}<button data-n="x">${icone('x', 26)}</button><button data-n="0">0</button><button data-n="apagar">${icone('voltar', 26)}</button></div></div>`);
    const spans = m.el.querySelectorAll('.digitos span');
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
