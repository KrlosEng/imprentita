/* =========================================================
   HTML → bloques
   Pasa cualquier HTML (de Word, Markdown o una página web) a
   una lista sencilla de bloques que después se puede escribir
   como PDF, Word, texto o Excel:

     { t: 'h', nivel, runs }        título
     { t: 'p', runs }               párrafo
     { t: 'li', runs, orden, nivel } elemento de lista (orden = número o null)
     { t: 'pre', texto }            texto preformateado / código
     { t: 'tabla', filas, encabezado, hoja? }
     { t: 'img', src, w, h }
     { t: 'salto' }                 salto de página

   runs = [{ text, b, i, u, code }]
   ========================================================= */
(() => {
  const BLOQUE = new Set(['p', 'div', 'section', 'article', 'header', 'footer', 'main', 'aside', 'nav', 'figure', 'figcaption', 'address', 'dd', 'dt', 'dl', 'center', 'form', 'fieldset']);
  const IGNORAR = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'meta', 'link', 'iframe', 'object', 'svg', 'button', 'input', 'select', 'textarea']);

  function htmlABloques(raiz) {
    const bloques = [];
    let runs = [];
    let actual = { t: 'p' };

    const flush = () => {
      // quita espacios al inicio y al final del bloque
      while (runs.length && !runs[0].text.trim() && runs[0].text !== '\n') runs.shift();
      while (runs.length && !runs[runs.length - 1].text.trim()) runs.pop();
      if (runs.length) {
        runs[0] = { ...runs[0], text: runs[0].text.replace(/^\s+/, '') };
        const u = runs.length - 1;
        runs[u] = { ...runs[u], text: runs[u].text.replace(/\s+$/, '') };
        bloques.push({ ...actual, runs });
      }
      runs = [];
    };

    function walk(node, estilo, lista) {
      if (node.nodeType === 3) {
        const text = node.nodeValue.replace(/\s+/g, ' ');
        if (text) runs.push({ text, ...estilo });
        return;
      }
      if (node.nodeType !== 1) return;
      const tag = node.tagName.toLowerCase();
      if (IGNORAR.has(tag)) return;
      const hijos = (est, lst = lista) => node.childNodes.forEach((n) => walk(n, est, lst));

      if (/^h[1-6]$/.test(tag)) {
        flush();
        const prev = actual;
        actual = { t: 'h', nivel: Number(tag[1]) };
        hijos(estilo);
        flush();
        actual = prev;
        return;
      }
      if (tag === 'br') { runs.push({ text: '\n' }); return; }
      if (tag === 'hr') { flush(); return; }
      if (tag === 'img') {
        flush();
        const src = node.getAttribute('src');
        if (src) bloques.push({ t: 'img', src });
        return;
      }
      if (tag === 'pre') {
        flush();
        bloques.push({ t: 'pre', texto: node.textContent.replace(/\n$/, '') });
        return;
      }
      if (tag === 'table') {
        flush();
        const filas = [];
        let encabezado = false;
        node.querySelectorAll('tr').forEach((tr, i) => {
          if (tr.closest('table') !== node) return; // ignora tablas anidadas
          const celdas = [...tr.children].filter((c) => /^(td|th)$/i.test(c.tagName));
          if (i === 0 && (celdas.some((c) => c.tagName === 'TH') || tr.closest('thead'))) encabezado = true;
          filas.push(celdas.map((c) => c.textContent.replace(/\s+/g, ' ').trim()));
        });
        if (filas.length) bloques.push({ t: 'tabla', filas, encabezado });
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        flush();
        const nivel = lista ? lista.nivel + 1 : 0;
        let n = Number(node.getAttribute('start')) || 1;
        node.childNodes.forEach((li) => {
          if (li.nodeType !== 1 || li.tagName.toLowerCase() !== 'li') return;
          flush();
          const prev = actual;
          actual = { t: 'li', orden: tag === 'ol' ? n++ : null, nivel };
          li.childNodes.forEach((c) => walk(c, estilo, { nivel }));
          flush();
          actual = prev;
        });
        return;
      }
      if (tag === 'blockquote') { flush(); hijos({ ...estilo, i: true }); flush(); return; }
      if (BLOQUE.has(tag) || tag === 'li' || tag === 'body') { flush(); hijos(estilo); flush(); return; }

      // En línea
      const e = { ...estilo };
      if (tag === 'b' || tag === 'strong') e.b = true;
      if (tag === 'i' || tag === 'em' || tag === 'cite') e.i = true;
      if (tag === 'u' || tag === 'a' || tag === 'ins') e.u = true;
      if (tag === 'code' || tag === 'kbd' || tag === 'samp') e.code = true;
      if (node.style) {
        if (/bold|[6-9]00/.test(node.style.fontWeight)) e.b = true;
        if (node.style.fontStyle === 'italic') e.i = true;
      }
      hijos(e);
    }

    walk(raiz, {}, null);
    flush();
    return bloques;
  }

  // Pasa todas las imágenes a PNG/JPEG y guarda su tamaño
  async function prepararImagenes(bloques) {
    for (const b of bloques) {
      if (b.t !== 'img') continue;
      try {
        const img = await App.loadImage(b.src);
        b.w = img.naturalWidth || 600;
        b.h = img.naturalHeight || 400;
        if (!/^data:image\/(png|jpe?g)/.test(b.src)) {
          const c = document.createElement('canvas');
          c.width = b.w; c.height = b.h;
          c.getContext('2d').drawImage(img, 0, 0, b.w, b.h);
          b.src = c.toDataURL('image/png');
        }
      } catch {
        b.t = 'omitir';
      }
    }
    return bloques.filter((b) => b.t !== 'omitir');
  }

  // Texto plano de unos runs
  const textoDeRuns = (runs) => runs.map((r) => r.text).join('');

  App.html = { htmlABloques, prepararImagenes, textoDeRuns };
})();
