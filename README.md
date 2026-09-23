# Eko Visual Studio

Editor personal para crear videos musicales reactivos con audio, portada, fondos e ilustraciones propias. El procesamiento sucede en el navegador; el repositorio solo contiene la app.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre la dirección local que muestre Vite. No abras `index.html` directamente con `file://`.

## Publicar en GitHub Pages

El workflow de `.github/workflows/deploy.yml` compila y publica `dist` en cada push a `main`. En GitHub, abre **Settings → Pages** y selecciona **GitHub Actions** como fuente.

## Capas incluidas

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
