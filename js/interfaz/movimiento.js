/* =========================================================
   Movimiento con JavaScript (Web Animations API)
   - flip: las tarjetas se deslizan a su nuevo lugar al
     reordenar o quitar una
   - salir: una tarjeta se encoge y desvanece antes de irse
   - realzar: pequeño "golpe" de sello para confirmar un cambio
   - aparecer: un elemento que se muestra entra deslizándose
   - celebrar: confeti de tintas al terminar la descarga
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

  // ---------- Golpe de sello ----------
  function realzar(el, escala = 1.18) {
    if (!el || reducido()) return;
    el.animate(
      [{ transform: 'none' }, { transform: `scale(${escala}) rotate(-6deg)`, offset: 0.4 }, { transform: 'none' }],
      { duration: 280, easing: EASE },
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

  // ---------- Invitar a usar el botón principal ----------
  function invitar(el) {
    if (!el || reducido()) return;
    el.animate(
      [{ transform: 'none' }, { transform: 'translate(-2px, -2px)', boxShadow: '7px 7px 0 var(--shadow)', offset: 0.5 }, { transform: 'none' }],
      { duration: 520, easing: EASE, iterations: 2 },
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

  // ---------- Confeti de tintas ----------
  const COLORES = ['var(--pink)', 'var(--blue)', 'var(--yellow)', 'var(--mint)'];
  const FORMAS = ['', 'circulo', 'tira'];
  function celebrar(desde) {
    if (!desde || reducido()) return;
    const r = desde.getBoundingClientRect();
    const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    for (let i = 0; i < 28; i++) {
      const p = document.createElement('span');
      p.className = 'confeti ' + FORMAS[i % FORMAS.length];
      p.style.background = COLORES[i % COLORES.length];
      document.body.appendChild(p);
      // Sale hacia arriba en abanico y cae con un giro
      const ang = (-90 + (Math.random() - 0.5) * 150) * (Math.PI / 180);
      const fuerza = 140 + Math.random() * 160;
      const dx = Math.cos(ang) * fuerza;
      const dy = Math.sin(ang) * fuerza;
      const giro = (Math.random() - 0.5) * 720;
      const anim = p.animate([
        { transform: `translate(${x0}px, ${y0}px) rotate(0deg) scale(.6)`, opacity: 1 },
        { transform: `translate(${x0 + dx * 0.8}px, ${y0 + dy}px) rotate(${giro * 0.6}deg) scale(1)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${x0 + dx}px, ${y0 + dy + 220}px) rotate(${giro}deg) scale(.9)`, opacity: 0 },
      ], { duration: 1000 + Math.random() * 500, easing: 'cubic-bezier(.2, .6, .35, 1)', fill: 'forwards' });
      anim.finished.catch(() => {}).then(() => p.remove());
      setTimeout(() => p.remove(), 2000); // por si la pestaña quedó en segundo plano
    }
  }

  App.mov = { reducido, flip, salir, realzar, aparecer, invitar, sacudir, celebrar };
})();
