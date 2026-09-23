import type { TemplateDef } from '../scene/model';

const text = [
  { id: 'titulo', kind: 'text', source: 'title', placement: 'auto' },
  { id: 'artista', kind: 'text', source: 'artist', placement: 'auto' },
  { id: 'enlace', kind: 'text', source: 'link', placement: 'auto' },
] as const;

export const retrato: TemplateDef = {
  id: 'retrato',
  title: 'Retrato',
  detail: 'Figura, atmósfera y marco',
  glyph: '◉',
  defaultRatio: 'portrait',
  slots: ['background', 'backgroundMotion', 'figure', 'cutout', 'frameShape', 'center', 'accent', 'sensitivity'],
  layers: [
    {
      id: 'fondo', kind: 'image', slot: 'background', motion: 'both', motionAmount: 0.7,
      x: 0.5, y: 0.5, size: 1, opacity: 1, coverFit: true,
    },
    { id: 'humo', kind: 'emitter', style: 'smoke', anchor: 'figura', band: 'mids', amount: 0.82, origin: 'base' },
    {
      id: 'figura', kind: 'image', slot: 'figure', motion: 'sway', motionAmount: 1,
      x: 0.5, y: 0.46, size: 0.92, opacity: 1, react: { band: 'bass', amount: 0.02 },
    },
    { id: 'chispas', kind: 'emitter', style: 'sparks', anchor: 'figura', band: 'highs', amount: 0.75, origin: 'edge' },
    {
      id: 'marco', kind: 'frame', shape: 'circle', bars: 'radial', center: 'cover',
      x: 0.5, y: 0.56, size: 0.34, showShape: true,
      portrait: { x: 0.5, y: 0.76, size: 0.32 },
    },
    ...text,
  ],
};
