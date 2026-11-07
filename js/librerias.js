/* =========================================================
   Carga de librerías bajo demanda, con verificación de integridad
   Cada librería se descarga solo cuando hace falta, así la
   app abre rápido. La primera vez se necesita internet.

   Seguridad: cada archivo lleva su hash SHA-384 (SRI). Si una CDN
   llegara a servir otro contenido, el navegador no lo ejecuta y la
   conversión muestra un aviso en lugar de correr código ajeno.
   Para actualizar una versión hay que recalcular su hash:
     curl -sL URL | openssl dgst -sha384 -binary | openssl base64 -A
   ========================================================= */
(() => {
  const LIBS = {
    jspdf: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', sri: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' }],
    autotable: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js', sri: 'sha384-fCAW/rDWORTbQXSiB7mOg0QtQ5c+r0f544y6XoKjuVva0nMBlCpNUjiFeG5iMdS3' }],
    docx: [{ url: 'https://unpkg.com/docx@8.5.0/build/index.umd.js', sri: 'sha384-4xaIisuLEy2lo2HkB2C4rEf7v8jbTb2kuogX6TkuEt9feTWKBSFSOzsqNNbV+sKh' }],
    // pdf.js 4.x solo existe como módulo (.mjs): se descarga, se verifica el hash y luego se importa
    pdfjs: [
      { url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs', sri: 'sha384-+0ti2moQlmLN7WZHE2RHIf5lV8hHxhxEalN0il3YZceG26fUPyOkR0hp9daxk1i7', modulo: 'pdfjsLib' },
      // el worker se carga en la página: así pdf.js funciona sin un Worker aparte y la app abre con doble clic (file://)
      { url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs', sri: 'sha384-ToeVvShCxKc6CEvhHeMt0Q8A06pSPDbAlngO9nokrDmh914gk/pYd0N7D0a4Lz2o', modulo: 'pdfjsWorker' },
    ],
    pdflib: [{ url: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', sri: 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI' }],
    mammoth: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js', sri: 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz' }],
    // SheetJS ya no publica en npm ni cdnjs: 0.20.3 corrige CVE-2023-30533 y CVE-2024-22363
    xlsx: [{ url: 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js', sri: 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT' }],
    marked: [{ url: 'https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js', sri: 'sha384-odPBjvtXVM/5hOYIr3A1dB+flh0c3wAT3bSesIOqEGmyUA4JoKf/YTWy0XKOYAY7' }],
    jszip: [{ url: 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', sri: 'sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG' }],
    // Mejora con IA (ver ia/mejorar.js)
    ia: [
      { url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.11.0/dist/tf.min.js', sri: 'sha384-KYxi/8db1ZZ+jkQnI7O2gXy6cVtDB5E8I0ZJvQ2wpL6HODnx5LpTVMe0hD4posna' },
      { url: 'https://cdn.jsdelivr.net/npm/upscaler@1.0.0/dist/browser/umd/upscaler.min.js', sri: 'sha384-QMCS4oRU0yhc/triRbY4mcIreg38XzA/8NNuZfTWWvv/km8cX/L63yLb3hh0IaA3' },
      { url: 'https://cdn.jsdelivr.net/npm/@upscalerjs/esrgan-slim@1.0.0/dist/umd/models/esrgan-slim/src/x2/index.min.js', sri: 'sha384-AGBOpw8YDaWtze64+1P80uYCg+607+NLyI/tVeKNOJr9+SHUMEC7Z0ue5WJy5zIs' },
    ],
  };
  // autotable necesita jsPDF antes
  const DEPENDE = { autotable: ['jspdf'] };

  const enCurso = {};

  // Script clásico: el navegador comprueba el hash (atributo integrity)
  const script = ({ url, sri }) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url;
    s.integrity = sri;
    s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo descargar ' + url.split('/').pop()));
    document.head.appendChild(s);
  });

  // Módulo: import() no acepta integrity, así que se descarga, se compara el
  // SHA-384 a mano y se importa desde una copia local (blob) ya verificada
  async function modulo({ url, sri }) {
    // crypto.subtle solo existe en conexiones seguras (https o archivo local)
    if (!window.isSecureContext || !(window.crypto && crypto.subtle)) {
      throw new Error('Conexión insegura: no se puede verificar ' + url.split('/').pop());
    }
    let texto;
    try {
      const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!r.ok) throw new Error(r.status);
      texto = await r.text();
    } catch {
      throw new Error('No se pudo descargar ' + url.split('/').pop());
    }
    const hash = await crypto.subtle.digest('SHA-384', new TextEncoder().encode(texto));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
    if ('sha384-' + b64 !== sri) throw new Error('Integridad: ' + url.split('/').pop() + ' no coincide con su hash');
    const blob = URL.createObjectURL(new Blob([texto], { type: 'text/javascript' }));
    try {
      return await import(blob);
    } finally {
      URL.revokeObjectURL(blob);
    }
  }

  function una(nombre) {
    if (!enCurso[nombre]) {
      enCurso[nombre] = (async () => {
        for (const dep of DEPENDE[nombre] || []) await una(dep);
        for (const lib of LIBS[nombre]) {
          if (lib.modulo) window[lib.modulo] = await modulo(lib);
          else await script(lib);
        }
      })();
      enCurso[nombre].catch(() => { delete enCurso[nombre]; }); // permite reintentar
    }
    return enCurso[nombre];
  }

  App.libs = {
    cargar: (...nombres) => Promise.all(nombres.map(una)),
  };
})();
