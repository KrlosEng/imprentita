/* =========================================================
   Preparar cada imagen: girarla, aplicar la versión de IA
   y calcular dónde va dentro de la página
   ========================================================= */
(() => {
  const MAX_SIDE = 4000; // px, evita archivos gigantes

  // Devuelve la imagen ya girada en el formato pedido (JPEG por defecto)
  async function rasterize(it, o, mime = 'image/jpeg') {
    const usarIA = o.ia && it.ia && it.ia.estado === 'listo';
    const fuente = usarIA ? it.ia.img : it.img;
    const fw = usarIA ? it.ia.w : it.w;
    const fh = usarIA ? it.ia.h : it.h;

    const swapped = it.rot % 180 !== 0;
    let w = swapped ? fh : fw, h = swapped ? fw : fh;
    const k = Math.min(1, MAX_SIDE / Math.max(w, h));
    w = Math.round(w * k); h = Math.round(h * k);

    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    if (mime === 'image/jpeg') { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); } // JPEG no tiene transparencia
    g.translate(w / 2, h / 2);
    g.rotate((it.rot * Math.PI) / 180);
    const dw = swapped ? h : w, dh = swapped ? w : h;
    g.drawImage(fuente, -dw / 2, -dh / 2, dw, dh);

    const blob = await canvasABlob(c, mime, o.jpeg);
    return { blob, w, h };
  }

  const canvasABlob = (c, mime, calidad) => new Promise((r) => c.toBlob(r, mime, calidad));

  // Calcula el tamaño de la página (mm) y la posición de la imagen
  function layoutPage(r, o) {
    const m = o.margin;
    let pw, ph;
    if (o.size === 'fit') {
      const pxToMm = 25.4 / 150; // la imagen a 150 ppp
      pw = r.w * pxToMm + 2 * m; ph = r.h * pxToMm + 2 * m;
    } else {
      [pw, ph] = App.SIZES[o.size];
      const land = o.orient === 'l' || (o.orient === 'auto' && r.w > r.h);
      if (land) [pw, ph] = [ph, pw];
    }
    const s = Math.min((pw - 2 * m) / r.w, (ph - 2 * m) / r.h);
    const dw = r.w * s, dh = r.h * s;
    return { pw, ph, m, dw, dh, x: (pw - dw) / 2, y: (ph - dh) / 2 };
  }

  const blobToDataURL = (b) => new Promise((r) => {
    const fr = new FileReader();
    fr.onload = () => r(fr.result);
    fr.readAsDataURL(b);
  });

  App.imagen = { rasterize, layoutPage, blobToDataURL, canvasABlob };
})();
