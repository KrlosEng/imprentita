# 🖨️ Imprentita

**Convierte imágenes, PDF, Word, Excel y texto al formato que necesites, directo en tu navegador.**

👉 **Pruébala aquí:** https://imprentita.vercel.app

Tus archivos nunca se suben a ningún servidor: todo se procesa en tu computadora.

---

## ✨ Qué puede hacer

- **Convertir entre formatos:** PDF, Word (.docx), imagen (JPG, PNG, WEBP), texto (.txt) y Excel (.xlsx).
- **Unir varios archivos en uno:** por ejemplo, una foto, un PDF y un Word en un solo PDF.
- **Uno por archivo:** si prefieres, cada archivo sale por separado dentro de un `.zip`.
- **Ordenar, girar y quitar** archivos antes de convertir: arrastra las tarjetas, usa sus flechas ◀ ▶ (también en el celular) o, con teclado, `Alt` + `←` `→`.
- **PDF a Word** como *texto editable* o como *copia exacta* (cada página como imagen).
- **Mejora con IA:** amplía tus fotos al doble de resolución con un modelo ESRGAN que corre en tu navegador.
- **PDF con texto real**, que se puede seleccionar y buscar.
- Modo **claro y oscuro**, y funciona en el **celular**.

## 🔄 Qué convierte

| Entrada ↓ / Salida → | PDF | Word | Imagen | Texto | Excel |
|---|:-:|:-:|:-:|:-:|:-:|
| Imagen (JPG, PNG, WEBP, GIF, BMP, SVG) | ✓ | ✓ | ✓ | — | — |
| PDF | ✓ | ✓ | ✓ una por página | ✓ | — |
| Word (.docx) | ✓ | ✓ | ✓ | ✓ | ✓ sus tablas |
| Excel / CSV (.xlsx, .xls, .ods, .csv) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Texto / Markdown / HTML | ✓ | ✓ | ✓ | ✓ | ✓ sus tablas |

> Los archivos `.doc` y `.ppt` antiguos no se pueden abrir: guárdalos antes como `.docx` o PDF.

## 🚀 Cómo usarla

1. Abre https://imprentita.vercel.app (o `index.html` con doble clic si la descargaste).
2. Arrastra tus archivos, búscalos con **Elegir archivos** o pégalos con `Ctrl` + `V`.
3. Elige el formato de salida y las opciones (tamaño de página, calidad, unir o separar).
4. Presiona **Convertir** y se descarga el resultado.

¿Sin archivos a la mano? Usa **Probar con ejemplos**.

> La primera vez que usas cada formato se necesita internet para descargar sus herramientas.

## 💻 Correrla en tu computadora

No necesita instalación ni compilación. Puedes:

- Abrir `index.html` con doble clic, **o**
- Servir la carpeta con cualquier servidor estático:

```bash
python -m http.server 8000
```

y abrir http://localhost:8000.

## 📁 Estructura del proyecto

```
├── index.html                 Página principal
├── css/
│   ├── base.css               Colores, fuentes, modo claro/oscuro
│   ├── layout.css             Encabezado, pasos y columnas
│   ├── componentes.css        Botones, tarjetas, panel, avisos
│   └── archivos.css           Colores por tipo, miniaturas, formatos de salida
└── js/
    ├── estado.js              Estado compartido, opciones y compatibilidad de formatos
    ├── librerias.js           Carga cada librería solo cuando hace falta
    ├── app.js                 Botón "Convertir"
    ├── entradas/              Abrir archivos
    │   ├── abrir.js           Detecta el tipo y lee cada archivo
    │   ├── html-a-bloques.js  Pasa Word/Markdown/HTML a bloques
    │   └── leer-pdf.js        Dibuja páginas y saca el texto de un PDF
    ├── salidas/               Crear cada formato
    │   ├── imagen.js          Girar imágenes y acomodarlas en la página
    │   ├── a-pdf.js           PDF con texto real y unión de PDFs
    │   ├── a-word.js          Word (.docx)
    │   ├── a-imagenes.js      JPG / PNG / WEBP
    │   ├── a-texto.js         Texto (.txt)
    │   ├── a-excel.js         Excel (.xlsx)
    │   └── paquete.js         Descarga directa o en .zip
    ├── ia/
    │   └── mejorar.js         Mejora con IA ×2
    └── interfaz/
        ├── avisos.js          Mensajes flotantes
        ├── carga.js           Explorador, arrastrar, pegar y ejemplos
        ├── tarjetas.js        Tarjetas: girar, quitar y reordenar
        └── panel.js           Opciones según el formato, resumen y pasos
```

Los scripts se cargan en orden desde `index.html` (sin módulos), por eso funciona al abrirla con doble clic.

### Cómo funciona por dentro

Cada documento se pasa primero a una lista de **bloques** (título, párrafo, lista, tabla, imagen).
Cada salida sabe escribir esos bloques, así que agregar un formato nuevo es escribir un solo archivo en `js/salidas/`.

## 🧰 Hecha con

| Librería | Para qué |
|---|---|
| [jsPDF](https://github.com/parallax/jsPDF) + [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | Crear PDF y sus tablas |
| [pdf-lib](https://pdf-lib.js.org/) | Unir y girar PDF |
| [pdf.js](https://mozilla.github.io/pdf.js/) | Leer PDF: páginas y texto |
| [docx](https://docx.js.org/) | Crear documentos de Word |
| [Mammoth](https://github.com/mwilliamson/mammoth.js) | Leer documentos de Word |
| [SheetJS](https://sheetjs.com/) | Leer y crear Excel / CSV |
| [Marked](https://marked.js.org/) | Leer Markdown |
| [JSZip](https://stuk.github.io/jszip/) | Empaquetar varios archivos |
| [UpscalerJS](https://upscalerjs.com/) + [TensorFlow.js](https://www.tensorflow.org/js) | Mejora de imágenes con IA |

Todas se cargan desde CDN y solo cuando hacen falta.

## ☁️ Publicar en Vercel

Es un sitio estático, así que no necesita configuración:

```bash
vercel deploy --prod
```

## 🔒 Privacidad

Las conversiones y la mejora con IA ocurren dentro de tu navegador. Ningún archivo se envía a un servidor.

- **Integridad de las librerías:** cada librería que se descarga de una CDN lleva su hash SHA-384 (SRI). Si la CDN sirviera otro contenido, no se ejecuta. Los hashes están en `js/librerias.js`.
- **Sin imágenes de internet:** si un HTML o Markdown trae imágenes con dirección web, no se descargan; en su lugar queda una nota.
- **Versiones con parches de seguridad:** SheetJS 0.20.3 (desde `cdn.sheetjs.com`) y pdf.js 4.10 con `isEvalSupported: false`.

## ⚠️ Límites conocidos

- Los textos en alfabetos que las fuentes básicas de PDF no tienen (chino, árabe, griego, emojis…) se ponen en el PDF como imagen: se ven bien, pero no se pueden seleccionar. La app lo avisa.
- Un PDF escaneado no tiene texto: al pasarlo a Texto sale vacío (avisa) y a Word se pasa como copia exacta.
- Un PDF protegido se une copiando sus páginas como imagen, para que no salgan en blanco.
