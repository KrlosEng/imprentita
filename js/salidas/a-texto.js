/* =========================================================
   Salida Texto (.txt)
   Saca solo el texto: de PDF, Word, Markdown, HTML y Excel
   (las tablas quedan separadas por tabuladores)
   ========================================================= */
(() => {
  function bloquesATexto(bloques) {
    const { textoDeRuns } = App.html;
    const out = [];
    for (const b of bloques) {
      if (b.t === 'h') out.push('', textoDeRuns(b.runs).toUpperCase(), '');
      else if (b.t === 'p') out.push(textoDeRuns(b.runs), '');
      else if (b.t === 'li') out.push('  '.repeat(b.nivel) + (b.orden ? b.orden + '. ' : '• ') + textoDeRuns(b.runs));
      else if (b.t === 'pre') out.push(b.texto, '');
      else if (b.t === 'tabla') out.push(...b.filas.map((f) => f.join('\t')), '');
      else if (b.t === 'salto') out.push('', '');
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  async function textoDe(it, o) {
    if (it.kind === 'pdf') {
      const pdf = await App.leerPdf.abrir(it.bytes);
      try {
        const paginas = await App.leerPdf.texto(pdf);
        if (!paginas.some((p) => p.length)) {
          // sin texto: casi siempre es un PDF escaneado (fotos de páginas)
          o.avisos?.push(`${it.name} no tiene texto: parece escaneado. Para sacar el texto de una imagen haría falta reconocimiento de texto (OCR).`);
          return '(Este PDF no tiene texto que se pueda sacar: parece escaneado.)';
        }
        // separador de páginas legible en cualquier editor (antes era el carácter \f)
        return paginas.map((p, i) => (i ? `\n\n— Página ${i + 1} —\n\n` : '') + p.join('\n\n')).join('').trim();
      } finally {
        pdf.destroy();
      }
    }
    return bloquesATexto(it.bloques);
  }

  // ﻿ al inicio para que el Bloc de notas reconozca los acentos
  const blobTexto = (s) => new Blob(['﻿' + s.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' });

  async function salidaTexto(items, o, paso) {
    const textos = [];
    for (const [i, it] of items.entries()) {
      paso(i / items.length, `Leyendo ${it.name}`);
      textos.push({ it, texto: await textoDe(it, o) });
    }
    if (o.archivos === 'unir') {
      const todo = textos.length === 1
        ? textos[0].texto
        : textos.map((t) => `===== ${t.it.name} =====\n\n${t.texto}`).join('\n\n\n');
      return [{ nombre: o.base + '.txt', blob: blobTexto(todo) }];
    }
    return textos.map((t) => ({ nombre: App.sinExtension(t.it.name) + '.txt', blob: blobTexto(t.texto) }));
  }

  App.texto = { bloquesATexto };
  App.salidas = App.salidas || {};
  App.salidas.texto = salidaTexto;
})();
