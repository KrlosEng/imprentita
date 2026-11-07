/* =========================================================
   Mejora con IA (superresolución ×2)
   Usa el modelo ESRGAN-slim de UpscalerJS sobre TensorFlow.js.
   Corre en el navegador: las imágenes no se envían a ningún
   servidor. Las librerías se descargan solo la primera vez
   que se elige la calidad "IA".
   ========================================================= */
(() => {
  // Las librerías de IA (TensorFlow.js + UpscalerJS) están en librerias.js, con su hash de integridad

  // Imágenes con el lado mayor por encima de esto ya tienen buena
  // resolución; mejorarlas sería muy lento y casi no se notaría.
  const LIMITE_PX = 1200;

  let cargando = null;
  let upscaler = null;
  let cola = Promise.resolve();
  let avisoDado = false; // un solo aviso por tanda de fallos, no uno por imagen

  function cargarModelo() {
    if (!cargando) {
      cargando = (async () => {
        await App.libs.cargar('ia');
        upscaler = new window.Upscaler({ model: window.ESRGANSlim2x });
      })();
      cargando.catch(() => { cargando = null; }); // permite reintentar
    }
    return cargando;
  }

  async function procesar(it) {
    if (!App.state.items.includes(it)) return; // la quitaron mientras esperaba
    it.ia.estado = 'procesando';
    App.emit('ia', it);
    try {
      await cargarModelo();
      const out = await upscaler.upscale(it.img, {
        output: 'base64',
        patchSize: 64,
        padding: 4,
        progress: (p) => { it.ia.progreso = p; App.emit('ia-progreso', it); },
      });
      const img = await App.loadImage(out);
      Object.assign(it.ia, { estado: 'listo', img, src: out, w: img.naturalWidth, h: img.naturalHeight, progreso: 1 });
      avisoDado = false;
    } catch (err) {
      console.error(err);
      it.ia = { estado: 'error' };
      if (!avisoDado) {
        avisoDado = true;
        App.toast('No se pudo usar la IA, así que esas imágenes se quedan como están. La primera vez necesita internet para descargar el modelo.', 6000, 'error');
      }
    }
    App.emit('ia', it);
  }

  // Un fallo no se reintenta solo al cambiar opciones (repetiría el aviso):
  // se reintenta cuando la persona presiona Convertir
  function encolar(it, reintentar) {
    if (it.ia && (it.ia.estado !== 'error' || !reintentar)) return; // lista, en camino o ya falló
    if (Math.max(it.w, it.h) > LIMITE_PX) {
      it.ia = { estado: 'hd' };
      App.emit('ia', it);
      return;
    }
    it.ia = { estado: 'pendiente', progreso: 0 };
    App.emit('ia', it);
    cola = cola.then(() => procesar(it));
  }

  App.ia = {
    LIMITE_PX,
    // solo las fotos e imágenes; los documentos no pasan por la IA
    mejorarTodas: ({ reintentar = false } = {}) => App.state.items
      .filter((it) => it.kind === 'imagen')
      .forEach((it) => encolar(it, reintentar)),
    esperar: () => cola,
    contar() {
      const conIA = App.state.items.filter((it) => it.kind === 'imagen' && it.ia && it.ia.estado !== 'hd');
      return {
        total: conIA.length,
        listas: conIA.filter((it) => it.ia.estado === 'listo').length,
        faltan: conIA.filter((it) => ['pendiente', 'procesando'].includes(it.ia.estado)).length,
        fallidas: conIA.filter((it) => it.ia.estado === 'error').length,
      };
    },
  };
})();
