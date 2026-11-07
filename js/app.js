/* =========================================================
   Arranque y botón "Convertir"
   ========================================================= */
(() => {
  const { $, state } = App;

  function setProgreso(p, texto) {
    if (texto) $('#progresoTexto').textContent = texto;
    if (p !== null && p !== undefined) {
      const v = Math.min(1, Math.max(0, p));
      $('#bar').style.transform = `scaleX(${v.toFixed(3)})`;
      $('#barra').setAttribute('aria-valuenow', Math.round(v * 100));
    }
  }

  // Espera a que la IA termine, mostrando el avance
  let esperandoIA = false;
  const mostrarIA = () => {
    const { total, listas } = App.ia.contar();
    if (esperandoIA && total) setProgreso(listas / total, `Mejorando con IA… ${listas} de ${total}`);
  };
  App.on('ia', mostrarIA);

  async function esperarIA() {
    esperandoIA = true;
    mostrarIA();
    try { await App.ia.esperar(); } finally { esperandoIA = false; }
  }

  // Avisos del resultado: quedan visibles bajo el botón, no se pierden como el aviso flotante
  function mostrarAvisos(avisos) {
    const caja = $('#avisoResultado');
    const unicos = [...new Set(avisos)];
    caja.hidden = !unicos.length;
    if (!unicos.length) return;
    caja.innerHTML = '<strong>Ten en cuenta:</strong><ul></ul>';
    const ul = caja.querySelector('ul');
    unicos.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); });
    App.mov.aparecer(caja);
  }

  const mb = (bytes) => (bytes < 1048576 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1048576).toFixed(1)} MB`);

  $('#go').addEventListener('click', async () => {
    if (state.convirtiendo) return;
    const o = App.opts();
    o.base = ($('#fname').value.trim() || 'mis-documentos').replace(/[\\/:*?"<>|]+/g, '-');
    const items = state.items.filter((it) => App.compatible(it, o.fmt));
    const omitidos = state.items.length - items.length;
    if (!items.length) return;

    const go = $('#go');
    state.convirtiendo = true;
    go.disabled = true;
    go.classList.add('convirtiendo');
    go.textContent = 'Convirtiendo…';
    $('#progreso').hidden = false;
    $('#avisoResultado').hidden = true;
    setProgreso(0, 'Preparando…');
    // Las salidas anotan aquí lo que conviene saber del resultado
    // (páginas sin texto, PDF cifrados, caracteres que no caben en la fuente…)
    o.avisos = [];

    try {
      if (o.ia && items.some((it) => it.kind === 'imagen')) {
        App.ia.mejorarTodas({ reintentar: true });
        await esperarIA();
        const { fallidas } = App.ia.contar();
        if (fallidas) o.avisos.push(`${fallidas} ${fallidas === 1 ? 'imagen se usó' : 'imágenes se usaron'} sin la mejora de IA porque no se pudo cargar el modelo.`);
      }
      const archivos = await App.salidas[o.fmt](items, o, setProgreso);
      setProgreso(1, 'Descargando…');
      const r = await App.paquete.entregar(archivos, o.base);
      state.descargado = true;
      const cuantos = r.cuantos ? ` con ${r.cuantos} archivos` : '';
      App.toast(`Listo: ${r.nombre}${cuantos} (${mb(r.tamano)})${omitidos ? ` · se ${omitidos === 1 ? 'omitió 1 archivo' : `omitieron ${omitidos} archivos`}` : ''}`, 5000, 'ok');
      App.mov.celebrar(go);
      mostrarAvisos(o.avisos);
    } catch (err) {
      console.error(err);
      App.toast(/insegura/.test(err.message)
        ? 'Esta conexión no permite comprobar que las herramientas sean seguras. Abre la app desde https://imprentita.vercel.app o con doble clic en index.html.'
        : /Integridad/.test(err.message)
        ? 'Una herramienta descargada no pasó la revisión de seguridad y no se usó. Recarga la página e inténtalo de nuevo.'
        : /descargar/.test(err.message)
          ? 'No se pudo descargar una herramienta necesaria. La primera vez se necesita internet.'
          : 'Algo falló al convertir. Prueba con menos archivos o con calidad "Alta".', 7000, 'error');
    } finally {
      state.convirtiendo = false;
      go.classList.remove('convirtiendo');
      setTimeout(() => { $('#progreso').hidden = true; }, 700);
      App.actualizarResumen();
    }
  });

  App.render();
})();
