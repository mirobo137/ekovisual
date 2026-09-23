import type { DynamicLayer, VisualConfig } from '../types';
import type { ImageLayerDef, LayerDef } from './model';
import { getTemplate } from '../templates';

function customImage(layer: DynamicLayer): ImageLayerDef {
  return {
    id: layer.id,
    kind: 'image',
    slot: 'custom',
    customId: layer.id,
    motion: layer.motion,
    motionAmount: 1,
    x: layer.x,
    y: layer.y,
    size: layer.size,
    opacity: layer.visible ? layer.opacity : 0,
    react: layer.motion === 'pulse' ? { band: 'bass', amount: 0.18 } : undefined,
  };
}

/** Applies the active template and the slots the user is allowed to change. */
export function resolveLayers(config: VisualConfig, custom: DynamicLayer[]): LayerDef[] {
  const template = getTemplate(config.template);
  const layers: LayerDef[] = template.layers.map((layer): LayerDef => {
    if (layer.kind === 'image' && layer.slot === 'cover' && config.centerMode !== 'cover') {
      return {
        id: layer.id, kind: 'frame', shape: 'rounded', bars: 'none', center: config.centerMode,
        x: layer.x, y: layer.y, size: layer.size, portrait: layer.portrait, showShape: false,
      };
    }
    if (layer.kind === 'image' && layer.slot === 'background' && template.slots.includes('backgroundMotion')) {
      return { ...layer, motion: config.backgroundMotion, motionAmount: config.backgroundMotionAmount };
    }
    if (layer.kind === 'image' && layer.slot === 'figure' && template.slots.includes('figure')) {
      return { ...layer, size: config.avatarScale, y: config.avatarY };
    }
    if (layer.kind === 'frame') {
      return {
        ...layer,
        bars: config.spectrumStyle === 'template' ? layer.bars : config.spectrumStyle,
        spectrumCount: config.spectrumCount,
        spectrumHeight: config.spectrumHeight,
        spectrumWidth: config.spectrumWidth,
        spectrumY: config.spectrumY,
        shape: template.slots.includes('frameShape') ? config.frameShape : layer.shape,
        center: template.slots.includes('center') && !template.slots.includes('cover') ? config.centerMode : layer.center,
      };
    }
    if (layer.kind === 'emitter') {
      const slot = layer.style === 'rain' ? 'weather' : layer.style === 'stars' ? 'particles' : null;
      if (slot && template.slots.includes(slot)) {
        return { ...layer, amount: slot === 'weather' ? config.weatherAmount : config.particleAmount };
      }
    }
    return layer;
  });

  if (template.slots.includes('customLayers') && custom.length) {
    const extras = custom.map(customImage);
    const textAt = layers.findIndex((layer) => layer.kind === 'text');
    layers.splice(textAt < 0 ? layers.length : textAt, 0, ...extras);
  }
  return layers;
}
