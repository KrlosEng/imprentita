/* =========================================================
   Abrir cada archivo según su tipo y prepararlo:
   miniatura, información y contenido en bloques
   ========================================================= */
(() => {
  const { TIPOS } = App;

  function tipoDe(f) {
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (f.type.startsWith('image/')) return 'imagen';
    for (const [kind, t] of Object.entries(TIPOS)) if (t.ext.includes(ext)) return kind;
    if (f.type === 'application/pdf') return 'pdf';
    if (f.type.startsWith('text/')) return 'texto';
    return null;
  }

  const numero = (n) => n.toLocaleString('es');

  // Miniatura reducida: una foto de 12 MP mostrada entera en la tarjeta gasta
  // mucha memoria y hace lento el desplazamiento en el celular
  const LADO_MINI = 480;
  function miniatura(img, w, h) {
    const k = LADO_MINI / Math.max(w, h);
    if (k >= 1) return img.src;
    const c = document.createElement('canvas');
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, c.height);
    // WEBP conserva la transparencia de los PNG y pesa poco
    return c.toDataURL('image/webp', 0.85);
  }

  // ---------- Lectores por tipo ----------
  async function leerImagen(f, it) {
    it.src = URL.createObjectURL(f);
    it.img = await App.loadImage(it.src);
    it.w = it.img.naturalWidth || 800;
    it.h = it.img.naturalHeight || 800;
    it.thumb = miniatura(it.img, it.w, it.h);
  }

  async function leerPdf(f, it) {
    it.bytes = new Uint8Array(await f.arrayBuffer());
    const pdf = await App.leerPdf.abrir(it.bytes);
    it.paginas = pdf.numPages;
    const c = await App.leerPdf.dibujarPagina(pdf, 1, 0.6);
    it.thumb = c.toDataURL('image/jpeg', 0.8);
    it.info = `${it.paginas} ${it.paginas === 1 ? 'página' : 'páginas'}`;
    pdf.destroy();
  }

  async function leerWord(f, it) {
    await App.libs.cargar('mammoth');
    const res = await window.mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() });
    await desdeHtml(res.value, it);
  }

  async function leerMarkdown(f, it) {
    await App.libs.cargar('marked');
    await desdeHtml(window.marked.parse(await f.text()), it);
  }

  async function leerHtml(f, it) {
    await desdeHtml(await f.text(), it);
  }

  async function leerTexto(f, it) {
    const texto = (await f.text()).replace(/\r\n?/g, '\n');
    it.bloques = texto.split('\n').map((l) => (l.trim() ? { t: 'p', runs: [{ text: l }] } : null)).filter(Boolean);
  }

  async function leerTabla(f, it) {
    await App.libs.cargar('xlsx');
    const ext = f.name.split('.').pop().toLowerCase();
    const wb = ext === 'csv' || ext === 'tsv'
      ? window.XLSX.read(await f.text(), { type: 'string', FS: ext === 'tsv' ? '\t' : undefined })
      : window.XLSX.read(await f.arrayBuffer(), { type: 'array' });
    it.bloques = [];
    const varias = wb.SheetNames.length > 1;
    for (const nombre of wb.SheetNames) {
      const hoja = wb.Sheets[nombre];
      const filas = window.XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '', blankrows: false });
      if (!filas.length) continue;
      if (varias) it.bloques.push({ t: 'h', nivel: 2, runs: [{ text: nombre }] });
      it.bloques.push({ t: 'tabla', filas, encabezado: true, hoja, nombre });
    }
  }

  async function desdeHtml(html, it) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    it.bloques = await App.html.prepararImagenes(App.html.htmlABloques(doc.body));
  }

  const LECTORES = { imagen: leerImagen, pdf: leerPdf, word: leerWord, markdown: leerMarkdown, html: leerHtml, texto: leerTexto, tabla: leerTabla };

  // Vista previa de un documento: título y primeras líneas, o primeras celdas
  function resumir(it) {
    const b = it.bloques;
    const tabla = b.find((x) => x.t === 'tabla');
    const textos = b.filter((x) => x.runs).map((x) => App.html.textoDeRuns(x.runs));
    const titulo = b.find((x) => x.t === 'h');
    it.resumen = {
      titulo: titulo ? App.html.textoDeRuns(titulo.runs) : '',
      lineas: textos.filter((t) => !titulo || t !== App.html.textoDeRuns(titulo.runs)).slice(0, 6),
      tabla: tabla && it.kind === 'tabla' ? tabla.filas.slice(0, 7).map((f) => f.slice(0, 4)) : null,
    };
    if (it.kind === 'tabla') {
      const tablas = b.filter((x) => x.t === 'tabla');
      const filas = tablas.reduce((s, t) => s + t.filas.length, 0);
      it.info = `${numero(filas)} filas${tablas.length > 1 ? ` · ${tablas.length} hojas` : ''}`;
    } else {
      const palabras = textos.join(' ').split(/\s+/).filter(Boolean).length;
      const tablas = b.filter((x) => x.t === 'tabla').length;
      it.info = `${numero(palabras)} palabras${tablas ? ` · ${tablas} ${tablas === 1 ? 'tabla' : 'tablas'}` : ''}`;
    }
  }

  // Abre un archivo y devuelve el objeto listo para la mesa, o null si no se puede
  async function abrirArchivo(f) {
    const kind = tipoDe(f);
    if (!kind) return { error: 'tipo', name: f.name };
    const it = { id: ++App.state.uid, name: f.name, kind, rot: 0, ia: null };
    try {
      await LECTORES[kind](f, it);
      if (it.bloques) {
        if (!it.bloques.length) it.bloques.push({ t: 'p', runs: [{ text: '(Documento vacío)' }] });
        resumir(it);
      }
      return it;
    } catch (err) {
      console.error(err);
      if (it.src) URL.revokeObjectURL(it.src);
      return { error: /descargar/.test(err.message) ? 'red' : 'lectura', name: f.name };
    }
  }

  App.entradas = { abrirArchivo, tipoDe };
})();
