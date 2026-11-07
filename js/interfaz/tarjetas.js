/* =========================================================
   Tarjetas de archivo: dibujar, girar, quitar y reordenar
   ========================================================= */
(() => {
  const { $, state, escapar } = App;
  const grid = $('#grid');
  const vistas = new Set(); // ids ya dibujados (para animar solo las nuevas)
  let dragId = null; // mientras se arrastra no se redibuja (se hace al soltar)

  const ICONS = {
    left: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
    right: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></svg>',
    antes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    despues: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    del: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>',
  };

  const MOTIVO = {
    texto: 'Las imágenes no tienen texto que sacar',
    excel: 'No tiene tablas para Excel',
  };

  function estadoIA(it, usarIA) {
    const ia = it.ia;
    if (!usarIA || !ia || it.kind !== 'imagen') return { badge: '', capa: '', clase: '' };
    if (ia.estado === 'listo') return { badge: '<span class="ia-badge">IA ×2</span>', capa: '', clase: '' };
    if (ia.estado === 'error') return { badge: '<span class="ia-badge sin" title="La IA no pudo mejorar esta imagen; se usa la original">Sin IA</span>', capa: '', clase: '' };
    if (ia.estado === 'hd') return { badge: '<span class="ia-badge hd" title="Ya tiene buena resolución">HD</span>', capa: '', clase: '' };
    if (ia.estado === 'pendiente' || ia.estado === 'procesando') {
      const texto = ia.estado === 'pendiente' ? 'En espera…' : 'Mejorando con IA…';
      return {
        badge: '',
        clase: 'procesando',
        capa: `<div class="ia-capa"><span class="ia-texto">${texto}</span><div class="ia-barra"><div style="transform:scaleX(${(ia.progreso || 0).toFixed(3)})"></div></div></div>`,
      };
    }
    return { badge: '', capa: '', clase: '' };
  }

  // Lo que se ve dentro del recuadro de la tarjeta
  function miniatura(it, usarIA) {
    if (it.kind === 'imagen') {
      const listo = usarIA && it.ia && it.ia.estado === 'listo';
      const w = listo ? it.ia.w : it.w, h = listo ? it.ia.h : it.h;
      const scale = it.rot % 180 ? Math.min(w, h) / Math.max(w, h) : 1;
      return `<img src="${listo ? it.ia.src : it.thumb}" alt="" style="transform: ${giroCss(it, scale)}">`;
    }
    if (it.kind === 'pdf') {
      return `<img class="pagina ${it.paginas > 1 ? 'paginas-pila' : ''}" src="${it.thumb}" alt="" style="transform: ${giroCss(it, it.rot % 180 ? 0.75 : 1)}">`;
    }
    const r = it.resumen;
    if (r.tabla) {
      const filas = r.tabla.map((f) => `<tr>${f.map((c) => `<td>${escapar(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="papel ${it.kind}"><span class="t">${escapar(App.sinExtension(it.name))}</span><table class="mini-tabla">${filas}</table></div>`;
    }
    const lineas = r.lineas.map((l) => `<span class="l">${escapar(l)}</span>`).join('');
    return `<div class="papel ${it.kind}"><span class="t">${escapar(r.titulo || App.sinExtension(it.name))}</span>${lineas}</div>`;
  }

  function info(it, usarIA) {
    if (it.kind !== 'imagen') return escapar(it.info);
    const listo = usarIA && it.ia && it.ia.estado === 'listo';
    const dims = (a, b) => (it.rot % 180 ? `${b} × ${a}` : `${a} × ${b}`);
    return listo ? `${dims(it.w, it.h)} → <b>${dims(it.ia.w, it.ia.h)}</b>` : `${dims(it.w, it.h)} px`;
  }

  // Ángulo acumulado: así el giro siempre va en la dirección que se pidió (270° → 360°, no de vuelta a 0°)
  const giroCss = (it, scale) => `rotate(${it.giro ?? it.rot}deg) scale(${scale})`;

  let cuentaAnterior = 0;
  // Redibuja las tarjetas; las que ya estaban se deslizan a su nuevo lugar
  function render() {
    if (dragId !== null) return;
    App.mov.flip(grid, dibujar);
  }

  function dibujar() {
    grid.innerHTML = '';
    const o = App.opts();
    state.items.forEach((it, i) => {
      const ia = estadoIA(it, o.ia);
      const fuera = !App.compatible(it, o.fmt);
      const girable = it.kind === 'imagen' || it.kind === 'pdf';

      const card = document.createElement('div');
      card.className = `card ${ia.clase} ${vistas.has(it.id) ? '' : 'nueva'} ${fuera ? 'fuera' : ''}`;
      card.draggable = true;
      card.dataset.id = it.id;
      card.innerHTML = `
        <div class="thumb" data-motivo="${fuera ? MOTIVO[o.fmt] : ''}">
          <span class="num">${String(i + 1).padStart(2, '0')}</span>
          ${ia.badge}
          ${miniatura(it, o.ia)}
          ${ia.capa}
          <button class="mover antes" data-act="antes" type="button" title="Mover antes" aria-label="Mover ${App.escapar(it.name)} antes" ${i === 0 ? 'disabled' : ''}>${ICONS.antes}</button>
          <button class="mover despues" data-act="despues" type="button" title="Mover después" aria-label="Mover ${App.escapar(it.name)} después" ${i === state.items.length - 1 ? 'disabled' : ''}>${ICONS.despues}</button>
        </div>
        <div class="meta">
          <div class="name"></div>
          <div class="dims"><span class="tipo ${it.kind}">${App.TIPOS[it.kind].nombre}</span>${info(it, o.ia)}</div>
        </div>
        <div class="tools">
          ${girable ? `
          <button class="tool" data-act="left" type="button" title="Girar a la izquierda" aria-label="Girar a la izquierda">${ICONS.left}</button>
          <button class="tool" data-act="right" type="button" title="Girar a la derecha" aria-label="Girar a la derecha">${ICONS.right}</button>` : ''}
          <button class="tool del ${girable ? '' : 'solo'}" data-act="del" type="button" title="Quitar" aria-label="Quitar archivo">${ICONS.del}</button>
        </div>`;
      card.querySelector('.name').textContent = it.name;
      card.querySelector('.name').title = it.name;
      grid.appendChild(card);
      vistas.add(it.id);
    });
    $('#empty').hidden = state.items.length > 0;
    $('#drop').classList.toggle('vacia', !state.items.length);
    $('#count').textContent = state.items.length;
    if (state.items.length !== cuentaAnterior) App.mov.realzar($('#count'), 1.3);
    cuentaAnterior = state.items.length;
    App.emit('resumen');
  }

  // Solo mueve la barra de progreso, sin redibujar todo
  App.on('ia-progreso', (it) => {
    const bar = grid.querySelector(`.card[data-id="${it.id}"] .ia-barra div`);
    if (bar) bar.style.transform = `scaleX(${it.ia.progreso.toFixed(3)})`;
  });
  App.on('ia', render);
  App.on('items', render);

  // Girar (sin redibujar, para que la miniatura gire suave) y quitar
  grid.addEventListener('click', async (e) => {
    const mov = e.target.closest('.mover');
    if (mov) { mover(mov.closest('.card'), mov.dataset.act === 'antes' ? -1 : 1, mov.dataset.act); return; }
    const btn = e.target.closest('.tool');
    if (!btn) return;
    const card = btn.closest('.card');
    const it = state.items.find((x) => x.id === Number(card.dataset.id));
    if (!it) return;

    if (btn.dataset.act === 'left' || btn.dataset.act === 'right') {
      const paso = btn.dataset.act === 'left' ? -90 : 90;
      it.giro = (it.giro ?? it.rot) + paso;
      it.rot = ((it.rot + paso) % 360 + 360) % 360;
      const img = card.querySelector('.thumb img');
      if (img) {
        const o = App.opts();
        let scale = 1;
        if (it.rot % 180) {
          if (it.kind === 'pdf') scale = 0.75;
          else {
            const listo = o.ia && it.ia && it.ia.estado === 'listo';
            const w = listo ? it.ia.w : it.w, h = listo ? it.ia.h : it.h;
            scale = Math.min(w, h) / Math.max(w, h);
          }
        }
        img.style.transform = giroCss(it, scale);
        card.querySelector('.dims').innerHTML = `<span class="tipo ${it.kind}">${App.TIPOS[it.kind].nombre}</span>${info(it, o.ia)}`;
      }
      return;
    }

    if (btn.dataset.act === 'del') {
      const indice = state.items.indexOf(it);
      const teniaFoco = card.contains(document.activeElement);
      await App.mov.salir(card);
      if (it.src) URL.revokeObjectURL(it.src);
      state.items = state.items.filter((x) => x !== it);
      render();
      // quien usa el teclado no pierde su lugar: el foco pasa a la tarjeta siguiente
      if (teniaFoco) {
        const sig = grid.querySelectorAll('.card .tool.del')[Math.min(indice, state.items.length - 1)];
        (sig || $('#sample')).focus();
      }
    }
  });

  // Mueve una tarjeta un lugar y deja el foco en el mismo botón de esa tarjeta
  function mover(card, delta, act) {
    const from = state.items.findIndex((x) => x.id === Number(card.dataset.id));
    const to = from + delta;
    if (from < 0 || to < 0 || to >= state.items.length) return;
    const [moved] = state.items.splice(from, 1);
    state.items.splice(to, 0, moved);
    render();
    let nueva = grid.querySelector(`.card[data-id="${moved.id}"] [data-act="${act}"]`);
    if (nueva && nueva.disabled) nueva = grid.querySelector(`.card[data-id="${moved.id}"] .mover:not([disabled])`);
    if (nueva) nueva.focus();
    App.toast(`${moved.name} ahora es el número ${to + 1}`, 1800);
  }

  // Reordenar con teclado: Alt + flecha sobre cualquier botón de la tarjeta
  grid.addEventListener('keydown', (e) => {
    if (!e.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    mover(card, e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1, e.target.dataset.act);
  });

  // Reordenar arrastrando
  grid.addEventListener('dragstart', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    dragId = Number(card.dataset.id);
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(dragId));
  });
  grid.addEventListener('dragend', () => {
    dragId = null;
    render();
  });
  grid.addEventListener('dragover', (e) => {
    if (dragId === null) return;
    e.preventDefault();
    const card = e.target.closest('.card');
    grid.querySelectorAll('.target').forEach((c) => c.classList.remove('target'));
    if (card && Number(card.dataset.id) !== dragId) card.classList.add('target');
  });
  grid.addEventListener('drop', (e) => {
    if (dragId === null) return;
    e.preventDefault(); e.stopPropagation();
    const card = e.target.closest('.card');
    if (!card) return;
    const from = state.items.findIndex((x) => x.id === dragId);
    const to = state.items.findIndex((x) => x.id === Number(card.dataset.id));
    const [moved] = state.items.splice(from, 1);
    state.items.splice(to, 0, moved);
    dragId = null;
    render();
  });

  App.render = render;
})();
