/* =========================================================
   Arranque y botón "Convertir"
   ========================================================= */
(() => {
  const { $, state } = App;

  function setProgreso(p, texto) {
    if (texto) $('#progresoTexto').textContent = texto;
    if (p !== null && p !== undefined) $('#bar').style.width = Math.round(p * 100) + '%';
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
    go.textContent = 'Convirtiendo…';
    $('#progreso').hidden = false;
    setProgreso(0, 'Preparando…');

    try {
      if (o.ia && items.some((it) => it.kind === 'imagen')) {
        App.ia.mejorarTodas();
        await esperarIA();
      }
      const archivos = await App.salidas[o.fmt](items, o, setProgreso);
      setProgreso(1, 'Descargando…');
      const r = await App.paquete.entregar(archivos, o.base);
      state.descargado = true;
      const cuantos = r.cuantos ? ` con ${r.cuantos} archivos` : '';
      App.toast(`Listo: ${r.nombre}${cuantos} (${mb(r.tamano)})${omitidos ? ` · se ${omitidos === 1 ? 'omitió 1 archivo' : `omitieron ${omitidos} archivos`}` : ''}`, 5000);
    } catch (err) {
      console.error(err);
      App.toast(/descargar/.test(err.message)
        ? 'No se pudo descargar una herramienta necesaria. La primera vez se necesita internet.'
        : 'Algo falló al convertir. Prueba con menos archivos o con calidad "Alta".', 6000);
    } finally {
      state.convirtiendo = false;
      setTimeout(() => { $('#progreso').hidden = true; }, 700);
      App.actualizarResumen();
    }
  });

  App.render();
})();
