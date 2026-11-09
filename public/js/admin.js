(() => {
  const { icone, real, esc, toast, api, modal, segundosDesde, tempo } = DF;
  const raiz = document.getElementById('raiz');
  let eu = null, aba = null, timer = null;

  const PAPEIS = {
    dono: ['Dono', 'Acesso total, inclusive a outros donos'],
    gerente: ['Gerente', 'Salão, cardápio, mesas, tablets e equipe'],
    caixa: ['Caixa', 'Salão, chamados e fechamento de contas'],
    cozinha: ['Cozinha', 'Só a tela da cozinha'],
  };
  const ABAS = {
    estabelecimentos: ['Estabelecimentos', 'mesa', () => estabelecimentos()],
    salao: ['Salão e contas', 'mesa', s => salao(s)],
    mesas: ['Mesas', 'mesa', () => mesas()],
    dispositivos: ['Dispositivos', 'tablet', s => dispositivos(s)],
    cardapio: ['Cardápio', 'cardapio', () => cardapio()],
    equipe: ['Equipe', 'chef', () => equipePg()],
    ajustes: ['Ajustes', 'cadeado', () => ajustes()],
    conta: ['Minha senha', 'cadeado', () => ajustes()],
  };
  const ABAS_POR_PAPEL = {
    plataforma: ['estabelecimentos', 'conta'],
    dono: ['salao', 'mesas', 'dispositivos', 'cardapio', 'equipe', 'ajustes'],
    gerente: ['salao', 'mesas', 'dispositivos', 'cardapio', 'equipe', 'ajustes'],
    caixa: ['salao', 'conta'],
  };
  const AO_VIVO = ['salao', 'dispositivos'];

  const paraCentavos = v => {
    const n = parseFloat(String(v).trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };
  const paraReais = c => (c / 100).toFixed(2).replace('.', ',');
  const main = () => raiz.querySelector('#main');
  const falhou = er => { if (er.status === 401) return telaLogin(); toast(er.message, 'erro'); };

  /* ------------------------------------------------------------ LOGIN */
  async function telaLogin() {
    clearInterval(timer);
    let demo = false;
    try { demo = (await api('/api/info')).demo; } catch {}
    raiz.innerHTML = `<div class="login">
      <div class="lado"><img src="/img/icone-escuro.png" alt=""><h1>Cada mesa com seu próprio cardápio.</h1><p>Acompanhe o salão, a cozinha e os tablets das mesas em um só lugar.</p></div>
      <div class="formulario"><form id="f">
        <img src="/img/logo.png" alt="Deu Fome" style="height:60px;margin:0 auto 4px">
        <h2>Entrar no painel</h2>
        <label class="campo">E-mail<input name="email" type="email" required autocomplete="username"></label>
        <label class="campo">Senha<input name="senha" type="password" required autocomplete="current-password"></label>
        <button class="btn btn-azul" style="height:54px">Entrar</button>
        ${demo ? '<div class="dica"><b>Modo demonstração</b><br>admin@cantinho.test, senha 123456, PIN do tablet 1234<br>Cozinha: cozinha@cantinho.test · Caixa: caixa@cantinho.test</div>' : ''}
      </form></div>
    </div>`;
    raiz.querySelector('#f').onsubmit = async e => {
      e.preventDefault();
      const b = e.target.querySelector('button'); b.disabled = true;
      try {
        const r = await api('/api/login', { metodo: 'POST', dados: Object.fromEntries(new FormData(e.target)) });
        if (r.papel === 'cozinha' || new URLSearchParams(location.search).get('voltar') === '/cozinha') return location.href = '/cozinha';
        history.replaceState(null, '', '/admin');
        iniciar();
      } catch (er) { toast(er.message, 'erro'); b.disabled = false; }
    };
  }

  /* ------------------------------------------------------------ LAYOUT */
  function layout() {
    const abas = ABAS_POR_PAPEL[eu.papel] || [];
    raiz.innerHTML = `<div class="admin">
      <aside>
        <div class="marca"><img src="/img/icone.png" alt=""><div><b>Deu Fome</b><small>${esc(eu.estabelecimento || 'Administração')}</small></div></div>
        ${abas.map(a => `<button data-aba="${a}">${icone(ABAS[a][1], 20, 2)} ${ABAS[a][0]}</button>`).join('')}
        ${eu.papel !== 'plataforma' ? `<div class="grupo">Telas</div>
          <a href="/cozinha" target="_blank" rel="noopener">${icone('chef', 20, 2)} Abrir cozinha</a>
          <a href="/tablet" target="_blank" rel="noopener">${icone('tablet', 20, 2)} Abrir tablet</a>` : ''}
        <div class="fim"><div class="quem">${esc(eu.nome)}<small>${esc(PAPEIS[eu.papel]?.[0] || 'Administrador do Deu Fome')}</small></div><button id="sair">${icone('sair', 20, 2)} Sair</button></div>
      </aside>
      <main id="main"></main>
    </div>`;
    raiz.querySelector('aside').addEventListener('click', e => { const b = e.target.closest('[data-aba]'); if (b) mudarAba(b.dataset.aba); });
    raiz.querySelector('#sair').onclick = async () => { await api('/api/logout', { metodo: 'POST' }).catch(() => {}); location.href = '/admin'; };
    const hash = location.hash.slice(1);
    mudarAba(abas.includes(hash) ? hash : abas[0]);
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
    main().innerHTML = cabecalho('Salão e contas', `${ocupadas} de ${r.mesas.length} mesas ocupadas`)
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
      const at = e.target.closest('[data-atender]');
      if (at) { try { await api(`/api/salao/chamados/${at.dataset.atender}/atender`, { metodo: 'POST' }); } catch (er) { falhou(er); } return salao(); }
      const c = e.target.closest('[data-comanda]');
      if (c && c.dataset.comanda) abrirComanda(c.dataset.comanda);
    };
  }

  async function abrirComanda(id) {
    let forma = null;
    const m = modal('<div class="comanda"><div class="corpo">Carregando…</div></div>', { aoFechar: () => aba === 'salao' && salao() });
    async function pintar() {
      let r;
      try { r = await api(`/api/salao/sessoes/${id}`); } catch (er) { m.fechar(); return falhou(er); }
      const s = r.sessao;
      const aberta = s.status !== 'fechada';
      m.el.querySelector('.corpo').innerHTML = `
        <div class="modal-cab"><h2>Comanda</h2><button class="btn btn-claro btn-p" data-fechar aria-label="Fechar">${icone('x', 18, 3)}</button></div>
        <p class="sutil" style="margin:6px 0 0">Aberta há ${tempo(segundosDesde(s.aberta_em))}${s.status === 'conta_solicitada' ? ' · <b style="color:var(--tomate)">conta solicitada</b>' : ''}</p>
        ${r.pedidos.map(p => `<div class="pedido ${p.status === 'cancelado' ? 'cancelado' : ''}">
          <div class="cab"><b>Pedido ${p.numero}</b><span><span class="chip ${p.status === 'pronto' ? 'verde' : p.status === 'preparo' ? 'amarelo' : p.status === 'cancelado' ? 'vermelho' : 'cinza'}">${{ recebido: 'Recebido', preparo: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue', cancelado: 'Cancelado' }[p.status]}</span>
          ${aberta && p.status !== 'cancelado' ? `<button class="btn btn-p btn-perigo" data-cancelar="${p.id}" style="margin-left:6px">Cancelar</button>` : ''}</span></div>
          ${p.itens.map(i => `<div class="it"><span>${i.quantidade}× ${esc(i.nome)}${i.adicionais.length ? ' (+ ' + esc(i.adicionais.map(a => a.nome).join(', ')) + ')' : ''}${i.observacao ? ' · ' + esc(i.observacao) : ''}</span><span>${real(i.subtotal)}</span></div>`).join('')}
        </div>`).join('') || '<p>Nenhum pedido.</p>'}
        <div class="linha-total" style="margin-top:16px"><span>Total</span><strong>${real(r.total)}</strong></div>
        ${aberta ? `<h3 style="margin-top:18px">Forma de pagamento</h3>
          <div class="formas">${[['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['credito', 'Crédito'], ['debito', 'Débito']].map(([k, n]) => `<button data-forma="${k}" class="${forma === k ? 'marcada' : ''}">${n}</button>`).join('')}</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${s.status === 'conta_solicitada' ? '<button class="btn btn-borda" id="reabrir">Reabrir para novos pedidos</button>' : ''}
            <button class="btn btn-sucesso" id="fechar" style="flex:1" ${forma ? '' : 'disabled'}>${icone('check', 20, 3)} Receber e liberar mesa</button>
          </div>` : `<p class="chip verde" style="margin-top:12px">Fechada</p>`}`;
    }
    m.el.addEventListener('click', async e => {
      if (e.target.closest('[data-fechar]')) return m.fechar();
      const f = e.target.closest('[data-forma]');
      if (f) { forma = f.dataset.forma; return pintar(); }
      const c = e.target.closest('[data-cancelar]');
      if (c) {
        const motivo = prompt('Motivo do cancelamento:');
        if (!motivo) return;
        try { await api(`/api/salao/pedidos/${c.dataset.cancelar}/cancelar`, { metodo: 'POST', dados: { motivo } }); pintar(); } catch (er) { falhou(er); }
      }
      if (e.target.closest('#reabrir')) { try { await api(`/api/salao/sessoes/${id}/reabrir`, { metodo: 'POST' }); pintar(); } catch (er) { falhou(er); } }
      if (e.target.closest('#fechar')) {
        try { const r = await api(`/api/salao/sessoes/${id}/fechar`, { metodo: 'POST', dados: { forma } }); toast(`Conta de ${real(r.total)} recebida. Mesa liberada.`); m.fechar(); }
        catch (er) { falhou(er); }
      }
    });
    pintar();
  }

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
  async function reduzirImagem(arquivo) {
    const url = URL.createObjectURL(arquivo);
    try {
      const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
      const max = 1200, esc_ = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * esc_); c.height = Math.round(img.naturalHeight * esc_);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.85));
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
    main().innerHTML = cabecalho(gestor ? 'Ajustes' : 'Minha senha', '') + `<div class="cartoes">
      ${gestor ? `<form class="cartao" id="fEstab"><h3>Estabelecimento</h3>
        <label class="campo">Nome que aparece nos tablets<input name="nome" required maxlength="60" value="${esc(cfg.nome)}"></label>
        <label class="campo">Novo PIN dos tablets<input name="pin" inputmode="numeric" maxlength="4" placeholder="4 números, deixe em branco para manter"></label>
        <p class="sutil" style="margin:0">O PIN é pedido para sair do modo quiosque no tablet (5 toques no logo).</p>
        <button class="btn btn-azul">Salvar</button></form>` : ''}
      <form class="cartao" id="fSenha"><h3>Minha senha</h3>
        <label class="campo">Senha atual<input name="atual" type="password" required autocomplete="current-password"></label>
        <label class="campo">Nova senha<input name="nova" type="password" required minlength="8" autocomplete="new-password" placeholder="mínimo 8 caracteres"></label>
        <button class="btn btn-azul">Trocar senha</button></form>
    </div>`;
    main().querySelector('#fEstab')?.addEventListener('submit', async e => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      if (d.pin && !/^\d{4}$/.test(d.pin)) return toast('O PIN precisa ter 4 números.', 'erro');
      try { await api('/api/config', { metodo: 'POST', dados: d }); toast('Ajustes salvos.'); eu.estabelecimento = d.nome; raiz.querySelector('.marca small').textContent = d.nome; e.target.pin.value = ''; } catch (er) { falhou(er); }
    });
    main().querySelector('#fSenha').addEventListener('submit', async e => {
      e.preventDefault();
      try { await api('/api/minha-senha', { metodo: 'POST', dados: Object.fromEntries(new FormData(e.target)) }); toast('Senha trocada.'); e.target.reset(); } catch (er) { falhou(er); }
    });
  }

  async function iniciar() {
    try { eu = await api('/api/me'); } catch { return telaLogin(); }
    if (eu.papel === 'cozinha') return location.href = '/cozinha';
    layout();
  }
  iniciar();
})();
