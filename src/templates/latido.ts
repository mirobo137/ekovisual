import type { TemplateDef } from '../scene/model';

export const latido: TemplateDef = {
  id: 'heart',
  title: 'Latido',
  detail: 'Corazón reactivo',
  glyph: '♡',
  defaultRatio: 'landscape',
  slots: ['background', 'backgroundMotion', 'cover', 'center', 'particles', 'customLayers', 'accent', 'sensitivity'],
  layers: [
    {
      id: 'fondo', kind: 'image', slot: 'background', motion: 'both', motionAmount: 0.4,
      x: 0.5, y: 0.5, size: 1, opacity: 1, coverFit: true,
    },
    { id: 'estrellas', kind: 'emitter', style: 'stars', anchor: 'screen', band: 'highs', amount: 0.55, origin: 'body' },
    {
      id: 'portada', kind: 'image', slot: 'cover', motion: 'pulse', motionAmount: 1,
      x: 0.5, y: 0.48, size: 0.38, opacity: 1, stroke: true, react: { band: 'bass', amount: 0.055 },
      portrait: { x: 0.5, y: 0.37, size: 0.53 },
    },
    {
      id: 'latido', kind: 'frame', shape: 'heart', bars: 'none', center: 'none',
      x: 0.78, y: 0.5, size: 0.17, showShape: true,
      portrait: { x: 0.5, y: 0.61, size: 0.17 },
    },
    { id: 'titulo', kind: 'text', source: 'title', placement: 'auto' },
    { id: 'artista', kind: 'text', source: 'artist', placement: 'auto' },
    { id: 'enlace', kind: 'text', source: 'link', placement: 'auto' },
  ],
};
