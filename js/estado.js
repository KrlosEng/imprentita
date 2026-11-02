/* =========================================================
   Estado compartido de la app
   Todos los módulos cuelgan de window.App
   ========================================================= */
window.App = (() => {
  const $ = (s) => document.querySelector(s);

  // Tamaños de página en milímetros (vertical)
  const SIZES = { a4: [210, 297], letter: [215.9, 279.4], legal: [215.9, 355.6] };
  const SIZE_NAMES = { a4: 'A4', letter: 'Carta', legal: 'Oficio', fit: 'A la medida' };
  const ORIENT_NAMES = { auto: 'auto', p: 'vertical', l: 'horizontal' };

  // Nivel de calidad → compresión JPEG, resolución al pasar páginas a imagen y si se usa la IA
  const CALIDAD = {
    ligera: { jpeg: 0.7, dpi: 110, ia: false, nombre: 'ligera' },
    alta: { jpeg: 0.92, dpi: 150, ia: false, nombre: 'alta' },
    ia: { jpeg: 0.95, dpi: 200, ia: true, nombre: 'IA ×2' },
  };

  // Tipos de archivo que se pueden abrir
  const TIPOS = {
    imagen: { nombre: 'Imagen', ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif'] },
    pdf: { nombre: 'PDF', ext: ['pdf'] },
    word: { nombre: 'Word', ext: ['docx'] },
    tabla: { nombre: 'Excel', ext: ['xlsx', 'xls', 'ods', 'csv', 'tsv'] },
    markdown: { nombre: 'Markdown', ext: ['md', 'markdown'] },
    html: { nombre: 'HTML', ext: ['html', 'htm'] },
    texto: { nombre: 'Texto', ext: ['txt', 'text', 'log', 'json', 'xml', 'rtf'] },
  };

  // Formatos de salida
  const SALIDAS = {
    pdf: { nombre: 'PDF', ext: '.pdf' },
    docx: { nombre: 'Word', ext: '.docx' },
    imagen: { nombre: 'Imagen', ext: '.jpg' },
    texto: { nombre: 'Texto', ext: '.txt' },
    excel: { nombre: 'Excel', ext: '.xlsx' },
  };

  // Cada archivo: { id, name, kind, rot, ia, ... } (ver entradas/detectar.js)
  const state = { items: [], uid: 0, descargado: false, convirtiendo: false };

  // Eventos simples para que los módulos se avisen entre sí
  const listeners = {};
  const on = (ev, fn) => (listeners[ev] = listeners[ev] || []).push(fn);
  const emit = (ev, data) => (listeners[ev] || []).forEach((fn) => fn(data));

  const checked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
  const opts = () => {
    const calidad = checked('calidad');
    const fmt = checked('fmt');
    return {
      fmt,
      size: $('#size').value,
      orient: checked('orient'),
      margin: Number(checked('margin')),
      imgFormato: checked('imgfmt'),
      pdfAWord: checked('pdfword'),
      archivos: checked('archivos'),
      calidad,
      ...CALIDAD[calidad],
      // la IA solo aplica a salidas que llevan imágenes
      ia: CALIDAD[calidad].ia && ['pdf', 'docx', 'imagen'].includes(fmt),
    };
  };

  // ¿Este archivo se puede convertir al formato elegido?
  const compatible = (it, fmt) => {
    if (fmt === 'texto') return it.kind !== 'imagen';
    if (fmt === 'excel') return (it.bloques || []).some((b) => b.t === 'tabla');
    return true;
  };

  const loadImage = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });

  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sinExtension = (n) => n.replace(/\.[^.]+$/, '');

  return { $, SIZES, SIZE_NAMES, ORIENT_NAMES, CALIDAD, TIPOS, SALIDAS, state, on, emit, opts, compatible, loadImage, escapar, sinExtension };
})();
