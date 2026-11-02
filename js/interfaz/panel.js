/* =========================================================
   Panel de opciones: muestra solo lo que aplica al formato
   elegido, resumen, pasos y aviso de la IA
   ========================================================= */
(() => {
  const { $, state } = App;
  const EXT_IMG = { jpg: '.jpg', png: '.png', webp: '.webp' };

  function actualizarPasos() {
    const actual = state.descargado ? 3 : state.items.length ? 2 : 1;
    document.querySelectorAll('.paso').forEach((li) => {
      const n = Number(li.dataset.paso);
      li.classList.toggle('activo', n === actual);
      li.classList.toggle('hecho', n < actual || (n === 3 && state.descargado));
    });
  }

  // Muestra solo las opciones del formato elegido
  function actualizarCampos(o) {
    const hayPdf = state.items.some((it) => it.kind === 'pdf');
    document.querySelectorAll('.panel [data-para]').forEach((el) => {
      let ver = el.dataset.para.split(' ').includes(o.fmt);
      if (el.dataset.si === 'pdf') ver = ver && hayPdf;
      el.hidden = !ver;
    });
  }

  // Cuántos archivos entran en cada formato
  function actualizarCompat(o) {
    const total = state.items.length;
    document.querySelectorAll('[data-compat]').forEach((el) => {
      const n = state.items.filter((it) => App.compatible(it, el.dataset.compat)).length;
      el.textContent = !total ? '' : n === total ? 'todos' : `${n} de ${total}`;
    });
    const fuera = state.items.filter((it) => !App.compatible(it, o.fmt)).length;
    const aviso = $('#avisoCompat');
    aviso.hidden = !fuera;
    if (fuera) {
      aviso.textContent = o.fmt === 'excel'
        ? `${fuera} ${fuera === 1 ? 'archivo no tiene' : 'archivos no tienen'} tablas y se ${fuera === 1 ? 'omite' : 'omiten'}. Excel solo toma tablas (CSV, Excel o tablas dentro de Word, Markdown o HTML).`
        : `${fuera} ${fuera === 1 ? 'imagen se omite' : 'imágenes se omiten'}: no tienen texto que sacar.`;
    }
  }

  function actualizarNotaIA(o) {
    const imagenes = state.items.filter((it) => it.kind === 'imagen').length;
    $('#iaNota').hidden = !o.ia;
    if (!o.ia) return;
    const { total, listas, faltan } = App.ia.contar();
    const hd = state.items.filter((it) => it.kind === 'imagen' && it.ia && it.ia.estado === 'hd').length;
    let texto = 'La IA duplica la resolución de tus fotos e imágenes y les da más nitidez. Corre en tu computadora, así que tarda unos segundos por imagen.';
    if (!imagenes && state.items.length) texto = 'La IA solo mejora fotos e imágenes. Tus documentos se convierten con calidad alta.';
    else if (faltan) texto = `Mejorando con IA: ${listas} de ${total} listas. Puedes seguir ajustando mientras tanto.`;
    else if (total) texto = `Listo: ${listas} ${listas === 1 ? 'imagen mejorada' : 'imágenes mejoradas'} con IA.`;
    if (hd) texto += ` ${hd} ya ${hd === 1 ? 'tenía' : 'tenían'} buena resolución (más de ${App.ia.LIMITE_PX} px) y se dejan igual.`;
    $('#iaTexto').textContent = texto;
  }

  function extension(o) {
    const n = state.items.filter((it) => App.compatible(it, o.fmt)).length;
    if (o.fmt === 'imagen') {
      const unaImagen = n === 1 && state.items.find((it) => App.compatible(it, o.fmt)).kind === 'imagen';
      return n <= 1 && (unaImagen || !n) ? EXT_IMG[o.imgFormato] : '.zip';
    }
    if (o.archivos === 'separar' && n > 1) return '.zip';
    return App.SALIDAS[o.fmt].ext;
  }

  function actualizarResumen() {
    const o = App.opts();
    const nombre = App.SALIDAS[o.fmt].nombre;
    const go = $('#go');
    const n = state.items.filter((it) => App.compatible(it, o.fmt)).length;
    $('#ext').textContent = extension(o);
    if (!state.convirtiendo) {
      go.textContent = `Convertir a ${nombre}`;
      go.disabled = n === 0;
    }
    go.className = 'btn go ' + (o.fmt === 'docx' ? 'doc' : 'pdf');
    $('#sumPages').textContent = `${n} ${n === 1 ? 'archivo' : 'archivos'}`;
    $('#sumSize').textContent = ['pdf', 'docx'].includes(o.fmt)
      ? `${App.SIZE_NAMES[o.size]} · ${App.ORIENT_NAMES[o.orient]} · ${o.nombre}`
      : o.fmt === 'imagen' ? `${o.imgFormato.toUpperCase()} · ${o.nombre}` : nombre;
    actualizarCampos(o);
    actualizarCompat(o);
    actualizarNotaIA(o);
    actualizarPasos();
  }

  // Al cambiar cualquier opción
  document.querySelectorAll('.panel input, .panel select').forEach((el) => el.addEventListener('change', () => {
    state.descargado = false;
    if (el.name === 'calidad' || el.name === 'fmt') {
      if (App.opts().ia) App.ia.mejorarTodas();
      App.render(); // marcas de IA y archivos que no entran en el formato
    }
    actualizarResumen();
  }));

  App.on('resumen', actualizarResumen);
  App.on('ia', actualizarResumen);
  App.actualizarResumen = actualizarResumen;
})();
