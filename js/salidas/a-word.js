/* =========================================================
   Salida Word (.docx)
   Cada archivo es una sección del documento, así cada uno
   puede tener su propio tamaño y orientación de página
   ========================================================= */
(() => {
  const twip = (mm) => Math.round(mm * 56.6929);
  const MM_A_PX = 96 / 25.4;

  const dataUrlABytes = (src) => {
    const bin = atob(src.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  // Propiedades de página. docx espera medidas en vertical y las gira si es horizontal
  function pagina(pw, ph, m) {
    const { PageOrientation } = window.docx;
    return {
      page: {
        size: { width: twip(Math.min(pw, ph)), height: twip(Math.max(pw, ph)), orientation: pw > ph ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT },
        margin: { top: twip(m), bottom: twip(m), left: twip(m), right: twip(m), header: 0, footer: 0, gutter: 0 },
      },
    };
  }

  // Una página con una imagen centrada (bytes JPEG)
  function seccionImagen(bytes, L) {
    const { Paragraph, ImageRun, AlignmentType } = window.docx;
    return {
      properties: pagina(L.pw, L.ph, L.m),
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        // un poco más chica para que Word no la mande a otra página
        children: [new ImageRun({ data: bytes, transformation: { width: Math.floor(L.dw * MM_A_PX * 0.97), height: Math.floor(L.dh * MM_A_PX * 0.97) } })],
      })],
    };
  }

  // ---------- Bloques → contenido de Word ----------
  function bloquesAWord(bloques, anchoPx, altoPx) {
    const D = window.docx;
    const runs = (rs, extra = {}) => rs.flatMap((r) => r.text.split('\n').map((parte, i) => new D.TextRun({
      text: parte,
      break: i > 0 ? 1 : 0,
      bold: r.b || extra.bold,
      italics: r.i,
      underline: r.u ? {} : undefined,
      font: r.code ? 'Consolas' : undefined,
    })));
    const HEADINGS = [null, D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3, D.HeadingLevel.HEADING_4, D.HeadingLevel.HEADING_5, D.HeadingLevel.HEADING_6];

    const hijos = [];
    for (const b of bloques) {
      if (b.t === 'h') {
        hijos.push(new D.Paragraph({ heading: HEADINGS[b.nivel] || D.HeadingLevel.HEADING_3, children: runs(b.runs) }));
      } else if (b.t === 'p') {
        hijos.push(new D.Paragraph({ children: runs(b.runs), spacing: { after: 120 } }));
      } else if (b.t === 'li') {
        hijos.push(b.orden
          ? new D.Paragraph({ children: [new D.TextRun(`${b.orden}. `), ...runs(b.runs)], indent: { left: 360 + b.nivel * 360, hanging: 300 } })
          : new D.Paragraph({ children: runs(b.runs), bullet: { level: Math.min(b.nivel, 8) } }));
      } else if (b.t === 'pre') {
        for (const l of b.texto.split('\n')) hijos.push(new D.Paragraph({ children: [new D.TextRun({ text: l, font: 'Consolas', size: 19 })], spacing: { after: 0 } }));
        hijos.push(new D.Paragraph(''));
      } else if (b.t === 'tabla') {
        const cols = Math.max(...b.filas.map((f) => f.length));
        hijos.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          rows: b.filas.map((f, i) => new D.TableRow({
            tableHeader: b.encabezado && i === 0,
            children: Array.from({ length: cols }, (_, c) => new D.TableCell({
              shading: b.encabezado && i === 0 ? { fill: '1B1A2E' } : undefined,
              children: [new D.Paragraph({ children: [new D.TextRun({ text: String(f[c] ?? ''), bold: b.encabezado && i === 0, color: b.encabezado && i === 0 ? 'FFFFFF' : undefined, size: cols > 6 ? 16 : 20 })] })],
            })),
          })),
        }));
        hijos.push(new D.Paragraph(''));
      } else if (b.t === 'img') {
        let w = Math.min(anchoPx, b.w), h = (w * b.h) / b.w;
        if (h > altoPx) { h = altoPx; w = (h * b.w) / b.h; }
        hijos.push(new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.ImageRun({ data: dataUrlABytes(b.src), transformation: { width: Math.floor(w), height: Math.floor(h) } })] }));
      } else if (b.t === 'salto') {
        hijos.push(new D.Paragraph({ children: [new D.PageBreak()] }));
      }
    }
    return hijos;
  }

  // Página de documento según las opciones
  function paginaDoc(o, bloques) {
    let [pw, ph] = App.SIZES[o.size === 'fit' ? 'a4' : o.size];
    const ancha = bloques.some((b) => b.t === 'tabla' && Math.max(...b.filas.map((f) => f.length)) > 6);
    if (o.orient === 'l' || (o.orient === 'auto' && ancha)) [pw, ph] = [ph, pw];
    return { pw, ph, m: Math.max(o.margin, 12) };
  }

  function seccionDoc(bloques, o) {
    const P = paginaDoc(o, bloques);
    return {
      properties: pagina(P.pw, P.ph, P.m),
      children: bloquesAWord(bloques, (P.pw - 2 * P.m) * MM_A_PX, (P.ph - 2 * P.m) * MM_A_PX * 0.95),
    };
  }

  // ---------- Secciones de cada tipo de archivo ----------
  async function secciones(it, o, paso) {
    if (it.kind === 'imagen') {
      const r = await App.imagen.rasterize(it, o);
      return [seccionImagen(new Uint8Array(await r.blob.arrayBuffer()), App.imagen.layoutPage(r, o))];
    }
    if (it.kind === 'pdf') {
      const pdf = await App.leerPdf.abrir(it.bytes);
      try {
        if (o.pdfAWord === 'texto') {
          const paginas = await App.leerPdf.texto(pdf);
          const bloques = [];
          paginas.forEach((parrafos, i) => {
            if (i > 0) bloques.push({ t: 'salto' });
            parrafos.forEach((t) => bloques.push({ t: 'p', runs: [{ text: t }] }));
          });
          // Si no hay texto (PDF escaneado), mejor como imagen
          if (paginas.some((p) => p.length)) return [seccionDoc(bloques, o)];
        }
        // Copia exacta: cada página como imagen, del tamaño original
        const out = [];
        for (let n = 1; n <= pdf.numPages; n++) {
          paso(null, `${it.name}: página ${n} de ${pdf.numPages}`);
          const c = await App.leerPdf.dibujarPagina(pdf, n, o.dpi / 72, it.rot);
          const blob = await App.imagen.canvasABlob(c, 'image/jpeg', o.jpeg);
          const t = await App.leerPdf.tamanoPagina(pdf, n, it.rot);
          out.push(seccionImagen(new Uint8Array(await blob.arrayBuffer()), { pw: t.w, ph: t.h, m: 0, dw: t.w, dh: t.h }));
        }
        return out;
      } finally {
        pdf.destroy();
      }
    }
    return [seccionDoc(it.bloques, o)];
  }

  async function salidaWord(items, o, paso) {
    await App.libs.cargar('docx');
    const { Document, Packer } = window.docx;
    const crear = (sections) => Packer.toBlob(new Document({ creator: 'Imprentita', title: o.base, sections }));
    const porArchivo = [];
    for (const [i, it] of items.entries()) {
      paso(i / items.length, `Preparando ${it.name}`);
      porArchivo.push({ it, secciones: await secciones(it, o, paso) });
    }
    paso(0.95, 'Armando el documento…');
    if (o.archivos === 'unir') {
      return [{ nombre: o.base + '.docx', blob: await crear(porArchivo.flatMap((p) => p.secciones)) }];
    }
    const archivos = [];
    for (const p of porArchivo) archivos.push({ nombre: App.sinExtension(p.it.name) + '.docx', blob: await crear(p.secciones) });
    return archivos;
  }

  App.salidas = App.salidas || {};
  App.salidas.docx = salidaWord;
})();
