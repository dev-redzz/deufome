(() => {
  const { icone, esc, api, toast, segundosDesde, tempo, imprimir } = DF;
  let estab = '', autoImprimir = false, pedidosAtuais = [];
  try { autoImprimir = localStorage.getItem('deufome_auto_imprimir') === '1'; } catch {}
  const ATRASO_MIN = 15;
  let conhecidos = null, somLigado = false, ctx;
  const proximo = { recebido: ['preparo', 'Começar preparo', 'btn-azul'], preparo: ['pronto', 'Marcar como pronto', 'btn-sucesso'], pronto: ['entregue', 'Entregue na mesa', 'btn-marinho'] };
  const anterior = { preparo: 'recebido', pronto: 'preparo' };

  document.getElementById('som').onclick = e => { ctx = ctx || new AudioContext(); somLigado = !somLigado; e.target.textContent = somLigado ? 'Som ligado' : 'Ativar som'; if (somLigado) bip(); };
  function bip() {
    if (!somLigado || !ctx) return;
    [0, .18].forEach(t => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(.2, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + t + .15); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + .16); });
  }
  setInterval(() => document.getElementById('relogio').textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), 1000);

  async function carregar() {
    try {
      const r = await api('/api/cozinha/pedidos');
      const novos = conhecidos ? r.pedidos.filter(p => !conhecidos.has(p.id)) : [];
      if (novos.length) bip();
      pedidosAtuais = r.pedidos;
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
          <div class="cab"><span class="mesa">Mesa ${String(p.mesa).padStart(2, '0')}</span><span class="tempo">${tempo(s)}</span></div>
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
    return `<h1>${esc(estab)}</h1><h2>MESA ${String(p.mesa).padStart(2, '0')}</h2><div class="c">Pedido ${p.numero} · ${hora}</div><hr>
      ${p.itens.map(i => `<div class="g">${i.quantidade}x ${esc(i.nome)}</div>${i.adicionais.length ? `<div class="add">+ ${esc(i.adicionais.join(', '))}</div>` : ''}${i.observacao ? `<div class="obs">** ${esc(i.observacao)} **</div>` : ''}`).join('')}<hr>`;
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

  document.getElementById('sair').onclick = async () => { await api('/api/logout', { metodo: 'POST' }).catch(() => {}); location.href = '/admin'; };
  api('/api/me').then(u => { estab = u.estabelecimento || ''; document.getElementById('titulo').innerHTML = `Cozinha<small>${esc(estab)}</small>`; }).catch(() => {});
  carregar();
  setInterval(carregar, 2000);
})();
