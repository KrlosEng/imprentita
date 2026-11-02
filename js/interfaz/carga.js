/* =========================================================
   Agregar archivos: explorador, arrastrar, pegar y ejemplos
   ========================================================= */
(() => {
  const { $, state } = App;
  const drop = $('#drop');
  const fileInput = $('#file');

  async function addFiles(files) {
    const lista = [...files];
    if (!lista.length) return;
    if (lista.length > 1 || !lista[0].type.startsWith('image/')) App.toast(`Abriendo ${lista.length} ${lista.length === 1 ? 'archivo' : 'archivos'}…`, 10000);
    let added = 0;
    const errores = { tipo: [], lectura: [], red: [] };
    for (const f of lista) {
      const it = await App.entradas.abrirArchivo(f);
      if (it.error) { errores[it.error].push(it.name); continue; }
      state.items.push(it);
      added++;
      App.emit('items');
    }
    if (App.opts().ia) App.ia.mejorarTodas();

    if (errores.red.length) App.toast('No se pudo descargar el lector de ese formato. La primera vez se necesita internet.', 6000);
    else if (errores.tipo.length) {
      const doc = errores.tipo.some((n) => /\.(doc|ppt|pptx)$/i.test(n));
      App.toast(doc
        ? 'Los archivos .doc y .ppt no se pueden abrir. Guárdalos como .docx o PDF y vuelve a intentarlo.'
        : `No se pudo abrir: ${errores.tipo.join(', ')}. Usa imágenes, PDF, Word (.docx), Excel, CSV o texto.`, 6000);
    } else if (errores.lectura.length) App.toast(`No se pudo leer ${errores.lectura.join(', ')}. Puede estar dañado o protegido con contraseña.`, 6000);
    else if (added) App.toast(`${added} ${added === 1 ? 'archivo agregado' : 'archivos agregados'}`);
  }

  // Explorador de archivos
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

  // Arrastrar y soltar
  const hayArchivos = (e) => e.dataTransfer && e.dataTransfer.types.includes('Files');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
    if (!hayArchivos(e)) return;
    e.preventDefault(); drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('over')));
  drop.addEventListener('drop', (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  // Si sueltan fuera de la zona, igual se agregan (y el navegador no abre el archivo)
  window.addEventListener('dragover', (e) => { if (hayArchivos(e)) e.preventDefault(); });
  window.addEventListener('drop', (e) => {
    if (hayArchivos(e) && !drop.contains(e.target)) { e.preventDefault(); addFiles(e.dataTransfer.files); }
  });

  // Pegar con Ctrl+V
  window.addEventListener('paste', (e) => {
    const files = [...((e.clipboardData && e.clipboardData.files) || [])];
    if (files.length) addFiles(files);
  });

  // Vaciar
  $('#clear').addEventListener('click', () => {
    state.items.forEach((it) => it.src && URL.revokeObjectURL(it.src));
    state.items = [];
    state.descargado = false;
    App.emit('items');
  });

  // ---------- Ejemplos: una imagen, un PDF, unas notas en Markdown y una tabla CSV ----------
  async function imagenEjemplo() {
    const c = document.createElement('canvas');
    c.width = 600; c.height = 800;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 600, 800);
    grad.addColorStop(0, '#ff3d9a'); grad.addColorStop(1, '#ffd60a');
    g.fillStyle = grad; g.fillRect(0, 0, 600, 800);
    g.fillStyle = 'rgba(255,255,255,.2)';
    for (let y = 0; y < 800; y += 24) for (let x = (y / 24) % 2 ? 12 : 0; x < 600; x += 24) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 86px "Bricolage Grotesque", sans-serif';
    g.fillText('Póster', 300, 400);
    g.font = '600 22px "JetBrains Mono", monospace';
    g.fillText('600 × 800 px', 300, 475);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    return new File([blob], 'poster-feria.png', { type: 'image/png' });
  }

  async function pdfEjemplo() {
    const run = (text, extra) => ({ text, ...extra });
    const bytes = await App.pdf.bloquesAPdf([
      { t: 'h', nivel: 1, runs: [run('Feria del Libro 2026')] },
      { t: 'p', runs: [run('Del '), run('14 al 22 de noviembre', { b: true }), run(' en el Centro Cultural. Entrada libre para estudiantes con credencial.')] },
      { t: 'h', nivel: 2, runs: [run('Programa')] },
      { t: 'li', nivel: 0, orden: null, runs: [run('Presentaciones de autores cada día a las 18:00')] },
      { t: 'li', nivel: 0, orden: null, runs: [run('Taller de encuadernación (cupo de 20 personas)')] },
      { t: 'li', nivel: 0, orden: null, runs: [run('Intercambio de libros usados el sábado')] },
      { t: 'p', runs: [run('Más información en la recepción del centro.', { i: true })] },
    ], { size: 'a4', orient: 'p', margin: 18 });
    return new File([bytes], 'folleto-feria.pdf', { type: 'application/pdf' });
  }

  const markdownEjemplo = () => new File([`# Notas de la reunión

**Fecha:** 3 de noviembre · **Asistentes:** equipo de diseño y ventas

## Acuerdos
1. Lanzar el catálogo nuevo el lunes 10.
2. Revisar los precios del segundo trimestre.
3. Preparar las fotos de producto con fondo blanco.

## Pendientes
- Enviar el borrador del folleto a imprenta
- Confirmar el lugar para la feria
- Pedir cotización de envíos

| Tarea | Responsable | Fecha |
|---|---|---|
| Catálogo | Ana | 10 nov |
| Precios | Luis | 12 nov |
| Fotos | Marta | 14 nov |
`], 'notas-reunion.md', { type: 'text/markdown' });

  const csvEjemplo = () => new File([`Mes,Producto,Unidades,Ingresos
Enero,Cuadernos,320,4800
Enero,Plumas,850,2550
Febrero,Cuadernos,290,4350
Febrero,Plumas,910,2730
Marzo,Cuadernos,410,6150
Marzo,Plumas,780,2340
Abril,Cuadernos,365,5475
Abril,Plumas,1020,3060
`], 'ventas-primer-cuatrimestre.csv', { type: 'text/csv' });

  $('#sample').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Creando ejemplos…';
    try {
      await addFiles([await imagenEjemplo(), await pdfEjemplo(), markdownEjemplo(), csvEjemplo()]);
    } catch (err) {
      console.error(err);
      App.toast('No se pudieron crear los ejemplos. Revisa tu conexión a internet.', 5000);
    }
    btn.disabled = false; btn.textContent = 'Probar con ejemplos';
  });
})();
