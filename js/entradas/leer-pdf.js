/* =========================================================
   Leer PDF con pdf.js: abrir, dibujar páginas y sacar texto
   ========================================================= */
(() => {
  // pdf.js se queda con el buffer que recibe, por eso siempre se le pasa una copia
  async function abrir(bytes) {
    await App.libs.cargar('pdfjs');
    return window.pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  }

  // Dibuja una página en un canvas. escala 1 = 72 ppp
  async function dibujarPagina(pdf, n, escala, rot = 0) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: escala, rotation: (page.rotate + rot) % 360 });
    const c = document.createElement('canvas');
    c.width = Math.floor(viewport.width);
    c.height = Math.floor(viewport.height);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    // intent 'print' no espera a requestAnimationFrame: así sigue funcionando
    // aunque la pestaña esté en segundo plano
    await page.render({ canvasContext: g, viewport, intent: 'print' }).promise;
    return c;
  }

  // Texto de una página agrupado en párrafos
  async function parrafosDePagina(pdf, n) {
    const page = await pdf.getPage(n);
    const tc = await page.getTextContent();
    const lineas = [];
    let linea = null;
    for (const it of tc.items) {
      if (!('str' in it)) continue;
      const y = it.transform[5];
      if (!linea || Math.abs(y - linea.y) > 2) {
        linea = { y, texto: '', alto: Math.abs(it.transform[3]) || 10 };
        lineas.push(linea);
      }
      linea.texto += it.str;
      if (it.hasEOL) linea = null;
    }
    const llenas = lineas.filter((l) => l.texto.trim());
    // Une líneas en párrafos. Empieza uno nuevo si hay un salto grande
    // entre líneas o si cambia el tamaño de letra (por ejemplo, tras un título)
    const parrafos = [];
    let actual = '';
    llenas.forEach((l, i) => {
      const prev = llenas[i - 1];
      const salto = prev ? Math.abs(prev.y - l.y) : 0;
      const cambiaLetra = prev && Math.abs(prev.alto - l.alto) > 1.5;
      if (prev && (cambiaLetra || salto > Math.min(prev.alto, l.alto) * 1.75)) { parrafos.push(actual); actual = ''; }
      actual += (actual && !actual.endsWith('-') ? ' ' : '') + l.texto.trim();
    });
    if (actual) parrafos.push(actual);
    return parrafos;
  }

  // Todo el texto del PDF, una lista de párrafos por página
  async function texto(pdf) {
    const paginas = [];
    for (let n = 1; n <= pdf.numPages; n++) paginas.push(await parrafosDePagina(pdf, n));
    return paginas;
  }

  // Tamaño de la página en mm (ya girada)
  async function tamanoPagina(pdf, n, rot = 0) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1, rotation: (page.rotate + rot) % 360 });
    return { w: (vp.width * 25.4) / 72, h: (vp.height * 25.4) / 72 };
  }

  App.leerPdf = { abrir, dibujarPagina, texto, tamanoPagina };
})();
