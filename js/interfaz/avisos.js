/* =========================================================
   Avisos flotantes (toast)
   tipo: 'ok' (palomita que se dibuja), 'error' (se sacude) o nada
   ========================================================= */
(() => {
  const ICONOS = {
    ok: '<svg class="t-icono" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--mint)"/><path d="M6.5 12.5l3.5 3.5 7.5-8" fill="none" stroke="var(--ink-fixed)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg class="t-icono" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="var(--pink)"/><path d="M12 6.5v7M12 17.2h.01" fill="none" stroke="var(--ink-fixed)" stroke-width="2.6" stroke-linecap="round"/></svg>',
  };
  let timer;
  App.toast = (msg, ms = 3200, tipo = '') => {
    const t = App.$('#toast');
    const yaVisible = t.classList.contains('show');
    t.className = 'toast ' + tipo;
    t.innerHTML = (ICONOS[tipo] || '') + '<span></span>';
    t.querySelector('span').textContent = msg;
    // fuerza el reinicio para que la palomita se vuelva a dibujar
    void t.offsetWidth;
    t.classList.add('show');
    if (tipo === 'error' && App.mov) setTimeout(() => App.mov.sacudir(t, 'translate(-50%, 0)'), yaVisible ? 0 : 260);
    clearTimeout(timer);
    timer = setTimeout(() => t.classList.remove('show'), ms);
  };
})();
