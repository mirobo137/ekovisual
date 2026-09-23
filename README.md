# Eko Visual Studio

Editor personal para crear videos musicales reactivos con audio, portada, fondos e ilustraciones propias. El procesamiento sucede en el navegador; el repositorio solo contiene la app.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre la dirección local que muestre Vite. No abras `index.html` directamente con `file://`.

## Comprobar el editor

```bash
npm test
npm run build
```

Las pruebas usan Microsoft Edge instalado y arrancan el servidor local si es necesario. Comprueban píxeles de imágenes importadas (PNG y SVG), proporciones de la vista previa, reproducción de audio y un MP4 de un segundo con pistas H.264/AAC. Los resultados quedan en `test-results/` y no se incluyen en Git.

## Publicar en GitHub Pages

El workflow de `.github/workflows/deploy.yml` compila y publica `dist` en cada push a `main`. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente.

## Biblioteca personal de plantillas

En **Mis plantillas**, escribe un nombre y pulsa **Guardar como nueva**. Se conservan las imágenes originales (fondo, figura, portada y capas), sus ajustes, textos, letras LRC, formato y efectos. La música no se incluye.

**Usar** recupera la composición y mantiene la canción abierta, si la hay. Puedes elegir portada, letra, artista o título como contenido del marco en las cuatro escenas. Las letras guardadas conservan sus tiempos: carga otro LRC si cambias de canción.

Los cambios del editor no sobrescriben la biblioteca automáticamente: pulsa **Actualizar seleccionada** para sustituir la plantilla seleccionada, o **Guardar como nueva** para crear una variante. Las plantillas persisten al cerrar el navegador mediante IndexedDB, en el mismo navegador y origen (dirección y puerto). No hay sincronización ni copia externa: borrar los datos del sitio elimina la biblioteca.

## Capas y formatos

- Portada con escala reactiva a graves.
- Composición vertical de retrato: fondo con paneo, avatar PNG, humo procedural y anillo de barras radial.
- Letras sincronizadas desde archivos `.lrc`; se puede elegir mostrar la portada o la línea actual dentro del anillo.
- Segundo fondo con movimiento lento y parallax.
- Capas de SVG o imagen con animación independiente: pulso, flotar o girar.
- Partículas, espectro, corazón vectorial, lluvia y flashes de tormenta.
- Formatos 16:9, 9:16 y 1:1.
- Exportación sincronizada por cuadro mediante WebCodecs/Mediabunny a H.264/AAC MP4.

Los SVG deben ser propios o de fuentes con licencia adecuada. MP4 necesita que el navegador pueda codificar H.264; AAC usa el codificador del navegador o un codificador local incluido como alternativa.

## Letras sincronizadas

Carga un archivo LRC y selecciona **Letra sincronizada** como contenido del círculo. Cada línea lleva su tiempo, por ejemplo:

```text
[00:12.50]Primera línea
[00:16.20]Segunda línea
```
