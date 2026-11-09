(() => {
  const ajustar = () => document.documentElement.style.setProperty('--altura', window.innerHeight + 'px');
  ajustar();
  window.addEventListener('resize', ajustar);
  window.addEventListener('orientationchange', () => { ajustar(); setTimeout(ajustar, 250); setTimeout(ajustar, 700); });
  document.addEventListener('fullscreenchange', () => setTimeout(ajustar, 150));
})();

const DF = (() => {
  const P = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    sino: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    conta: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    sacola: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    relogio: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    caixa: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>',
    impressora: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
    estrela: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.9z"/>',
    lua: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    balao: '<path d="M4 5h16v11H9l-5 4z"/>',
    alerta: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17.5v.5"/>',
    loja: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
    chef: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 1 1 1.2-7.8A4 4 0 0 1 15.8 6.7 4 4 0 1 1 17 14.5z"/>',
    tablet: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M10.5 18h3"/>',
    mesa: '<path d="M3 9h18M5 9v10M19 9v10M8 9l1-4h6l1 4"/>',
    cardapio: '<path d="M7 4v7a2 2 0 0 0 2 2v7M7 4v5M11 4v5"/><path d="M16 4c-1.5 1.5-2 4-2 6s1 3 2 3v7"/>',
    sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/>',
    cadeado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    voltar: '<path d="M15 5l-7 7 7 7"/>',
    seta: '<path d="M9 5l7 7-7 7"/>',
    lixo: '<path d="M4 7h16M10 7V4h4v3M6 7l1 13h10l1-13"/>',
    fogo: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5.5 1-8.5z"/>',
    vapor: '<path d="M7 9l-3-3M11 7l-1-4M15 7l1.5-3.5"/>',
    camera: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17 7h.01"/>',
    fone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    pincel: '<path d="M14 4l6 6-8.5 8.5a3 3 0 0 1-4.2 0l-1.8-1.8a3 3 0 0 1 0-4.2z"/><path d="M4 20l3-3"/>',
    engrenagem: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    imagem: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    pessoas: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  };
  const icone = (n, t = 24, e = 2.5) => `<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${e}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
  const real = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12));
  const segundosDesde = utc => Math.max(0, Math.floor((Date.now() - Date.parse(utc.replace(' ', 'T') + 'Z')) / 1000));
  const tempo = s => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)} min` : `${Math.floor(s / 3600)}h${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}`;

  let toastTimer;
  function toast(msg, tipo = '') {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); document.body.appendChild(el); }
    el.className = 'toast ' + tipo;
    el.textContent = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2600);
  }

  async function api(caminho, { metodo = 'GET', dados, headers = {}, form } = {}) {
    const op = { method: metodo, headers: { ...headers }, credentials: 'same-origin' };
    if (form) op.body = form;
    else if (metodo !== 'GET') { op.headers['Content-Type'] = 'application/json'; op.body = JSON.stringify(dados || {}); }
    let r;
    try { r = await fetch(caminho, op); } catch (e) { const er = new Error('Sem conexão com o servidor.'); er.offline = true; throw er; }
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) { const er = new Error(corpo.erro || 'Erro inesperado.'); er.status = r.status; throw er; }
    return corpo;
  }

  function modal(html, { classe = '', aoFechar } = {}) {
    document.querySelector('.toast')?.remove();
    const f = document.createElement('div');
    f.className = 'modal-fundo';
    f.innerHTML = `<div class="modal ${classe}">${html}</div>`;
    f.addEventListener('click', e => { if (e.target === f) fechar(); });
    function fechar() { f.remove(); aoFechar && aoFechar(); }
    document.body.appendChild(f);
    return { el: f.firstElementChild, fechar };
  }

  let errosEnviados = 0;
  function reportarErro(mensagem, detalhe) {
    if (errosEnviados++ >= 5 || !mensagem) return;
    try {
      fetch('/api/erros', { method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ mensagem: String(mensagem).slice(0, 500), detalhe: String(detalhe || '').slice(0, 3000), url: location.pathname + ' · ' + navigator.userAgent.slice(0, 120) }) }).catch(() => {});
    } catch {}
  }
  window.addEventListener('error', e => reportarErro(e.message, e.error?.stack || `${e.filename}:${e.lineno}:${e.colno}`));
  window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r && (r.status || r.offline)) return; reportarErro(r?.message || String(r), r?.stack); });

  function imprimir(html) {
    let area = document.getElementById('area-impressao');
    if (!area) { area = document.createElement('div'); area.id = 'area-impressao'; document.body.appendChild(area); }
    area.innerHTML = html;
    document.body.classList.add('imprimindo');
    const fim = () => { document.body.classList.remove('imprimindo'); area.innerHTML = ''; window.removeEventListener('afterprint', fim); };
    window.addEventListener('afterprint', fim);
    setTimeout(() => { window.print(); setTimeout(fim, 1500); }, 60);
  }

  const dataHora = utc => new Date(utc.replace(' ', 'T') + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return { icone, real, esc, uid, toast, api, modal, segundosDesde, tempo, imprimir, dataHora };
})();

window.DF = DF;
export default DF;
