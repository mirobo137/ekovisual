import type { TemplateDef } from '../scene/model';

export const tormenta: TemplateDef = {
  id: 'storm',
  title: 'Tormenta',
  detail: 'Lluvia y relámpagos',
  glyph: 'ϟ',
  defaultRatio: 'landscape',
  slots: ['background', 'backgroundMotion', 'cover', 'weather', 'accent', 'sensitivity'],
  layers: [
    {
      id: 'fondo', kind: 'image', slot: 'background', motion: 'both', motionAmount: 0.35,
      x: 0.5, y: 0.5, size: 1, opacity: 1, coverFit: true,
    },
    { id: 'lluvia', kind: 'emitter', style: 'rain', anchor: 'screen', band: 'highs', amount: 0.55, origin: 'body' },
    {
      id: 'portada', kind: 'image', slot: 'cover', motion: 'pulse', motionAmount: 1,
      x: 0.5, y: 0.48, size: 0.38, opacity: 1, stroke: true, react: { band: 'bass', amount: 0.055 },
      portrait: { x: 0.5, y: 0.37, size: 0.53 },
    },
    {
      id: 'barras', kind: 'frame', shape: 'rounded', bars: 'linear', center: 'none',
      x: 0.5, y: 0.68, size: 0.2, showShape: false,
    },
    { id: 'titulo', kind: 'text', source: 'title', placement: 'auto' },
    { id: 'artista', kind: 'text', source: 'artist', placement: 'auto' },
    { id: 'enlace', kind: 'text', source: 'link', placement: 'auto' },
  ],
};
