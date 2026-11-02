/* =========================================================
   Carga de librerías bajo demanda
   Cada librería se descarga solo cuando hace falta, así la
   app abre rápido. La primera vez se necesita internet.
   ========================================================= */
(() => {
  const URLS = {
    jspdf: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'],
    autotable: ['https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'],
    docx: ['https://unpkg.com/docx@8.5.0/build/index.umd.js'],
    pdfjs: [
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      // Cargar el worker como script deja a pdf.js trabajar sin un Worker
      // aparte, lo que permite abrir la app con doble clic (file://)
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
    ],
    pdflib: ['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js'],
    mammoth: ['https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'],
    xlsx: ['https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'],
    marked: ['https://cdn.jsdelivr.net/npm/marked@9.1.6/marked.min.js'],
    jszip: ['https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'],
  };
  // autotable necesita jsPDF antes
  const DEPENDE = { autotable: ['jspdf'] };

  const enCurso = {};

  const script = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error('No se pudo descargar ' + src.split('/').slice(-1)[0]));
    document.head.appendChild(s);
  });

  function una(nombre) {
    if (!enCurso[nombre]) {
      enCurso[nombre] = (async () => {
        for (const dep of DEPENDE[nombre] || []) await una(dep);
        for (const src of URLS[nombre]) await script(src);
        if (nombre === 'pdfjs') {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = URLS.pdfjs[1];
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
