import DF from './comum.js';

(() => {
  const { icone, esc, api, toast, segundosDesde, tempo, imprimir } = DF;
  let estab = '', autoImprimir = false, pedidosAtuais = [];
  try { autoImprimir = localStorage.getItem('deufome_auto_imprimir') === '1'; } catch {}
  let ATRASO_MIN = 15, rodape = '', somPadraoAplicado = false, setor = '';
  try { setor = localStorage.getItem('deufome_setor') || ''; } catch {}
  const NOMES_SETOR = { '': 'Tudo', cozinha: 'Cozinha', bar: 'Bar' };
  const doSetor = p => setor ? { ...p, itens: p.itens.filter(i => (i.setor || 'cozinha') === setor) } : p;
  let conhecidos = null, somLigado = false, ctx;
  const proximo = { recebido: ['preparo', 'Começar preparo', 'btn-azul'], preparo: ['pronto', 'Marcar como pronto', 'btn-sucesso'], pronto: ['entregue', 'Entregue na mesa', 'btn-marinho'] };
  const anterior = { preparo: 'recebido', pronto: 'preparo' };

  document.getElementById('som').onclick = e => { ctx = ctx || new AudioContext(); somLigado = !somLigado; e.target.textContent = somLigado ? 'Som ligado' : 'Ativar som'; if (somLigado) bip(); };
  function bip() {
    if (!somLigado || !ctx) return;
    [0, .18].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .15); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .16); });
  }
  const relogio = () => document.getElementById('relogio').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  relogio(); setInterval(relogio, 1000);

  async function carregar() {
    try {
      const r = await api('/api/cozinha/pedidos');
      r.pedidos = r.pedidos.map(doSetor).filter(p => p.itens.length);
      const novos = conhecidos ? r.pedidos.filter(p => !conhecidos.has(p.id)) : [];
      if (novos.length) bip();
      pedidosAtuais = r.pedidos;
      if (r.config) {
        ATRASO_MIN = r.config.atraso_min || 15;
        rodape = r.config.rodape || '';
        if (!somPadraoAplicado) { somPadraoAplicado = true; if (r.config.som === false) document.getElementById('som').classList.add('oculto'); }
      }
      desenhar(r.pedidos, new Set(novos.map(p => p.id)));
      if (autoImprimir && novos.length) imprimir(novos.map(textoTicket).join('<div style="page-break-after:always"></div>'));
      conhecidos = new Set(r.pedidos.map(p => p.id));
    } catch (e) {
      if (e.status === 401) location.href = '/admin?voltar=/cozinha';
    }
  }

  function desenhar(pedidos, novos) {
    ['recebido', 'preparo', 'pronto'].forEach(st => {
      const lista = pedidos.filter(p => p.status === st);
      document.getElementById('n-' + st).textContent = lista.length;
      document.getElementById('c-' + st).innerHTML = lista.map(p => {
        const s = segundosDesde(p.created_at);
        const atrasado = st !== 'pronto' && s > ATRASO_MIN * 60;
        const [prox, rot, cls] = proximo[st];
        return `<div class="ticket ${st} ${atrasado ? 'atrasado' : ''} ${novos.has(p.id) ? 'novo' : ''}">
          <div class="cab"><span class="mesa">${esc(p.mesa_nome || 'Mesa ' + String(p.mesa).padStart(2, '0'))}</span><span class="tempo">${tempo(s)}</span></div>
          <div class="num">Pedido ${p.numero}</div>
          <ul>${p.itens.map(i => `<li><b>${i.quantidade}×</b>${esc(i.nome)}${i.adicionais.length ? `<small>+ ${esc(i.adicionais.join(', '))}</small>` : ''}${i.observacao ? `<small class="obs">${esc(i.observacao)}</small>` : ''}</li>`).join('')}</ul>
          <button class="btn ${cls}" data-id="${p.id}" data-st="${prox}">${rot}</button>
          <button class="voltar" data-imprimir="${p.id}">${icone('impressora', 14, 2)} imprimir</button>
          ${anterior[st] ? `<button class="voltar" data-id="${p.id}" data-st="${anterior[st]}">desfazer</button>` : ''}
        </div>`;
      }).join('') || '<p class="nada">Nenhum pedido nesta etapa.</p>';
    });
  }

  function textoTicket(p) {
    const hora = new Date(p.created_at.replace(' ', 'T') + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<h1>${esc(estab)}</h1>${setor ? `<div class="c">${NOMES_SETOR[setor].toUpperCase()}</div>` : ''}<h2>${esc((p.mesa_nome || 'Mesa ' + String(p.mesa).padStart(2, '0')).toUpperCase())}</h2><div class="c">Pedido ${p.numero} · ${hora}</div><hr>
      ${p.itens.map(i => `<div class="g">${i.quantidade}x ${esc(i.nome)}</div>${i.adicionais.length ? `<div class="add">+ ${esc(i.adicionais.join(', '))}</div>` : ''}${i.observacao ? `<div class="obs">** ${esc(i.observacao)} **</div>` : ''}`).join('')}<hr>${rodape ? `<div class="c">${esc(rodape)}</div>` : ''}`;
  }

  const botaoAuto = document.getElementById('autoImp');
  const pintarAuto = () => botaoAuto.textContent = autoImprimir ? 'Impressão automática: ligada' : 'Impressão automática';
  pintarAuto();
  botaoAuto.onclick = () => {
    autoImprimir = !autoImprimir;
    try { localStorage.setItem('deufome_auto_imprimir', autoImprimir ? '1' : '0'); } catch {}
    pintarAuto();
    toast(autoImprimir ? 'Pedidos novos serão impressos assim que chegarem.' : 'Impressão automática desligada.');
  };

  document.querySelector('.colunas').addEventListener('click', async e => {
    const imp = e.target.closest('[data-imprimir]');
    if (imp) { const p = pedidosAtuais.find(x => x.id == imp.dataset.imprimir); if (p) imprimir(textoTicket(p)); return; }
    const b = e.target.closest('[data-id]'); if (!b) return;
    b.disabled = true;
    try { await api(`/api/cozinha/pedidos/${b.dataset.id}/status`, { metodo: 'POST', dados: { status: b.dataset.st } }); await carregar(); }
    catch (er) { toast(er.message, 'erro'); b.disabled = false; }
  });

  const setores = document.getElementById('setores');
  const pintarSetor = () => setores.querySelectorAll('[data-setor]').forEach(b => b.classList.toggle('marcado', b.dataset.setor === setor));
  pintarSetor();
  setores.onclick = e => {
    const b = e.target.closest('[data-setor]'); if (!b) return;
    setor = b.dataset.setor;
    try { localStorage.setItem('deufome_setor', setor); } catch {}
    pintarSetor(); conhecidos = null; carregar();
    toast(setor ? `Mostrando só os itens de ${NOMES_SETOR[setor]}.` : 'Mostrando todos os itens.');
  };

  /* Esgotou algo? Marca com um toque e some na hora de todos os tablets. */
  document.getElementById('esgotar').onclick = async () => {
    const f = document.createElement('div');
    f.className = 'gaveta-fundo';
    f.innerHTML = '<aside class="gaveta"><header><h2>O que acabou?</h2><button class="btn btn-p" data-fechar>Fechar</button></header><p>Toque para marcar como esgotado. Some dos tablets na hora. Toque de novo quando voltar.</p><input type="search" placeholder="Procurar prato" id="busca"><div class="gaveta-lista">Carregando…</div></aside>';
    document.body.appendChild(f);
    const fechar = () => { f.classList.add('saindo'); setTimeout(() => f.remove(), 220); };
    f.addEventListener('click', e => { if (e.target === f || e.target.closest('[data-fechar]')) fechar(); });
    let cats = [];
    const pintar = () => {
      const q = f.querySelector('#busca').value.trim().toLowerCase();
      f.querySelector('.gaveta-lista').innerHTML = cats.map(c => {
        const ps = c.produtos.filter(p => !q || p.nome.toLowerCase().includes(q));
        return ps.length ? `<h3>${esc(c.nome)}</h3>${ps.map(p => `<button class="esg ${p.disponivel ? '' : 'acabou'}" data-esg="${p.id}"><span>${esc(p.nome)}</span><em>${p.disponivel ? 'Tem' : 'Esgotado'}</em></button>`).join('')}` : '';
      }).join('') || '<p>Nenhum prato encontrado.</p>';
    };
    try { cats = (await api('/api/cozinha/produtos')).categorias; pintar(); } catch (er) { toast(er.message, 'erro'); }
    f.querySelector('#busca').oninput = pintar;
    f.querySelector('.gaveta-lista').onclick = async e => {
      const b = e.target.closest('[data-esg]'); if (!b) return;
      const p = cats.flatMap(c => c.produtos).find(x => x.id == b.dataset.esg);
      try {
        const r = await api(`/api/cozinha/produtos/${p.id}/disponivel`, { metodo: 'POST', dados: { disponivel: !p.disponivel } });
        p.disponivel = r.disponivel; pintar();
        toast(p.disponivel ? `${p.nome} voltou ao cardápio.` : `${p.nome} marcado como esgotado.`);
      } catch (er) { toast(er.message, 'erro'); }
    };
  };

  document.getElementById('sair').onclick = async () => { await api('/api/logout', { metodo: 'POST' }).catch(() => {}); location.href = '/admin'; };
  api('/api/me').then(u => { estab = u.estabelecimento || ''; document.getElementById('titulo').innerHTML = `Cozinha <small>${esc(estab)}</small>`; }).catch(() => {});
  carregar();
  setInterval(carregar, 2000);
})();
