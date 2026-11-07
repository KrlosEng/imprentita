/* =========================================================
   Movimiento con JavaScript (Web Animations API)
   - flip: las tarjetas se deslizan a su nuevo lugar al
     reordenar o quitar una
   - salir: una tarjeta se encoge y desvanece antes de irse
   - realzar: pequeño "golpe" de sello para confirmar un cambio
   - aparecer: un elemento que se muestra entra deslizándose
   Con "reducir movimiento" ninguna de estas se ejecuta.
   ========================================================= */
(() => {
  const EASE = 'cubic-bezier(0.25, 1, 0.5, 1)';
  const EASE_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const consulta = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reducido = () => consulta.matches;

  // ---------- Reordenar con FLIP ----------
  // Guarda dónde estaba cada tarjeta, deja que cambie el DOM y anima desde la posición vieja
  function flip(contenedor, cambiar) {
    if (reducido()) { cambiar(); return; }
    const antes = new Map();
    contenedor.querySelectorAll('.card').forEach((c) => antes.set(c.dataset.id, c.getBoundingClientRect()));
    cambiar();
    contenedor.querySelectorAll('.card').forEach((c) => {
      const r0 = antes.get(c.dataset.id);
      if (!r0) return;
      const r1 = c.getBoundingClientRect();
      const dx = r0.left - r1.left, dy = r0.top - r1.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      c.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
        { duration: 360, easing: EASE },
      );
    });
  }

  // ---------- Salida de una tarjeta ----------
  function salir(el) {
    if (reducido()) return Promise.resolve();
    el.classList.add('saliendo');
    const anim = el.animate(
      [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.86) rotate(-3deg)' }],
      { duration: 180, easing: EASE, fill: 'forwards' },
    );
    // Con la pestaña en segundo plano el navegador pausa las animaciones:
    // el tiempo máximo asegura que la tarjeta se quite igual
    return Promise.race([anim.finished.catch(() => {}), new Promise((r) => setTimeout(r, 220))]);
  }

  // ---------- Confirmar un cambio: un pulso breve ----------
  function realzar(el, escala = 1.12) {
    if (!el || reducido()) return;
    el.animate(
      [{ transform: 'none' }, { transform: `scale(${escala})`, offset: 0.4 }, { transform: 'none' }],
      { duration: 220, easing: EASE },
    );
  }

  // ---------- Aparecer ----------
  function aparecer(el) {
    if (!el || reducido()) return;
    el.animate(
      [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
      { duration: 240, easing: EASE },
    );
  }

  // ---------- Sacudida de error ----------
  function sacudir(el, base = '') {
    if (!el || reducido()) return;
    el.animate(
      [0, -7, 6, -4, 2, 0].map((x) => ({ transform: `${base} translateX(${x}px)` })),
      { duration: 360, easing: 'ease-out' },
    );
  }

  App.mov = { reducido, flip, salir, realzar, aparecer, sacudir };
})();
