/* =========================================================
   Salida Imagen (JPG, PNG o WEBP)
   - Imágenes: cambian de formato (con giro e IA si se eligió)
   - PDF y documentos: cada página se vuelve una imagen
   ========================================================= */
(() => {
  const FORMATOS = {
    jpg: { mime: 'image/jpeg', ext: '.jpg' },
    png: { mime: 'image/png', ext: '.png' },
    webp: { mime: 'image/webp', ext: '.webp' },
  };

  async function salidaImagen(items, o, paso) {
    const f = FORMATOS[o.imgFormato];
    const archivos = [];
    for (const [i, it] of items.entries()) {
      const base = App.sinExtension(it.name);
      paso(i / items.length, `Preparando ${it.name}`);
      if (it.kind === 'imagen') {
        const r = await App.imagen.rasterize(it, o, f.mime);
        archivos.push({ nombre: base + f.ext, blob: r.blob });
        continue;
      }
      // PDF (original) o documento (primero se pasa a PDF)
      const bytes = await App.pdf.archivoAPdf(it, o);
      const pdf = await App.leerPdf.abrir(bytes);
      try {
        const rot = it.kind === 'pdf' ? it.rot : 0;
        for (let n = 1; n <= pdf.numPages; n++) {
          paso((i + n / pdf.numPages) / items.length, `${it.name}: página ${n} de ${pdf.numPages}`);
          const c = await App.leerPdf.dibujarPagina(pdf, n, o.dpi / 72, rot);
          const sufijo = pdf.numPages > 1 ? `-pagina-${String(n).padStart(2, '0')}` : '';
          archivos.push({ nombre: base + sufijo + f.ext, blob: await App.imagen.canvasABlob(c, f.mime, o.jpeg) });
        }
      } finally {
        pdf.destroy();
      }
    }
    return archivos;
  }

  App.salidas = App.salidas || {};
  App.salidas.imagen = salidaImagen;
})();
