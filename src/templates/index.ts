import type { TemplateId, VisualConfig } from '../types';
import type { TemplateDef } from '../scene/model';
import { aurora } from './aurora';
import { latido } from './latido';
import { retrato } from './retrato';
import { tormenta } from './tormenta';

export const TEMPLATE_LIST: TemplateDef[] = [retrato, aurora, latido, tormenta];

const byId = new Map(TEMPLATE_LIST.map((template) => [template.id, template]));

export function getTemplate(id: TemplateId): TemplateDef {
  return byId.get(id) ?? retrato;
}

export function applyTemplate(id: TemplateId, current: VisualConfig): VisualConfig {
  const template = getTemplate(id);
  const background = template.layers.find((layer) => layer.kind === 'image' && layer.slot === 'background');
  const figure = template.layers.find((layer) => layer.kind === 'image' && layer.slot === 'figure');
  const frame = template.layers.find((layer) => layer.kind === 'frame' && (layer.center !== 'none' || layer.bars !== 'none'));
  const motion = background?.kind === 'image' ? background.motion : current.backgroundMotion;
  return {
    ...current,
    template: id,
    ratio: template.defaultRatio,
    backgroundMotion: motion === 'pan' || motion === 'zoom' || motion === 'both' ? motion : current.backgroundMotion,
    backgroundMotionAmount: background?.kind === 'image' ? background.motionAmount : current.backgroundMotionAmount,
    frameShape: template.slots.includes('frameShape') && frame?.kind === 'frame' && frame.shape !== 'heart' ? frame.shape : current.frameShape,
    centerMode: template.slots.includes('center') && frame?.kind === 'frame' && frame.center !== 'none' ? frame.center : current.centerMode,
    avatarScale: figure?.kind === 'image' ? figure.size : current.avatarScale,
    avatarY: figure?.kind === 'image' ? figure.y : current.avatarY,
  };
}
