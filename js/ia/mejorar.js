/* =========================================================
   Mejora con IA (superresolución ×2)
   Usa el modelo ESRGAN-slim de UpscalerJS sobre TensorFlow.js.
   Corre en el navegador: las imágenes no se envían a ningún
   servidor. Las librerías se descargan solo la primera vez
   que se elige la calidad "IA".
   ========================================================= */
(() => {
  const LIBS = [
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js',
    'https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/umd/upscaler.min.js',
    'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x2/index.min.js',
  ];
  // Imágenes con el lado mayor por encima de esto ya tienen buena
  // resolución; mejorarlas sería muy lento y casi no se notaría.
  const LIMITE_PX = 1200;

  let cargando = null;
  let upscaler = null;
  let cola = Promise.resolve();

  const cargarScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('No se pudo cargar ' + src));
    document.head.appendChild(s);
  });

  function cargarModelo() {
    if (!cargando) {
      cargando = (async () => {
        for (const src of LIBS) await cargarScript(src);
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
    } catch (err) {
      console.error(err);
      it.ia = { estado: 'error' };
      App.toast('No se pudo usar la IA. La primera vez necesita internet para descargar el modelo.', 5000);
    }
    App.emit('ia', it);
  }

  function encolar(it) {
    if (it.ia && it.ia.estado !== 'error') return; // ya está lista o en camino
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
    mejorarTodas: () => App.state.items.filter((it) => it.kind === 'imagen').forEach(encolar),
    esperar: () => cola,
    contar() {
      const conIA = App.state.items.filter((it) => it.kind === 'imagen' && it.ia && it.ia.estado !== 'hd');
      return {
        total: conIA.length,
        listas: conIA.filter((it) => it.ia.estado === 'listo').length,
        faltan: conIA.filter((it) => ['pendiente', 'procesando'].includes(it.ia.estado)).length,
      };
    },
  };
})();
