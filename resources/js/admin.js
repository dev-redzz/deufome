import DF from './comum.js';

(() => {
  const { icone, real, esc, toast, api, modal, segundosDesde, tempo, imprimir, dataHora } = DF;
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
    equipe: ['Equipe', 'chef', () => equipePg()],
    aparencia: ['Personalizar', 'pincel', () => aparencia()],
    ajustes: ['Configurações', 'engrenagem', () => ajustes()],
    conta: ['Minha senha', 'cadeado', () => ajustes()],
  };
  const ABAS_POR_PAPEL = {
    plataforma: ['estabelecimentos', 'sistema', 'sugestoes', 'erros', 'conta'],
    dono: ['salao', 'caixa', 'relatorios', 'cardapio', 'mesas', 'dispositivos', 'aparencia', 'equipe', 'ajustes'],
    gerente: ['salao', 'caixa', 'relatorios', 'cardapio', 'mesas', 'dispositivos', 'aparencia', 'equipe', 'ajustes'],
    caixa: ['salao', 'caixa', 'conta'],
  };
  const GRUPOS = { salao: 'No dia a dia', relatorios: 'Resultados', cardapio: 'Seu restaurante', estabelecimentos: 'Plataforma', conta: 'Sua conta' };
  const FORMAS = { pix: 'Pix', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito', dividido: 'Dividido' };
  const AO_VIVO = ['salao', 'dispositivos'];

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

  function aplicarTema(t) {
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem('deufome_tema', t); } catch {}
  }
  try { const t = localStorage.getItem('deufome_tema'); if (t === 'escuro') document.documentElement.dataset.tema = 'escuro'; } catch {}

  function abertura() {
    try { if (sessionStorage.getItem('deufome_abertura')) return; sessionStorage.setItem('deufome_abertura', '1'); } catch { return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = document.createElement('div');
    a.className = 'abertura';
    a.innerHTML = '<div class="peca"><img src="/img/icone-escuro.png" alt=""><b>Deu<span>Fome</span></b></div>';
    a.onclick = () => a.remove();
    a.addEventListener('animationend', e => { if (e.animationName === 'abertura-sai') a.remove(); });
    document.body.appendChild(a);
  }

  function telaAcesso(conteudo, { titulo = 'Cada mesa com seu próprio cardápio.', texto = 'Acompanhe o salão, a cozinha e os tablets das mesas em um só lugar.' } = {}) {
    clearInterval(timer);
    raiz.innerHTML = `<div class="login">
      <div class="lado"><a class="voltar-inicio" href="/"><img src="/img/logo.png" alt="Deu Fome"></a>
        <div class="comandas" aria-hidden="true">
          <div class="comanda-papel atras"><div class="cp-cab"><b>Mesa 07</b><span>há 2 min</span></div><ul><li><b>1×</b> Filé com fritas</li><li><b>2×</b> Suco natural</li></ul></div>
          <div class="comanda-papel"><div class="cp-cab"><b>Mesa 04</b><span>agora</span></div><div class="cp-num">Pedido 128</div><ul><li><b>2×</b> Burger clássico<small>sem cebola</small></li><li><b>1×</b> Batata frita</li><li><b>1×</b> Açaí 400 ml</li></ul><div class="cp-btn">Começar preparo</div></div>
        </div>
        <h1>${titulo}</h1><p>${texto}</p></div>
      <div class="formulario">${conteudo}</div>
    </div>`;
    return raiz.querySelector('form');
  }

  const botaoGoogle = (modo, texto) => info.google ? `<a class="btn btn-google" href="/auth/google?modo=${modo}">${texto}</a><div class="ou">ou</div>` : '';

  function telaLogin(msg) {
    const erroHash = (location.hash.match(/^#erro=([a-z-]+)/) || [])[1];
    if (erroHash) { msg = { tipo: 'erro', texto: ERROS_HASH[erroHash] || 'Não foi possível entrar.' }; history.replaceState(null, '', '/admin'); }
    const f = telaAcesso(`<form id="f">
      <img src="/img/logo.png" alt="Deu Fome" style="height:60px;margin:0 auto 4px">
      <h2>Entrar no painel</h2>
      ${msg ? `<div class="aviso-form ${msg.tipo}">${esc(msg.texto)}</div>` : ''}
      ${botaoGoogle('entrar', 'Entrar com Google')}
      <label class="campo">E-mail<input name="email" type="email" required autocomplete="username"></label>
      <label class="campo">Senha<input name="senha" type="password" required autocomplete="current-password"></label>
      <button class="btn btn-azul" style="height:54px">Entrar</button>
      <div class="links"><button type="button" class="link" id="esqueci">Esqueci minha senha</button>${info.cadastro ? '<a href="/cadastro">Criar conta grátis</a>' : ''}</div>
      ${info.demo ? '<div class="dica"><b>Modo demonstração</b><br>admin@cantinho.test, senha 123456, PIN do tablet 1234<br>Cozinha: cozinha@cantinho.test · Caixa: caixa@cantinho.test</div>' : ''}
    </form>`);
    f.querySelector('#esqueci').onclick = () => telaEsqueci(f.email.value);
    f.onsubmit = async e => {
      e.preventDefault();
      const b = f.querySelector('button.btn-azul'); b.disabled = true;
      try {
        const r = await api('/api/login', { metodo: 'POST', dados: Object.fromEntries(new FormData(f)) });
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
      <button class="btn btn-azul" style="height:54px">Enviar link</button>
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
      <button class="btn btn-azul" style="height:54px">Salvar nova senha</button>
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
    const textos = { titulo: 'Seu restaurante pedindo pelo tablet hoje.', texto: 'Crie a conta, monte o cardápio e ative os tablets das mesas. Grátis durante o beta.' };
    const f = telaAcesso(pend ? `<form id="f" class="largo">
      <h2>Falta pouco</h2>
      <div class="aviso-form ok">Conta Google confirmada: <b>${esc(pend.email)}</b></div>
      <label class="campo">Seu nome<input name="nome" required maxlength="60" value="${esc(pend.nome || '')}"></label>
      ${camposRestaurante}
      <button class="btn btn-azul" style="height:54px">Criar restaurante</button>
    </form>` : `<form id="f" class="largo">
      <h2>Criar conta</h2>
      ${botaoGoogle('cadastro', 'Cadastrar com Google')}
      <div class="dupla"><label class="campo">Seu nome<input name="nome" required maxlength="60" autocomplete="name"></label>
      <label class="campo">E-mail<input name="email" type="email" required autocomplete="email"></label></div>
      <label class="campo">Senha<input name="senha" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
      ${camposRestaurante}
      <button class="btn btn-azul" style="height:54px">Criar conta</button>
      <div class="links"><a href="/admin">Já tenho conta</a></div>
    </form>`, textos);
    f.onsubmit = async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      const b = f.querySelector('.btn-azul'); b.disabled = true;
      try {
        await api(pend ? '/api/cadastro/google' : '/api/cadastro', { metodo: 'POST', dados: { ...d, aceite: !!d.aceite } });
        history.replaceState(null, '', '/admin#salao');
        iniciar();
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  /* ------------------------------------------------------------ LAYOUT */
  function layout() {
    const abas = ABAS_POR_PAPEL[eu.papel] || [];
    raiz.innerHTML = `<div class="admin">
      <div class="barra-movel"><button id="abrirMenu" aria-label="Abrir menu">${icone('menu', 24, 2.2)}</button><img src="/img/logo.png" alt="Deu Fome"><span>${esc(eu.estabelecimento || 'Administração')}</span></div>
      <aside id="menuLateral">
        <div class="marca"><img src="/img/icone-escuro.png" alt=""><div><b>Deu Fome</b><span class="beta">Beta</span><small>${esc(eu.estabelecimento || 'Administração')}</small></div></div>
        <nav class="navegacao">${abas.map(a => `${GRUPOS[a] ? `<div class="grupo">${GRUPOS[a]}</div>` : ''}<button data-aba="${a}">${icone(ABAS[a][1], 20, 2)} <span>${ABAS[a][0]}</span><span class="contador oculto" data-contador="${a}"></span></button>`).join('')}
        ${eu.papel !== 'plataforma' ? `<div class="grupo">Telas</div>
          <a href="/cozinha" target="_blank" rel="noopener">${icone('chef', 20, 2)} Abrir cozinha</a>
          <a href="/tablet" target="_blank" rel="noopener">${icone('tablet', 20, 2)} Abrir tablet</a>` : ''}</nav>
        <div class="fim">
          <div class="rodape-acoes">
            <button id="tema" title="Tema claro ou escuro">${document.documentElement.dataset.tema === 'escuro' ? icone('sol', 18, 2) + ' Claro' : icone('lua', 18, 2) + ' Escuro'}</button>
            ${eu.papel !== 'plataforma' ? `<button id="sugerir" title="Enviar sugestão">${icone('balao', 18, 2)} Sugestão</button>` : ''}
          </div>
          <div class="quem">${esc(eu.nome)}<small>${esc(PAPEIS[eu.papel]?.[0] || 'Administrador do Deu Fome')}</small></div><button id="sair">${icone('sair', 20, 2)} Sair</button></div>
      </aside>
      <main id="main"></main>
    </div>`;
    raiz.querySelector('aside').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) { mudarAba(b.dataset.aba); raiz.querySelector('.admin').classList.remove('menu-aberto'); } });
    raiz.querySelector('#abrirMenu').onclick = () => raiz.querySelector('.admin').classList.toggle('menu-aberto');
    raiz.querySelector('#sair').onclick = async () => { await api('/api/logout', { metodo: 'POST' }).catch(() => {}); location.href = '/admin'; };
    raiz.querySelector('#tema').onclick = () => { aplicarTema(document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'); layoutRodape(); };
    raiz.querySelector('#sugerir')?.addEventListener('click', sugestaoModal);
    const hash = location.hash.slice(1);
    mudarAba(abas.includes(hash) ? hash : abas[0]);
    if (eu.papel === 'plataforma') atualizarContadores();
  }

  function layoutRodape() {
    const b = raiz.querySelector('#tema');
    if (b) b.innerHTML = document.documentElement.dataset.tema === 'escuro' ? icone('sol', 18, 2) + ' Claro' : icone('lua', 18, 2) + ' Escuro';
  }

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
    main().innerHTML = '';
    ABAS[a][2](false);
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
  async function salao() {
    let r;
    try { r = await api('/api/salao/mesas'); } catch (er) { return falhou(er); }
    if (aba !== 'salao') return;
    const chamados = r.mesas.flatMap(m => m.chamados.map(c => ({ ...c, mesa: m })));
    const ocupadas = r.mesas.filter(m => m.sessao).length;
    const ini = r.inicio;
    const passos = ini && ['dono', 'gerente'].includes(eu.papel) ? [
      [ini.mesas > 0, 'Cadastre as mesas', 'Diga quantas mesas o salão tem.', 'mesas'],
      [ini.produtos > 0, 'Monte o cardápio', 'Categorias, produtos, fotos e adicionais.', 'cardapio'],
      [ini.pin, 'Defina o PIN dos tablets', '4 números para o gerente sair do modo quiosque.', 'ajustes'],
      [ini.tablets > 0, 'Ative o primeiro tablet', 'Gere o código e digite no tablet da mesa.', 'dispositivos'],
    ] : [];
    const feitos = passos.filter(p => p[0]).length;
    main().innerHTML = cabecalho('Salão e contas', `${ocupadas} de ${r.mesas.length} mesas ocupadas`)
      + (passos.length && feitos < passos.length ? `<section class="primeiros-passos"><div class="pp-cab"><h2>Primeiros passos</h2><span>${feitos} de ${passos.length} prontos</span></div>
        <div class="pp-barra"><i style="width:${Math.round(feitos / passos.length * 100)}%"></i></div>
        <ol>${passos.map(([ok, t, d, a]) => `<li class="${ok ? 'feito' : ''}"><span class="pp-check">${ok ? icone('check', 16, 3) : ''}</span><div><b>${t}</b><small>${d}</small></div>${ok ? '' : `<button class="btn btn-p btn-borda" data-ir="${a}">Fazer agora</button>`}</li>`).join('')}</ol>
        <p class="sutil">Depois, deixe o tablet com a cara do restaurante em <button class="link" data-ir="aparencia">Personalizar</button>.</p></section>` : '')
      + (chamados.length ? `<div class="chamados"><b style="margin-right:6px">${icone('sino', 20)} Chamados</b>${chamados.map(c => `
        <span class="chip ${c.tipo === 'conta' ? 'vermelho' : 'amarelo'}">${esc(c.mesa.nome)}: ${c.tipo === 'conta' ? 'pediu a conta' : 'chamou o garçom'}, há ${tempo(segundosDesde(c.created_at))}</span>
        ${c.tipo === 'garcom' ? `<button class="btn btn-p btn-claro" data-atender="${c.id}">Atendido</button>` : `<button class="btn btn-p btn-marinho" data-comanda="${c.mesa.sessao?.id || ''}">Abrir comanda</button>`}`).join('')}</div>` : '')
      + (r.mesas.length ? `<div class="mapa">${r.mesas.map(m => {
        const s = m.sessao;
        const cls = !s ? '' : s.status === 'conta_solicitada' ? 'conta' : 'ocupada';
        return `<button class="mesa-card ${cls}" ${s ? `data-comanda="${s.id}"` : 'disabled'}>
          <h3>${esc(m.nome)}</h3>
          ${s ? `<span class="valor">${real(s.total)}</span><span class="sutil" style="font-size:14px">aberta há ${tempo(segundosDesde(s.aberta_em))}</span>` : '<span class="sutil">Livre</span>'}
          <div class="rodape">
            ${s?.status === 'conta_solicitada' ? '<span class="chip vermelho">Conta pedida</span>' : s ? '<span class="chip">Em atendimento</span>' : ''}
            ${m.tablet ? `<span class="chip ${m.tablet.online ? 'verde' : 'cinza'}"><span class="ponto"></span>${esc(m.tablet.nome)}</span>` : '<span class="chip cinza">Sem tablet</span>'}
          </div></button>`;
      }).join('')}</div>` : `<div class="vazio-painel"><b>Nenhuma mesa cadastrada.</b><span>${['dono', 'gerente'].includes(eu.papel) ? 'Cadastre as mesas na aba Mesas.' : 'Peça ao gerente para cadastrar as mesas.'}</span></div>`);
    main().onclick = async e => {
      const ir = e.target.closest('[data-ir]'); if (ir) return mudarAba(ir.dataset.ir);
      const at = e.target.closest('[data-atender]');
      if (at) { try { await api(`/api/salao/chamados/${at.dataset.atender}/atender`, { metodo: 'POST' }); } catch (er) { falhou(er); } return salao(); }
      const c = e.target.closest('[data-comanda]');
      if (c && c.dataset.comanda) abrirComanda(c.dataset.comanda);
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
      return { sub, taxa, total: sub + taxa };
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
      const { sub, taxa, total } = contas();
      m.el.querySelector('#totais').innerHTML = `<div><span>Consumo</span><b>${real(sub)}</b></div>
        ${r.taxa_servico > 0 ? `<div><label class="liga"><input type="checkbox" id="taxa" ${cobrarTaxa ? 'checked' : ''}> Taxa de serviço (${r.taxa_servico}%)</label><b>${real(taxa)}</b></div>` : ''}
        <div class="grande"><span>Total</span><strong>${real(total)}</strong></div>
        ${pessoas > 1 ? `<div class="sutil"><span>${pessoas} pessoas</span><b>${real(Math.ceil(total / pessoas))} cada</b></div>` : ''}`;
    }
    async function carregar() {
      try { r = await api(`/api/salao/sessoes/${id}`); } catch (er) { m.fechar(); return falhou(er); }
      const s = r.sessao, aberta = s.status !== 'fechada';
      if (!aberta) cobrarTaxa = !!s.taxa;
      pagamentos = [{ forma: '', valor: contas().total }];
      const a = r.avaliacao;
      m.el.querySelector('.corpo').innerHTML = `
        <div class="modal-cab"><h2>Comanda · ${esc(r.mesa || '')}</h2><button class="btn btn-claro btn-p" data-fechar aria-label="Fechar">${icone('x', 18, 3)}</button></div>
        <p class="sutil" style="margin:6px 0 0">Aberta há ${tempo(segundosDesde(s.aberta_em))}${s.status === 'conta_solicitada' ? ' · <b style="color:var(--tomate)">conta solicitada</b>' : ''}</p>
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
      if (e.target.closest('#preConta')) {
        const { sub, taxa, total } = contas();
        return imprimir(textoConta(r, `<div class="l"><span>Consumo</span><span>${real(sub)}</span></div>${taxa ? `<div class="l"><span>Serviço ${r.taxa_servico}%</span><span>${real(taxa)}</span></div>` : ''}<div class="l g"><span>TOTAL</span><span>${real(total)}</span></div>${pessoas > 1 ? `<div class="l"><span>${pessoas} pessoas</span><span>${real(Math.ceil(total / pessoas))} cada</span></div>` : ''}`));
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
    main().innerHTML = cabecalho('Mesas', `${r.mesas.length} mesas`, `<button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Adicionar mesas</button>`)
      + (r.mesas.length ? `<table class="tabela"><thead><tr><th>Número</th><th>Nome</th><th>Tablet</th><th>Situação</th><th></th></tr></thead><tbody>
        ${r.mesas.map(m => `<tr><td><b>${m.numero}</b></td><td>${esc(m.nome)}</td><td>${m.tablet ? esc(m.tablet) : '<span class="sutil">Sem tablet</span>'}</td>
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
      const ed = e.target.closest('[data-editar]');
      if (ed) {
        const m = r.mesas.find(x => x.id == ed.dataset.editar);
        formulario('Editar mesa', `<div class="dupla"><label class="campo">Número<input name="numero" type="number" min="1" max="999" value="${m.numero}" required></label>
          <label class="campo">Nome<input name="nome" maxlength="30" value="${esc(m.nome)}"></label></div>`, {
          aoEnviar: async d => { await api(`/api/mesas/${m.id}`, { metodo: 'POST', dados: { numero: Number(d.numero), nome: d.nome } }); toast('Mesa atualizada.'); mesas(); },
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
    main().innerHTML = cabecalho('Cardápio', `${total} produtos em ${cats.length} categorias. As mudanças aparecem nos tablets em poucos segundos.`,
      `<button class="btn btn-borda" id="novaCat">${icone('mais', 20, 3)} Categoria</button>${cats.length ? `<button class="btn btn-azul" id="novoProd">${icone('mais', 20, 3)} Produto</button>` : ''}`)
      + (cats.length ? cats.map((c, ci) => `<section class="cat-bloco">
        <div class="cat-cab"><h3>${esc(c.nome)}</h3><span class="sutil">${c.produtos.length} ${c.produtos.length === 1 ? 'produto' : 'produtos'}</span><span style="flex:1"></span>
          <button class="btn btn-p btn-borda" data-cat-mover="${c.id}" data-d="-1" ${ci === 0 ? 'disabled' : ''} aria-label="Subir categoria">↑</button>
          <button class="btn btn-p btn-borda" data-cat-mover="${c.id}" data-d="1" ${ci === cats.length - 1 ? 'disabled' : ''} aria-label="Descer categoria">↓</button>
          <button class="btn btn-p btn-claro" data-cat-renomear="${c.id}">Renomear</button>
          <button class="btn btn-p btn-perigo" data-cat-remover="${c.id}">Apagar</button>
          <button class="btn btn-p btn-azul" data-novo-em="${c.id}">${icone('mais', 16, 3)} Produto</button></div>
        ${c.produtos.length ? `<table class="tabela"><tbody>${c.produtos.map((p, pi) => `<tr>
          <td><div class="produto-linha"><div class="mini" style="background-image:url('${esc(p.imagem || '/img/sem-foto.svg')}')"></div><div><b>${esc(p.nome)}</b>${p.adicionais.length ? `<br><small class="sutil">${p.adicionais.length} ${p.adicionais.length === 1 ? 'adicional' : 'adicionais'}</small>` : ''}</div></div></td>
          <td style="width:130px"><b>${real(p.preco)}</b></td>
          <td style="width:170px"><label class="liga"><button class="interruptor ${p.disponivel ? 'on' : ''}" data-disp="${p.id}" data-v="${p.disponivel ? 1 : 0}" aria-label="Disponível"></button>${p.disponivel ? 'Disponível' : 'Esgotado'}</label></td>
          <td style="width:240px"><div class="acoes">
            <button class="btn btn-p btn-borda" data-mover="${p.id}" data-d="-1" ${pi === 0 ? 'disabled' : ''} aria-label="Subir">↑</button>
            <button class="btn btn-p btn-borda" data-mover="${p.id}" data-d="1" ${pi === c.produtos.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button>
            <button class="btn btn-p btn-claro" data-editar="${p.id}">Editar</button></div></td>
        </tr>`).join('')}</tbody></table>` : '<p class="sutil" style="margin:6px 2px 0">Nenhum produto nesta categoria.</p>'}
      </section>`).join('') : `<div class="vazio-painel"><b>O cardápio está vazio.</b><span>Comece criando uma categoria, como "Lanches" ou "Bebidas".</span></div>`);

    const acharProduto = id => { for (const c of cats) for (const p of c.produtos) if (p.id == id) return { ...p, categoria_id: c.id }; };
    const novaCategoria = () => formulario('Nova categoria', '<label class="campo">Nome<input name="nome" required maxlength="40" placeholder="Bebidas"></label>', {
      enviar: 'Criar', aoEnviar: async d => { await api('/api/categorias', { metodo: 'POST', dados: d }); toast('Categoria criada.'); cardapio(); },
    });
    main().querySelector('#novaCat').onclick = novaCategoria;
    main().querySelector('#novoProd')?.addEventListener('click', () => editarProduto(null, cats));
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
        return formulario('Renomear categoria', `<label class="campo">Nome<input name="nome" required maxlength="40" value="${esc(c.nome)}"></label>`, {
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
    let foto = null;
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
          <label class="liga"><input type="checkbox" name="disponivel" ${p.disponivel === false ? '' : 'checked'}> Disponível para pedir</label>
        </div>
      </div>
      <h3 style="margin:8px 0 0">Adicionais</h3>
      <div id="adicionais"></div>
      <button type="button" class="btn btn-p btn-borda" id="maisAdicional" style="align-self:flex-start">${icone('mais', 16, 3)} Adicional</button>`, {
      enviar: novo ? 'Criar produto' : 'Salvar',
      perigo: novo ? null : 'Apagar produto',
      aoEnviar: async (d, f) => {
        lerAdicionais(f);
        const preco = paraCentavos(d.preco);
        if (preco === null) throw new Error('Preço inválido.');
        const lista = [];
        for (const a of adicionais) {
          if (!a.nome?.trim() && !a.precoTexto) continue;
          const pa = paraCentavos(a.precoTexto || '0');
          if (pa === null) throw new Error(`Preço inválido no adicional "${a.nome}".`);
          lista.push({ id: a.id, nome: a.nome, preco: pa });
        }
        const dados = { nome: d.nome, descricao: d.descricao, preco, categoria_id: Number(d.categoria_id), disponivel: !!d.disponivel, adicionais: lista };
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
  async function equipePg() {
    let r;
    try { r = await api('/api/equipe'); } catch (er) { return falhou(er); }
    main().innerHTML = cabecalho('Equipe', 'Cada pessoa entra com o próprio e-mail e só vê as telas da sua função.', `<button class="btn btn-azul" id="novo">${icone('mais', 20, 3)} Adicionar pessoa</button>`)
      + `<table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Função</th><th>Situação</th><th></th></tr></thead><tbody>
      ${r.equipe.map(p => `<tr><td><b>${esc(p.nome)}</b>${p.id == r.eu ? ' <small class="sutil">(você)</small>' : ''}</td><td>${esc(p.email)}</td><td>${PAPEIS[p.papel]?.[0] || p.papel}</td>
        <td>${p.ativo ? '<span class="chip verde">Ativo</span>' : '<span class="chip cinza">Desativado</span>'}</td>
        <td><div class="acoes"><button class="btn btn-p btn-claro" data-editar="${p.id}">Editar</button></div></td></tr>`).join('')}
      </tbody></table>`;
    const opcoes = sel => Object.entries(PAPEIS).filter(([k]) => k !== 'dono' || eu.papel === 'dono' || sel === 'dono').map(([k, [n, d]]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}: ${d}</option>`).join('');
    main().querySelector('#novo').onclick = () => formulario('Adicionar pessoa', `
      <label class="campo">Nome<input name="nome" required maxlength="60"></label>
      <label class="campo">E-mail<input name="email" type="email" required></label>
      <label class="campo">Função<select name="papel">${opcoes('caixa')}</select></label>
      <label class="campo">Senha inicial<input name="senha" type="text" required minlength="8" placeholder="mínimo 8 caracteres" autocomplete="off"></label>`, {
      enviar: 'Adicionar', aoEnviar: async d => { await api('/api/equipe', { metodo: 'POST', dados: d }); toast('Pessoa adicionada.'); equipePg(); },
    });
    main().onclick = e => {
      const b = e.target.closest('[data-editar]'); if (!b) return;
      const p = r.equipe.find(x => x.id == b.dataset.editar);
      const souEu = p.id == r.eu;
      formulario('Editar pessoa', `
        <label class="campo">Nome<input name="nome" required maxlength="60" value="${esc(p.nome)}"></label>
        <label class="campo">E-mail<input name="email" type="email" required value="${esc(p.email)}"></label>
        <label class="campo">Função<select name="papel" ${souEu ? 'disabled' : ''}>${opcoes(p.papel)}</select></label>
        <label class="campo">Nova senha<input name="senha" type="text" minlength="8" placeholder="deixe em branco para manter" autocomplete="off"></label>
        ${souEu ? '' : `<label class="liga"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}> Pode entrar no sistema</label>`}`, {
        aoEnviar: async d => {
          const dados = { nome: d.nome, email: d.email };
          if (!souEu) { dados.papel = d.papel; dados.ativo = !!d.ativo; }
          if (d.senha) dados.senha = d.senha;
          await api(`/api/equipe/${p.id}`, { metodo: 'POST', dados }); toast('Dados salvos.'); equipePg();
        },
      });
    };
  }

  /* ------------------------------------------------------------ AJUSTES */
  async function ajustes() {
    const gestor = ['dono', 'gerente'].includes(eu.papel);
    let cfg = null;
    if (gestor) { try { cfg = await api('/api/config'); } catch (er) { return falhou(er); } }
    const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const situacao = st => !st.controle ? '<span class="chip cinza">Sem controle de horário: aceita pedidos sempre</span>' : st.aberto ? '<span class="chip verde"><span class="ponto"></span>Aberto agora</span>' : `<span class="chip vermelho"><span class="ponto"></span>Fechado agora${st.proxima ? ', abre ' + esc(st.proxima) : ''}</span>`;
    const turnoHtml = (d, t, i) => `<span class="turno"><input type="time" data-d="${d}" data-t="${i}" data-p="0" value="${t[0]}" aria-label="Início"> às <input type="time" data-d="${d}" data-t="${i}" data-p="1" value="${t[1]}" aria-label="Fim">${i > 0 ? `<button type="button" class="btn btn-p btn-perigo" data-tirar-turno="${d}" aria-label="Remover turno">${icone('x', 14, 3)}</button>` : ''}</span>`;
    main().innerHTML = cabecalho(gestor ? 'Configurações' : 'Minha senha', gestor ? 'Dados do restaurante, PIN dos tablets, taxa de serviço e horário' : '') + `<div class="cartoes">
      ${gestor ? `<form class="cartao" id="fEstab"><h3>Estabelecimento</h3>
        <label class="campo">Nome que aparece nos tablets<input name="nome" required maxlength="60" value="${esc(cfg.nome)}"></label>
        <label class="campo">PIN dos tablets ${cfg.pin_definido ? '<span class="chip verde">Definido</span>' : '<span class="chip vermelho">Ainda não definido</span>'}<input name="pin" inputmode="numeric" maxlength="4" placeholder="${cfg.pin_definido ? '4 números, deixe em branco para manter' : 'Escolha 4 números'}"></label>
        <p class="sutil" style="margin:0">O PIN é pedido para sair do modo quiosque no tablet (5 toques no logo).</p>
        <div class="dupla"><label class="campo">Taxa de serviço (%)<input name="taxa_servico" type="number" min="0" max="30" value="${cfg.taxa_servico}"></label>
        <label class="campo">Fuso horário<select name="fuso">${Object.entries(cfg.fusos).map(([k, v]) => `<option value="${k}" ${k === cfg.fuso ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label></div>
        <p class="sutil" style="margin:0">Use 0 para não ter taxa. Ela é sugerida na comanda e o caixa pode tirar.</p>
        <button class="btn btn-azul">Salvar</button></form>
      <form class="cartao" id="fHorario" style="grid-column:1/-1"><h3>Horário de funcionamento</h3>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <label class="liga"><input type="checkbox" id="usarHorario" ${cfg.horarios.ativo ? 'checked' : ''}> Bloquear pedidos fora do horário</label>
          <span id="situacao">${situacao(cfg.situacao)}</span></div>
        <div class="horarios" id="dias">${dias.map((n, d) => { const ts = cfg.horarios.dias[d] || cfg.horarios.dias[String(d)] || []; return `<div class="horario-dia ${ts.length ? '' : 'fechado'}" data-dia="${d}">
          <label class="liga"><input type="checkbox" data-aberto="${d}" ${ts.length ? 'checked' : ''}> ${n}</label>
          <div class="turnos">${(ts.length ? ts : [['18:00', '23:00']]).map((t, i) => turnoHtml(d, t, i)).join('')}${ts.length < 2 ? `<button type="button" class="btn btn-p btn-borda" data-mais-turno="${d}">+ turno</button>` : ''}</div></div>`; }).join('')}</div>
        <p class="sutil" style="margin:0">Turnos que passam da meia-noite também valem (ex.: 18:00 às 02:00). Fora do horário, o tablet mostra que o restaurante está fechado.</p>
        <button class="btn btn-azul">Salvar horário</button></form>` : ''}
      <form class="cartao" id="fSenha"><h3>Minha senha</h3>
        <label class="campo">Senha atual<input name="atual" type="password" required autocomplete="current-password"></label>
        <label class="campo">Nova senha<input name="nova" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
        <p class="sutil" style="margin:0">Se você entra com o Google e não sabe a senha atual, use "Esqueci minha senha" na tela de login.</p>
        <button class="btn btn-azul">Trocar senha</button></form>
    </div>`;
    const fE = main().querySelector('#fEstab');
    fE?.addEventListener('submit', async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(fE));
      if (d.pin && !/^\d{4}$/.test(d.pin)) return toast('O PIN precisa ter 4 números.', 'erro');
      try { await api('/api/config', { metodo: 'POST', dados: { ...d, taxa_servico: Number(d.taxa_servico) } }); toast('Configurações salvas.'); if (d.pin) ajustes(); eu.estabelecimento = d.nome; raiz.querySelectorAll('.marca small, .barra-movel span').forEach(el => el.textContent = d.nome); fE.pin.value = ''; } catch (er) { falhou(er); }
    });
    const fH = main().querySelector('#fHorario');
    if (fH) {
      const lerHorario = () => {
        const dias = {};
        fH.querySelectorAll('.horario-dia').forEach(l => {
          const d = l.dataset.dia;
          if (!l.querySelector('[data-aberto]').checked) { dias[d] = []; return; }
          const turnos = [];
          l.querySelectorAll('.turno').forEach(t => turnos.push([t.querySelector('[data-p="0"]').value, t.querySelector('[data-p="1"]').value]));
          dias[d] = turnos;
        });
        return { ativo: fH.querySelector('#usarHorario').checked, dias };
      };
      fH.addEventListener('change', e => { const a = e.target.closest('[data-aberto]'); if (a) a.closest('.horario-dia').classList.toggle('fechado', !a.checked); });
      fH.addEventListener('click', e => {
        const mais = e.target.closest('[data-mais-turno]');
        if (mais) { const d = mais.dataset.maisTurno; mais.insertAdjacentHTML('beforebegin', turnoHtml(d, ['11:00', '14:00'], 1)); mais.remove(); }
        const tira = e.target.closest('[data-tirar-turno]');
        if (tira) { const cont = tira.closest('.turnos'); tira.closest('.turno').remove(); cont.insertAdjacentHTML('beforeend', `<button type="button" class="btn btn-p btn-borda" data-mais-turno="${tira.dataset.tirarTurno}">+ turno</button>`); }
      });
      fH.addEventListener('submit', async e => {
        e.preventDefault();
        try { const r = await api('/api/config', { metodo: 'POST', dados: { horarios: lerHorario() } }); fH.querySelector('#situacao').innerHTML = situacao(r.situacao); toast('Horário salvo.'); } catch (er) { falhou(er); }
      });
    }
    main().querySelector('#fSenha').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('/api/minha-senha', { metodo: 'POST', dados: Object.fromEntries(new FormData(e.target)) }); toast('Senha trocada.'); e.target.reset(); } catch (er) { falhou(er); }
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
        <section class="cartao"><h3>Textos</h3>
          ${texto('boas_vindas', 'Frase da tela inicial', 'maxlength="80" placeholder="Toque na tela para ver o cardápio"')}
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
          ${liga('mostrar_descricao', 'Mostrar descrição nos cartões', 'A descrição completa continua ao abrir o produto.')}
          ${liga('permitir_observacao', 'Observações rápidas', 'Botões como "Sem cebola" e "Sem gelo".')}
          ${liga('chamar_garcom', 'Botão "Chamar garçom"', 'O pedido de ajuda aparece no Salão.')}
          ${liga('pedir_avaliacao', 'Pedir avaliação no fim', 'Estrelas e comentário depois de pedir a conta.')}
          <label class="campo">Voltar para a tela inicial depois de<select data-p="inatividade_min">${[1, 2, 3, 5, 10, 15].map(n => `<option value="${n}" ${n === Number(p.inatividade_min) ? 'selected' : ''}>${n} ${n === 1 ? 'minuto' : 'minutos'} sem uso</option>`).join('')}</select></label>
        </section>
        <section class="cartao"><h3>Cozinha e impressão</h3>
          <label class="campo">Avisar pedido atrasado depois de<select data-p="cozinha_atraso_min">${[5, 10, 15, 20, 25, 30, 45, 60].map(n => `<option value="${n}" ${n === Number(p.cozinha_atraso_min) ? 'selected' : ''}>${n} minutos</option>`).join('')}</select></label>
          ${liga('cozinha_som', 'Som de pedido novo', 'Mostra o botão para ligar o som na tela da cozinha.')}
          ${texto('rodape_comanda', 'Rodapé da conta impressa', 'maxlength="160" placeholder="CNPJ, agradecimento ou promoção da semana"')}
        </section>
      </div>
      <div class="personalizar-previa"><div class="previa-rotulo">${icone('olho', 16, 2)} Prévia do tablet</div><div class="tablet-previa" id="previa"></div></div>
    </div>`;

    const previa = () => {
      const fundo = capa ? `background-image:linear-gradient(90deg, rgba(10,14,40,.82), rgba(10,14,40,.35)),url('${esc(capa)}')` : `background:${p.cor}`;
      const escuro = p.tema_tablet === 'escuro';
      main().querySelector('#previa').innerHTML = `<div class="tp-descanso" style="${fundo}">
          <span class="tp-mesa" style="color:${p.cor}">Mesa 04</span>
          <img src="${esc(logo || '/img/icone-escuro.png')}" alt="">
          <b>${esc(eu.estabelecimento || 'Seu restaurante')}</b>
          <span class="tp-frase">${esc(p.boas_vindas || 'Toque na tela para ver o cardápio')}</span>
          <span class="tp-botao">Ver o cardápio</span>
          ${p.wifi_nome || p.instagram ? `<span class="tp-info">${p.wifi_nome ? `Wi-Fi ${esc(p.wifi_nome)}` : ''}${p.wifi_nome && p.instagram ? ' · ' : ''}${p.instagram ? '@' + esc(p.instagram.replace(/^@/, '')) : ''}</span>` : ''}
        </div>
        <div class="tp-cardapio ${escuro ? 'escuro' : ''}">
          <div class="tp-topo" style="background:${p.cor}"><i></i><b>${esc(eu.estabelecimento || '')}</b></div>
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
  let filtroRel = { periodo: '7d' };
  const periodos = [['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Este mês']];

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
    const rs = r.resumo, av = r.avaliacoes;
    const dm = d => { const [a, m, dd] = d.split('-'); return `${dd}/${m}`; };
    const totalFormas = r.formas.reduce((a, f) => a + f.total, 0) || 1;
    const maxProd = Math.max(1, ...r.produtos.map(p => Number(p.quantidade)));
    const maxMesa = Math.max(1, ...r.mesas.map(m => m.total));
    const horas = r.por_hora.map((v, h) => ({ h, v }));
    const ini = horas.findIndex(x => x.v), fim = 23 - [...horas].reverse().findIndex(x => x.v);
    const horasUteis = ini >= 0 ? horas.slice(Math.max(0, ini - 1), Math.min(24, fim + 2)) : horas.slice(10, 24);
    const pico = Math.max(...r.por_hora);
    main().innerHTML = cabecalho('Relatórios', `${dm(r.periodo.de)}${r.periodo.de !== r.periodo.ate ? ' a ' + dm(r.periodo.ate) : ''}`, `<button class="btn btn-borda" id="irCaixa">${icone('caixa', 18, 2)} Fechamento de caixa</button>`)
      + `<div class="filtros">${periodos.map(([k, n]) => `<button data-p="${k}" class="${r.periodo.tipo === k ? 'ativo' : ''}">${n}</button>`).join('')}
        <span class="sutil" style="margin-left:6px">ou</span><input type="date" id="de" value="${r.periodo.de}" aria-label="De"><input type="date" id="ate" value="${r.periodo.ate}" aria-label="Até"><button data-p="personalizado" class="${r.periodo.tipo === 'personalizado' ? 'ativo' : ''}">Ver período</button></div>
      <div class="numeros">
        <div class="numero destaque"><small>Recebido</small><b>${real(rs.faturado)}</b><span>${rs.taxas ? `inclui ${real(rs.taxas)} de serviço` : 'sem taxa de serviço'}</span></div>
        <div class="numero"><small>Contas fechadas</small><b>${rs.contas}</b><span>${rs.permanencia_min != null ? `${rs.permanencia_min} min na mesa, em média` : '—'}</span></div>
        <div class="numero"><small>Ticket médio por mesa</small><b>${real(rs.ticket_medio)}</b><span>${real(rs.por_pessoa)} por pessoa</span></div>
        <div class="numero"><small>Pedidos</small><b>${rs.pedidos}</b><span>${rs.itens} itens${rs.cancelados ? `, ${rs.cancelados} cancelados` : ''}</span></div>
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
        <div class="painel largo"><h3>Avaliações dos clientes</h3>
          ${av.total ? `<div class="paineis" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:10px">
            <div>${listaBarras([5, 4, 3, 2, 1].map(n => [`${n} ${n === 1 ? 'estrela' : 'estrelas'}`, String(av.distribuicao[n]), av.distribuicao[n] / av.total]))}
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px">${Object.entries(av.tags).map(([t, n]) => `<span class="chip ${['Demorou', 'Pedido errado', 'Comida fria', 'Tablet difícil de usar'].includes(t) ? 'vermelho' : 'verde'}">${esc(t)} · ${n}</span>`).join('')}</div></div>
            <div>${av.ultimas.map(c => `<div class="comentario">${estrelas(c.nota)} <small class="sutil">${esc(c.mesa || '')} · ${esc(c.quando)}</small>${c.comentario ? `<p>${esc(c.comentario)}</p>` : ''}${c.tags.length ? `<div class="tags">${c.tags.map(t => `<span class="chip cinza">${esc(t)}</span>`).join('')}</div>` : ''}</div>`).join('') || '<p class="sutil">Nenhum comentário no período.</p>'}</div>
          </div>` : '<p class="sutil" style="margin:6px 0 0">Nenhuma avaliação no período. Elas aparecem quando o cliente pede a conta pelo tablet.</p>'}</div>
      </div>`;
    main().querySelector('#irCaixa').onclick = () => mudarAba('caixa');
    main().querySelector('.filtros').onclick = e => {
      const b = e.target.closest('[data-p]'); if (!b) return;
      filtroRel = b.dataset.p === 'personalizado' ? { periodo: 'personalizado', de: main().querySelector('#de').value, ate: main().querySelector('#ate').value } : { periodo: b.dataset.p };
      relatorios();
    };
  }

  /* ------------------------------------------------------------ CAIXA */
  let diaCaixa = '';
  async function caixaPg() {
    let r;
    try { r = await api('/api/caixa' + (diaCaixa ? '?dia=' + diaCaixa : '')); } catch (er) { return falhou(er); }
    const t = r.totais;
    const [a, m, d] = r.dia.split('-');
    main().innerHTML = cabecalho('Fechamento de caixa', `${d}/${m}/${a}`, `<input type="date" id="dia" value="${r.dia}" class="filtro-dia" aria-label="Dia" style="height:46px;border-radius:14px;border:2px solid var(--linha);padding:0 12px;font-weight:600;background:var(--superficie);color:var(--texto)"><button class="btn btn-azul" id="imprimir">${icone('impressora', 18, 2)} Imprimir</button>`)
      + `<div class="numeros">
        <div class="numero destaque"><small>Total recebido</small><b>${real(t.total)}</b><span>${t.contas} ${t.contas === 1 ? 'conta fechada' : 'contas fechadas'}</span></div>
        ${r.formas.map(f => `<div class="numero"><small>${FORMAS[f.forma]}</small><b>${real(f.total)}</b><span>${f.qtd} ${f.qtd === 1 ? 'pagamento' : 'pagamentos'}</span></div>`).join('')}
        <div class="numero"><small>Taxa de serviço</small><b>${real(t.taxa)}</b><span>consumo ${real(t.subtotal)}</span></div>
      </div>
      ${r.em_aberto.contas ? `<div class="aviso">${r.em_aberto.contas} ${r.em_aberto.contas === 1 ? 'mesa ainda está' : 'mesas ainda estão'} com conta aberta (${real(r.em_aberto.total)}). Elas entram no caixa quando forem fechadas.</div>` : ''}
      ${r.cancelados.qtd ? `<div class="aviso perigo">${r.cancelados.qtd} ${r.cancelados.qtd === 1 ? 'pedido cancelado' : 'pedidos cancelados'} no dia, somando ${real(r.cancelados.total)}.</div>` : ''}
      ${r.contas.length ? `<div class="rolagem"><table class="tabela"><thead><tr><th>Hora</th><th>Mesa</th><th>Consumo</th><th>Serviço</th><th>Total</th><th>Pagamento</th><th>Fechada por</th></tr></thead><tbody>
        ${r.contas.map(c => `<tr><td>${c.hora}</td><td><b>${esc(c.mesa || '—')}</b>${c.pessoas > 1 ? `<br><small class="sutil">${c.pessoas} pessoas</small>` : ''}</td><td>${real(c.subtotal)}</td><td>${c.taxa ? real(c.taxa) : '—'}</td><td><b>${real(c.total)}</b></td>
          <td>${c.pagamentos.map(p => `${FORMAS[p.forma] || p.forma} ${real(p.valor)}`).join('<br>')}</td><td class="sutil">${esc(c.quem || '')}</td></tr>`).join('')}
      </tbody></table></div>` : '<div class="vazio-painel"><b>Nenhuma conta fechada neste dia.</b><span>Escolha outra data acima.</span></div>'}`;
    main().querySelector('#dia').onchange = e => { diaCaixa = e.target.value; caixaPg(); };
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
    const tipos = { sugestao: ['Sugestão', ''], problema: ['Problema', 'vermelho'], elogio: ['Elogio', 'verde'] };
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
    layout();
  }
  iniciar();
})();
