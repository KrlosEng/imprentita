/* =========================================================
   Panel de opciones: muestra solo lo que aplica al formato
   elegido, el resumen, la línea de estado bajo el título y el
   aviso de la IA
   ========================================================= */
(() => {
  const { $, state } = App;
  const EXT_IMG = { jpg: '.jpg', png: '.png', webp: '.webp' };
  let iniciado = false; // no animar lo que ya está en pantalla al abrir la página

  // Muestra u oculta un elemento; si aparece, entra deslizándose
  function mostrar(el, ver) {
    const estabaOculto = el.hidden;
    el.hidden = !ver;
    if (iniciado && estabaOculto && ver) App.mov.aparecer(el);
  }

  // La línea bajo el título: qué se va a descargar, en una frase
  function actualizarEstado(o, n) {
    const el = $('#estado');
    const total = state.items.length;
    if (!total) {
      el.textContent = 'Agrega imágenes, PDF, Word, Excel o texto y elige en qué convertirlos.';
      return;
    }
    const nombre = App.SALIDAS[o.fmt].nombre;
    const fuera = total - n;
    const partes = [];
    if (state.descargado) partes.push('Descargado.');
    partes.push(n
      ? `${n} de ${total} ${total === 1 ? 'archivo' : 'archivos'} ${o.archivos === 'unir' && n > 1 && o.fmt !== 'imagen' ? 'se unen en un' : 'se convierten a'} ${nombre}.`
      : `Ninguno de tus ${total} archivos se puede pasar a ${nombre}.`);
    if (fuera && n) partes.push(`${fuera} se ${fuera === 1 ? 'omite' : 'omiten'}.`);
    el.textContent = partes.join(' ');
  }

  // Muestra solo las opciones del formato elegido
  function actualizarCampos(o) {
    const hayPdf = state.items.some((it) => it.kind === 'pdf');
    document.querySelectorAll('.panel [data-para]').forEach((el) => {
      let ver = el.dataset.para.split(' ').includes(o.fmt);
      if (el.dataset.si === 'pdf') ver = ver && hayPdf;
      mostrar(el, ver);
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
    mostrar(aviso, Boolean(fuera));
    if (fuera) {
      aviso.textContent = o.fmt === 'excel'
        ? `${fuera} ${fuera === 1 ? 'archivo no tiene' : 'archivos no tienen'} tablas y se ${fuera === 1 ? 'omite' : 'omiten'}. Excel solo toma tablas (CSV, Excel o tablas dentro de Word, Markdown o HTML).`
        : `${fuera} ${fuera === 1 ? 'imagen se omite' : 'imágenes se omiten'}: no tienen texto que sacar.`;
    }
  }

  function actualizarNotaIA(o) {
    const imagenes = state.items.filter((it) => it.kind === 'imagen').length;
    mostrar($('#iaNota'), o.ia);
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
    actualizarEstado(o, n);
  }

  // Al cambiar cualquier opción
  document.querySelectorAll('.panel input, .panel select').forEach((el) => el.addEventListener('change', () => {
    state.descargado = false;
    if (el.name === 'fmt' || el.name === 'calidad') {
      // el icono del formato elegido se estampa
      App.mov.realzar(el.closest('.opt').querySelector('.ico, span'), 1.15);
      if (App.opts().ia) App.ia.mejorarTodas();
      App.render(); // marcas de IA y archivos que no entran en el formato
    }
    actualizarResumen();
  }));

  App.on('resumen', actualizarResumen);
  App.on('ia', actualizarResumen);
  App.actualizarResumen = actualizarResumen;
  // A partir de aquí los cambios ya los provoca la persona: se animan
  setTimeout(() => { iniciado = true; }, 0);
})();
