/* =========================================================
   Salida PDF
   - Imágenes: una por página
   - PDF: se copian sus páginas tal cual (con el giro elegido)
   - Documentos (Word, texto, Markdown, HTML, Excel): se
     escriben como texto real, que se puede seleccionar
   Al final se unen con pdf-lib
   ========================================================= */
(() => {
  const PT = 0.3528; // 1 punto en mm
  const TINTA = [27, 26, 46];

  // Las fuentes básicas de PDF solo cubren caracteres latinos
  const REEMPLAZOS = { '‘': "'", '’': "'", '‚': "'", '“': '"', '”': '"', '„': '"', '–': '-', '—': '-', '…': '...', '•': '·', '€': 'EUR', ' ': ' ', '\t': '    ' };
  const limpiar = (s) => String(s).replace(/[^\x00-\xff]|\t/g, (c) => REEMPLAZOS[c] ?? '?');
  // ¿Quedan letras que esas fuentes no tienen (chino, árabe, griego, emojis…)?
  const fueraDeFuente = (s) => /[^\x00-\xff]/.test([...String(s)].filter((c) => !(c in REEMPLAZOS)).join(''));

  // Esos textos se dibujan con las fuentes del sistema (que sí tienen todos los
  // alfabetos) y se insertan como imagen nítida, en vez de salir como "?"
  const PX_MM = 8; // ~200 ppp
  const FAMILIA = '"Helvetica Neue", Helvetica, Arial, "Segoe UI", "Noto Sans", sans-serif';
  const fuenteCanvas = (r, size) => `${r.i ? 'italic ' : ''}${r.b ? 'bold ' : ''}${(size * PT * PX_MM).toFixed(1)}px ${r.code ? 'Consolas, "Courier New", monospace' : FAMILIA}`;
  const esRtl = (s) => /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/.test(s);
  const lienzo = document.createElement('canvas').getContext('2d'); // solo para medir

  // ---------- Documentos → PDF ----------
  async function bloquesAPdf(bloques, o) {
    await App.libs.cargar('jspdf', 'autotable');
    const { jsPDF } = window.jspdf;

    let [pw, ph] = App.SIZES[o.size === 'fit' ? 'a4' : o.size];
    const ancha = bloques.some((b) => b.t === 'tabla' && Math.max(...b.filas.map((f) => f.length)) > 6);
    if (o.orient === 'l' || (o.orient === 'auto' && ancha)) [pw, ph] = [ph, pw];
    const m = Math.max(o.margin, 12); // el texto pegado al borde no se lee bien
    const ancho = pw - 2 * m;
    const orient = pw > ph ? 'l' : 'p';
    const doc = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: orient, compress: true });
    let y = m;

    const nueva = () => { doc.addPage([pw, ph], orient); y = m; };
    const asegurar = (h) => { if (y + h > ph - m && y > m) nueva(); };
    const estilo = (r) => (r.b && r.i ? 'bolditalic' : r.b ? 'bold' : r.i ? 'italic' : 'normal');
    const fuente = (r, size) => { doc.setFont(r.code ? 'courier' : 'helvetica', estilo(r)); doc.setFontSize(size); };
    let enImagen = 0; // párrafos y celdas dibujados como imagen

    // Una línea de texto como imagen (para alfabetos que la fuente del PDF no tiene)
    function lineaComoImagen(ln, x, w, lh, size) {
      const alto = lh * 1.2; // un poco de aire para los trazos bajo la línea
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * PX_MM);
      c.height = Math.ceil(alto * PX_MM);
      const g = c.getContext('2d');
      g.fillStyle = `rgb(${TINTA.join(',')})`;
      const by = size * PT * 1.05 * PX_MM;
      const texto = ln.map((t) => t.text).join('');
      if (esRtl(texto)) {
        // árabe o hebreo: la línea entera, de derecha a izquierda, para que el navegador una las letras
        g.direction = 'rtl';
        g.textAlign = 'right';
        g.font = fuenteCanvas(ln[0] || {}, size);
        g.fillText(texto, c.width, by);
      } else {
        let cx = 0;
        for (const t of ln) {
          g.font = fuenteCanvas(t, size);
          g.fillText(t.text, cx, by);
          const tw = g.measureText(t.text).width;
          if (t.u) g.fillRect(cx, by + 0.7 * PX_MM, tw, Math.max(1, 0.2 * PX_MM));
          cx += tw;
        }
      }
      doc.addImage(c.toDataURL('image/png'), 'PNG', x, y, w, alto, undefined, 'FAST');
    }

    // Escribe un párrafo con negritas, cursivas, etc. y corta las líneas a lo ancho
    function parrafo(runs, { size = 11, x = m, w = ancho, base = {}, interlineado = 1.45, prefijo = null }) {
      const lh = size * PT * interlineado;
      const imagen = runs.some((r) => fueraDeFuente(r.text));
      if (imagen) enImagen++;
      const preparar = imagen ? (s) => String(s).replace(/\t/g, '    ') : limpiar;
      const medir = (t, s = t.text) => {
        if (imagen) { lienzo.font = fuenteCanvas(t, size); return lienzo.measureText(s).width / PX_MM; }
        fuente(t, size);
        return doc.getTextWidth(s);
      };
      const tokens = [];
      for (const r of runs) {
        for (const p of preparar(r.text).split(/(\n|[ ]+)/)) {
          if (!p) continue;
          tokens.push({ ...base, ...r, text: p === '\n' ? '\n' : /^ +$/.test(p) ? ' ' : p });
        }
      }
      const lineas = [];
      let linea = [], lw = 0;
      const cortar = () => { while (linea.length && linea[linea.length - 1].text === ' ') linea.pop(); lineas.push(linea); linea = []; lw = 0; };
      for (const t of tokens) {
        if (t.text === '\n') { cortar(); continue; }
        if (t.text === ' ' && !linea.length) continue;
        let tw = medir(t);
        if (lw + tw > w && linea.length) { cortar(); if (t.text === ' ') continue; }
        // palabra más larga que la línea (o idioma sin espacios, como el chino): se parte
        while (tw > w && [...t.text].length > 1) {
          const letras = [...t.text]; // por letras completas, sin partir emojis
          let n = letras.length;
          while (n > 1 && medir(t, letras.slice(0, n).join('')) > w) n--;
          const trozo = letras.slice(0, n).join('');
          linea.push({ ...t, text: trozo, w: medir(t, trozo) });
          cortar();
          t.text = letras.slice(n).join('');
          tw = medir(t);
        }
        linea.push({ ...t, w: tw });
        lw += tw;
      }
      if (linea.length) cortar();

      doc.setTextColor(...TINTA);
      doc.setDrawColor(...TINTA);
      lineas.forEach((ln, i) => {
        asegurar(lh);
        const base_y = y + size * PT * 1.05;
        if (i === 0 && prefijo === 'bala') {
          doc.setFillColor(...TINTA);
          doc.circle(x - 3.2, base_y - size * PT * 0.32, size * PT * 0.17, 'F');
        } else if (i === 0 && prefijo) {
          fuente(base, size);
          doc.text(prefijo, x - 1.8, base_y, { align: 'right' });
        }
        if (imagen) { lineaComoImagen(ln, x, w, lh, size); y += lh; return; }
        let cx = x;
        for (const t of ln) {
          fuente(t, size);
          doc.text(t.text, cx, base_y);
          if (t.u) { doc.setLineWidth(0.2); doc.line(cx, base_y + 0.7, cx + t.w, base_y + 0.7); }
          cx += t.w;
        }
        y += lh;
      });
    }

    function celdaComoImagen(cell, cabecera) {
      const pl = cell.padding('left'), pt = cell.padding('top');
      const w = cell.width - pl - cell.padding('right');
      const hDisp = cell.height - pt; // puede usar también el relleno inferior
      const size = cell.styles.fontSize;
      const st = { b: cabecera };
      lienzo.font = fuenteCanvas(st, size);
      const ancho = (s) => lienzo.measureText(s).width / PX_MM;
      // corta en líneas por palabras, o por letras si no hay espacios
      const lineas = [];
      let actual = '';
      for (const trozo of cell.crudo.split(/(\s+)/)) {
        for (const pieza of (ancho(trozo) > w ? [...trozo] : [trozo])) {
          if (actual && ancho(actual + pieza) > w) { lineas.push(actual.trim()); actual = ''; }
          actual += pieza;
        }
      }
      if (actual.trim()) lineas.push(actual.trim());
      const lh = size * PT * 1.15; // igual que el texto normal de la tabla
      const c = document.createElement('canvas');
      c.width = Math.ceil(w * PX_MM);
      c.height = Math.ceil((lineas.length * lh + size * PT * 0.25) * PX_MM);
      const g = c.getContext('2d');
      g.font = fuenteCanvas(st, size);
      g.fillStyle = cabecera ? 'rgb(253,252,250)' : `rgb(${TINTA.join(',')})`;
      lineas.forEach((l, i) => {
        const by = ((i + 1) * lh - size * PT * 0.15) * PX_MM;
        const rtl = esRtl(l);
        g.direction = rtl ? 'rtl' : 'ltr';
        g.textAlign = rtl ? 'right' : 'left';
        g.fillText(l, rtl ? c.width : 0, by);
      });
      let iw = w, ih = c.height / PX_MM;
      if (ih > hDisp) { iw *= hDisp / ih; ih = hDisp; } // si no cabe, se achica
      doc.addImage(c.toDataURL('image/png'), 'PNG', cell.x + pl, cell.y + pt, iw, ih, undefined, 'FAST');
    }

    const TAM_TITULO = [0, 22, 17, 14, 12.5, 12, 11];
    for (const b of bloques) {
      if (b.t === 'h') {
        const size = TAM_TITULO[b.nivel] || 12;
        if (y > m) y += size * PT * 0.9;
        asegurar(size * PT * 3); // que el título no quede solo al final de la página
        parrafo(b.runs, { size, base: { b: true }, interlineado: 1.25 });
        y += 1.8;
      } else if (b.t === 'p') {
        parrafo(b.runs, {});
        y += 2.4;
      } else if (b.t === 'li') {
        const sangria = 7 + b.nivel * 6;
        parrafo(b.runs, { x: m + sangria, w: ancho - sangria, prefijo: b.orden ? b.orden + '.' : (b.nivel ? '-' : 'bala') });
        y += 1;
      } else if (b.t === 'pre') {
        y += 1;
        for (const l of b.texto.split('\n')) parrafo([{ text: l || ' ', code: true }], { size: 9, interlineado: 1.3 });
        y += 2.4;
      } else if (b.t === 'tabla') {
        const cols = Math.max(...b.filas.map((f) => f.length));
        const crudas = b.filas.map((f) => Array.from({ length: cols }, (_, i) => String(f[i] ?? '')));
        const filas = crudas.map((f) => f.map(limpiar));
        const crudo = (d) => (crudas[d.section === 'head' ? 0 : d.row.index + (b.encabezado ? 1 : 0)] || [])[d.column.index];
        doc.autoTable({
          // las celdas con letras que la fuente no tiene se dibujan como imagen
          willDrawCell: (d) => {
            const raw = crudo(d);
            if (raw && fueraDeFuente(raw)) { d.cell.crudo = raw; d.cell.text = []; }
          },
          didDrawCell: (d) => { if (d.cell.crudo) { enImagen++; celdaComoImagen(d.cell, d.section === 'head'); } },
          startY: y,
          ...(b.encabezado ? { head: [filas[0]], body: filas.slice(1) } : { body: filas }),
          margin: { left: m, right: m, top: m, bottom: m },
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: cols > 8 ? 7 : 9, cellPadding: 1.6, lineColor: [205, 203, 215], lineWidth: 0.2, textColor: TINTA, overflow: 'linebreak' },
          headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [246, 245, 241] },
        });
        y = doc.lastAutoTable.finalY + 5;
      } else if (b.t === 'img') {
        let w = Math.min(ancho, (b.w * 25.4) / 96), h = (w * b.h) / b.w;
        const maxH = ph - 2 * m;
        if (h > maxH) { h = maxH; w = (h * b.w) / b.h; }
        asegurar(h);
        doc.addImage(b.src, /^data:image\/png/.test(b.src) ? 'PNG' : 'JPEG', m + (ancho - w) / 2, y, w, h, undefined, 'FAST');
        y += h + 3;
      } else if (b.t === 'salto') {
        nueva();
      }
    }
    if (enImagen && o.avisos) {
      o.avisos.push('Algunos textos usan letras que la fuente del PDF no tiene (por ejemplo chino, árabe o emojis). Se pusieron como imagen: se ven bien, pero no se pueden seleccionar.');
    }
    return new Uint8Array(doc.output('arraybuffer'));
  }

  // ---------- Imagen → PDF de una página ----------
  async function imagenAPdf(it, o) {
    await App.libs.cargar('jspdf');
    const { jsPDF } = window.jspdf;
    const { rasterize, layoutPage, blobToDataURL } = App.imagen;
    const r = await rasterize(it, o);
    const L = layoutPage(r, o);
    const doc = new jsPDF({ unit: 'mm', format: [L.pw, L.ph], orientation: L.pw > L.ph ? 'l' : 'p', compress: true });
    doc.addImage(await blobToDataURL(r.blob), 'JPEG', L.x, L.y, L.dw, L.dh, undefined, 'FAST');
    return new Uint8Array(doc.output('arraybuffer'));
  }

  // PDF de un solo archivo (sin aplicar el giro de un PDF original; eso lo hace unirPdfs)
  async function archivoAPdf(it, o) {
    if (it.kind === 'imagen') return imagenAPdf(it, o);
    if (it.kind === 'pdf') return it.bytes;
    return bloquesAPdf(it.bloques, o);
  }

  // Páginas de un PDF como imágenes (se ven igual; el texto deja de ser seleccionable)
  async function pdfComoImagenes(bytes, o) {
    await App.libs.cargar('jspdf');
    const { jsPDF } = window.jspdf;
    const pdf = await App.leerPdf.abrir(bytes);
    try {
      let doc;
      for (let n = 1; n <= pdf.numPages; n++) {
        const c = await App.leerPdf.dibujarPagina(pdf, n, (o.dpi || 150) / 72);
        const t = await App.leerPdf.tamanoPagina(pdf, n);
        const orient = t.w > t.h ? 'l' : 'p';
        if (!doc) doc = new jsPDF({ unit: 'mm', format: [t.w, t.h], orientation: orient, compress: true });
        else doc.addPage([t.w, t.h], orient);
        doc.addImage(c.toDataURL('image/jpeg', o.jpeg || 0.92), 'JPEG', 0, 0, t.w, t.h, undefined, 'FAST');
      }
      return new Uint8Array(doc.output('arraybuffer'));
    } finally {
      pdf.destroy();
    }
  }

  // Abre un PDF para copiar sus páginas. Si está cifrado, copiarlas tal cual
  // puede dar hojas en blanco: entonces se copian como imagen y se avisa
  async function cargarParaUnir(bytes, nombre, o) {
    const { PDFDocument } = window.PDFLib;
    try {
      return await PDFDocument.load(bytes);
    } catch (err) {
      if (!/encrypt/i.test(err.message)) throw err;
      o.avisos?.push(`${nombre} está protegido: sus páginas se copiaron como imagen. Se ven igual, pero su texto no se puede seleccionar.`);
      return PDFDocument.load(await pdfComoImagenes(bytes, o));
    }
  }

  // Une varios PDF en uno. partes = [{ it, bytes, rot }]
  async function unirPdfs(partes, o = {}) {
    await App.libs.cargar('pdflib');
    const { PDFDocument, degrees } = window.PDFLib;
    const out = await PDFDocument.create();
    for (const { it, bytes, rot } of partes) {
      const src = await cargarParaUnir(bytes, it ? it.name : 'Un PDF', o);
      const paginas = await out.copyPages(src, src.getPageIndices());
      for (const p of paginas) {
        if (rot) p.setRotation(degrees((p.getRotation().angle + rot) % 360));
        out.addPage(p);
      }
    }
    out.setCreator('Imprentita');
    out.setProducer('Imprentita');
    return out.save();
  }

  // ---------- Salida ----------
  async function salidaPdf(items, o, paso) {
    const partes = [];
    for (const [i, it] of items.entries()) {
      paso(i / items.length, `Preparando ${it.name}`);
      partes.push({ it, bytes: await archivoAPdf(it, o), rot: it.kind === 'pdf' ? it.rot : 0 });
    }
    paso(0.95, 'Uniendo páginas…');
    const tipo = { type: 'application/pdf' };
    if (o.archivos === 'unir') {
      return [{ nombre: o.base + '.pdf', blob: new Blob([await unirPdfs(partes, o)], tipo) }];
    }
    const archivos = [];
    for (const p of partes) {
      archivos.push({ nombre: App.sinExtension(p.it.name) + '.pdf', blob: new Blob([await unirPdfs([p], o)], tipo) });
    }
    return archivos;
  }

  App.pdf = { bloquesAPdf, archivoAPdf, unirPdfs, limpiar };
  App.salidas = App.salidas || {};
  App.salidas.pdf = salidaPdf;
})();
