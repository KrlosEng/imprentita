/* =========================================================
   Salida Excel (.xlsx)
   Toma las tablas de cada archivo (CSV, Excel, o las tablas
   que haya dentro de un Word, Markdown o HTML) y pone cada
   una en su propia hoja
   ========================================================= */
(() => {
  // Excel no deja nombres de hoja de más de 31 caracteres ni con []:*?/\
  function nombreHoja(nombre, usados) {
    const base = nombre.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Hoja';
    let n = base, i = 2;
    while (usados.has(n.toLowerCase())) n = `${base.slice(0, 25)} (${i++})`;
    usados.add(n.toLowerCase());
    return n;
  }

  function agregarTablas(wb, it, usados) {
    const X = window.XLSX;
    const tablas = it.bloques.filter((b) => b.t === 'tabla');
    tablas.forEach((t, i) => {
      // Si viene de un Excel se conserva la hoja original (números, fechas, fórmulas)
      const hoja = t.hoja || X.utils.aoa_to_sheet(t.filas);
      const base = t.nombre && tablas.length > 1 ? t.nombre : App.sinExtension(it.name) + (tablas.length > 1 ? ` ${i + 1}` : '');
      X.utils.book_append_sheet(wb, hoja, nombreHoja(base, usados));
    });
  }

  const libroABlob = (wb) => new Blob([window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  async function salidaExcel(items, o, paso) {
    await App.libs.cargar('xlsx');
    const X = window.XLSX;
    paso(0.3, 'Armando las hojas…');
    if (o.archivos === 'unir') {
      const wb = X.utils.book_new();
      const usados = new Set();
      items.forEach((it) => agregarTablas(wb, it, usados));
      return [{ nombre: o.base + '.xlsx', blob: libroABlob(wb) }];
    }
    return items.map((it) => {
      const wb = X.utils.book_new();
      agregarTablas(wb, it, new Set());
      return { nombre: App.sinExtension(it.name) + '.xlsx', blob: libroABlob(wb) };
    });
  }

  App.salidas = App.salidas || {};
  App.salidas.excel = salidaExcel;
})();
