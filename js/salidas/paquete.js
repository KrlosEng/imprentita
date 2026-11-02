/* =========================================================
   Entregar los archivos: uno se descarga directo,
   varios se juntan en un .zip
   ========================================================= */
(() => {
  function descargar(blob, nombre) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // Evita nombres repetidos dentro del zip
  function nombresUnicos(archivos) {
    const vistos = {};
    return archivos.map((f) => {
      const k = f.nombre.toLowerCase();
      if (!vistos[k]) { vistos[k] = 1; return f; }
      const n = ++vistos[k];
      return { ...f, nombre: f.nombre.replace(/(\.[^.]+)$/, ` (${n})$1`) };
    });
  }

  async function entregar(archivos, base) {
    if (archivos.length === 1) {
      descargar(archivos[0].blob, archivos[0].nombre);
      return { nombre: archivos[0].nombre, tamano: archivos[0].blob.size };
    }
    await App.libs.cargar('jszip');
    const zip = new window.JSZip();
    nombresUnicos(archivos).forEach((f) => zip.file(f.nombre, f.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    const nombre = base + '.zip';
    descargar(blob, nombre);
    return { nombre, tamano: blob.size, cuantos: archivos.length };
  }

  App.paquete = { entregar };
})();
