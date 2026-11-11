import DF from './comum.js';

(() => {
  const { icone, real, esc, toast, api, modal, segundosDesde, tempo, imprimir, dataHora, contar } = DF;
  const MOVIMENTO = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let info = { google: false, cadastro: false, demo: false };
  const raiz = document.getElementById('raiz');
  let eu = null, aba = null, timer = null;

  const PAPEIS = {
    dono: ['Dono', 'Acesso total, inclusive a outros donos'],
    gerente: ['Gerente', 'Salão, cardápio, mesas, tablets e equipe'],
    caixa: ['Caixa', 'Salão, chamados e fechamento de contas'],
    cozinha: ['Cozinha', 'Só a tela da cozinha'],
  };
  const ABAS = {
    visao: ['Visão geral', 'pulso', () => visao()],
    inicio: ['Início', 'casa', () => inicio()],
    estabelecimentos: ['Estabelecimentos', 'loja', () => estabelecimentos()],
    sistema: ['Sistema e backup', 'cadeado', () => sistema()],
    sugestoes: ['Sugestões', 'balao', () => sugestoesPg()],
    erros: ['Erros', 'alerta', () => errosPg()],
    salao: ['Salão e contas', 'mesa', s => salao(s)],
    relatorios: ['Relatórios', 'grafico', () => relatorios()],
    caixa: ['Fechamento de caixa', 'caixa', () => caixaPg()],
    mesas: ['Mesas', 'mesa', () => mesas()],
    dispositivos: ['Dispositivos', 'tablet', s => dispositivos(s)],
    cardapio: ['Cardápio', 'cardapio', () => cardapio()],
    cupons: ['Cupons', 'cupom', () => cuponsPg()],
    equipe: ['Equipe', 'chef', () => equipePg()],
    aparencia: ['Personalizar', 'pincel', () => aparencia()],
    ajustes: ['Configurações', 'engrenagem', () => ajustes()],
  };
  const ABAS_POR_PAPEL = {
    plataforma: ['visao', 'estabelecimentos', 'sistema', 'sugestoes', 'erros'],
    dono: ['inicio', 'salao', 'caixa', 'relatorios', 'cardapio', 'cupons', 'mesas', 'dispositivos', 'aparencia', 'equipe', 'ajustes'],
    gerente: ['inicio', 'salao', 'caixa', 'relatorios', 'cardapio', 'cupons', 'mesas', 'dispositivos', 'aparencia', 'equipe', 'ajustes'],
    caixa: ['salao', 'caixa'],
  };
  const GRUPOS = { inicio: 'No dia a dia', salao: 'No dia a dia', caixa: 'No dia a dia', relatorios: 'Resultados', cardapio: 'Seu restaurante', cupons: 'Seu restaurante', mesas: 'Seu restaurante', dispositivos: 'Seu restaurante', aparencia: 'Seu restaurante', equipe: 'Gestão', ajustes: 'Gestão', visao: 'Plataforma' };
  const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', dividido: 'Dividido' };
  const AO_VIVO = ['salao', 'dispositivos', 'inicio'];
  const SELOS = { novo: 'Novidade', promocao: 'Promoção', chef: 'Sugestão do chef', picante: 'Picante', vegetariano: 'Vegetariano' };

  const paraCentavos = v => {
    const n = parseFloat(String(v).trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };
  const paraReais = c => (c / 100).toFixed(2).replace('.', ',');
  const main = () => raiz.querySelector('#main');
  const falhou = er => { if (er.status === 401) return telaLogin(); toast(er.message, 'erro'); };

  /* ------------------------------------------------------------ ACESSO */
  const ERROS_HASH = {
    'google-off': 'O login com Google ainda não foi configurado.',
    'google-cancelado': 'Você cancelou o login com Google.',
    'google-sessao': 'A confirmação do Google expirou. Tente de novo.',
    'google-falhou': 'Não foi possível entrar com o Google. Tente de novo.',
    'sem-conta': 'Não encontramos uma conta com este e-mail do Google.',
    'desativado': 'Seu acesso foi desativado. Fale com o responsável pelo restaurante.',
    'bloqueado': 'Este estabelecimento está bloqueado. Fale com o suporte do Deu Fome.',
  };

  const escuroDoSistema = matchMedia('(prefers-color-scheme: dark)');
  let temaEscolhido = 'claro';
  function pintarTema() {
    document.documentElement.dataset.tema = temaEscolhido === 'auto' ? (escuroDoSistema.matches ? 'escuro' : 'claro') : temaEscolhido;
    document.querySelectorAll('[data-tema-op]').forEach(b => b.classList.toggle('marcado', b.dataset.temaOp === temaEscolhido));
  }
  function aplicarTema(t) {
    temaEscolhido = t;
    try { localStorage.setItem('deufome_tema', t); } catch {}
    pintarTema();
  }
  try { temaEscolhido = localStorage.getItem('deufome_tema') || 'claro'; } catch {}
  pintarTema();
  escuroDoSistema.addEventListener?.('change', pintarTema);

  function abertura(saudar) {
    if (!saudar) { try { if (sessionStorage.getItem('deufome_abertura')) return; sessionStorage.setItem('deufome_abertura', '1'); } catch { return; } }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = document.createElement('div');
    a.className = 'abertura' + (saudar ? ' saudacao' : '');
    a.innerHTML = `<div class="peca"><img src="/img/icone-escuro.png" alt=""><b>${saudar ? `Olá,<span>${esc(saudar)}</span>` : 'Deu<span>Fome</span>'}</b></div>`;
    a.onclick = () => a.remove();
    a.addEventListener('animationend', e => { if (e.animationName === 'abertura-sai') a.remove(); });
    document.body.appendChild(a);
  }

  function telaAcesso(conteudo, { texto = 'Pedidos pelo tablet da mesa, cozinha e caixa do seu restaurante em um só lugar.' } = {}) {
    clearInterval(timer);
    raiz.innerHTML = `<div class="login">
      <aside class="lado">
        <div class="impressora" aria-hidden="true">
          <div class="boca"><span>DEU FOME · PDV</span><i></i></div>
          <div class="saida"><div class="recibo">
            <div class="rc-logo"><img src="/img/icone-escuro.png" alt=""><b>Deu <span>Fome</span></b></div>
            <div class="rc-c">Comanda nº 000128 · Mesa 04 · ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <hr>
            <div class="rc-itens">
              <div class="rc-l"><span>2x Burger Clássico<small>sem cebola</small></span><span>57,80</span></div>
              <div class="rc-l"><span>1x Batata Frita</span><span>22,90</span></div>
              <div class="rc-l"><span>2x Suco Natural</span><span>21,80</span></div>
              <hr>
              <div class="rc-t"><span>TOTAL</span><span>R$ 102,50</span></div>
              <hr>
            </div>
            <p class="rc-frase">${texto}</p>
            <span class="carimbo">Na cozinha</span>
          </div></div>
        </div>
      </aside>
      <main class="formulario">${conteudo}
        <nav class="rodape-login"><a href="/">Conheça o Deu Fome</a><a href="/termos" target="_blank">Termos de uso</a><a href="/privacidade" target="_blank">Privacidade</a></nav>
      </main>
    </div>`;
    return raiz.querySelector('form');
  }

  /* O "G" do Google vem do arquivo oficial em public/img/google.svg (baixado das diretrizes de marca do Google). */
  const botaoGoogle = (modo, texto) => info.google ? `<div class="ou">ou</div><a class="btn btn-google" href="/auth/google?modo=${modo}"><img class="g-logo" src="/img/google.svg" alt="" width="28" height="28"><span>${texto}</span></a>` : '';
  const ligarGoogle = el => el.querySelectorAll('.g-logo').forEach(i => i.addEventListener('error', () => i.remove(), { once: true }));

  function telaLogin(msg) {
    const erroHash = (location.hash.match(/^#erro=([a-z-]+)/) || [])[1];
    if (erroHash) { msg = { tipo: 'erro', texto: ERROS_HASH[erroHash] || 'Não foi possível entrar.' }; history.replaceState(null, '', '/admin'); }
    const f = telaAcesso(`<form id="f">
      <div class="form-cab"><h2>Entrar</h2><p>Acesse a conta da sua empresa.</p></div>
      ${msg ? `<div class="aviso-form ${msg.tipo}">${esc(msg.texto)}</div>` : ''}
      <label class="campo">E-mail<input name="email" type="email" required autocomplete="username"></label>
      <label class="campo">Senha<span class="senha-campo"><input name="senha" type="password" required autocomplete="current-password"><button type="button" class="ver-senha">Mostrar</button></span></label>
      <div class="linha-opcoes"><label class="lembrar"><input type="checkbox" name="lembrar" checked> Manter conectado</label><button type="button" class="link" id="esqueci">Esqueci minha senha</button></div>
      <button class="btn btn-azul btn-entrar">Entrar</button>
      ${botaoGoogle('entrar', 'Entrar com Google')}
      ${info.cadastro ? '<p class="troca-tela">Ainda não tem conta? <a href="/cadastro">Criar conta</a></p>' : ''}
      ${info.demo ? '<div class="dica"><b>Modo demonstração</b><br>admin@cantinho.test, senha 123456, PIN do tablet 1234<br>Cozinha: cozinha@cantinho.test · Caixa: caixa@cantinho.test</div>' : ''}
    </form>`);
    ligarGoogle(f);
    f.querySelector('#esqueci').onclick = () => telaEsqueci(f.email.value);
    f.querySelector('.ver-senha').onclick = e => { const ver = f.senha.type === 'password'; f.senha.type = ver ? 'text' : 'password'; e.currentTarget.textContent = ver ? 'Ocultar' : 'Mostrar'; f.senha.focus(); };
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('button.btn-azul'); b.disabled = true;
      try {
        const r = await api('/api/login', { metodo: 'POST', dados: { email: f.email.value, senha: f.senha.value, lembrar: f.lembrar.checked } });
        if (r.papel === 'cozinha' || new URLSearchParams(location.search).get('voltar') === '/cozinha') return location.href = '/cozinha';
        history.replaceState(null, '', '/admin');
        iniciar();
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  function telaEsqueci(email = '') {
    const f = telaAcesso(`<form id="f">
      <h2>Esqueci minha senha</h2>
      <p class="sutil" style="margin:0">Digite o e-mail da sua conta. Vamos enviar um link para você criar uma senha nova.</p>
      <label class="campo">E-mail<input name="email" type="email" required autocomplete="username" value="${esc(email)}"></label>
      <button class="btn btn-azul btn-entrar">Enviar link</button>
      <div class="links"><button type="button" class="link" id="voltar">Voltar para o login</button></div>
    </form>`);
    f.querySelector('#voltar').onclick = () => telaLogin();
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('.btn-azul'); b.disabled = true;
      try {
        await api('/api/senha/esqueci', { metodo: 'POST', dados: { email: f.email.value } });
        telaLogin({ tipo: 'ok', texto: 'Se este e-mail tiver uma conta, você vai receber o link em alguns minutos. Veja também a caixa de spam.' });
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  function telaRedefinir(token) {
    const f = telaAcesso(`<form id="f">
      <h2>Criar nova senha</h2>
      <label class="campo">Nova senha<input name="senha" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
      <label class="campo">Repita a nova senha<input name="senha2" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="btn btn-azul btn-entrar">Salvar nova senha</button>
    </form>`);
    f.onsubmit = async e => {
      e.preventDefault();
      if (f.senha.value !== f.senha2.value) return toast('As senhas não são iguais.', 'erro');
      const b = f.querySelector('.btn-azul'); b.disabled = true;
      try {
        await api('/api/senha/redefinir', { metodo: 'POST', dados: { token, senha: f.senha.value } });
        history.replaceState(null, '', '/admin');
        telaLogin({ tipo: 'ok', texto: 'Senha alterada. Entre com a nova senha.' });
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  const camposRestaurante = `
    <label class="campo">Nome do restaurante<input name="restaurante" required maxlength="60" placeholder="Pizzaria do Centro"></label>
    <label class="aceite"><input type="checkbox" name="aceite" required> <span>Li e aceito os <a href="/termos" target="_blank">Termos de uso</a> e a <a href="/privacidade" target="_blank">Política de privacidade</a>.</span></label>`;

  async function telaCadastro() {
    if (!info.cadastro) return telaLogin({ tipo: 'erro', texto: 'O cadastro de novos restaurantes está fechado no momento.' });
    let pend = null;
    if (location.hash === '#google') { try { pend = await api('/api/cadastro/google'); } catch {} }
    const textos = { texto: 'Crie a conta e o painel guia você: mesas, cardápio, aparência e o primeiro tablet.' };
    const f = telaAcesso(pend ? `<form id="f" class="largo">
      <h2>Falta pouco</h2>
      <div class="aviso-form ok">Conta Google confirmada: <b>${esc(pend.email)}</b></div>
      <label class="campo">Seu nome<input name="nome" required maxlength="60" value="${esc(pend.nome || '')}"></label>
      ${camposRestaurante}
      <button class="btn btn-azul btn-entrar">Criar restaurante</button>
    </form>` : `<form id="f" class="largo">
      <div class="form-cab"><h2>Criar conta</h2><p>Grátis durante o beta. Leva menos de um minuto.</p></div>
      <div class="dupla"><label class="campo">Seu nome<input name="nome" required maxlength="60" autocomplete="name"></label>
      <label class="campo">E-mail<input name="email" type="email" required autocomplete="email"></label></div>
      <label class="campo">Senha<input name="senha" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
      ${camposRestaurante}
      <button class="btn btn-azul btn-entrar">Criar conta grátis</button>
      ${botaoGoogle('cadastro', 'Criar conta com Google')}
      <p class="troca-tela">Já tem conta? <a href="/admin">Entrar</a></p>
    </form>`, textos);
    ligarGoogle(f);
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const b = f.querySelector('.btn-azul'); b.disabled = true;
      try {
        await api(pend ? '/api/cadastro/google' : '/api/cadastro', { metodo: 'POST', dados: { ...d, aceite: !!d.aceite } });
        history.replaceState(null, '', '/admin#inicio');
        iniciar();
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  /* ------------------------------------------------------------ LAYOUT */
  function layout() {
    const abas = ABAS_POR_PAPEL[eu.papel] || [];
    const gestor = ['dono', 'gerente'].includes(eu.papel);
    const inicial = (eu.nome || '?').trim().charAt(0).toUpperCase();
    const papel = PAPEIS[eu.papel]?.[0] || 'Administrador';
    raiz.innerHTML = `<div class="admin">
      <aside id="menuLateral">
        <div class="marca"><img src="/img/icone-escuro.png" alt=""><div><b>Deu Fome</b><span class="beta">Beta</span><small class="nome-estab">${esc(eu.estabelecimento || 'Administração')}</small></div></div>
        <nav class="navegacao">${abas.map((a, i) => `${GRUPOS[a] && GRUPOS[a] !== GRUPOS[abas[i - 1]] ? `<div class="grupo">${GRUPOS[a]}</div>` : ''}<button data-aba="${a}">${icone(ABAS[a][1], 20, 2)} <span>${ABAS[a][0]}</span><span class="contador oculto" data-contador="${a}"></span></button>`).join('')}
        ${eu.papel !== 'plataforma' ? `<div class="grupo">Telas</div>
          <a href="/cozinha" target="_blank" rel="noopener">${icone('chef', 20, 2)} Abrir cozinha</a>
          <a href="/tablet" target="_blank" rel="noopener">${icone('tablet', 20, 2)} Abrir tablet</a>` : ''}</nav>
      </aside>
      <div class="area">
        <header class="topo-painel">
          <button class="icone-topo menu-movel" id="abrirMenu" aria-label="Abrir menu">${icone('menu', 22, 2.2)}</button>
          <span class="topo-titulo nome-estab">${esc(eu.estabelecimento || 'Administração')}</span>
          <div class="topo-dir">
            <div class="suspenso">
              <button class="icone-topo" id="sinoBtn" aria-label="Avisos" aria-expanded="false">${icone('sino', 20, 2)}<span class="bolinha oculto" id="sinoN"></span></button>
              <div class="painel-suspenso avisos oculto" id="sinoMenu"><div class="ps-cab">Avisos</div><div id="listaAvisos"><p class="ps-vazio">Nenhum aviso agora.</p></div></div>
            </div>
            <div class="suspenso">
              <button class="usuario-btn" id="usuarioBtn" aria-expanded="false"><span class="avatar">${esc(inicial)}</span><span class="usuario-txt"><b>${esc(eu.nome)}</b><small>${esc(papel)}</small></span>${icone('seta', 16, 2.5)}</button>
              <div class="painel-suspenso menu-usuario oculto" id="usuarioMenu">
                <div class="mu-cab"><span class="avatar grande">${esc(inicial)}</span><div><b>${esc(eu.nome)}</b><small>${esc(eu.email)}</small><small>${esc(papel)}${eu.estabelecimento ? ' · ' + esc(eu.estabelecimento) : ' · Deu Fome'}</small></div></div>
                <div class="mu-bloco"><span class="mu-rotulo">Tema</span>
                  <div class="segmentado tema-seg"><button data-tema-op="claro">${icone('sol', 16, 2)} Claro</button><button data-tema-op="escuro">${icone('lua', 16, 2)} Escuro</button><button data-tema-op="auto">${icone('tablet', 16, 2)} Auto</button></div></div>
                <div class="mu-bloco mu-itens">
                  ${eu.papel !== 'plataforma' ? `<button data-mu="sugestao">${icone('balao', 18, 2)} Enviar sugestão</button>` : ''}
                  ${gestor ? `<button data-mu="equipe">${icone('pessoas', 18, 2)} Equipe</button><button data-mu="ajustes">${icone('engrenagem', 18, 2)} Configurações</button>` : ''}
                  ${eu.papel === 'plataforma' ? `<button data-mu="sistema">${icone('escudo', 18, 2)} Sistema e backup</button>` : ''}
                  ${!gestor && eu.papel !== 'plataforma' ? `<button data-mu="senha">${icone('pessoas', 18, 2)} Minha conta</button>` : ''}
                </div>
                <div class="mu-bloco mu-itens"><button data-mu="sair" class="perigo">${icone('sair', 18, 2)} Sair</button></div>
              </div>
            </div>
          </div>
        </header>
        <main id="main"></main>
      </div>
    </div>`;
    const admin = raiz.querySelector('.admin');
    raiz.querySelector('aside').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) { mudarAba(b.dataset.aba); admin.classList.remove('menu-aberto'); } });
    raiz.querySelector('#abrirMenu').onclick = () => admin.classList.toggle('menu-aberto');
    admin.addEventListener('click', e => { if (e.target === admin) admin.classList.remove('menu-aberto'); });
    const alternar = (btn, menu) => {
      const abrir = menu.classList.contains('oculto');
      raiz.querySelectorAll('.painel-suspenso').forEach(m => m.classList.add('oculto'));
      raiz.querySelectorAll('[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      if (abrir) { menu.classList.remove('oculto'); btn.setAttribute('aria-expanded', 'true'); }
    };
    raiz.querySelector('#usuarioBtn').onclick = e => { e.stopPropagation(); alternar(e.currentTarget, raiz.querySelector('#usuarioMenu')); };
    raiz.querySelector('#sinoBtn').onclick = e => { e.stopPropagation(); alternar(e.currentTarget, raiz.querySelector('#sinoMenu')); };
    document.addEventListener('click', e => { if (!e.target.closest('.suspenso')) raiz.querySelectorAll('.painel-suspenso').forEach(m => m.classList.add('oculto')); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') raiz.querySelectorAll('.painel-suspenso').forEach(m => m.classList.add('oculto')); });
    raiz.querySelector('#usuarioMenu').addEventListener('click', async e => {
      const t = e.target.closest('[data-tema-op]'); if (t) return aplicarTema(t.dataset.temaOp);
      const b = e.target.closest('[data-mu]'); if (!b) return;
      raiz.querySelector('#usuarioMenu').classList.add('oculto');
      const acao = b.dataset.mu;
      if (acao === 'sair') { await api('/api/logout', { metodo: 'POST' }).catch(() => {}); location.href = '/admin'; }
      if (acao === 'sugestao') sugestaoModal();
      if (acao === 'senha') minhaContaModal();
      if (['equipe', 'ajustes', 'sistema'].includes(acao)) mudarAba(acao);
    });
    raiz.querySelector('#sinoMenu').addEventListener('click', e => { const a = e.target.closest('[data-ir-aviso]'); if (a) { raiz.querySelector('#sinoMenu').classList.add('oculto'); mudarAba(a.dataset.irAviso); } });
    pintarTema();
    const hash = location.hash.slice(1);
    mudarAba(abas.includes(hash) ? hash : abas[0]);
    if (eu.papel === 'plataforma') atualizarContadores();
    atualizarAvisos();
    setInterval(() => { if (document.visibilityState === 'visible') atualizarAvisos(); }, 20000);
  }

  async function atualizarAvisos() {
    let r;
    try { r = await api('/api/avisos'); } catch { return; }
    const n = r.avisos.length;
    const bolinha = raiz.querySelector('#sinoN'); if (!bolinha) return;
    bolinha.textContent = n; bolinha.classList.toggle('oculto', !n);
    const ic = { garcom: 'sino', conta: 'conta', atraso: 'relogio', erro: 'alerta', sugestao: 'balao' };
    raiz.querySelector('#listaAvisos').innerHTML = n ? r.avisos.map(a => `<button class="aviso-item ${a.tipo}" data-ir-aviso="${a.aba}"><span>${icone(ic[a.tipo] || 'sino', 18, 2)}</span><div><b>${esc(a.texto)}</b>${a.quando ? `<small>há ${tempo(segundosDesde(a.quando))}</small>` : ''}</div></button>`).join('') : '<p class="ps-vazio">Nenhum aviso agora.</p>';
  }

  function minhaContaModal() {
    formulario('Minha conta', `<label class="campo">Seu nome<input name="nome" required maxlength="60" value="${esc(eu.nome)}"></label>
      <label class="campo">E-mail<input value="${esc(eu.email)}" disabled></label>
      <details class="dobra"><summary>Trocar a senha</summary>
        <label class="campo">Senha atual<input name="atual" type="password" autocomplete="current-password"></label>
        <label class="campo">Nova senha<input name="nova" type="password" minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label></details>`, {
      aoEnviar: async d => {
        await api('/api/minha-conta', { metodo: 'POST', dados: { nome: d.nome } });
        if (d.nova) await api('/api/minha-senha', { metodo: 'POST', dados: { atual: d.atual, nova: d.nova } });
        eu.nome = d.nome; raiz.querySelectorAll('.usuario-txt b, .mu-cab b').forEach(el => el.textContent = d.nome);
        toast('Dados salvos.');
      },
    });
  }

  function layoutRodape() {}

  async function atualizarContadores() {
    try {
      const st = await api('/api/plataforma/status');
      const pinta = (aba, n) => { const c = raiz.querySelector(`[data-contador="${aba}"]`); if (c) { c.textContent = n; c.classList.toggle('oculto', !n); } };
      pinta('erros', st.erros_abertos); pinta('sugestoes', st.sugestoes_novas);
      return st;
    } catch { return null; }
  }

  function mudarAba(a) {
    aba = a;
    history.replaceState(null, '', '#' + a);
    raiz.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('ativa', b.dataset.aba === a));
    clearInterval(timer);
    const mn = main();
    mn.classList.remove('entrando');
    mn.innerHTML = '<div class="esqueleto"><i class="e-titulo"></i><div class="e-linha"><i></i><i></i><i></i><i></i></div><i class="e-bloco"></i></div>';
    if (MOVIMENTO) { void mn.offsetWidth; mn.classList.add('entrando'); }
    window.scrollTo({ top: 0 });
    Promise.resolve(ABAS[a][2](false)).finally(() => { if (aba === a) { contar(mn); setTimeout(() => mn.classList.remove('entrando'), 900); } });
    if (AO_VIVO.includes(a)) timer = setInterval(() => { if (!document.querySelector('.modal-fundo') && document.visibilityState === 'visible' && !document.activeElement?.matches('select, input')) ABAS[a][2](true); }, 3000);
  }

  function cabecalho(titulo, sub, acoes = '') {
    return `<div class="cabecalho"><div><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${acoes ? `<div class="acoes-topo">${acoes}</div>` : ''}</div>`;
  }

  function formulario(titulo, corpo, { enviar = 'Salvar', aoEnviar, perigo } = {}) {
    const m = modal(`<form class="comanda" novalidate><div class="corpo">
      <div class="modal-cab"><h2>${titulo}</h2><button type="button" class="btn btn-claro btn-p" data-fechar aria-label="Fechar">${icone('x', 18, 3)}</button></div>
      <div class="form-campos">${corpo}</div>
      <div class="form-acoes">${perigo ? `<button type="button" class="btn btn-perigo" data-perigo>${perigo}</button>` : ''}<span style="flex:1"></span><button type="button" class="btn btn-borda" data-fechar>Cancelar</button><button class="btn btn-azul" type="submit">${enviar}</button></div>
    </div></form>`);
    const f = m.el.querySelector('form');
    m.el.querySelectorAll('[data-fechar]').forEach(b => b.onclick = m.fechar);
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('[type=submit]'); b.disabled = true;
      try { await aoEnviar(Object.fromEntries(new FormData(f)), f); m.fechar(); }
      catch (er) { falhou(er); } finally { b.disabled = false; }
    };
    setTimeout(() => f.querySelector('input:not([type=hidden]), select, textarea')?.focus(), 50);
    return m;
  }


  /* ------------------------------------------------------------ INÍCIO DO RESTAURANTE */
  const STATUS_PEDIDO = { recebido: ['Novo', ''], preparo: ['Em preparo', 'amarelo'], pronto: ['Pronto', 'verde'], entregue: ['Entregue', 'cinza'], cancelado: ['Cancelado', 'vermelho'] };
  const hojePorExtenso = () => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const kpi = (rotulo, valor, detalhe, { icone: ic, tom = '' } = {}) => `<div class="kpi ${tom}"><div class="kpi-topo"><span>${rotulo}</span>${ic ? `<i>${icone(ic, 18, 2)}</i>` : ''}</div><b>${valor}</b><small>${detalhe}</small></div>`;

  async function inicio() {
    let r;
    try { r = await api('/api/inicio'); } catch (er) { return falhou(er); }
    if (aba !== 'inicio') return;
    const hora = new Date().getHours();
    const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
    const ini = r.inicio;
    const passos = [
      [ini.mesas > 0, 'Cadastre as mesas', 'Quantas mesas o salão tem.', 'mesas'],
      [ini.produtos > 0, 'Monte o cardápio', 'Categorias, produtos, fotos e adicionais.', 'cardapio'],
      [ini.pin, 'Defina o PIN dos tablets', '4 números para sair do modo quiosque.', 'ajustes'],
      [ini.personalizado, 'Personalize o tablet', 'Logo, cor, foto e Wi-Fi na tela inicial.', 'aparencia'],
      [ini.tablets > 0, 'Ative o primeiro tablet', 'Gere o código e digite no tablet da mesa.', 'dispositivos'],
    ];
    const feitos = passos.filter(x => x[0]).length;
    const proximo = passos.find(x => !x[0]);
    const st = r.horario;
    const situacao = !st.controle ? '' : st.aberto ? '<span class="chip verde"><span class="ponto"></span>Aberto agora</span>' : `<span class="chip vermelho"><span class="ponto"></span>Fechado${st.proxima ? ', abre ' + esc(st.proxima) : ''}</span>`;
    const h = r.hoje, ontem = h.ontem_mesma_hora;
    const delta = ontem ? Math.round((h.vendas - ontem) / ontem * 100) : null;
    const comparacao = delta === null ? 'Ontem neste horário: sem vendas' : `<span class="delta ${delta >= 0 ? 'sobe' : 'desce'}">${delta >= 0 ? '+' : ''}${delta}%</span> em relação a ontem neste horário`;
    const c = r.cozinha;
    const horas = r.por_hora.map((v, i) => ({ h: i, v }));
    const primeira = Math.min(horas.findIndex(x => x.v) === -1 ? 11 : horas.findIndex(x => x.v), 11);
    const visiveis = horas.slice(primeira, Math.max(hora + 1, 23 - 0) + 1);
    main().innerHTML = `<div class="inicio-cab"><div><h1>${saudacao}, ${esc(r.saudacao)}</h1><p><span class="data-hoje">${hojePorExtenso()}</span>${situacao}</p></div></div>`
      + (feitos < passos.length ? `<section class="primeiros-passos"><div class="pp-cab"><div><h2>Vamos deixar tudo pronto</h2><span>${feitos} de ${passos.length} passos feitos. Próximo: <b>${proximo[1]}</b></span></div><button class="btn btn-azul" data-ir="${proximo[3]}">Continuar ${icone('seta', 18, 3)}</button></div>
        <div class="pp-barra"><i style="width:${Math.round(feitos / passos.length * 100)}%"></i></div>
        <ol>${passos.map(([ok, t, d, a], i) => `<li class="${ok ? 'feito' : ''}" data-ir="${a}"><span class="pp-check">${ok ? icone('check', 16, 3) : i + 1}</span><div><b>${t}</b><small>${d}</small></div></li>`).join('')}</ol></section>` : '')
      + (r.salao.chamados ? `<div class="alerta-linha amarelo">${icone('sino', 20, 2)}<span><b>${r.salao.chamados} ${r.salao.chamados === 1 ? 'chamado aberto' : 'chamados abertos'}</b> no salão.</span><button class="btn btn-p btn-borda" data-ir="salao">Atender</button></div>` : '')
      + (c.atrasados ? `<div class="alerta-linha vermelho">${icone('relogio', 20, 2)}<span><b>${c.atrasados} ${c.atrasados === 1 ? 'pedido atrasado' : 'pedidos atrasados'}</b> na cozinha (mais de ${c.atraso_min} min).</span><a class="btn btn-p btn-borda" href="/cozinha" target="_blank" rel="noopener">Ver cozinha</a></div>` : '')
      + `<div class="kpis">
          ${kpi('Vendas hoje', `<span data-contar="${h.vendas}" data-formato="real">${real(h.vendas)}</span>`, comparacao, { icone: 'caixa', tom: 'destaque' })}
          ${kpi('Pedidos hoje', `<span data-contar="${h.pedidos}">${h.pedidos}</span>`, h.contas ? `${h.contas} ${h.contas === 1 ? 'conta fechada' : 'contas fechadas'} · ticket ${real(h.ticket_medio)}` : 'Nenhuma conta fechada ainda', { icone: 'sacola' })}
          ${kpi('Mesas ocupadas', `${r.salao.ocupadas}<small> de ${r.salao.mesas}</small>`, r.salao.em_aberto ? `${real(r.salao.em_aberto)} em contas abertas` : 'Nenhuma conta aberta', { icone: 'mesa' })}
          ${kpi('Avaliação', r.avaliacao.media !== null ? `${String(r.avaliacao.media).replace('.', ',')}<small> de 5</small>` : '—', r.avaliacao.total ? `${r.avaliacao.total} avaliações nos últimos 7 dias` : 'Sem avaliações nos últimos 7 dias', { icone: 'estrela' })}
        </div>
        <div class="paineis paineis-inicio">
          <div class="painel largo-2"><h3>Movimento de hoje</h3><p>Pedidos feitos em cada hora. A barra forte é a hora atual.</p>
            ${graficoBarras(visiveis, { altura: 160, rotulo: d => d.h + 'h', valor: d => d.v, formatar: v => v + (v === 1 ? ' pedido' : ' pedidos'), destaque: d => d.h === hora })}</div>
          <div class="painel"><h3>Agora na cozinha</h3><p>Atualiza sozinho.</p>
            <div class="trio"><div><b>${c.recebido}</b><span>Novos</span></div><div class="amarelo"><b>${c.preparo}</b><span>Em preparo</span></div><div class="verde"><b>${c.pronto}</b><span>Prontos</span></div></div>
            <div class="mini-linha">${icone('tablet', 16, 2)} ${r.tablets.ativos ? `${r.tablets.online} de ${r.tablets.ativos} tablets online` : 'Nenhum tablet ativado'}<button class="link" data-ir="dispositivos">Ver tablets</button></div></div>
          <div class="painel largo"><h3>Últimos pedidos</h3>
            ${r.ultimos.length ? `<ul class="lista-pedidos">${r.ultimos.map(o => `<li><b>${esc(o.mesa)}</b><span class="sutil">Pedido ${o.numero} · há ${tempo(segundosDesde(o.created_at))}</span><span class="chip ${STATUS_PEDIDO[o.status]?.[1] || ''}">${STATUS_PEDIDO[o.status]?.[0] || o.status}</span><span class="preco">${real(o.total)}</span></li>`).join('')}</ul>`
              : `<div class="vazio-mini">${icone('cardapio', 28, 2)}<span>Os pedidos feitos nos tablets aparecem aqui.</span></div>`}</div>
        </div>`;
    main().onclick = e => { const ir = e.target.closest('[data-ir]'); if (ir) mudarAba(ir.dataset.ir); };
  }

  /* ------------------------------------------------------------ VISÃO GERAL DA PLATAFORMA */
  async function visao() {
    let r;
    try { r = await api('/api/plataforma/resumo'); } catch (er) { return falhou(er); }
    if (aba !== 'visao') return;
    const sv = r.servicos, rs = r.restaurantes;
    const servico = (ok, nome, okTxt, faltaTxt) => `<li class="${ok ? 'ok' : 'falta'}"><span class="sv-ponto">${icone(ok ? 'check' : 'alerta', 14, 3)}</span><div><b>${nome}</b><small>${ok ? okTxt : faltaTxt}</small></div></li>`;
    const dm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
    const etapas = t => `<span class="etapas" title="Mesas, cardápio e tablets">${['Mesas', 'Cardápio', 'Tablets'].map((n, i) => `<i class="${[t.mesas, t.produtos, t.tablets][i] > 0 ? 'on' : ''}">${n}</i>`).join('')}</span>`;
    const desde = t => new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR');
    const pendencias = [];
    if (!sv.volume) pendencias.push(['vermelho', 'alerta', '<b>Sem volume no Railway.</b> Os dados serão apagados no próximo deploy.', '']);
    if (r.erros_abertos) pendencias.push(['vermelho', 'alerta', `<b>${r.erros_abertos} ${r.erros_abertos === 1 ? 'erro novo' : 'erros novos'}</b> registrados no sistema.`, 'erros']);
    if (r.sugestoes_novas) pendencias.push(['amarelo', 'balao', `<b>${r.sugestoes_novas} ${r.sugestoes_novas === 1 ? 'sugestão nova' : 'sugestões novas'}</b> dos restaurantes.`, 'sugestoes']);
    main().innerHTML = cabecalho('Visão geral', `<span class="data-hoje">${hojePorExtenso()}</span> · cadastros, uso e saúde do sistema`, `<button class="btn btn-azul" data-ir="estabelecimentos">${icone('mais', 18, 3)} Novo estabelecimento</button>`)
      + pendencias.map(([tom, ic, txt, ir]) => `<div class="alerta-linha ${tom}">${icone(ic, 20, 2)}<span>${txt}</span>${ir ? `<button class="btn btn-p btn-borda" data-ir="${ir}">Ver</button>` : ''}</div>`).join('')
      + `<div class="kpis">
          ${kpi('Restaurantes ativos', rs.ativos, `${rs.em_uso} em uso · ${rs.configurando} configurando${rs.bloqueados ? ` · ${rs.bloqueados} bloqueados` : ''}`, { icone: 'loja', tom: 'destaque' })}
          ${kpi('Novos cadastros', r.cadastros.d7, `nos últimos 7 dias · ${r.cadastros.d30} em 30 dias`, { icone: 'mais' })}
          ${kpi('Pessoas com acesso', r.usuarios.total, `donos, gerentes, caixas e cozinha · ${r.usuarios.google} entram com Google`, { icone: 'pessoas' })}
          ${kpi('Tablets ativados', r.tablets_ativados, 'Em todos os restaurantes', { icone: 'tablet' })}
        </div>
        <div class="paineis paineis-inicio">
          <div class="painel largo-2"><h3>Cadastros por dia</h3><p>Restaurantes criados nos últimos 30 dias.</p>
            ${graficoBarras(r.cadastros_por_dia, { altura: 160, rotulo: d => dm(d.dia), valor: d => d.n, formatar: v => v + (v === 1 ? ' cadastro' : ' cadastros') })}</div>
          <div class="painel"><h3>Serviços</h3><p>O que está ligado no servidor.</p>
            <ul class="servicos">
              ${servico(sv.volume, 'Volume de dados', 'Banco e fotos guardados com segurança', 'Adicione um volume em /data no Railway')}
              ${servico(sv.email, 'E-mail (Brevo)', 'Boas-vindas, senha e backup por e-mail', 'Configure BREVO_API_KEY e EMAIL_REMETENTE')}
              ${servico(sv.google, 'Login com Google', 'Botão "Entrar com Google" ativo', 'Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET')}
              ${servico(!!sv.backup, 'Backup diário', sv.backup ? 'Último: ' + dataHora(sv.backup) : '', 'Ainda não foi feito')}
              ${servico(sv.cadastro, 'Cadastro aberto', 'Restaurantes podem criar conta sozinhos', 'Só você cadastra restaurantes')}
            </ul></div>
          <div class="painel"><h3>Precisam de ajuda</h3><p>Criaram a conta há mais de 2 dias e ainda não terminaram de configurar.</p>
            ${r.precisam_ajuda.length ? `<ul class="lista-ajuda">${r.precisam_ajuda.map(t => `<li><div><b>${esc(t.nome)}</b>${etapas(t)}</div>${t.dono_email ? `<a class="btn btn-p btn-borda" href="mailto:${esc(t.dono_email)}?subject=${encodeURIComponent('Precisa de ajuda com o Deu Fome?')}">${icone('balao', 14, 2)} Falar</a>` : ''}</li>`).join('')}</ul>`
              : `<div class="vazio-mini">${icone('check', 24, 2.5)}<span>Ninguém parado na configuração.</span></div>`}</div>
          <div class="painel largo-2"><h3>Cadastros recentes</h3><p>Os últimos restaurantes e o que cada um já configurou.</p>
            ${r.recentes.length ? `<ul class="lista-restaurantes">${r.recentes.map(t => {
              const prontos = [t.mesas > 0, t.produtos > 0, t.tablets > 0].filter(Boolean).length;
              return `<li><div><b>${esc(t.nome)}</b><small class="sutil">${esc(t.dono_email || '—')} · desde ${desde(t)}${t.ultimo_sinal ? ' · tablet visto há ' + tempo(segundosDesde(t.ultimo_sinal)) : ''}</small></div>
                ${etapas(t)}
                ${t.status !== 'ativo' ? '<span class="chip vermelho">Bloqueado</span>' : prontos === 3 ? '<span class="chip verde">Em uso</span>' : '<span class="chip amarelo">Configurando</span>'}</li>`;
            }).join('')}</ul>` : `<div class="vazio-mini">${icone('loja', 28, 2)}<span>Nenhum restaurante ainda.</span></div>`}</div>
        </div>`;
    main().onclick = e => {
      const ir = e.target.closest('[data-ir]'); if (!ir) return;
      mudarAba(ir.dataset.ir);
      if (ir.textContent.includes('Novo estabelecimento')) setTimeout(() => main().querySelector('#novo')?.click(), 400);
    };
  }

  /* ------------------------------------------------------------ PLATAFORMA */
  async function estabelecimentos() {
    let r;
    try { r = await api('/api/plataforma/estabelecimentos'); } catch (er) { return falhou(er); }
    main().innerHTML = cabecalho('Estabelecimentos', `${r.estabelecimentos.length} cadastrados`, `<a class="btn btn-borda" href="/api/plataforma/backup" download>Baixar backup</a><button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Novo estabelecimento</button>`)
      + (r.sem_volume ? `<div class="aviso perigo"><b>Atenção:</b> o serviço no Railway está sem volume. Os dados serão apagados no próximo deploy. Adicione um volume (veja o LEIA-ME).</div>` : '')
      + (r.estabelecimentos.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Estabelecimento</th><th>Responsável</th><th>Mesas</th><th>Tablets</th><th>Pedidos 30 dias</th><th>Recebido 30 dias</th><th>Situação</th><th></th></tr></thead><tbody>
        ${r.estabelecimentos.map(t => `<tr>
          <td><b>${esc(t.nome)}</b><br><small class="sutil">desde ${new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}</small></td>
          <td>${esc(t.dono_email || '—')}</td><td>${t.mesas}</td><td>${t.tablets}</td><td>${t.pedidos_30d}</td><td>${real(t.faturado_30d)}</td>
          <td>${t.status === 'ativo' ? '<span class="chip verde">Ativo</span>' : '<span class="chip vermelho">Bloqueado</span>'}</td>
          <td><div class="acoes">${t.status === 'ativo' ? `<button class="btn btn-p btn-perigo" data-status="bloqueado" data-id="${t.id}">Bloquear</button>` : `<button class="btn btn-p btn-claro" data-status="ativo" data-id="${t.id}">Desbloquear</button>`}</div></td>
        </tr>`).join('')}</tbody></table></div>` : `<div class="vazio-painel"><b>Nenhum estabelecimento ainda.</b><span>Cadastre o primeiro restaurante e envie ao responsável o e-mail e a senha de acesso.</span></div>`);
    main().querySelector('#novo').onclick = novoEstabelecimento;
    main().onclick = async e => {
      const b = e.target.closest('[data-status]'); if (!b) return;
      if (b.dataset.status === 'bloqueado' && !confirm('Bloquear este estabelecimento? Os tablets e o painel dele param de funcionar na hora.')) return;
      try { await api(`/api/plataforma/estabelecimentos/${b.dataset.id}`, { metodo: 'POST', dados: { status: b.dataset.status } }); toast(b.dataset.status === 'ativo' ? 'Estabelecimento desbloqueado.' : 'Estabelecimento bloqueado.'); estabelecimentos(); }
      catch (er) { falhou(er); }
    };
  }

  function novoEstabelecimento() {
    formulario('Novo estabelecimento', `
      <label class="campo">Nome do estabelecimento<input name="nome" required maxlength="60" placeholder="Pizzaria do Centro"></label>
      <div class="dupla"><label class="campo">Nome do responsável<input name="dono_nome" required maxlength="60"></label>
      <label class="campo">E-mail de acesso<input name="dono_email" type="email" required></label></div>
      <div class="dupla"><label class="campo">Senha inicial<input name="dono_senha" type="text" required minlength="8" placeholder="mínimo 8 caracteres" autocomplete="off"></label>
      <label class="campo">PIN dos tablets<input name="pin" inputmode="numeric" pattern="\\d{4}" maxlength="4" required placeholder="4 números"></label></div>
      <label class="campo">Quantidade de mesas<input name="mesas" type="number" min="0" max="200" value="10"></label>`, {
      enviar: 'Cadastrar',
      aoEnviar: async d => { await api('/api/plataforma/estabelecimentos', { metodo: 'POST', dados: { ...d, mesas: Number(d.mesas || 0) } }); toast('Estabelecimento cadastrado.'); estabelecimentos(); },
    });
  }

  /* ------------------------------------------------------------ SALÃO */
  let vistaSalao = 'mapa', editandoMapa = false;
  try { vistaSalao = localStorage.getItem('deufome_salao_vista') || 'mapa'; } catch {}

  /** Posição padrão para mesas que ainda não foram arrumadas no mapa. */
  function posicoesPadrao(lista) {
    const semPos = lista.filter(m => m.pos_x == null || m.pos_y == null);
    const colunas = Math.max(3, Math.ceil(Math.sqrt(lista.length * 1.6)));
    const linhas = Math.ceil(lista.length / colunas);
    return Object.fromEntries(semPos.map(m => {
      const i = lista.indexOf(m);
      return [m.id, { x: Math.round((i % colunas + .5) / colunas * 1000), y: Math.round((Math.floor(i / colunas) + .5) / Math.max(1, linhas) * 1000) }];
    }));
  }

  function estadoMesa(m) {
    const s = m.sessao;
    if (!s) return ['livre', 'Livre'];
    if (s.status === 'conta_solicitada') return s.pagar_com === 'pix' ? ['pix', 'Pagando no Pix'] : ['conta', 'Pediu a conta'];
    if (s.atrasado) return ['atrasada', 'Pedido atrasado'];
    return ['ocupada', 'Em atendimento'];
  }

  async function salao(aoVivo) {
    if (aoVivo && editandoMapa) return;
    let r;
    try { r = await api('/api/salao/mesas'); } catch (er) { return falhou(er); }
    if (aba !== 'salao') return;
    const gestor = ['dono', 'gerente'].includes(eu.papel);
    const chamados = r.mesas.flatMap(m => m.chamados.map(c => ({ ...c, mesa: m })));
    const ocupadas = r.mesas.filter(m => m.sessao).length;
    const emAberto = r.mesas.reduce((s, m) => s + (m.sessao?.total || 0), 0);
    const padrao = posicoesPadrao(r.mesas);
    const pos = m => m.pos_x != null && m.pos_y != null ? { x: m.pos_x, y: m.pos_y } : padrao[m.id];
    const contagem = r.mesas.reduce((o, m) => { const k = estadoMesa(m)[0]; o[k] = (o[k] || 0) + 1; return o; }, {});
    const legenda = [['livre', 'Livres'], ['ocupada', 'Em atendimento'], ['conta', 'Pediram a conta'], ['pix', 'Pagando no Pix'], ['atrasada', 'Com atraso']];
    main().innerHTML = cabecalho('Salão e contas', `${ocupadas} de ${r.mesas.length} mesas ocupadas${emAberto ? ` · ${real(emAberto)} em contas abertas` : ''}`,
      r.mesas.length ? `<div class="segmentado" role="tablist"><button data-vista="mapa" class="${vistaSalao === 'mapa' ? 'marcado' : ''}">${icone('mapa', 16, 2)} Mapa</button><button data-vista="lista" class="${vistaSalao === 'lista' ? 'marcado' : ''}">${icone('grade', 16, 2)} Cartões</button></div>${gestor && vistaSalao === 'mapa' ? `<button class="btn btn-borda" id="editarMapa">${icone('mover', 18, 2)} Arrumar mapa</button>` : ''}` : '')
      + (chamados.length ? `<div class="chamados"><b style="margin-right:6px">${icone('sino', 20)} Chamados</b>${chamados.map(c => `
        <span class="chip ${c.tipo === 'conta' ? 'vermelho' : 'amarelo'}">${esc(c.mesa.nome)}: ${c.tipo === 'conta' ? (c.mesa.sessao?.pagar_com === 'pix' ? 'vai pagar no Pix' : 'pediu a conta') : 'chamou o garçom'}, há ${tempo(segundosDesde(c.created_at))}</span>
        ${c.tipo === 'garcom' ? `<button class="btn btn-p btn-claro" data-atender="${c.id}">Atendido</button>` : `<button class="btn btn-p btn-marinho" data-comanda="${c.mesa.sessao?.id || ''}">Abrir comanda</button>`}`).join('')}</div>` : '')
      + (!r.mesas.length ? `<div class="vazio-painel"><b>Nenhuma mesa cadastrada.</b><span>${gestor ? 'Cadastre as mesas e depois arrume o mapa do salão aqui.' : 'Peça ao gerente para cadastrar as mesas.'}</span>${gestor ? `<button class="btn btn-azul" data-ir="mesas">${icone('mais', 18, 3)} Cadastrar mesas</button>` : ''}</div>`
        : vistaSalao === 'mapa' ? `<div class="legenda-salao">${legenda.filter(([k]) => contagem[k] || k === 'livre' || k === 'ocupada').map(([k, n]) => `<span class="lg ${k}"><i></i>${n} <b>${contagem[k] || 0}</b></span>`).join('')}</div>
          <div class="mapa-salao" id="mapaSalao">${r.mesas.map(m => {
            const [est, rot] = estadoMesa(m), p = pos(m), s = m.sessao;
            return `<button class="mesa-pin ${est} ${m.formato || 'quadrada'}" data-mesa-id="${m.id}" ${s ? `data-comanda="${s.id}"` : ''} style="left:${p.x / 10}%;top:${p.y / 10}%" title="${esc(m.nome)}: ${rot}">
              <span class="cadeiras" style="--n:${Math.min(8, m.lugares || 4)}">${Array.from({ length: Math.min(8, m.lugares || 4) }, (_, i) => `<i style="--k:${i}"></i>`).join('')}</span>
              <span class="tampo"><b>${esc(m.nome.replace(/^Mesa\s*/i, ''))}</b>${s ? `<small>${real(s.total)}</small>` : '<small>livre</small>'}</span>
              ${m.chamados.length ? `<span class="pin-alerta">${icone('sino', 14, 2.6)}</span>` : ''}
              ${m.tablet && !m.tablet.online ? '<span class="pin-off" title="Tablet offline"></span>' : ''}
            </button>`;
          }).join('')}</div>
          <p class="sutil dica-mapa">Toque numa mesa ocupada para abrir a comanda.${gestor ? ' Use "Arrumar mapa" para deixar as mesas na posição do seu salão.' : ''}</p>`
        : `<div class="mapa">${r.mesas.map(m => {
        const s = m.sessao, [est] = estadoMesa(m);
        const cls = !s ? '' : est === 'conta' || est === 'pix' ? 'conta' : 'ocupada';
        return `<button class="mesa-card ${cls}" ${s ? `data-comanda="${s.id}"` : 'disabled'}>
          <h3>${esc(m.nome)}</h3>
          ${s ? `<span class="valor">${real(s.total)}</span><span class="sutil" style="font-size:14px">aberta há ${tempo(segundosDesde(s.aberta_em))}</span>` : '<span class="sutil">Livre</span>'}
          <div class="rodape">
            ${est === 'pix' ? '<span class="chip vermelho">Pagando no Pix</span>' : est === 'conta' ? '<span class="chip vermelho">Conta pedida</span>' : est === 'atrasada' ? '<span class="chip amarelo">Pedido atrasado</span>' : s ? '<span class="chip">Em atendimento</span>' : ''}
            ${m.tablet ? `<span class="chip ${m.tablet.online ? 'verde' : 'cinza'}"><span class="ponto"></span>${esc(m.tablet.nome)}</span>` : '<span class="chip cinza">Sem tablet</span>'}
          </div></button>`;
      }).join('')}</div>`);
    main().onclick = async e => {
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const v = e.target.closest('[data-vista]');
      if (v) { vistaSalao = v.dataset.vista; try { localStorage.setItem('deufome_salao_vista', vistaSalao); } catch {} return salao(); }
      if (e.target.closest('#editarMapa')) return editarMapa(r.mesas, pos);
      const at = e.target.closest('[data-atender]');
      if (at) { try { await api(`/api/salao/chamados/${at.dataset.atender}/atender`, { metodo: 'POST' }); } catch (er) { falhou(er); } return salao(); }
      const c = e.target.closest('[data-comanda]');
      if (c && c.dataset.comanda) abrirComanda(c.dataset.comanda);
      else if (e.target.closest('.mesa-pin.livre')) toast('Mesa livre. A comanda abre sozinha quando o tablet fizer o primeiro pedido.');
    };
  }

  /** Arrastar as mesas para a posição real do salão. */
  function editarMapa(lista, pos) {
    editandoMapa = true;
    const mapa = main().querySelector('#mapaSalao');
    const posicoes = Object.fromEntries(lista.map(m => [m.id, { ...pos(m) }]));
    mapa.classList.add('editando');
    main().querySelector('.acoes-topo').innerHTML = `<button class="btn btn-borda" id="organizar">${icone('grade', 18, 2)} Organizar em grade</button><button class="btn btn-borda" id="cancelarMapa">Cancelar</button><button class="btn btn-azul" id="salvarMapa">${icone('check', 18, 3)} Salvar mapa</button>`;
    main().querySelector('.dica-mapa').innerHTML = `${icone('mover', 16, 2)} Arraste cada mesa para o lugar dela no salão e toque em <b>Salvar mapa</b>.`;
    main().querySelector('.dica-mapa').classList.add('destaque');
    let arrastando = null;
    mapa.addEventListener('pointerdown', e => {
      const pin = e.target.closest('.mesa-pin'); if (!pin) return;
      e.preventDefault();
      arrastando = pin; pin.setPointerCapture(e.pointerId); pin.classList.add('arrastando');
    });
    mapa.addEventListener('pointermove', e => {
      if (!arrastando) return;
      const r = mapa.getBoundingClientRect();
      const x = Math.max(40, Math.min(960, Math.round((e.clientX - r.left) / r.width * 1000)));
      const y = Math.max(60, Math.min(940, Math.round((e.clientY - r.top) / r.height * 1000)));
      posicoes[arrastando.dataset.mesaId] = { x, y };
      arrastando.style.left = x / 10 + '%'; arrastando.style.top = y / 10 + '%';
    });
    const soltar = () => { arrastando?.classList.remove('arrastando'); arrastando = null; };
    mapa.addEventListener('pointerup', soltar); mapa.addEventListener('pointercancel', soltar);
    mapa.addEventListener('click', e => { e.stopPropagation(); }, true);
    const sair = () => { editandoMapa = false; salao(); };
    main().querySelector('#cancelarMapa').onclick = sair;
    main().querySelector('#organizar').onclick = () => {
      const grade = posicoesPadrao(lista.map(m => ({ ...m, pos_x: null, pos_y: null })));
      for (const m of lista) { posicoes[m.id] = grade[m.id]; const el = mapa.querySelector(`[data-mesa-id="${m.id}"]`); el.style.left = grade[m.id].x / 10 + '%'; el.style.top = grade[m.id].y / 10 + '%'; }
    };
    main().querySelector('#salvarMapa').onclick = async ev => {
      ev.currentTarget.disabled = true;
      try { await api('/api/mesas/mapa', { metodo: 'POST', dados: { posicoes: Object.entries(posicoes).map(([id, p]) => ({ id: Number(id), x: p.x, y: p.y })) } }); toast('Mapa do salão salvo.'); sair(); }
      catch (er) { falhou(er); ev.currentTarget.disabled = false; }
    };
  }

  function textoConta(r, extra = '') {
    const s = r.sessao;
    const linhas = r.pedidos.filter(p => p.status !== 'cancelado').flatMap(p => p.itens).map(i => `<div class="l"><span>${i.quantidade}x ${esc(i.nome)}</span><span>${real(i.subtotal)}</span></div>${i.adicionais.length ? `<div class="add">+ ${esc(i.adicionais.map(a => a.nome).join(', '))}</div>` : ''}`).join('');
    return `<h1>${esc(r.estabelecimento)}</h1><div class="c">${esc(r.mesa || '')} · ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div><hr>${linhas}<hr>${extra}<div class="c" style="margin-top:3mm">${esc(r.impressao?.rodape || 'Obrigado pela preferência!')}</div>${[r.impressao?.endereco, r.impressao?.telefone, r.impressao?.instagram ? '@' + r.impressao.instagram : ''].filter(Boolean).map(t => `<div class="c">${esc(t)}</div>`).join('')}`;
  }

  async function abrirComanda(id) {
    let r = null, cobrarTaxa = true, pessoas = 1, pagamentos = [], recebido = {};
    const m = modal('<div class="comanda"><div class="corpo">Carregando…</div></div>', { aoFechar: () => aba === 'salao' && salao() });
    const contas = () => {
      const sub = r.total, taxa = cobrarTaxa && r.taxa_servico > 0 ? Math.round(sub * r.taxa_servico / 100) : 0;
      const desconto = r.conta?.desconto || 0, gorjeta = r.conta?.gorjeta || 0;
      return { sub, taxa, desconto, gorjeta, total: sub - desconto + taxa + gorjeta };
    };
    const lerPagamentos = () => {
      m.el.querySelectorAll('.pagamento').forEach((l, i) => {
        pagamentos[i].forma = l.querySelector('select').value;
        pagamentos[i].valor = paraCentavos(l.querySelector('[data-valor]').value) ?? 0;
        const rc = l.querySelector('[data-recebido]'); if (rc) recebido[i] = rc.value;
      });
    };
    function pintarPagamentos() {
      const { total } = contas();
      const soma = pagamentos.reduce((a, p) => a + (p.valor || 0), 0);
      const resta = total - soma;
      const ok = resta === 0 && pagamentos.every(p => p.forma && p.valor > 0);
      m.el.querySelector('#pagamentos').innerHTML = pagamentos.map((p, i) => {
        const rc = paraCentavos(recebido[i] || '');
        const troco = p.forma === 'dinheiro' && rc !== null && rc > p.valor ? rc - p.valor : null;
        return `<div class="pagamento" data-i="${i}">
          <select aria-label="Forma de pagamento"><option value="">Forma…</option>${['pix', 'dinheiro', 'credito', 'debito'].map(f => `<option value="${f}" ${p.forma === f ? 'selected' : ''}>${FORMAS[f]}</option>`).join('')}</select>
          <input data-valor inputmode="decimal" value="${paraReais(p.valor || 0)}" aria-label="Valor">
          <button class="btn btn-p btn-perigo" data-tirar-pg="${i}" ${pagamentos.length === 1 ? 'disabled' : ''} aria-label="Remover pagamento">${icone('lixo', 16)}</button>
          ${p.forma === 'dinheiro' ? `<div class="troco">Recebido R$ <input data-recebido inputmode="decimal" value="${esc(recebido[i] || '')}" placeholder="0,00"><b data-troco>${troco !== null ? `Troco: ${real(troco)}` : ''}</b></div>` : ''}
        </div>`;
      }).join('');
      m.el.querySelector('#restante').className = 'restante ' + (resta === 0 ? 'ok' : 'falta');
      m.el.querySelector('#restante').textContent = resta === 0 ? 'Pagamentos conferem com o total.' : resta > 0 ? `Faltam ${real(resta)}` : `Passou ${real(-resta)} do total`;
      m.el.querySelector('#fechar').disabled = !ok;
    }
    function pintarTotais() {
      const { sub, taxa, desconto, gorjeta, total } = contas();
      const cp = r.conta?.cupom, aberta = r.sessao.status !== 'fechada';
      m.el.querySelector('#totais').innerHTML = `<div><span>Consumo</span><b>${real(sub)}</b></div>
        ${cp ? `<div class="linha-cupom"><span>${icone('cupom', 16, 2.2)} Cupom <b>${esc(cp.codigo)}</b> <small class="sutil">${esc(cp.descricao)}</small>${aberta ? ' <button class="link" id="tirarCupom">remover</button>' : ''}</span><b class="verde">${desconto ? '− ' + real(desconto) : 'não se aplica'}</b></div>`
          : aberta ? `<div class="linha-cupom"><span class="cupom-campo"><input id="codCupom" placeholder="Código do cupom" maxlength="20" aria-label="Código do cupom"><button class="btn btn-p btn-borda" id="aplicarCupom">Aplicar</button></span></div>` : ''}
        ${gorjeta ? `<div><span>Gorjeta escolhida no tablet (${r.conta.gorjeta_pct}%)</span><b>${real(gorjeta)}</b></div>` : ''}
        ${r.taxa_servico > 0 ? `<div><label class="liga"><input type="checkbox" id="taxa" ${cobrarTaxa ? 'checked' : ''}> Taxa de serviço (${r.taxa_servico}%)</label><b>${real(taxa)}</b></div>` : ''}
        <div class="grande"><span>Total</span><strong>${real(total)}</strong></div>
        ${pessoas > 1 ? `<div class="sutil"><span>${pessoas} pessoas</span><b>${real(Math.ceil(total / pessoas))} cada</b></div>` : ''}`;
    }
    async function carregar() {
      try { r = await api(`/api/salao/sessoes/${id}`); } catch (er) { m.fechar(); return falhou(er); }
      const s = r.sessao, aberta = s.status !== 'fechada';
      if (!aberta) cobrarTaxa = !!s.taxa;
      if (r.conta?.pagar_com === 'pix') cobrarTaxa = true;
      pagamentos = [{ forma: r.conta?.pagar_com === 'pix' ? 'pix' : '', valor: contas().total }];
      const a = r.avaliacao;
      m.el.querySelector('.corpo').innerHTML = `
        <div class="modal-cab"><h2>Comanda · ${esc(r.mesa || '')}</h2><button class="btn btn-claro btn-p" data-fechar aria-label="Fechar">${icone('x', 18, 3)}</button></div>
        <p class="sutil" style="margin:6px 0 0">Aberta há ${tempo(segundosDesde(s.aberta_em))}${s.status === 'conta_solicitada' ? ' · <b style="color:var(--tomate)">conta solicitada</b>' : ''}</p>
        ${r.conta?.pagar_com === 'pix' && aberta ? `<div class="aviso-pix">${icone('qr', 20, 2.2)}<span><b>O cliente gerou um Pix de ${real(r.conta.total)}${r.conta.gorjeta ? ` (com ${r.conta.gorjeta_pct}% de gorjeta)` : ''}.</b> Confira o comprovante e confirme o pagamento abaixo.</span></div>` : ''}
        ${a ? `<p style="margin:8px 0 0">${estrelas(a.nota)} ${a.tags.map(t => `<span class="chip cinza">${esc(t)}</span>`).join(' ')}${a.comentario ? `<br><i class="sutil">"${esc(a.comentario)}"</i>` : ''}</p>` : ''}
        ${r.pedidos.map(p => `<div class="pedido ${p.status === 'cancelado' ? 'cancelado' : ''}">
          <div class="cab"><b>Pedido ${p.numero}</b><span><span class="chip ${p.status === 'pronto' ? 'verde' : p.status === 'preparo' ? 'amarelo' : p.status === 'cancelado' ? 'vermelho' : 'cinza'}">${{ recebido: 'Recebido', preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' }[p.status]}</span>
          ${aberta && p.status !== 'cancelado' ? `<button class="btn btn-p btn-perigo" data-cancelar="${p.id}" style="margin-left:6px">Cancelar</button>` : ''}</span></div>
          ${p.itens.map(i => `<div class="it"><span>${i.quantidade}× ${esc(i.nome)}${i.adicionais.length ? ' (+ ' + esc(i.adicionais.map(a => a.nome).join(', ')) + ')' : ''}${i.observacao ? ' · ' + esc(i.observacao) : ''}</span><span>${real(i.subtotal)}</span></div>`).join('')}
        </div>`).join('') || '<p>Nenhum pedido.</p>'}
        <div class="contas-linhas" id="totais"></div>
        ${aberta ? `<div class="divisao">Dividir entre <input type="number" id="pessoas" min="1" max="50" value="${pessoas}" aria-label="Número de pessoas"> pessoas <button class="btn btn-p btn-borda" id="igual">Dividir igualmente</button></div>
          <h3 style="margin-top:18px">Pagamentos</h3>
          <div class="pagamentos" id="pagamentos"></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><button class="btn btn-p btn-borda" id="maisPg">${icone('mais', 16, 3)} Outro pagamento</button><span id="restante" class="restante"></span></div>
          <div class="form-acoes">
            <button class="btn btn-borda" id="preConta">${icone('impressora', 18, 2)} Imprimir conta</button>
            ${s.status === 'conta_solicitada' ? '<button class="btn btn-borda" id="reabrir">Reabrir para pedidos</button>' : ''}
            <span style="flex:1"></span>
            <button class="btn btn-sucesso" id="fechar" disabled>${icone('check', 20, 3)} Receber e liberar mesa</button>
          </div>` : `<div class="form-acoes"><span class="chip verde">Conta fechada</span><span style="flex:1"></span><button class="btn btn-borda" id="preConta">${icone('impressora', 18, 2)} Imprimir</button></div>`}`;
      pintarTotais();
      if (aberta) pintarPagamentos();
    }
    m.el.addEventListener('input', e => {
      if (e.target.id === 'pessoas') { pessoas = Math.max(1, Math.min(50, Number(e.target.value) || 1)); pintarTotais(); }
      if (e.target.matches('[data-valor], [data-recebido]')) {
        lerPagamentos();
        m.el.querySelectorAll('.pagamento').forEach((l, i) => {
          const t = l.querySelector('[data-troco]'); if (!t) return;
          const rc = paraCentavos(recebido[i] || '');
          t.textContent = rc !== null && rc > pagamentos[i].valor ? `Troco: ${real(rc - pagamentos[i].valor)}` : '';
        });
        const { total } = contas(), soma = pagamentos.reduce((a, p) => a + (p.valor || 0), 0);
        const el = m.el.querySelector('#restante'); const resta = total - soma;
        el.className = 'restante ' + (resta === 0 ? 'ok' : 'falta');
        el.textContent = resta === 0 ? 'Pagamentos conferem com o total.' : resta > 0 ? `Faltam ${real(resta)}` : `Passou ${real(-resta)} do total`;
        m.el.querySelector('#fechar').disabled = !(resta === 0 && pagamentos.every(p => p.forma && p.valor > 0));
      }
    });
    m.el.addEventListener('change', e => {
      if (e.target.id === 'taxa') { cobrarTaxa = e.target.checked; lerPagamentos(); if (pagamentos.length === 1) pagamentos[0].valor = contas().total; pintarTotais(); pintarPagamentos(); }
      if (e.target.matches('.pagamento select') || e.target.matches('[data-valor], [data-recebido]')) { lerPagamentos(); pintarPagamentos(); }
    });
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      if (e.target.closest('#igual')) {
        lerPagamentos();
        const { total } = contas(), parte = Math.floor(total / pessoas);
        pagamentos = Array.from({ length: pessoas }, (_, i) => ({ forma: pagamentos[i]?.forma || '', valor: i === pessoas - 1 ? total - parte * (pessoas - 1) : parte }));
        recebido = {};
        return pintarPagamentos();
      }
      if (e.target.closest('#maisPg')) {
        lerPagamentos();
        const { total } = contas(), resta = Math.max(0, total - pagamentos.reduce((a, p) => a + p.valor, 0));
        pagamentos.push({ forma: '', valor: resta });
        return pintarPagamentos();
      }
      const tp = e.target.closest('[data-tirar-pg]');
      if (tp) { lerPagamentos(); pagamentos.splice(Number(tp.dataset.tirarPg), 1); recebido = {}; return pintarPagamentos(); }
      if (e.target.closest('#aplicarCupom') || e.target.closest('#tirarCupom')) {
        const codigo = e.target.closest('#tirarCupom') ? '' : m.el.querySelector('#codCupom').value.trim();
        if (e.target.closest('#aplicarCupom') && !codigo) return toast('Digite o código do cupom.', 'erro');
        try {
          const res = await api(`/api/salao/sessoes/${id}/cupom`, { metodo: 'POST', dados: { codigo } });
          r.conta = res.conta; lerPagamentos();
          if (pagamentos.length === 1) pagamentos[0].valor = contas().total;
          pintarTotais(); pintarPagamentos();
          toast(codigo ? (res.conta.desconto ? `Cupom aplicado: − ${real(res.conta.desconto)}` : 'Cupom guardado, mas a conta ainda não atingiu o mínimo.') : 'Cupom removido.');
        } catch (er) { falhou(er); }
        return;
      }
      if (e.target.closest('#preConta')) {
        const { sub, taxa, desconto, gorjeta, total } = contas();
        return imprimir(textoConta(r, `<div class="l"><span>Consumo</span><span>${real(sub)}</span></div>${desconto ? `<div class="l"><span>Cupom ${esc(r.conta.cupom.codigo)}</span><span>-${real(desconto)}</span></div>` : ''}${taxa ? `<div class="l"><span>Serviço ${r.taxa_servico}%</span><span>${real(taxa)}</span></div>` : ''}${gorjeta ? `<div class="l"><span>Gorjeta</span><span>${real(gorjeta)}</span></div>` : ''}<div class="l g"><span>TOTAL</span><span>${real(total)}</span></div>${pessoas > 1 ? `<div class="l"><span>${pessoas} pessoas</span><span>${real(Math.ceil(total / pessoas))} cada</span></div>` : ''}`));
      }
      const c = e.target.closest('[data-cancelar]');
      if (c) {
        const motivo = prompt('Motivo do cancelamento:');
        if (!motivo) return;
        try { await api(`/api/salao/pedidos/${c.dataset.cancelar}/cancelar`, { metodo: 'POST', dados: { motivo } }); carregar(); } catch (er) { falhou(er); }
      }
      if (e.target.closest('#reabrir')) { try { await api(`/api/salao/sessoes/${id}/reabrir`, { metodo: 'POST' }); carregar(); } catch (er) { falhou(er); } }
      if (e.target.closest('#fechar')) {
        lerPagamentos();
        const b = e.target.closest('#fechar'); b.disabled = true;
        try {
          const res = await api(`/api/salao/sessoes/${id}/fechar`, { metodo: 'POST', dados: { cobrar_taxa: cobrarTaxa, pessoas, pagamentos } });
          toast(`Conta de ${real(res.total)} recebida. Mesa liberada.`); m.fechar();
        } catch (er) { falhou(er); b.disabled = false; }
      }
    });
    carregar();
  }

  const estrelas = n => `<span class="estrelas" aria-label="${n} de 5 estrelas">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= n ? '' : 'apagada'}">${icone('estrela', 16, 0).replace('fill="none"', 'fill="currentColor"')}</span>`).join('')}</span>`;

  /* ------------------------------------------------------------ MESAS */
  async function mesas() {
    let r;
    try { r = await api('/api/mesas'); } catch (er) { return falhou(er); }
    const proximo = r.mesas.reduce((mx, m) => Math.max(mx, Number(m.numero)), 0) + 1;
    const lugares = r.mesas.reduce((s, m) => s + (m.lugares || 0), 0);
    main().innerHTML = cabecalho('Mesas', `${r.mesas.length} mesas · ${lugares} lugares`, `<button class="btn btn-borda" data-ir="salao">${icone('mapa', 18, 2)} Ver mapa do salão</button><button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Adicionar mesas</button>`)
      + (r.mesas.length ? `<table class="tabela"><thead><tr><th>Número</th><th>Nome</th><th>Lugares</th><th>Tablet</th><th>Situação</th><th></th></tr></thead><tbody>
        ${r.mesas.map(m => `<tr><td><b>${m.numero}</b></td><td>${esc(m.nome)}<br><small class="sutil">${{ quadrada: 'Quadrada', redonda: 'Redonda', retangular: 'Retangular' }[m.formato] || ''}</small></td><td>${m.lugares || 4}</td><td>${m.tablet ? esc(m.tablet) : '<span class="sutil">Sem tablet</span>'}</td>
          <td>${m.ocupada ? '<span class="chip">Ocupada</span>' : '<span class="chip cinza">Livre</span>'}</td>
          <td><div class="acoes"><button class="btn btn-p btn-claro" data-editar="${m.id}">Editar</button><button class="btn btn-p btn-perigo" data-remover="${m.id}">Remover</button></div></td></tr>`).join('')}
        </tbody></table>` : `<div class="vazio-painel"><b>Nenhuma mesa ainda.</b><span>Adicione as mesas e depois vincule um tablet a cada uma em Dispositivos.</span></div>`);
    main().querySelector('#novo').onclick = () => formulario('Adicionar mesas', `
      <div class="dupla"><label class="campo">Começar no número<input name="inicio" type="number" min="1" max="999" value="${proximo}" required></label>
      <label class="campo">Quantas mesas<input name="qtd" type="number" min="1" max="100" value="1" required></label></div>
      <p class="sutil" style="margin:0">Os nomes ficam no padrão "Mesa 07". Você pode renomear depois.</p>`, {
      enviar: 'Adicionar',
      aoEnviar: async d => {
        const ini = Number(d.inicio), qtd = Math.min(100, Number(d.qtd));
        let feitas = 0;
        for (let n = ini; n < ini + qtd; n++) {
          try { await api('/api/mesas', { metodo: 'POST', dados: { numero: n } }); feitas++; }
          catch (er) { if (er.status !== 409) throw er; }
        }
        toast(feitas ? `${feitas} ${feitas === 1 ? 'mesa adicionada' : 'mesas adicionadas'}.` : 'Essas mesas já existiam.');
        mesas();
      },
    });
    main().onclick = async e => {
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const ed = e.target.closest('[data-editar]');
      if (ed) {
        const m = r.mesas.find(x => x.id == ed.dataset.editar);
        formulario('Editar mesa', `<div class="dupla"><label class="campo">Número<input name="numero" type="number" min="1" max="999" value="${m.numero}" required></label>
          <label class="campo">Nome<input name="nome" maxlength="30" value="${esc(m.nome)}"></label></div>
          <div class="dupla"><label class="campo">Formato no mapa<select name="formato">${[['quadrada', 'Quadrada'], ['redonda', 'Redonda'], ['retangular', 'Retangular (comprida)']].map(([k, n]) => `<option value="${k}" ${m.formato === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <label class="campo">Lugares<input name="lugares" type="number" min="1" max="30" value="${m.lugares || 4}"></label></div>`, {
          aoEnviar: async d => { await api(`/api/mesas/${m.id}`, { metodo: 'POST', dados: { numero: Number(d.numero), nome: d.nome, formato: d.formato, lugares: Number(d.lugares) } }); toast('Mesa atualizada.'); mesas(); },
        });
      }
      const rm = e.target.closest('[data-remover]');
      if (rm && confirm('Remover esta mesa? O tablet vinculado a ela fica sem mesa.')) {
        try { await api(`/api/mesas/${rm.dataset.remover}/remover`, { metodo: 'POST' }); toast('Mesa removida.'); mesas(); } catch (er) { falhou(er); }
      }
    };
  }

  /* ------------------------------------------------------------ DISPOSITIVOS */
  async function dispositivos() {
    let r;
    try { r = await api('/api/dispositivos'); } catch (er) { return falhou(er); }
    if (aba !== 'dispositivos') return;
    const on = r.dispositivos.filter(d => d.online).length;
    const off = r.dispositivos.filter(d => d.status === 'ativo' && !d.online).length;
    const opMesas = sel => `<option value="">Sem mesa</option>` + r.mesas.map(m => `<option value="${m.id}" ${sel == m.id ? 'selected' : ''}>${esc(m.nome)}</option>`).join('');
    main().innerHTML = cabecalho('Dispositivos', `${on} online, ${off} offline, ${r.dispositivos.length} cadastrados`, `<button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Cadastrar tablet</button>`)
      + (r.pin ? '' : `<div class="aviso perigo"><b>Defina o PIN dos tablets.</b> Sem ele, ninguém consegue sair do modo quiosque no tablet. <button class="link" data-ir="ajustes">Definir agora</button></div>`)
      + `<div class="aviso">Endereço para abrir nos tablets: <b class="selecionavel">${location.origin}/tablet</b></div>`
      + (r.dispositivos.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Tablet</th><th>Mesa</th><th>Situação</th><th>Último sinal</th><th></th></tr></thead><tbody>
      ${r.dispositivos.map(d => {
        const sit = d.status === 'bloqueado' ? '<span class="chip vermelho">Bloqueado</span>'
          : d.status === 'pendente' ? '<span class="chip amarelo">Aguardando ativação</span>'
          : d.online ? '<span class="chip verde"><span class="ponto"></span>Online</span>' : '<span class="chip cinza"><span class="ponto"></span>Offline</span>';
        return `<tr>
          <td><b>${esc(d.nome)}</b>${d.ativacao ? `<div style="margin-top:4px">Código: <span class="codigo">${d.ativacao.codigo}</span><br><small class="sutil">expira em ${tempo(Math.max(0, -segundosDesde(d.ativacao.expira_em)))}</small></div>` : ''}</td>
          <td><select data-mesa="${d.id}" ${d.status === 'bloqueado' ? 'disabled' : ''}>${opMesas(d.table_id)}</select></td>
          <td>${sit}</td>
          <td class="sutil">${d.last_seen_at ? 'há ' + tempo(segundosDesde(d.last_seen_at)) : '—'}</td>
          <td><div class="acoes">
            <button class="btn btn-p btn-claro" data-cred="${d.id}">${d.status === 'bloqueado' ? 'Reativar com novo código' : 'Novo código'}</button>
            ${d.status !== 'bloqueado' ? `<button class="btn btn-p btn-perigo" data-bloq="${d.id}">Bloquear</button>` : `<button class="btn btn-p btn-borda" data-excluir="${d.id}">Excluir</button>`}
          </div></td></tr>`;
      }).join('')}</tbody></table></div>` : `<div class="vazio-painel"><b>Nenhum tablet cadastrado.</b><span>Cadastre um tablet, escolha a mesa e digite o código no aparelho, no endereço acima.</span></div>`);
    main().querySelector('#novo').onclick = () => novoDispositivo(r.mesas);
    main().onchange = async e => {
      const s = e.target.closest('[data-mesa]'); if (!s) return;
      try { await api(`/api/dispositivos/${s.dataset.mesa}/mesa`, { metodo: 'POST', dados: { mesa_id: s.value ? Number(s.value) : null } }); toast('Mesa atualizada. O tablet muda na hora.'); }
      catch (er) { falhou(er); }
      s.blur(); dispositivos();
    };
    main().onclick = async e => {
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const acao = async (url, msg) => { try { await api(url, { metodo: 'POST' }); msg && toast(msg); } catch (er) { falhou(er); } dispositivos(); };
      const c = e.target.closest('[data-cred]');
      if (c && confirm('Gerar um novo código? O tablet atual fica desconectado até digitar o novo código.')) return acao(`/api/dispositivos/${c.dataset.cred}/credencial`, 'Novo código gerado.');
      const b = e.target.closest('[data-bloq]');
      if (b && confirm('Bloquear este tablet? Ele para de funcionar na hora.')) return acao(`/api/dispositivos/${b.dataset.bloq}/bloquear`, 'Tablet bloqueado.');
      const x = e.target.closest('[data-excluir]');
      if (x && confirm('Excluir este tablet do cadastro?')) return acao(`/api/dispositivos/${x.dataset.excluir}/excluir`, 'Tablet excluído.');
    };
  }

  function novoDispositivo(listaMesas) {
    const m = formulario('Cadastrar tablet', `
      <label class="campo">Nome do tablet<input name="nome" required maxlength="40" placeholder="Tablet 05"></label>
      <label class="campo">Mesa<select name="mesa_id"><option value="">Escolher depois</option>${listaMesas.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}</select></label>`, {
      enviar: 'Gerar código',
      aoEnviar: async d => {
        const r = await api('/api/dispositivos', { metodo: 'POST', dados: { nome: d.nome, mesa_id: d.mesa_id ? Number(d.mesa_id) : null } });
        const ok = modal(`<div class="comanda"><div class="corpo" style="text-align:center">
          <h2>Código de ativação</h2>
          <p class="sutil">No tablet, abra <b class="selecionavel">${location.origin}/tablet</b> e digite:</p>
          <div class="codigo" style="font-size:52px;margin:20px 0">${r.ativacao.codigo}</div>
          <p class="sutil">Vale por 10 minutos e para um único uso.</p>
          <button type="button" class="btn btn-azul" data-ok>Pronto</button></div></div>`, { aoFechar: () => dispositivos() });
        ok.el.querySelector('[data-ok]').onclick = ok.fechar;
      },
    });
    return m;
  }

  /* ------------------------------------------------------------ CARDÁPIO */
  async function reduzirImagem(arquivo, { max: maxPx = 1200, png = false } = {}) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
      const esc_ = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * esc_); c.height = Math.round(img.naturalHeight * esc_);
      const ctx = c.getContext('2d'); if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); } ctx.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(ok => c.toBlob(ok, png ? 'image/png' : 'image/jpeg', 0.85));
    } catch { throw new Error('Não foi possível ler esta imagem. Use JPG ou PNG.'); }
    finally { URL.revokeObjectURL(url); }
  }

  async function cardapio() {
    let r;
    try { r = await api('/api/produtos'); } catch (er) { return falhou(er); }
    const cats = r.categorias;
    const total = cats.reduce((s, c) => s + c.produtos.length, 0);
    const setores = r.setores || { cozinha: 'Cozinha', bar: 'Bar' };
    const detalhes = p => [p.tamanhos.length ? `${p.tamanhos.length} tamanhos` : '', p.meio_a_meio ? 'meio a meio' : '', p.adicionais.length ? `${p.adicionais.length} ${p.adicionais.length === 1 ? 'adicional' : 'adicionais'}` : '', p.selo ? SELOS[p.selo] : ''].filter(Boolean);
    main().innerHTML = cabecalho('Cardápio', `${total} produtos em ${cats.length} categorias. As mudanças aparecem nos tablets em poucos segundos.`,
      `<button class="btn btn-azul" id="novaCat">${icone('mais', 20, 3)} Nova categoria</button>`)
      + (cats.length && !total ? `<div class="dica-guiada">${icone('raio', 20, 2.5)}<span><b>Próximo passo:</b> adicione os produtos. Use o botão <b>+ Produto</b> de cada categoria.</span></div>` : '')
      + (cats.length ? cats.map((c, ci) => `<section class="cat-bloco">
        <div class="cat-cab"><h3>${esc(c.nome)}</h3><span class="chip ${c.setor === 'bar' ? 'amarelo' : 'cinza'}" title="Onde os itens desta categoria são preparados">${icone(c.setor === 'bar' ? 'copo' : 'chef', 14, 2.2)} ${esc(setores[c.setor] || 'Cozinha')}</span><span class="sutil">${c.produtos.length} ${c.produtos.length === 1 ? 'produto' : 'produtos'}</span><span style="flex:1"></span>
          <button class="btn btn-p btn-borda" data-cat-mover="${c.id}" data-d="-1" ${ci === 0 ? 'disabled' : ''} aria-label="Subir categoria">↑</button>
          <button class="btn btn-p btn-borda" data-cat-mover="${c.id}" data-d="1" ${ci === cats.length - 1 ? 'disabled' : ''} aria-label="Descer categoria">↓</button>
          <button class="btn btn-p btn-claro" data-cat-renomear="${c.id}">Editar</button>
          <button class="btn btn-p btn-perigo" data-cat-remover="${c.id}">Apagar</button>
          <button class="btn btn-p btn-azul" data-novo-em="${c.id}">${icone('mais', 16, 3)} Produto</button></div>
        ${c.produtos.length ? `<table class="tabela"><tbody>${c.produtos.map((p, pi) => `<tr>
          <td><div class="produto-linha"><div class="mini" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"></div><div><b>${esc(p.nome)}</b>${detalhes(p).length ? `<br><small class="sutil">${esc(detalhes(p).join(' · '))}</small>` : ''}</div></div></td>
          <td style="width:150px">${p.tamanhos.length ? `<small class="sutil">a partir de</small><br><b>${real(Math.min(...p.tamanhos.map(t => t.preco)))}</b>` : `<b>${real(p.preco)}</b>`}</td>
          <td style="width:170px"><label class="liga"><button class="interruptor ${p.disponivel ? 'on' : ''}" data-disp="${p.id}" data-v="${p.disponivel ? 1 : 0}" aria-label="Disponível"></button>${p.disponivel ? 'Disponível' : 'Esgotado'}</label></td>
          <td style="width:240px"><div class="acoes">
            <button class="btn btn-p btn-borda" data-mover="${p.id}" data-d="-1" ${pi === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="btn btn-p btn-borda" data-mover="${p.id}" data-d="1" ${pi === c.produtos.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
            <button class="btn btn-p btn-claro" data-editar="${p.id}">Editar</button></div></td>
        </tr>`).join('')}</tbody></table>` : `<button class="cat-vazia" data-novo-em="${c.id}">${icone('mais', 22, 2.5)}<span><b>Adicionar o primeiro produto</b><small>Nome, preço, foto e, se quiser, tamanhos e adicionais.</small></span></button>`}
      </section>`).join('') : `<div class="vazio-painel"><b>O cardápio está vazio.</b><span>Comece criando uma categoria, como "Lanches" ou "Bebidas".</span></div>`);

    const acharProduto = id => { for (const c of cats) for (const p of c.produtos) if (p.id == id) return { ...p, categoria_id: c.id }; };
    const campoSetor = sel => `<label class="campo">Onde é preparado<select name="setor">${Object.entries(setores).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <p class="sutil" style="margin:0">Na tela da cozinha dá para mostrar só os itens da Cozinha ou só do Bar, e cada um imprime a sua parte.</p>`;
    const novaCategoria = () => formulario('Nova categoria', `<label class="campo">Nome<input name="nome" required maxlength="40" placeholder="Bebidas"></label>${campoSetor('cozinha')}`, {
      enviar: 'Criar', aoEnviar: async d => { await api('/api/categorias', { metodo: 'POST', dados: d }); toast('Categoria criada. Agora adicione os produtos.'); cardapio(); },
    });
    main().querySelector('#novaCat').onclick = novaCategoria;
    main().onclick = async e => {
      const t = e.target.closest('button'); if (!t) return;
      const post = async (url, dados) => { try { await api(url, { metodo: 'POST', dados }); cardapio(); } catch (er) { falhou(er); } };
      if (t.dataset.disp) return post(`/api/produtos/${t.dataset.disp}`, { disponivel: t.dataset.v !== '1' });
      if (t.dataset.mover) return post(`/api/produtos/${t.dataset.mover}/mover`, { direcao: Number(t.dataset.d) });
      if (t.dataset.catMover) return post(`/api/categorias/${t.dataset.catMover}/mover`, { direcao: Number(t.dataset.d) });
      if (t.dataset.editar) return editarProduto(acharProduto(t.dataset.editar), cats);
      if (t.dataset.novoEm) return editarProduto({ categoria_id: Number(t.dataset.novoEm) }, cats);
      if (t.dataset.catRenomear) {
        const c = cats.find(x => x.id == t.dataset.catRenomear);
        return formulario('Editar categoria', `<label class="campo">Nome<input name="nome" required maxlength="40" value="${esc(c.nome)}"></label>${campoSetor(c.setor)}`, {
          aoEnviar: async d => { await api(`/api/categorias/${c.id}`, { metodo: 'POST', dados: d }); cardapio(); },
        });
      }
      if (t.dataset.catRemover && confirm('Apagar esta categoria?')) return post(`/api/categorias/${t.dataset.catRemover}/remover`);
    };
  }

  function editarProduto(p, cats) {
    const novo = !p || !p.id;
    p = p || {};
    let adicionais = (p.adicionais || []).map(a => ({ ...a }));
    let tamanhos = (p.tamanhos || []).map(t => ({ nome: t.nome, precoTexto: paraReais(t.preco) }));
    let foto = null;
    const todos = cats.flatMap(c => c.produtos.map(x => ({ ...x, cat: c.nome }))).filter(x => x.id !== p.id);
    const sugeridos = p.sugestoes || [];
    const linhaAdicional = (a, i) => `<div class="adicional-linha" data-i="${i}">
      <input data-campo="nome" maxlength="60" placeholder="Nome, ex.: Bacon" value="${esc(a.nome || '')}" aria-label="Nome do adicional">
      <span class="prefixo">R$</span><input data-campo="preco" inputmode="decimal" placeholder="0,00" value="${a.preco != null ? paraReais(a.preco) : ''}" aria-label="Preço do adicional">
      <button type="button" class="btn btn-p btn-perigo" data-tirar="${i}" aria-label="Remover adicional">${icone('lixo', 16)}</button></div>`;
    const m = formulario(novo ? 'Novo produto' : 'Editar produto', `
      <div class="produto-form">
        <div class="foto-campo"><div class="previa" style="background-image:url('${esc(p.imagem || '')}')">${p.imagem ? '' : '<span>Sem foto</span>'}</div>
          <label class="btn btn-p btn-claro">${icone('mais', 16, 3)} Escolher foto<input type="file" accept="image/*" hidden id="foto"></label></div>
        <div class="form-campos">
          <label class="campo">Nome<input name="nome" required maxlength="80" value="${esc(p.nome || '')}"></label>
          <div class="dupla"><label class="campo">Categoria<select name="categoria_id">${cats.map(c => `<option value="${c.id}" ${c.id == p.categoria_id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</select></label>
          <label class="campo">Preço (R$)<input name="preco" inputmode="decimal" required placeholder="0,00" value="${p.preco != null ? paraReais(p.preco) : ''}"></label></div>
          <label class="campo">Descrição<textarea name="descricao" maxlength="300" rows="3" placeholder="Ingredientes, tamanho, porção…">${esc(p.descricao || '')}</textarea></label>
          <label class="campo">Selo no tablet<select name="selo"><option value="">Nenhum</option>${Object.entries(SELOS).map(([k, v]) => `<option value="${k}" ${p.selo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="liga"><input type="checkbox" name="disponivel" ${p.disponivel === false ? '' : 'checked'}> Disponível para pedir</label>
        </div>
      </div>
      <section class="bloco-form"><div class="bf-cab"><div><h3>Tamanhos</h3><small>Ex.: P, M e G, ou Média, Grande e Família. Com tamanhos, o cliente escolhe um antes de adicionar.</small></div><button type="button" class="btn btn-p btn-borda" id="maisTamanho">${icone('mais', 16, 3)} Tamanho</button></div>
        <div id="tamanhos"></div>
        <label class="liga"><input type="checkbox" name="meio_a_meio" ${p.meio_a_meio ? 'checked' : ''}> Pode ser meio a meio <small class="sutil">(o cliente junta dois sabores desta categoria; vale o preço do mais caro)</small></label></section>
      <section class="bloco-form"><div class="bf-cab"><div><h3>Adicionais</h3><small>Extras que o cliente pode marcar, como bacon ou borda recheada.</small></div><button type="button" class="btn btn-p btn-borda" id="maisAdicional">${icone('mais', 16, 3)} Adicional</button></div>
        <div id="adicionais"></div></section>
      <section class="bloco-form"><div class="bf-cab"><div><h3>Combina com</h3><small>Até 3 produtos sugeridos quando o cliente adicionar este. Se deixar vazio, o Deu Fome sugere sozinho pelo que mais sai junto.</small></div></div>
        <div class="dupla tripla">${[0, 1, 2].map(i => `<select name="sug${i}" aria-label="Sugestão ${i + 1}"><option value="">Automático</option>${todos.map(x => `<option value="${x.id}" ${sugeridos[i] == x.id ? 'selected' : ''}>${esc(x.nome)} (${esc(x.cat)})</option>`).join('')}</select>`).join('')}</div></section>`, {
      enviar: novo ? 'Criar produto' : 'Salvar',
      perigo: novo ? null : 'Apagar produto',
      aoEnviar: async (d, f) => {
        lerAdicionais(f);
        const preco = paraCentavos(d.preco) ?? (tamanhos.some(t => t.nome?.trim()) ? 0 : null);
        if (preco === null) throw new Error('Preço inválido.');
        const lista = [];
        for (const a of adicionais) {
          if (!a.nome?.trim() && !a.precoTexto) continue;
          const pa = paraCentavos(a.precoTexto || '0');
          if (pa === null) throw new Error(`Preço inválido no adicional "${a.nome}".`);
          lista.push({ id: a.id, nome: a.nome, preco: pa });
        }
        lerTamanhos();
        const tams = [];
        for (const t of tamanhos) {
          if (!t.nome?.trim() && !t.precoTexto) continue;
          const pt = paraCentavos(t.precoTexto || '');
          if (!t.nome?.trim()) throw new Error('Dê um nome para cada tamanho.');
          if (pt === null) throw new Error(`Preço inválido no tamanho "${t.nome}".`);
          tams.push({ nome: t.nome.trim(), preco: pt });
        }
        const sugestoes = [d.sug0, d.sug1, d.sug2].filter(Boolean).map(Number);
        const dados = { nome: d.nome, descricao: d.descricao, preco: tams.length ? Math.min(...tams.map(t => t.preco)) : preco, categoria_id: Number(d.categoria_id), disponivel: !!d.disponivel, selo: d.selo || '', adicionais: lista, tamanhos: tams, meio_a_meio: !!d.meio_a_meio, sugestoes };
        let id = p.id;
        if (novo) id = (await api('/api/produtos', { metodo: 'POST', dados })).id;
        else await api(`/api/produtos/${id}`, { metodo: 'POST', dados });
        if (foto) {
          const fd = new FormData(); fd.append('imagem', foto, 'foto.jpg');
          await api(`/api/produtos/${id}/imagem`, { metodo: 'POST', form: fd });
        }
        toast(novo ? 'Produto criado.' : 'Produto salvo.');
        cardapio();
      },
    });
    const f = m.el.querySelector('form');
    const caixa = f.querySelector('#adicionais');
    const lerAdicionais = () => {
      caixa.querySelectorAll('.adicional-linha').forEach(l => {
        const a = adicionais[l.dataset.i];
        a.nome = l.querySelector('[data-campo=nome]').value.trim();
        a.precoTexto = l.querySelector('[data-campo=preco]').value.trim();
      });
    };
    const caixaT = f.querySelector('#tamanhos');
    const lerTamanhos = () => caixaT.querySelectorAll('.adicional-linha').forEach(l => { const t = tamanhos[l.dataset.i]; t.nome = l.querySelector('[data-campo=nome]').value; t.precoTexto = l.querySelector('[data-campo=preco]').value.trim(); });
    const pintarTamanhos = () => {
      caixaT.innerHTML = tamanhos.map((t, i) => `<div class="adicional-linha" data-i="${i}"><input data-campo="nome" maxlength="20" placeholder="Nome, ex.: Grande" value="${esc(t.nome || '')}" aria-label="Nome do tamanho"><span class="prefixo">R$</span><input data-campo="preco" inputmode="decimal" placeholder="0,00" value="${esc(t.precoTexto || '')}" aria-label="Preço do tamanho"><button type="button" class="btn btn-p btn-perigo" data-tirar-t="${i}" aria-label="Remover tamanho">${icone('lixo', 16)}</button></div>`).join('') || '<p class="sutil" style="margin:0">Sem tamanhos: vale o preço acima.</p>';
      f.preco.closest('.campo').classList.toggle('apagado', tamanhos.length > 0);
      f.preco.required = !tamanhos.length;
    };
    pintarTamanhos();
    f.querySelector('#maisTamanho').onclick = () => { lerTamanhos(); tamanhos.push({ nome: ['P', 'M', 'G', 'GG', 'Família', 'Extra'][tamanhos.length] || '', precoTexto: '' }); pintarTamanhos(); caixaT.querySelector('.adicional-linha:last-child [data-campo=preco]')?.focus(); };
    caixaT.onclick = e => { const b = e.target.closest('[data-tirar-t]'); if (!b) return; lerTamanhos(); tamanhos.splice(Number(b.dataset.tirarT), 1); pintarTamanhos(); };
    const pintarAdicionais = () => { caixa.innerHTML = adicionais.map(linhaAdicional).join('') || '<p class="sutil" style="margin:0">Nenhum adicional. Ex.: bacon, queijo extra.</p>'; };
    adicionais.forEach(a => a.precoTexto = paraReais(a.preco));
    pintarAdicionais();
    f.querySelector('#maisAdicional').onclick = () => { lerAdicionais(); adicionais.push({ nome: '', preco: null }); pintarAdicionais(); caixa.querySelector('.adicional-linha:last-child input')?.focus(); };
    caixa.onclick = e => { const b = e.target.closest('[data-tirar]'); if (!b) return; lerAdicionais(); adicionais.splice(Number(b.dataset.tirar), 1); pintarAdicionais(); };
    f.querySelector('#foto').onchange = async e => {
      const arq = e.target.files[0]; if (!arq) return;
      try {
        foto = await reduzirImagem(arq);
        const prev = f.querySelector('.previa');
        prev.style.backgroundImage = `url('${URL.createObjectURL(foto)}')`; prev.innerHTML = '';
      } catch (er) { toast(er.message, 'erro'); }
    };
    f.querySelector('[data-perigo]')?.addEventListener('click', async () => {
      if (!confirm(`Apagar "${p.nome}" do cardápio?`)) return;
      try { await api(`/api/produtos/${p.id}/remover`, { metodo: 'POST' }); m.fechar(); toast('Produto apagado.'); cardapio(); } catch (er) { falhou(er); }
    });
  }

  /* ------------------------------------------------------------ EQUIPE */
  const O_QUE_VE = {
    dono: ['Tudo do restaurante', 'Relatórios, configurações e equipe', 'Pode cadastrar outros donos'],
    gerente: ['Salão, caixa e relatórios', 'Cardápio, mesas, tablets e cupons', 'Cadastra caixas e cozinha'],
    caixa: ['Salão e chamados', 'Fecha contas e recebe', 'Fechamento de caixa do dia'],
    cozinha: ['Só a tela da cozinha', 'Muda o andamento dos pedidos', 'Marca itens como esgotados'],
  };
  const COR_PAPEL = { dono: 'brasa', gerente: 'marinho', caixa: 'verde', cozinha: 'amarelo' };
  const iniciais = n => (n || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
  const quandoFoi = utc => {
    if (!utc) return 'nunca entrou';
    const s = segundosDesde(utc);
    return s < 600 ? 'ativo agora' : s < 86400 ? `há ${tempo(s)}` : s < 86400 * 2 ? 'ontem' : `há ${Math.floor(s / 86400)} dias`;
  };

  async function equipePg() {
    let r, atv = { atividade: [] };
    try { [r, atv] = await Promise.all([api('/api/equipe'), api('/api/equipe/atividade').catch(() => ({ atividade: [] }))]); } catch (er) { return falhou(er); }
    if (aba !== 'equipe') return;
    const ativos = r.equipe.filter(p => p.ativo);
    const porPapel = Object.keys(PAPEIS).map(k => [k, ativos.filter(p => p.papel === k).length]);
    main().innerHTML = cabecalho('Equipe', `${ativos.length} ${ativos.length === 1 ? 'pessoa com acesso' : 'pessoas com acesso'}. Cada uma entra com o próprio e-mail e vê só o que a função permite.`)
      + `<div class="funcoes">${porPapel.map(([k, n]) => `<div class="funcao ${COR_PAPEL[k]}"><div class="fn-cab"><b>${PAPEIS[k][0]}</b><span>${n}</span></div><ul>${O_QUE_VE[k].map(t => `<li>${icone('check', 14, 3)} ${t}</li>`).join('')}</ul></div>`).join('')}</div>
      <div class="equipe-grade">${r.equipe.map(p => {
        const souEu = p.id == r.eu;
        return `<article class="pessoa ${p.ativo ? '' : 'desativada'}">
          <div class="ps-topo"><span class="avatar ${COR_PAPEL[p.papel]}">${esc(iniciais(p.nome))}</span>
            <div class="ps-nome"><b>${esc(p.nome)}${souEu ? ' <small>(você)</small>' : ''}</b><small>${esc(p.email)}</small></div></div>
          <div class="ps-chips"><span class="chip ${p.papel === 'dono' ? '' : p.papel === 'caixa' ? 'verde' : p.papel === 'cozinha' ? 'amarelo' : 'cinza'}">${PAPEIS[p.papel]?.[0] || p.papel}</span>
            ${p.ativo ? '' : '<span class="chip vermelho">Sem acesso</span>'}${p.google ? '<span class="chip cinza">Entra com Google</span>' : ''}</div>
          <div class="ps-acesso"><span class="ponto-acesso ${p.ultimo_acesso && segundosDesde(p.ultimo_acesso) < 600 ? 'on' : ''}"></span>${quandoFoi(p.ultimo_acesso)}</div>
          <div class="ps-acoes"><button class="btn btn-p btn-claro" data-editar="${p.id}">Editar</button>
            ${souEu ? '' : `<button class="btn btn-p btn-borda" data-senha="${p.id}">${icone('cadeado', 14, 2.2)} Nova senha</button>
            <button class="btn btn-p ${p.ativo ? 'btn-perigo' : 'btn-sucesso'}" data-ativo="${p.id}" data-v="${p.ativo ? 0 : 1}">${p.ativo ? 'Tirar acesso' : 'Devolver acesso'}</button>`}</div>
        </article>`;
      }).join('')}
        <button class="pessoa nova" id="novo2">${icone('mais', 28, 2.5)}<b>Adicionar pessoa</b><small>Caixa, cozinha ou gerente</small></button></div>
      <section class="painel atividade"><h3>Atividade recente</h3><p>O que a equipe e os tablets fizeram por último.</p>
        ${atv.atividade.length ? `<ol class="linha-atividade">${atv.atividade.slice(0, 25).map(a => `<li><span class="avatar mini ${a.pessoa ? '' : 'tablet'}">${a.pessoa ? esc(iniciais(a.quem)) : icone('tablet', 14, 2.2)}</span><div><b>${esc(a.quem)}</b> ${esc(a.acao)}${a.detalhe ? ` <span class="sutil">· ${esc(a.detalhe)}</span>` : ''}<small>${dataHora(a.quando)}</small></div></li>`).join('')}</ol>`
          : `<div class="vazio-mini">${icone('pulso', 26, 2)}<span>Quando alguém fechar contas, cancelar pedidos ou mudar o cardápio, aparece aqui.</span></div>`}</section>`;
    const opcoes = sel => Object.entries(PAPEIS).filter(([k]) => k !== 'dono' || eu.papel === 'dono' || sel === 'dono').map(([k, [n, d]]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}: ${d}</option>`).join('');
    const nova = () => formulario('Adicionar pessoa', `
      <div class="dupla"><label class="campo">Nome<input name="nome" required maxlength="60"></label>
      <label class="campo">E-mail<input name="email" type="email" required></label></div>
      <label class="campo">Função<select name="papel">${opcoes('caixa')}</select></label>
      <label class="campo">Senha inicial<span class="senha-gerada"><input name="senha" type="text" required minlength="8" autocomplete="off" value="${gerarSenha()}"><button type="button" class="btn btn-p btn-borda" data-gerar>Outra</button></span></label>
      <p class="sutil" style="margin:0">Passe o e-mail e a senha para a pessoa. Ela pode trocar a senha depois em "Minha conta".</p>`, {
      enviar: 'Adicionar', aoEnviar: async d => { await api('/api/equipe', { metodo: 'POST', dados: d }); toast(`${d.nome} já pode entrar com ${d.email}.`); equipePg(); },
    });
    main().querySelector('#novo2').onclick = nova;
    main().onclick = async e => {
      const at = e.target.closest('[data-ativo]');
      if (at) {
        const p = r.equipe.find(x => x.id == at.dataset.ativo), v = at.dataset.v === '1';
        if (!v && !confirm(`Tirar o acesso de ${p.nome}? A pessoa sai do sistema na hora.`)) return;
        try { await api(`/api/equipe/${p.id}`, { metodo: 'POST', dados: { ativo: v } }); toast(v ? 'Acesso devolvido.' : 'Acesso retirado.'); equipePg(); } catch (er) { falhou(er); }
        return;
      }
      const sn = e.target.closest('[data-senha]');
      if (sn) {
        const p = r.equipe.find(x => x.id == sn.dataset.senha);
        return formulario(`Nova senha para ${esc(p.nome)}`, `<label class="campo">Nova senha<span class="senha-gerada"><input name="senha" type="text" required minlength="8" autocomplete="off" value="${gerarSenha()}"><button type="button" class="btn btn-p btn-borda" data-gerar>Outra</button></span></label>
          <p class="sutil" style="margin:0">Anote e passe para ${esc(p.nome)}. A senha antiga para de funcionar.</p>`, {
          enviar: 'Trocar senha', aoEnviar: async d => { await api(`/api/equipe/${p.id}`, { metodo: 'POST', dados: { senha: d.senha } }); toast('Senha trocada.'); },
        });
      }
      const b = e.target.closest('[data-editar]'); if (!b) return;
      const p = r.equipe.find(x => x.id == b.dataset.editar);
      const souEu = p.id == r.eu;
      formulario('Editar pessoa', `
        <label class="campo">Nome<input name="nome" required maxlength="60" value="${esc(p.nome)}"></label>
        <label class="campo">E-mail<input name="email" type="email" required value="${esc(p.email)}"></label>
        <label class="campo">Função<select name="papel" ${souEu ? 'disabled' : ''}>${opcoes(p.papel)}</select></label>
        ${souEu ? '<p class="sutil" style="margin:0">Você não pode mudar a sua própria função.</p>' : ''}`, {
        aoEnviar: async d => {
          const dados = { nome: d.nome, email: d.email };
          if (!souEu) dados.papel = d.papel;
          await api(`/api/equipe/${p.id}`, { metodo: 'POST', dados }); toast('Dados salvos.'); equipePg();
        },
      });
    };
  }

  document.addEventListener('click', e => { const g = e.target.closest('[data-gerar]'); if (g) g.previousElementSibling.value = gerarSenha(); });
  function gerarSenha() {
    const a = 'abcdefghjkmnpqrstuvwxyz', n = '23456789';
    const r = new Uint32Array(10); crypto.getRandomValues(r);
    return Array.from(r, (v, i) => (i % 4 === 3 ? n : a)[v % (i % 4 === 3 ? n.length : a.length)]).join('');
  }

  /* ------------------------------------------------------------ CUPONS */
  async function cuponsPg() {
    let r;
    try { r = await api('/api/cupons'); } catch (er) { return falhou(er); }
    if (aba !== 'cupons') return;
    const hoje = new Date().toISOString().slice(0, 10);
    const situacao = c => !c.ativo ? ['cinza', 'Pausado'] : c.validade && c.validade < hoje ? ['vermelho', 'Vencido'] : c.limite && c.usos >= c.limite ? ['vermelho', 'Esgotado'] : ['verde', 'Valendo'];
    const economia = r.cupons.reduce((s, c) => s + c.economia, 0);
    main().innerHTML = cabecalho('Cupons de desconto', 'Crie códigos para promoções. O cliente digita no tablet, ou o caixa aplica na comanda.', `<button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Novo cupom</button>`)
      + (r.cupons.length ? `<div class="kpis kpis-3">
          ${kpi('Cupons valendo', r.cupons.filter(c => situacao(c)[1] === 'Valendo').length, `${r.cupons.length} criados no total`, { icone: 'cupom', tom: 'destaque' })}
          ${kpi('Vezes usados', r.cupons.reduce((s, c) => s + c.usos, 0), 'em contas fechadas', { icone: 'conta' })}
          ${kpi('Desconto dado', real(economia), 'somando todos os cupons', { icone: 'caixa' })}</div>
        <div class="cupons">${r.cupons.map(c => {
          const [cor, txt] = situacao(c);
          return `<article class="cupom-cartao ${c.ativo ? '' : 'pausado'}">
            <div class="cc-esq"><span class="cc-valor">${c.tipo === 'percentual' ? c.valor + '%' : real(c.valor)}</span><small>de desconto</small></div>
            <div class="cc-dir"><div class="cc-topo"><b class="cc-codigo">${esc(c.codigo)}</b><span class="chip ${cor}">${txt}</span></div>
              <small>${c.minimo ? `Contas a partir de ${real(c.minimo)}` : 'Qualquer valor de conta'}${c.validade ? ` · até ${c.validade.split('-').reverse().join('/')}` : ''}</small>
              <div class="cc-uso">${c.limite ? `<div class="trilho"><i style="width:${Math.min(100, Math.round(c.usos / c.limite * 100))}%"></i></div><span>${c.usos} de ${c.limite} usos</span>` : `<span>${c.usos} ${c.usos === 1 ? 'uso' : 'usos'} · sem limite</span>`}</div>
              <div class="cc-acoes"><button class="btn btn-p btn-claro" data-editar="${c.id}">Editar</button><button class="btn btn-p btn-borda" data-pausar="${c.id}" data-v="${c.ativo ? 0 : 1}">${c.ativo ? 'Pausar' : 'Reativar'}</button><button class="btn btn-p btn-perigo" data-apagar="${c.id}" aria-label="Apagar">${icone('lixo', 16)}</button></div></div>
          </article>`;
        }).join('')}</div>`
        : `<div class="vazio-painel">${icone('cupom', 40, 1.8)}<b>Nenhum cupom ainda.</b><span>Ex.: <b>BEMVINDO10</b> para 10% na primeira visita, ou <b>SEXTOU</b> com R$ 15 de desconto acima de R$ 100.</span><button class="btn btn-azul" id="novo2">${icone('mais', 18, 3)} Criar o primeiro cupom</button></div>`);
    const editar = c => {
      c = c || { tipo: 'percentual', valor: 10, ativo: 1 };
      const m = formulario(c.id ? `Editar cupom ${esc(c.codigo)}` : 'Novo cupom', `
        ${c.id ? '' : '<label class="campo">Código<input name="codigo" required maxlength="20" placeholder="BEMVINDO10" style="text-transform:uppercase;font-weight:800;letter-spacing:.04em"></label>'}
        <div class="campo">Tipo de desconto<div class="segmentado" id="tipoSeg"><button type="button" data-tipo="percentual" class="${c.tipo === 'percentual' ? 'marcado' : ''}">Porcentagem (%)</button><button type="button" data-tipo="valor" class="${c.tipo === 'valor' ? 'marcado' : ''}">Valor fixo (R$)</button></div></div>
        <input type="hidden" name="tipo" value="${c.tipo}">
        <div class="dupla"><label class="campo"><span id="rotValor">${c.tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}</span><input name="valor" required inputmode="decimal" value="${c.tipo === 'percentual' ? c.valor : paraReais(c.valor)}"></label>
          <label class="campo">Conta mínima (R$)<input name="minimo" inputmode="decimal" placeholder="sem mínimo" value="${c.minimo ? paraReais(c.minimo) : ''}"></label></div>
        <div class="dupla"><label class="campo">Vale até<input name="validade" type="date" value="${c.validade || ''}"></label>
          <label class="campo">Quantas vezes pode ser usado<input name="limite" type="number" min="1" placeholder="sem limite" value="${c.limite || ''}"></label></div>
        <p class="sutil" style="margin:0" id="previaCupom"></p>`, {
        enviar: c.id ? 'Salvar' : 'Criar cupom',
        aoEnviar: async d => {
          const valor = d.tipo === 'percentual' ? Number(String(d.valor).replace(',', '.')) : paraCentavos(d.valor);
          if (!valor) throw new Error('Informe o valor do desconto.');
          const minimo = d.minimo ? paraCentavos(d.minimo) : '';
          if (minimo === null) throw new Error('Conta mínima inválida.');
          const dados = { tipo: d.tipo, valor, minimo, validade: d.validade, limite: d.limite };
          if (c.id) await api(`/api/cupons/${c.id}`, { metodo: 'POST', dados });
          else await api('/api/cupons', { metodo: 'POST', dados: { ...dados, codigo: d.codigo } });
          toast(c.id ? 'Cupom salvo.' : 'Cupom criado. Já vale nos tablets.'); cuponsPg();
        },
      });
      const f = m.el.querySelector('form');
      const previa = () => {
        const d = Object.fromEntries(new FormData(f));
        const v = d.tipo === 'percentual' ? `${d.valor || 0}% de desconto` : `R$ ${d.valor || '0,00'} de desconto`;
        f.querySelector('#previaCupom').innerHTML = `${icone('olho', 14, 2)} O cliente vai ver: <b>${esc((d.codigo || c.codigo || 'CÓDIGO').toUpperCase())}</b>: ${esc(v)}${d.minimo ? ` acima de R$ ${esc(d.minimo)}` : ''}.`;
      };
      f.addEventListener('input', previa); previa();
      f.querySelector('#tipoSeg').onclick = e => {
        const b = e.target.closest('[data-tipo]'); if (!b) return;
        f.tipo.value = b.dataset.tipo;
        f.querySelectorAll('[data-tipo]').forEach(x => x.classList.toggle('marcado', x === b));
        f.querySelector('#rotValor').textContent = b.dataset.tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)';
        previa();
      };
    };
    main().querySelector('#novo').onclick = () => editar();
    main().querySelector('#novo2')?.addEventListener('click', () => editar());
    main().onclick = async e => {
      const ed = e.target.closest('[data-editar]'); if (ed) return editar(r.cupons.find(c => c.id == ed.dataset.editar));
      const pa = e.target.closest('[data-pausar]');
      if (pa) { try { await api(`/api/cupons/${pa.dataset.pausar}`, { metodo: 'POST', dados: { ativo: pa.dataset.v === '1' } }); cuponsPg(); } catch (er) { falhou(er); } return; }
      const ap_ = e.target.closest('[data-apagar]');
      if (ap_ && confirm('Apagar este cupom? Se ele já foi usado, ele só fica pausado para manter o histórico.')) {
        try { const res = await api(`/api/cupons/${ap_.dataset.apagar}/remover`, { metodo: 'POST' }); toast(res.desativado ? 'O cupom já foi usado, então foi pausado.' : 'Cupom apagado.'); cuponsPg(); } catch (er) { falhou(er); }
      }
    };
  }

  /* ------------------------------------------------------------ CONFIGURAÇÕES */
  const SECOES_CFG = [
    ['restaurante', 'Restaurante', 'loja'], ['conta', 'Minha conta', 'pessoas'], ['horario', 'Horário', 'relogio'],
    ['pagamentos', 'Pagamentos', 'qr'], ['cozinha', 'Cozinha e impressão', 'chef'], ['avisos', 'Avisos e e-mail', 'sino'],
    ['seguranca', 'Segurança', 'escudo'], ['dados', 'Seus dados', 'baixar'],
  ];
  let secaoCfg = 'restaurante';

  async function ajustes() {
    let cfg;
    try { cfg = await api('/api/config'); } catch (er) { return falhou(er); }
    if (aba !== 'ajustes') return;
    const p = { ...cfg.preferencias };
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const situacao = st => !st.controle ? '<span class="chip cinza">Sem controle de horário: aceita pedidos sempre</span>' : st.aberto ? '<span class="chip verde"><span class="ponto"></span>Aberto agora</span>' : `<span class="chip vermelho"><span class="ponto"></span>Fechado agora${st.proxima ? ', abre ' + esc(st.proxima) : ''}</span>`;
    const turnoHtml = (d, t, i) => `<span class="turno"><input type="time" data-d="${d}" data-t="${i}" data-p="0" value="${t[0]}" aria-label="Início"> às <input type="time" data-d="${d}" data-t="${i}" data-p="1" value="${t[1]}" aria-label="Fim">${i > 0 ? `<button type="button" class="btn btn-p btn-perigo" data-tirar-turno="${d}" aria-label="Remover turno">${icone('x', 14, 3)}</button>` : ''}</span>`;
    const liga = (k, t, d) => `<label class="opcao-liga"><span><b>${t}</b><small>${d}</small></span><button type="button" class="interruptor ${p[k] ? 'on' : ''}" data-liga="${k}" aria-pressed="${!!p[k]}" aria-label="${t}"></button></label>`;
    const campoP = (k, t, extra = '') => `<label class="campo">${t}<input data-pref="${k}" value="${esc(p[k] || '')}" ${extra}></label>`;
    const salvarPref = `<button class="btn btn-azul" data-salvar-pref>Salvar</button>`;
    const secoes = {
      restaurante: `<form class="cartao" id="fEstab"><h3>Dados do restaurante</h3>
          <label class="campo">Nome que aparece nos tablets e no painel<input name="nome" required maxlength="60" value="${esc(cfg.nome)}"></label>
          <label class="campo">Fuso horário<select name="fuso">${Object.entries(cfg.fusos).map(([k, v]) => `<option value="${k}" ${k === cfg.fuso ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
          <p class="sutil" style="margin:0">Cliente desde ${new Date(cfg.criado_em.replace(' ', 'T') + 'Z').toLocaleDateString('pt-BR')}. Endereço do painel: <b class="selecionavel">${location.origin}/admin</b></p>
          <button class="btn btn-azul">Salvar</button></form>
        <div class="cartao atalhos-cfg"><h3>Também é configuração</h3>
          <button data-ir="aparencia">${icone('pincel', 20, 2)}<span><b>Aparência do tablet</b><small>Logo, cores, fontes, textos e o que aparece no cardápio</small></span>${icone('seta', 18, 2.5)}</button>
          <button data-ir="mesas">${icone('mesa', 20, 2)}<span><b>Mesas</b><small>Quantidade, nomes, lugares e o mapa do salão</small></span>${icone('seta', 18, 2.5)}</button>
          <button data-ir="equipe">${icone('pessoas', 20, 2)}<span><b>Equipe</b><small>Quem tem acesso e o que cada um vê</small></span>${icone('seta', 18, 2.5)}</button>
          <button data-ir="cupons">${icone('cupom', 20, 2)}<span><b>Cupons</b><small>Códigos de desconto para promoções</small></span>${icone('seta', 18, 2.5)}</button></div>`,
      conta: `<form class="cartao" id="fConta"><h3>Seus dados</h3>
          <div class="conta-topo"><span class="avatar grande">${esc(iniciais(eu.nome))}</span><div><b>${esc(eu.nome)}</b><small>${esc(eu.email)} · ${esc(PAPEIS[eu.papel]?.[0] || '')}</small></div></div>
          <label class="campo">Seu nome<input name="nome" required maxlength="60" value="${esc(eu.nome)}"></label>
          <label class="campo">E-mail de acesso<input value="${esc(eu.email)}" disabled></label>
          <p class="sutil" style="margin:0">Para trocar o e-mail, peça a outro dono em Equipe.</p>
          <button class="btn btn-azul">Salvar nome</button></form>
        <form class="cartao" id="fSenha"><h3>Senha</h3>
          <label class="campo">Senha atual<input name="atual" type="password" required autocomplete="current-password"></label>
          <label class="campo">Nova senha<input name="nova" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
          <p class="sutil" style="margin:0">${eu.google ? 'Você entra com o Google. Se não sabe a senha atual, use "Esqueci minha senha" na tela de login para criar uma.' : 'Use pelo menos 8 caracteres, misturando letras e números.'}</p>
          <button class="btn btn-azul">Trocar senha</button></form>
        <div class="cartao"><h3>Login com Google</h3>
          <p style="margin:0">${eu.google ? `<span class="chip verde">${icone('check', 14, 3)} Vinculado</span> Você pode entrar com o botão do Google usando ${esc(eu.email)}.` : `<span class="chip cinza">Não vinculado</span> Na tela de login, use "Entrar com Google" com o e-mail ${esc(eu.email)} para vincular.`}</p></div>`,
      horario: `<form class="cartao largo-cfg" id="fHorario"><h3>Horário de funcionamento</h3>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <label class="liga"><input type="checkbox" id="usarHorario" ${cfg.horarios.ativo ? 'checked' : ''}> Bloquear pedidos fora do horário</label>
            <span id="situacao">${situacao(cfg.situacao)}</span></div>
          <div class="horarios" id="dias">${dias.map((n, d) => { const ts = cfg.horarios.dias[d] || cfg.horarios.dias[String(d)] || []; return `<div class="horario-dia ${ts.length ? '' : 'fechado'}" data-dia="${d}">
            <label class="liga"><input type="checkbox" data-aberto="${d}" ${ts.length ? 'checked' : ''}> ${n}</label>
            <div class="turnos">${(ts.length ? ts : [['18:00', '23:00']]).map((t, i) => turnoHtml(d, t, i)).join('')}${ts.length < 2 ? `<button type="button" class="btn btn-p btn-borda" data-mais-turno="${d}">+ turno</button>` : ''}</div></div>`; }).join('')}</div>
          <p class="sutil" style="margin:0">Turnos que passam da meia-noite também valem (ex.: 18:00 às 02:00). Fora do horário, o tablet mostra que o restaurante está fechado.</p>
          <button class="btn btn-azul">Salvar horário</button></form>`,
      pagamentos: `<form class="cartao" id="fTaxa"><h3>Taxa de serviço</h3>
          <label class="campo">Porcentagem<input name="taxa_servico" type="number" min="0" max="30" value="${cfg.taxa_servico}"></label>
          <p class="sutil" style="margin:0">Use 0 para não cobrar. A taxa aparece como opcional no tablet e o caixa pode tirar na comanda.</p>
          <button class="btn btn-azul">Salvar</button></form>
        <div class="cartao" data-grupo="pix"><h3>Pix na mesa</h3>
          <p class="sutil" style="margin:0">O cliente vê o total, escolhe a gorjeta e paga pelo QR code no próprio tablet. O caixa confere o comprovante e fecha a conta.</p>
          ${liga('pix_ativo', 'Mostrar "Pagar com Pix" no tablet', 'O botão aparece na conta da mesa.')}
          ${campoP('pix_chave', 'Chave Pix', 'maxlength="77" placeholder="CNPJ, celular, e-mail ou chave aleatória"')}
          <div class="dupla">${campoP('pix_nome', 'Nome do recebedor', 'maxlength="25" placeholder="Como aparece no banco"')}${campoP('pix_cidade', 'Cidade', 'maxlength="15"')}</div>
          ${liga('gorjeta_ativa', 'Oferecer gorjeta no Pix', 'Opções de 5%, 10% e 15%, sempre opcionais.')}
          ${salvarPref}</div>`,
      cozinha: `<div class="cartao"><h3>Tela da cozinha</h3>
          <label class="campo">Avisar pedido atrasado depois de<select data-pref="cozinha_atraso_min">${[5, 10, 15, 20, 25, 30, 45, 60].map(n => `<option value="${n}" ${n === Number(p.cozinha_atraso_min) ? 'selected' : ''}>${n} minutos</option>`).join('')}</select></label>
          ${liga('cozinha_som', 'Som de pedido novo', 'Mostra o botão para ligar o som na tela da cozinha.')}
          <p class="sutil" style="margin:0">Cada categoria do cardápio diz se é preparada na <b>Cozinha</b> ou no <b>Bar</b>. Na tela da cozinha, escolha qual setor mostrar e cada impressora imprime só a sua parte.</p>
          ${salvarPref}</div>
        <div class="cartao"><h3>Conta impressa</h3>
          <label class="campo">Rodapé da conta<textarea data-pref="rodape_comanda" maxlength="160" rows="3" placeholder="CNPJ, agradecimento ou promoção da semana">${esc(p.rodape_comanda || '')}</textarea></label>
          <p class="sutil" style="margin:0">O endereço, o telefone e o Instagram de "Aparência" também saem na conta.</p>
          ${salvarPref}</div>`,
      avisos: `<div class="cartao"><h3>Resumo da semana por e-mail</h3>
          <p class="sutil" style="margin:0">Toda segunda-feira os donos recebem o faturamento da semana, os pratos mais pedidos, o melhor dia e as notas dos clientes.</p>
          ${liga('resumo_semanal', 'Receber o resumo semanal', 'Vai para o e-mail de cada dono do restaurante.')}
          <div style="display:flex;gap:10px;flex-wrap:wrap">${salvarPref}<button class="btn btn-borda" id="resumoTeste">${icone('balao', 18, 2)} Enviar um exemplo agora</button></div>
          ${cfg.email_configurado ? '' : '<p class="aviso" style="margin:0">O envio de e-mails do Deu Fome ainda não está ligado no servidor. O resumo começa a chegar assim que for configurado.</p>'}</div>
        <div class="cartao"><h3>Avisos no painel</h3>
          <p style="margin:0">O sino no canto de cima avisa quando uma mesa chama o garçom, pede a conta ou tem pedido atrasado na cozinha. Ele atualiza sozinho a cada 20 segundos.</p></div>`,
      seguranca: `<form class="cartao" id="fPin"><h3>PIN dos tablets ${cfg.pin_definido ? '<span class="chip verde">Definido</span>' : '<span class="chip vermelho">Ainda não definido</span>'}</h3>
          <label class="campo">Novo PIN<input name="pin" inputmode="numeric" maxlength="4" pattern="\\d{4}" required placeholder="4 números"></label>
          <p class="sutil" style="margin:0">O PIN é pedido para sair do modo quiosque no tablet (5 toques seguidos no logo).</p>
          <button class="btn btn-azul">Salvar PIN</button></form>
        <div class="cartao"><h3>Aparelhos conectados</h3>
          <p style="margin:0">Esqueceu o painel aberto em outro computador ou celular? Saia de todos de uma vez. Você continua conectado aqui.</p>
          <button class="btn btn-borda" id="sairTodos" style="align-self:flex-start">${icone('sair', 18, 2)} Sair de todos os outros aparelhos</button></div>`,
      dados: `<div class="cartao"><h3>Baixar seus dados</h3>
          <p style="margin:0">Um arquivo com cardápio, mesas, equipe, cupons, contas, pedidos e avaliações. É seu direito pela LGPD e serve como cópia de segurança.</p>
          <a class="btn btn-borda" href="/api/config/exportar" download style="align-self:flex-start">${icone('baixar', 18, 2.2)} Baixar arquivo (JSON)</a></div>
        ${eu.papel === 'dono' ? `<form class="cartao perigo-cfg" id="fExcluir"><h3>Excluir a conta do restaurante</h3>
          <p style="margin:0">A equipe do Deu Fome apaga todos os dados em até 15 dias e confirma por e-mail. Baixe seus dados antes.</p>
          <label class="campo">Para confirmar, digite <b>${esc(cfg.nome)}</b><input name="confirmacao" autocomplete="off" required></label>
          <button class="btn btn-perigo" style="align-self:flex-start">Pedir exclusão da conta</button></form>` : ''}`,
    };
    main().innerHTML = cabecalho('Configurações', 'Tudo do restaurante em um lugar.')
      + `<div class="config"><nav class="config-nav">${SECOES_CFG.map(([k, n, ic]) => `<button data-secao="${k}" class="${k === secaoCfg ? 'ativa' : ''}">${icone(ic, 18, 2)}<span>${n}</span></button>`).join('')}</nav>
        <div class="config-corpo cartoes" id="cfgCorpo">${secoes[secaoCfg]}</div></div>`;
    const corpo = main().querySelector('#cfgCorpo');
    main().querySelector('.config-nav').onclick = e => { const b = e.target.closest('[data-secao]'); if (!b) return; secaoCfg = b.dataset.secao; ajustes(); };
    const post = async (dados, msg) => { const r = await api('/api/config', { metodo: 'POST', dados }); toast(msg || 'Configurações salvas.'); return r; };
    corpo.addEventListener('click', async e => {
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const l = e.target.closest('[data-liga]');
      if (l) { p[l.dataset.liga] = !p[l.dataset.liga]; l.classList.toggle('on', p[l.dataset.liga]); l.setAttribute('aria-pressed', p[l.dataset.liga]); }
      const sp = e.target.closest('[data-salvar-pref]');
      if (sp) {
        corpo.querySelectorAll('[data-pref]').forEach(i => { p[i.dataset.pref] = i.value; });
        sp.disabled = true;
        try { await post({ preferencias: { ...p, inatividade_min: Number(p.inatividade_min), cozinha_atraso_min: Number(p.cozinha_atraso_min) } }); } catch (er) { falhou(er); } finally { sp.disabled = false; }
      }
      if (e.target.closest('#resumoTeste')) {
        try { const r = await api('/api/config/resumo-teste', { metodo: 'POST' }); toast(`Exemplo enviado para ${r.para}.`); } catch (er) { falhou(er); }
      }
      if (e.target.closest('#sairTodos')) {
        try { await api('/api/sair-de-todos', { metodo: 'POST' }); toast('Pronto. Os outros aparelhos vão pedir login de novo.'); } catch (er) { falhou(er); }
      }
      const mais = e.target.closest('[data-mais-turno]');
      if (mais) { const d = mais.dataset.maisTurno; mais.insertAdjacentHTML('beforebegin', turnoHtml(d, ['11:00', '14:00'], 1)); mais.remove(); }
      const tira = e.target.closest('[data-tirar-turno]');
      if (tira) { const cont = tira.closest('.turnos'); tira.closest('.turno').remove(); cont.insertAdjacentHTML('beforeend', `<button type="button" class="btn btn-p btn-borda" data-mais-turno="${tira.dataset.tirarTurno}">+ turno</button>`); }
    });
    corpo.addEventListener('change', e => { const a = e.target.closest('[data-aberto]'); if (a) a.closest('.horario-dia').classList.toggle('fechado', !a.checked); });
    corpo.addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target, d = Object.fromEntries(new FormData(f)), b = f.querySelector('button.btn-azul, button.btn-perigo');
      if (b) b.disabled = true;
      try {
        if (f.id === 'fEstab') { await post({ nome: d.nome, fuso: d.fuso }); eu.estabelecimento = d.nome; raiz.querySelectorAll('.nome-estab').forEach(el => el.textContent = d.nome); }
        if (f.id === 'fTaxa') await post({ taxa_servico: Number(d.taxa_servico) });
        if (f.id === 'fPin') { if (!/^\d{4}$/.test(d.pin)) throw new Error('O PIN precisa ter 4 números.'); await post({ pin: d.pin }, 'PIN salvo. Já vale nos tablets.'); ajustes(); }
        if (f.id === 'fConta') { await api('/api/minha-conta', { metodo: 'POST', dados: { nome: d.nome } }); eu.nome = d.nome; raiz.querySelectorAll('.usuario-txt b, .mu-cab b').forEach(el => el.textContent = d.nome); toast('Nome salvo.'); }
        if (f.id === 'fSenha') { await api('/api/minha-senha', { metodo: 'POST', dados: d }); toast('Senha trocada.'); f.reset(); }
        if (f.id === 'fExcluir') { if (!confirm('Tem certeza? Depois de apagados, os dados não voltam.')) return; await api('/api/config/excluir', { metodo: 'POST', dados: d }); toast('Pedido de exclusão enviado. Você vai receber a confirmação por e-mail.'); f.reset(); }
        if (f.id === 'fHorario') {
          const diasH = {};
          f.querySelectorAll('.horario-dia').forEach(l => {
            const dd = l.dataset.dia;
            if (!l.querySelector('[data-aberto]').checked) { diasH[dd] = []; return; }
            diasH[dd] = [...l.querySelectorAll('.turno')].map(t => [t.querySelector('[data-p="0"]').value, t.querySelector('[data-p="1"]').value]);
          });
          const r = await post({ horarios: { ativo: f.querySelector('#usarHorario').checked, dias: diasH } }, 'Horário salvo.');
          f.querySelector('#situacao').innerHTML = situacao(r.situacao);
        }
      } catch (er) { falhou(er); } finally { if (b) b.disabled = false; }
    });
  }


  /* ------------------------------------------------------------ PERSONALIZAR O TABLET */
  async function aparencia() {
    let cfg;
    try { cfg = await api('/api/config'); } catch (er) { return falhou(er); }
    if (aba !== 'aparencia') return;
    const p = { ...cfg.preferencias };
    let logo = cfg.logo, capa = cfg.capa;
    const liga = (k, t, d) => `<label class="opcao-liga"><span><b>${t}</b><small>${d}</small></span><button type="button" class="interruptor ${p[k] ? 'on' : ''}" data-liga="${k}" aria-pressed="${!!p[k]}" aria-label="${t}"></button></label>`;
    const texto = (k, t, extra = '') => `<label class="campo">${t}<input data-p="${k}" value="${esc(p[k] || '')}" ${extra}></label>`;
    main().innerHTML = cabecalho('Personalizar', 'Deixe o tablet das mesas com a cara do seu restaurante. A mudança chega aos tablets em segundos.', `<button class="btn btn-azul" id="salvarAp">${icone('check', 20, 3)} Salvar mudanças</button>`)
      + `<div class="personalizar">
      <div class="personalizar-form">
        <section class="cartao"><h3>Identidade</h3>
          <div class="envios">
            <div class="envio"><div class="envio-previa logo" id="previaLogo"></div><div><b>Logo</b><small>PNG com fundo transparente fica melhor. Quadrado, até 4 MB.</small>
              <div class="envio-acoes"><label class="btn btn-p btn-borda">${icone('imagem', 16, 2)} Escolher<input type="file" accept="image/png,image/jpeg,image/webp" data-envio="logo" hidden></label><button type="button" class="btn btn-p btn-perigo ${logo ? '' : 'oculto'}" data-tirar="logo">Remover</button></div></div></div>
            <div class="envio"><div class="envio-previa capa" id="previaCapa"></div><div><b>Foto da tela inicial</b><small>Uma foto do salão ou do prato mais famoso. Fica atrás do nome.</small>
              <div class="envio-acoes"><label class="btn btn-p btn-borda">${icone('imagem', 16, 2)} Escolher<input type="file" accept="image/png,image/jpeg,image/webp" data-envio="capa" hidden></label><button type="button" class="btn btn-p btn-perigo ${capa ? '' : 'oculto'}" data-tirar="capa">Remover</button></div></div></div>
          </div>
          <div class="campo">Cor principal
            <div class="cores">${cfg.cores.map(c => `<button type="button" class="cor ${c === p.cor ? 'marcada' : ''}" data-cor="${c}" style="background:${c}" aria-label="Cor ${c}"></button>`).join('')}
              <label class="cor cor-livre" title="Outra cor"><input type="color" id="corLivre" value="${esc(p.cor)}" aria-label="Escolher outra cor"></label></div></div>
          <div class="campo">Tema do tablet
            <div class="segmentado"><button type="button" data-tema="claro" class="${p.tema_tablet === 'claro' ? 'marcado' : ''}">${icone('sol', 18, 2)} Claro</button><button type="button" data-tema="escuro" class="${p.tema_tablet === 'escuro' ? 'marcado' : ''}">${icone('lua', 18, 2)} Escuro</button></div></div>
        </section>
          <div class="campo">Fonte dos títulos
            <div class="fontes">${[['padrao', 'Padrão', 'Bricolage'], ['arredondada', 'Arredondada', 'Nunito'], ['classica', 'Clássica', 'Fraunces'], ['moderna', 'Moderna', 'Space Grotesk']].map(([k, n, f]) => `<button type="button" data-fonte="${k}" class="${(p.fonte || 'padrao') === k ? 'marcado' : ''}" style="font-family:'${f}'"><b>Aa</b><span>${n}</span></button>`).join('')}</div></div>
          <div class="campo">Jeito do cardápio
            <div class="segmentado"><button type="button" data-layout="grade" class="${p.layout_cards !== 'lista' ? 'marcado' : ''}">${icone('grade', 18, 2)} Cartões com foto grande</button><button type="button" data-layout="lista" class="${p.layout_cards === 'lista' ? 'marcado' : ''}">${icone('lista', 18, 2)} Lista compacta</button></div></div>
        </section>
        <section class="cartao"><h3>Textos</h3>
          ${texto('boas_vindas', 'Frase da tela inicial', 'maxlength="80" placeholder="Toque na tela para ver o cardápio"')}
          ${texto('faixa_promocao', 'Faixa de promoção (aparece no topo do cardápio)', 'maxlength="90" placeholder="Ex.: Terça do hambúrguer: o segundo sai pela metade do preço"')}
          ${texto('texto_garcom', 'Texto do botão de ajuda', 'maxlength="24" placeholder="Chamar garçom"')}
          ${texto('agradecimento', 'Mensagem depois da conta', 'maxlength="80" placeholder="Obrigado pela visita! Volte sempre."')}
        </section>
        <section class="cartao"><h3>Informações na tela inicial</h3>
          <p class="sutil">Aparecem para o cliente enquanto ele espera. Deixe em branco o que não quiser mostrar.</p>
          <div class="dupla">${texto('wifi_nome', 'Nome do Wi-Fi', 'maxlength="40"')}${texto('wifi_senha', 'Senha do Wi-Fi', 'maxlength="40"')}</div>
          <div class="dupla">${texto('instagram', 'Instagram', 'maxlength="40" placeholder="@seurestaurante"')}${texto('telefone', 'Telefone ou WhatsApp', 'maxlength="20" inputmode="tel"')}</div>
          ${texto('endereco', 'Endereço', 'maxlength="120"')}
        </section>
        <section class="cartao"><h3>Cardápio e atendimento</h3>
          ${liga('mostrar_fotos', 'Mostrar fotos dos produtos', 'Desligue se ainda não tem fotos boas.')}
          ${liga('mostrar_destaques', 'Mostrar "Mais pedidos da casa"', 'Os 3 pratos que mais saíram no mês, no topo do cardápio.')}
          ${liga('descanso_pratos', 'Fotos dos pratos na tela inicial', 'Os pratos se revezam ao lado do nome do restaurante.')}
          ${liga('mostrar_combina', 'Sugerir o que combina', 'Depois de adicionar um prato, sugere bebida ou sobremesa.')}
          ${liga('mostrar_descricao', 'Mostrar descrição nos cartões', 'A descrição completa continua ao abrir o produto.')}
          ${liga('permitir_observacao', 'Observações rápidas', 'Botões como "Sem cebola" e "Sem gelo".')}
          ${liga('chamar_garcom', 'Botão "Chamar garçom"', 'O pedido de ajuda aparece no Salão.')}
          ${liga('pedir_avaliacao', 'Pedir avaliação no fim', 'Estrelas e comentário depois de pedir a conta.')}
          ${liga('avaliar_pratos', 'Avaliar cada prato', 'Na avaliação, o cliente também dá nota aos pratos que pediu.')}
          <label class="campo">Voltar para a tela inicial depois de<select data-p="inatividade_min">${[1, 2, 3, 5, 10, 15].map(n => `<option value="${n}" ${n === Number(p.inatividade_min) ? 'selected' : ''}>${n} ${n === 1 ? 'minuto' : 'minutos'} sem uso</option>`).join('')}</select></label>
        </section>
        <p class="sutil">Cozinha, impressão, Pix e taxa de serviço ficam em <button class="link" data-ir="ajustes">Configurações</button>.</p>
      </div>
      <div class="personalizar-previa"><div class="previa-rotulo">${icone('olho', 16, 2)} Prévia do tablet</div><div class="tablet-previa" id="previa"></div></div>
    </div>`;

    const previa = () => {
      const fundo = capa ? `background-image:linear-gradient(90deg, rgba(10,14,40,.82), rgba(10,14,40,.35)),url('${esc(capa)}')` : `background:${p.cor}`;
      const escuro = p.tema_tablet === 'escuro';
      main().querySelector('#previa').innerHTML = `<div class="tp-descanso" style="${fundo}">
          <span class="tp-mesa" style="color:${p.cor}">Mesa 04</span>
          <img src="${esc(logo || '/img/icone-escuro.png')}" alt="">
          <b data-fonte-previa="${esc(p.fonte || 'padrao')}">${esc(eu.estabelecimento || 'Seu restaurante')}</b>
          <span class="tp-frase">${esc(p.boas_vindas || 'Toque na tela para ver o cardápio')}</span>
          <span class="tp-botao">Ver o cardápio</span>
          ${p.wifi_nome || p.instagram ? `<span class="tp-info">${p.wifi_nome ? `Wi-Fi ${esc(p.wifi_nome)}` : ''}${p.wifi_nome && p.instagram ? ' · ' : ''}${p.instagram ? '@' + esc(p.instagram.replace(/^@/, '')) : ''}</span>` : ''}
        </div>
        <div class="tp-cardapio ${escuro ? 'escuro' : ''} ${p.layout_cards === 'lista' ? 'lista' : ''}" data-fonte-previa="${esc(p.fonte || 'padrao')}">
          <div class="tp-topo" style="background:${p.cor}"><i></i><b>${esc(eu.estabelecimento || '')}</b></div>
          ${p.faixa_promocao ? `<div class="tp-faixa" style="color:${p.cor}">${icone('raio', 12, 2.5)} ${esc(p.faixa_promocao)}</div>` : ''}
          <div class="tp-grade">${[1, 2, 3].map(() => `<div class="tp-card">${p.mostrar_fotos ? '<span class="tp-foto"></span>' : ''}<span class="tp-l"></span>${p.mostrar_descricao ? '<span class="tp-l curta"></span>' : ''}<span class="tp-mais" style="background:${p.cor}">+</span></div>`).join('')}</div>
        </div>`;
      main().querySelector('#previaLogo').style.backgroundImage = `url('${logo || '/img/icone-escuro.png'}')`;
      const pc = main().querySelector('#previaCapa');
      pc.style.backgroundImage = capa ? `url('${capa}')` : 'none';
      pc.style.backgroundColor = capa ? '' : p.cor;
    };
    previa();

    const raizP = main().querySelector('.personalizar');
    raizP.addEventListener('input', e => {
      const k = e.target.dataset.p; if (k) { p[k] = e.target.value; previa(); }
      if (e.target.id === 'corLivre') { p.cor = e.target.value.toUpperCase(); raizP.querySelectorAll('.cor').forEach(c => c.classList.remove('marcada')); e.target.parentElement.classList.add('marcada'); previa(); }
    });
    raizP.addEventListener('click', async e => {
      const c = e.target.closest('[data-cor]');
      if (c) { p.cor = c.dataset.cor; raizP.querySelectorAll('.cor').forEach(x => x.classList.toggle('marcada', x === c)); raizP.querySelector('#corLivre').value = p.cor; previa(); }
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const fo = e.target.closest('[data-fonte]');
      if (fo) { p.fonte = fo.dataset.fonte; raizP.querySelectorAll('[data-fonte]').forEach(x => x.classList.toggle('marcado', x === fo)); previa(); }
      const ly = e.target.closest('[data-layout]');
      if (ly) { p.layout_cards = ly.dataset.layout; raizP.querySelectorAll('[data-layout]').forEach(x => x.classList.toggle('marcado', x === ly)); previa(); }
      const t = e.target.closest('[data-tema]');
      if (t) { p.tema_tablet = t.dataset.tema; raizP.querySelectorAll('[data-tema]').forEach(x => x.classList.toggle('marcado', x === t)); previa(); }
      const l = e.target.closest('[data-liga]');
      if (l) { p[l.dataset.liga] = !p[l.dataset.liga]; l.classList.toggle('on', p[l.dataset.liga]); l.setAttribute('aria-pressed', p[l.dataset.liga]); previa(); }
      const x = e.target.closest('[data-tirar]');
      if (x) {
        try { await api('/api/config/imagem/remover', { metodo: 'POST', dados: { tipo: x.dataset.tirar } }); if (x.dataset.tirar === 'logo') logo = null; else capa = null; x.classList.add('oculto'); previa(); toast('Imagem removida.'); }
        catch (er) { falhou(er); }
      }
    });
    raizP.addEventListener('change', async e => {
      const tipo = e.target.dataset.envio; if (!tipo || !e.target.files[0]) return;
      try {
        const blob = await reduzirImagem(e.target.files[0], tipo === 'logo' ? { max: 600, png: true } : { max: 1600 });
        const fd = new FormData(); fd.append('tipo', tipo); fd.append('imagem', blob, tipo === 'logo' ? 'logo.png' : 'capa.jpg');
        const r = await api('/api/config/imagem', { metodo: 'POST', form: fd });
        if (tipo === 'logo') logo = r.logo; else capa = r.capa;
        raizP.querySelector(`[data-tirar="${tipo}"]`).classList.remove('oculto');
        previa(); toast(tipo === 'logo' ? 'Logo atualizado.' : 'Foto atualizada.');
      } catch (er) { falhou(er); }
      e.target.value = '';
    });
    main().querySelector('#salvarAp').onclick = async ev => {
      const b = ev.currentTarget; b.disabled = true;
      try { await api('/api/config', { metodo: 'POST', dados: { preferencias: { ...p, inatividade_min: Number(p.inatividade_min), cozinha_atraso_min: Number(p.cozinha_atraso_min) } } }); toast('Pronto! Os tablets já vão mostrar as mudanças.'); }
      catch (er) { falhou(er); } finally { b.disabled = false; }
    };
  }

  /* ------------------------------------------------------------ RELATÓRIOS */
  let filtroRel = { periodo: 'mes' };
  const PERIODOS = [['hoje', 'Hoje'], ['7d', 'Últimos 7 dias'], ['mes', 'Este mês'], ['mes_anterior', 'Mês anterior'], ['ano', 'Este ano']];

  /** Seletor de período no estilo do Meu Cash: botão com o intervalo e um menu com atalhos e datas. */
  function seletorPeriodo(per) {
    const dm = d => d.slice(8, 10) + '/' + d.slice(5, 7);
    const nome = (PERIODOS.find(p => p[0] === per.tipo) || [0, 'Período escolhido'])[1];
    const faixa = per.de === per.ate ? `${dm(per.de)}/${per.de.slice(0, 4)}` : `${dm(per.de)} – ${dm(per.ate)}/${per.ate.slice(0, 4)}`;
    return `<div class="suspenso periodo">
      <button class="periodo-btn" id="periodoBtn" aria-expanded="false" aria-haspopup="true"><span class="pb-ic">${icone('calendario', 18, 2)}</span><span class="pb-txt"><b>${esc(nome)}</b><small>${faixa}</small></span>${icone('seta', 16, 2.5)}</button>
      <div class="painel-suspenso periodo-menu oculto" id="periodoMenu">
        <div class="pm-lista">${PERIODOS.map(([k, n]) => `<button data-per="${k}" class="${per.tipo === k ? 'marcado' : ''}">${n}${per.tipo === k ? icone('check', 18, 2.5) : ''}</button>`).join('')}</div>
        <div class="pm-datas"><span class="mu-rotulo">Escolher datas</span>
          <div class="pm-campos"><label>De<input type="date" id="perDe" value="${per.de}"></label><label>Até<input type="date" id="perAte" value="${per.ate}"></label></div>
          <button class="btn btn-azul pm-aplicar" id="perAplicar">Aplicar período</button></div>
      </div></div>`;
  }
  function ligarPeriodo(raizEl, aoMudar) {
    const btn = raizEl.querySelector('#periodoBtn'), menu = raizEl.querySelector('#periodoMenu');
    btn.onclick = e => { e.stopPropagation(); const abrir = menu.classList.contains('oculto'); document.querySelectorAll('.painel-suspenso').forEach(m => m.classList.add('oculto')); menu.classList.toggle('oculto', !abrir); btn.setAttribute('aria-expanded', abrir); };
    menu.onclick = e => {
      e.stopPropagation();
      const b = e.target.closest('[data-per]');
      if (b) { menu.classList.add('oculto'); return aoMudar({ periodo: b.dataset.per }); }
      if (e.target.closest('#perAplicar')) {
        const de = menu.querySelector('#perDe').value, ate = menu.querySelector('#perAte').value;
        if (!de || !ate) return toast('Escolha as duas datas.', 'erro');
        menu.classList.add('oculto'); aoMudar({ periodo: 'personalizado', de, ate });
      }
    };
  }

  function graficoBarras(dados, { altura = 180, rotulo, valor, formatar, destaque }) {
    const W = 640, H = altura, base = H - 26, topo = 18;
    const max = Math.max(1, ...dados.map(valor));
    const passo = W / Math.max(1, dados.length), larg = Math.max(4, Math.min(42, passo * 0.68));
    const marcar = dados.length <= 16 ? 1 : Math.ceil(dados.length / 12);
    return `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico">
      <line class="eixo" x1="0" x2="${W}" y1="${base}" y2="${base}"/>
      ${dados.map((d, i) => {
        const v = valor(d), h = Math.round((base - topo) * v / max), x = i * passo + (passo - larg) / 2;
        return `<g><title>${esc(rotulo(d))}: ${esc(formatar(v))}</title><rect class="barra-g ${destaque && !destaque(d) ? 'fraca' : ''}" x="${x.toFixed(1)}" y="${base - h}" width="${larg.toFixed(1)}" height="${Math.max(h, v ? 2 : 0)}" rx="4"/>
          ${i % marcar === 0 ? `<text x="${(x + larg / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(rotulo(d))}</text>` : ''}
          ${dados.length <= 10 && v ? `<text class="valor-g" x="${(x + larg / 2).toFixed(1)}" y="${base - h - 6}" text-anchor="middle">${esc(formatar(v))}</text>` : ''}</g>`;
      }).join('')}
    </svg></div>`;
  }

  const listaBarras = (itens, total) => `<div class="lista-barras">${itens.map(([nome, valor, pct]) => `<div class="linha"><b>${esc(nome)}</b><span>${valor}</span><div class="trilho"><i style="width:${pct > 0 ? Math.max(2, Math.round(pct * 100)) : 0}%"></i></div></div>`).join('') || '<p class="sutil" style="margin:0">Sem dados no período.</p>'}</div>`;

  async function relatorios() {
    const q = new URLSearchParams(filtroRel);
    let r;
    try { r = await api('/api/relatorios?' + q); } catch (er) { return falhou(er); }
    if (aba !== 'relatorios') return;
    const rs = r.resumo, av = r.avaliacoes;
    const dm = d => { const [a, m, dd] = d.split('-'); return `${dd}/${m}`; };
    const totalFormas = r.formas.reduce((a, f) => a + f.total, 0) || 1;
    const maxProd = Math.max(1, ...r.produtos.map(p => Number(p.quantidade)));
    const maxMesa = Math.max(1, ...r.mesas.map(m => m.total));
    const horas = r.por_hora.map((v, h) => ({ h, v }));
    const ini = horas.findIndex(x => x.v), fim = 23 - [...horas].reverse().findIndex(x => x.v);
    const horasUteis = ini >= 0 ? horas.slice(Math.max(0, ini - 1), Math.min(24, fim + 2)) : horas.slice(10, 24);
    const pico = Math.max(...r.por_hora);
    const pr = r.pratos || { melhores: [], piores: [] };
    const linhaPrato = p => `<li><span>${esc(p.nome)}</span><span class="nota-prato ${p.media >= 4 ? 'boa' : p.media >= 3 ? 'media' : 'ruim'}">${icone('estrela', 14, 0).replace('fill="none"', 'fill="currentColor"')} ${String(p.media).replace('.', ',')}</span><small>${p.avaliacoes} ${p.avaliacoes === 1 ? 'nota' : 'notas'}</small></li>`;
    main().innerHTML = cabecalho('Relatórios', 'Vendas, movimento e o que os clientes acharam.', seletorPeriodo(r.periodo))
      + `<div class="numeros">
        <div class="numero destaque"><small>Recebido</small><b data-contar="${rs.faturado}" data-formato="real">${real(rs.faturado)}</b><span>${rs.taxas ? `inclui ${real(rs.taxas)} de serviço` : 'sem taxa de serviço'}${rs.gorjetas ? ` e ${real(rs.gorjetas)} de gorjeta` : ''}</span></div>
        <div class="numero"><small>Contas fechadas</small><b>${rs.contas}</b><span>${rs.permanencia_min != null ? `${rs.permanencia_min} min na mesa, em média` : '—'}</span></div>
        <div class="numero"><small>Ticket médio por mesa</small><b>${real(rs.ticket_medio)}</b><span>${real(rs.por_pessoa)} por pessoa</span></div>
        <div class="numero"><small>Pedidos</small><b data-contar="${rs.pedidos}">${rs.pedidos}</b><span>${rs.itens} itens${rs.cancelados ? `, ${rs.cancelados} cancelados` : ''}${rs.descontos ? ` · ${real(rs.descontos)} em cupons` : ''}</span></div>
        <div class="numero"><small>Tempo de preparo</small><b>${rs.preparo_min != null ? Math.round(rs.preparo_min) + ' min' : '—'}</b><span>${rs.espera_min != null ? `${Math.round(rs.espera_min)} min até começar` : 'do pedido até ficar pronto'}</span></div>
        <div class="numero"><small>Avaliação</small><b>${av.media != null ? String(av.media).replace('.', ',') + ' ★' : '—'}</b><span>${av.total} ${av.total === 1 ? 'avaliação' : 'avaliações'}</span></div>
      </div>
      <div class="paineis">
        <div class="painel largo"><h3>Vendas por dia</h3><p>Valor recebido nas contas fechadas em cada dia.</p>
          ${graficoBarras(r.por_dia, { rotulo: d => dm(d.dia), valor: d => d.total, formatar: v => real(v) })}</div>
        <div class="painel largo"><h3>Movimento por hora</h3><p>Pedidos feitos em cada horário${pico ? `; o pico é às ${r.por_hora.indexOf(pico)}h` : ''}.</p>
          ${graficoBarras(horasUteis, { altura: 150, rotulo: d => d.h + 'h', valor: d => d.v, formatar: v => v + ' pedidos', destaque: d => d.v === pico })}</div>
        <div class="painel"><h3>Formas de pagamento</h3><p>Quanto entrou por cada forma.</p>
          ${listaBarras(r.formas.filter(f => f.total).map(f => [FORMAS[f.forma], `${real(f.total)} · ${Math.round(f.total / totalFormas * 100)}%`, f.total / totalFormas]))}</div>
        <div class="painel"><h3>Mais vendidos</h3><p>Por quantidade vendida.</p>
          ${listaBarras(r.produtos.map(p => [p.nome, `${p.quantidade} un · ${real(p.total)}`, p.quantidade / maxProd]))}</div>
        <div class="painel"><h3>Mesas que mais faturaram</h3><p>Valor recebido por mesa.</p>
          ${listaBarras(r.mesas.map(m => [m.mesa, `${real(m.total)} · ${m.contas} contas`, m.total / maxMesa]))}</div>
        <div class="painel"><h3>Pratos mais bem avaliados</h3><p>Nota média que os clientes deram a cada prato no tablet.</p>
          ${pr.melhores.length ? `<ul class="lista-pratos">${pr.melhores.map(linhaPrato).join('')}</ul>` : '<p class="sutil" style="margin:0">Ainda sem notas de pratos no período. Elas aparecem quando o cliente avalia no fim da refeição.</p>'}</div>
        <div class="painel"><h3>Precisam de atenção</h3><p>Pratos com nota abaixo de 4.</p>
          ${pr.piores.length ? `<ul class="lista-pratos">${pr.piores.map(linhaPrato).join('')}</ul>` : `<div class="vazio-mini">${icone('check', 24, 2.5)}<span>Nenhum prato com nota baixa.</span></div>`}</div>
        <div class="painel largo"><h3>Avaliações dos clientes</h3>
          ${av.total ? `<div class="paineis" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:10px">
            <div>${listaBarras([5, 4, 3, 2, 1].map(n => [`${n} ${n === 1 ? 'estrela' : 'estrelas'}`, String(av.distribuicao[n]), av.distribuicao[n] / av.total]))}
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">${Object.entries(av.tags).map(([t, n]) => `<span class="chip ${['Demorou', 'Pedido errado', 'Comida fria', 'Tablet difícil de usar'].includes(t) ? 'vermelho' : 'verde'}">${esc(t)} · ${n}</span>`).join('')}</div></div>
            <div>${av.ultimas.map(c => `<div class="comentario">${estrelas(c.nota)} <small class="sutil">${esc(c.mesa || '')} · ${esc(c.quando)}</small>${c.comentario ? `<p>${esc(c.comentario)}</p>` : ''}${c.tags.length ? `<div class="tags">${c.tags.map(t => `<span class="chip cinza">${esc(t)}</span>`).join('')}</div>` : ''}</div>`).join('') || '<p class="sutil">Nenhum comentário no período.</p>'}</div>
          </div>` : '<p class="sutil" style="margin:6px 0 0">Nenhuma avaliação no período. Elas aparecem quando o cliente pede a conta pelo tablet.</p>'}</div>
      </div>`;
    ligarPeriodo(main(), f => { filtroRel = f; relatorios().then(() => contar(main())); });
  }

  /* ------------------------------------------------------------ CAIXA */
  let diaCaixa = '';
  /** Escolha de um dia, no mesmo estilo do seletor de período dos relatórios. */
  const isoLocal = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const somarDias = (iso, n) => { const dt = new Date(iso + 'T12:00:00'); dt.setDate(dt.getDate() + n); return isoLocal(dt); };
  function seletorDia(dia) {
    const hoje = isoLocal(new Date());
    const nome = dia === hoje ? 'Hoje' : dia === somarDias(hoje, -1) ? 'Ontem' : new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }).replace(/^./, c => c.toUpperCase());
    const atalhos = [[hoje, 'Hoje'], [somarDias(hoje, -1), 'Ontem'], [somarDias(hoje, -2), 'Anteontem'], [somarDias(hoje, -7), 'Mesmo dia da semana passada']];
    return `<div class="seletor-dia"><button class="dia-seta" data-passo="-1" aria-label="Dia anterior">${icone('voltar', 18, 2.5)}</button>
      <div class="suspenso periodo">
        <button class="periodo-btn" id="periodoBtn" aria-expanded="false" aria-haspopup="true"><span class="pb-ic">${icone('calendario', 18, 2)}</span><span class="pb-txt"><b>${nome}</b><small>${dia.split('-').reverse().join('/')}</small></span>${icone('seta', 16, 2.5)}</button>
        <div class="painel-suspenso periodo-menu oculto" id="periodoMenu">
          <div class="pm-lista">${atalhos.map(([k, n]) => `<button data-dia="${k}" class="${dia === k ? 'marcado' : ''}">${n}${dia === k ? icone('check', 18, 2.5) : ''}</button>`).join('')}</div>
          <div class="pm-datas"><span class="mu-rotulo">Escolher data</span><div class="pm-campos um"><label>Dia<input type="date" id="perDia" value="${dia}" max="${hoje}"></label></div>
          <button class="btn btn-azul pm-aplicar" id="perAplicar">Ver este dia</button></div>
        </div></div>
      <button class="dia-seta" data-passo="1" aria-label="Próximo dia" ${dia >= hoje ? 'disabled' : ''}>${icone('seta', 18, 2.5)}</button></div>`;
  }
  function ligarDia(raizEl, aoMudar) {
    const btn = raizEl.querySelector('#periodoBtn'), menu = raizEl.querySelector('#periodoMenu');
    const atual = () => raizEl.querySelector('#perDia').defaultValue;
    btn.onclick = e => { e.stopPropagation(); const abrir = menu.classList.contains('oculto'); document.querySelectorAll('.painel-suspenso').forEach(m => m.classList.add('oculto')); menu.classList.toggle('oculto', !abrir); btn.setAttribute('aria-expanded', abrir); };
    menu.onclick = e => {
      e.stopPropagation();
      const b = e.target.closest('[data-dia]');
      if (b) { menu.classList.add('oculto'); return aoMudar(b.dataset.dia); }
      if (e.target.closest('#perAplicar')) { const v = menu.querySelector('#perDia').value; if (!v) return toast('Escolha um dia.', 'erro'); menu.classList.add('oculto'); aoMudar(v); }
    };
    raizEl.querySelectorAll('.dia-seta').forEach(s => s.onclick = () => aoMudar(somarDias(atual(), Number(s.dataset.passo))));
  }

  async function caixaPg() {
    let r;
    try { r = await api('/api/caixa' + (diaCaixa ? '?dia=' + diaCaixa : '')); } catch (er) { return falhou(er); }
    const t = r.totais;
    const [a, m, d] = r.dia.split('-');
    main().innerHTML = cabecalho('Fechamento de caixa', 'Tudo o que foi recebido no dia, por forma de pagamento.', `${seletorDia(r.dia)}<button class="btn btn-azul" id="imprimir">${icone('impressora', 18, 2)} Imprimir</button>`)
      + `<div class="numeros">
        <div class="numero destaque"><small>Total recebido</small><b data-contar="${t.total}" data-formato="real">${real(t.total)}</b><span>${t.contas} ${t.contas === 1 ? 'conta fechada' : 'contas fechadas'}</span></div>
        ${r.formas.map(f => `<div class="numero"><small>${FORMAS[f.forma]}</small><b>${real(f.total)}</b><span>${f.qtd} ${f.qtd === 1 ? 'pagamento' : 'pagamentos'}</span></div>`).join('')}
        <div class="numero"><small>Taxa de serviço</small><b>${real(t.taxa)}</b><span>consumo ${real(t.subtotal)}</span></div>
      </div>
      ${r.em_aberto.contas ? `<div class="aviso">${r.em_aberto.contas} ${r.em_aberto.contas === 1 ? 'mesa ainda está' : 'mesas ainda estão'} com conta aberta (${real(r.em_aberto.total)}). Elas entram no caixa quando forem fechadas.</div>` : ''}
      ${r.cancelados.qtd ? `<div class="aviso perigo">${r.cancelados.qtd} ${r.cancelados.qtd === 1 ? 'pedido cancelado' : 'pedidos cancelados'} no dia, somando ${real(r.cancelados.total)}.</div>` : ''}
      ${r.contas.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Hora</th><th>Mesa</th><th>Consumo</th><th>Serviço</th><th>Total</th><th>Pagamento</th><th>Fechada por</th></tr></thead><tbody>
        ${r.contas.map(c => `<tr><td>${c.hora}</td><td><b>${esc(c.mesa || '—')}</b>${c.pessoas > 1 ? `<br><small class="sutil">${c.pessoas} pessoas</small>` : ''}</td><td>${real(c.subtotal)}</td><td>${c.taxa ? real(c.taxa) : '—'}</td><td><b>${real(c.total)}</b></td>
          <td>${c.pagamentos.map(p => `${FORMAS[p.forma] || p.forma} ${real(p.valor)}`).join('<br>')}</td><td class="sutil">${esc(c.quem || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="vazio-painel"><b>Nenhuma conta fechada neste dia.</b><span>Escolha outra data acima.</span></div>'}`;
    ligarDia(main(), dia => { diaCaixa = dia; caixaPg().then(() => contar(main())); });
    main().querySelector('#imprimir').onclick = () => imprimir(`<h1>${esc(r.estabelecimento)}</h1><div class="c">FECHAMENTO DE CAIXA</div><div class="c">${d}/${m}/${a}</div><hr>
      ${r.formas.map(f => `<div class="l"><span>${FORMAS[f.forma]} (${f.qtd})</span><span>${real(f.total)}</span></div>`).join('')}<hr>
      <div class="l"><span>Consumo</span><span>${real(t.subtotal)}</span></div><div class="l"><span>Taxa de serviço</span><span>${real(t.taxa)}</span></div>
      <div class="l g"><span>TOTAL</span><span>${real(t.total)}</span></div><div class="l"><span>Contas fechadas</span><span>${t.contas}</span></div>
      ${r.cancelados.qtd ? `<div class="l"><span>Cancelados (${r.cancelados.qtd})</span><span>${real(r.cancelados.total)}</span></div>` : ''}
      ${r.em_aberto.contas ? `<div class="l"><span>Em aberto (${r.em_aberto.contas})</span><span>${real(r.em_aberto.total)}</span></div>` : ''}<hr>
      <div class="c">Impresso em ${esc(r.gerado_em)}</div><div class="c" style="margin-top:8mm">________________________<br>Conferido por</div>`);
  }

  /* ------------------------------------------------------------ PLATAFORMA: sistema, sugestões, erros */
  async function sistema() {
    const st = await atualizarContadores();
    if (!st) return;
    const item = (ok, titulo, texto) => `<div><b>${ok ? '<span class="chip verde">Ativo</span>' : '<span class="chip amarelo">Desligado</span>'} ${titulo}</b><small>${texto}</small></div>`;
    main().innerHTML = cabecalho('Sistema e backup', `Endereço: ${esc(st.url)}`)
      + (st.sem_volume ? `<div class="aviso perigo"><b>Atenção:</b> sem volume no Railway. Os dados serão apagados no próximo deploy.</div>` : '')
      + `<div class="estado-servicos">
        ${item(st.email, 'E-mail (Brevo)', st.email ? 'Envia boas-vindas, recuperação de senha, backups e alertas.' : 'Crie BREVO_API_KEY e EMAIL_REMETENTE nas variáveis do Railway.')}
        ${item(st.google, 'Login com Google', st.google ? 'Botão "Entrar com Google" visível.' : 'Crie GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET (veja o LEIA-ME).')}
        ${item(st.cadastro, 'Cadastro aberto', st.cadastro ? 'Restaurantes podem criar conta pelo site.' : 'Só você cadastra restaurantes (CADASTRO_ABERTO=0).')}
        ${item(!st.sem_volume, 'Volume de dados', st.sem_volume ? 'Sem volume em /data.' : 'Banco e fotos guardados com segurança.')}
      </div>
      <div class="cartoes"><div class="cartao"><h3>Backup</h3>
        <p style="margin:0">${st.backup ? `Último backup automático: <b>${dataHora(st.backup.quando)}</b>${st.backup.info?.email ? ', enviado por e-mail' : ''}.` : 'Ainda não foi feito nenhum backup.'}</p>
        <p class="sutil" style="margin:0">Um backup é feito por dia e os 7 últimos ficam guardados no volume. Com o e-mail configurado, ele também chega na sua caixa de entrada.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-borda" href="/api/plataforma/backup" download>Baixar agora</a><button class="btn btn-azul" id="enviarBackup">Enviar por e-mail agora</button></div>
        ${st.backups.length ? `<p class="sutil" style="margin:0">${st.backups.map(b => `${esc(b.nome)} (${Math.max(1, Math.round(b.bytes / 1024))} KB)`).join('<br>')}</p>` : ''}
      </div></div>`;
    main().querySelector('#enviarBackup').onclick = async e => {
      e.target.disabled = true;
      try { await api('/api/plataforma/backup/enviar', { metodo: 'POST' }); toast('Backup enviado para o seu e-mail.'); sistema(); } catch (er) { falhou(er); sistema(); }
    };
  }

  async function sugestoesPg() {
    let r;
    try { r = await api('/api/plataforma/sugestoes'); } catch (er) { return falhou(er); }
    atualizarContadores();
    const tipos = { sugestao: ['Sugestão', ''], problema: ['Problema', 'vermelho'], elogio: ['Elogio', 'verde'], exclusao: ['Pedido de exclusão', 'vermelho'] };
    main().innerHTML = cabecalho('Sugestões', `${r.sugestoes.filter(s => !s.lida).length} novas`)
      + (r.sugestoes.length ? r.sugestoes.map(s => `<div class="cartao" style="margin-bottom:12px;${s.lida ? 'opacity:.6' : ''}">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip ${tipos[s.tipo][1]}">${tipos[s.tipo][0]}</span><b>${esc(s.estabelecimento || 'Plataforma')}</b><span class="sutil">${esc(s.autor || '')} · ${esc(s.email || '')} · ${dataHora(s.created_at)}</span><span style="flex:1"></span>
          <button class="btn btn-p ${s.lida ? 'btn-borda' : 'btn-claro'}" data-lida="${s.id}" data-v="${s.lida ? 0 : 1}">${s.lida ? 'Marcar como nova' : 'Marcar como lida'}</button></div>
        <p style="margin:0;white-space:pre-wrap">${esc(s.texto)}</p></div>`).join('') : '<div class="vazio-painel"><b>Nenhuma sugestão ainda.</b><span>Os restaurantes enviam pelo botão "Sugestão" no painel.</span></div>');
    main().onclick = async e => {
      const b = e.target.closest('[data-lida]'); if (!b) return;
      try { await api(`/api/plataforma/sugestoes/${b.dataset.lida}`, { metodo: 'POST', dados: { lida: b.dataset.v === '1' } }); sugestoesPg(); } catch (er) { falhou(er); }
    };
  }

  async function errosPg() {
    let r;
    try { r = await api('/api/plataforma/erros'); } catch (er) { return falhou(er); }
    atualizarContadores();
    const abertos = r.erros.filter(e => !e.resolvido).length;
    main().innerHTML = cabecalho('Erros', abertos ? `${abertos} sem resolver` : 'Nenhum erro aberto')
      + (r.erros.length ? r.erros.map(e => `<div class="cartao erro-item ${e.resolvido ? 'resolvido' : ''}" style="margin-bottom:12px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span class="chip ${e.origem === 'servidor' ? 'vermelho' : 'amarelo'}">${e.origem === 'servidor' ? 'Servidor' : 'Navegador'}</span>
          <b>${e.contagem}×</b><span class="sutil">última vez ${dataHora(e.ultima_em)} · primeira ${dataHora(e.primeira_em)}</span><span style="flex:1"></span>
          <button class="btn btn-p ${e.resolvido ? 'btn-borda' : 'btn-sucesso'}" data-resolver="${e.id}" data-v="${e.resolvido ? 0 : 1}">${e.resolvido ? 'Reabrir' : 'Marcar como resolvido'}</button></div>
        <p style="margin:0;font-weight:600;word-break:break-word">${esc(e.mensagem)}</p><small class="sutil">${esc(e.url)}</small>
        ${e.detalhe ? `<details><summary class="sutil" style="cursor:pointer">Detalhes</summary><pre>${esc(e.detalhe)}</pre></details>` : ''}</div>`).join('') : '<div class="vazio-painel"><b>Nenhum erro registrado.</b><span>Quando algo der errado no servidor ou nos navegadores, aparece aqui e você recebe um e-mail.</span></div>');
    main().onclick = async e => {
      const b = e.target.closest('[data-resolver]'); if (!b) return;
      try { await api(`/api/plataforma/erros/${b.dataset.resolver}`, { metodo: 'POST', dados: { resolvido: b.dataset.v === '1' } }); errosPg(); } catch (er) { falhou(er); }
    };
  }

  function sugestaoModal() {
    formulario('Enviar sugestão', `
      <p class="sutil" style="margin:0">O Deu Fome está em beta. Conte o que podemos melhorar, um problema que encontrou ou o que você gostou.</p>
      <label class="campo">Tipo<select name="tipo"><option value="sugestao">Sugestão</option><option value="problema">Problema</option><option value="elogio">Elogio</option></select></label>
      <label class="campo">Mensagem<textarea name="texto" required minlength="5" maxlength="2000" rows="5"></textarea></label>`, {
      enviar: 'Enviar',
      aoEnviar: async d => { await api('/api/sugestoes', { metodo: 'POST', dados: d }); toast('Obrigado! Sua mensagem foi enviada.'); },
    });
  }

  async function iniciar() {
    try { info = await api('/api/info'); } catch {}
    const red = location.hash.match(/^#redefinir=([a-f0-9]{64})$/);
    if (red) return telaRedefinir(red[1]);
    try { eu = await api('/api/me'); } catch {
      abertura();
      return location.pathname === '/cadastro' ? telaCadastro() : telaLogin();
    }
    if (location.pathname === '/cadastro') history.replaceState(null, '', '/admin');
    if (eu.papel === 'cozinha') return location.href = '/cozinha';
    if (eu.boas_vindas) { try { sessionStorage.setItem('deufome_abertura', '1'); } catch {} abertura((eu.nome || '').trim().split(/\s+/)[0] || 'bem-vindo'); }
    else abertura();
    layout();
  }
  iniciar();
})();
