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

    // Escribe un párrafo con negritas, cursivas, etc. y corta las líneas a lo ancho
    function parrafo(runs, { size = 11, x = m, w = ancho, base = {}, interlineado = 1.45, prefijo = null }) {
      const lh = size * PT * interlineado;
      const tokens = [];
      for (const r of runs) {
        for (const p of limpiar(r.text).split(/(\n|[ ]+)/)) {
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
        fuente(t, size);
        let tw = doc.getTextWidth(t.text);
        if (lw + tw > w && linea.length) { cortar(); if (t.text === ' ') continue; }
        // palabra más larga que la línea: se parte
        while (tw > w && t.text.length > 1) {
          let n = t.text.length;
          while (n > 1 && doc.getTextWidth(t.text.slice(0, n)) > w) n--;
          linea.push({ ...t, text: t.text.slice(0, n), w: doc.getTextWidth(t.text.slice(0, n)) });
          cortar();
          t.text = t.text.slice(n);
          tw = doc.getTextWidth(t.text);
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
        const filas = b.filas.map((f) => {
          const r = f.map((c) => limpiar(c ?? ''));
          while (r.length < cols) r.push('');
          return r;
        });
        doc.autoTable({
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

  // Une varios PDF en uno. partes = [{ bytes, rot }]
  async function unirPdfs(partes) {
    await App.libs.cargar('pdflib');
    const { PDFDocument, degrees } = window.PDFLib;
    const out = await PDFDocument.create();
    for (const { bytes, rot } of partes) {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
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
      return [{ nombre: o.base + '.pdf', blob: new Blob([await unirPdfs(partes)], tipo) }];
    }
    const archivos = [];
    for (const p of partes) {
      archivos.push({ nombre: App.sinExtension(p.it.name) + '.pdf', blob: new Blob([await unirPdfs([p])], tipo) });
    }
    return archivos;
  }

  App.pdf = { bloquesAPdf, archivoAPdf, unirPdfs, limpiar };
  App.salidas = App.salidas || {};
  App.salidas.pdf = salidaPdf;
})();
