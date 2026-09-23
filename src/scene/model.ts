import type { AspectRatio, AudioBand, BackgroundMotion, CenterMode, FrameShape, TemplateId } from '../types';

export type ImageMotion = BackgroundMotion | 'still' | 'pulse' | 'float' | 'rotate' | 'sway';
export type ImageSlot = 'background' | 'figure' | 'cover' | 'custom';
export type EmitterStyle = 'smoke' | 'sparks' | 'stars' | 'rain';
export type EmitterOrigin = 'body' | 'base' | 'edge';
export type TextSource = 'title' | 'artist' | 'link';
export type TextPlacement = 'auto' | 'top-left' | 'bottom-center';
export type BarLayout = 'radial' | 'linear' | 'none';

export interface Placement {
  x: number;
  y: number;
  size: number;
}

export interface AudioReact {
  band: AudioBand;
  amount: number;
}

export interface ImageLayerDef {
  id: string;
  kind: 'image';
  slot: ImageSlot;
  customId?: string;
  motion: ImageMotion;
  motionAmount: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  coverFit?: boolean;
  stroke?: boolean;
  react?: AudioReact;
  portrait?: Placement;
}

export interface EmitterLayerDef {
  id: string;
  kind: 'emitter';
  style: EmitterStyle;
  anchor: 'screen' | string;
  band: AudioBand;
  amount: number;
  origin: EmitterOrigin;
}

export interface FrameLayerDef {
  id: string;
  kind: 'frame';
  shape: FrameShape;
  bars: BarLayout;
  center: CenterMode;
  x: number;
  y: number;
  size: number;
  showShape: boolean;
  portrait?: Placement;
}

export interface TextLayerDef {
  id: string;
  kind: 'text';
  source: TextSource;
  placement: TextPlacement;
}

export type LayerDef = ImageLayerDef | EmitterLayerDef | FrameLayerDef | TextLayerDef;

export type TemplateSlot =
  | 'background'
  | 'backgroundMotion'
  | 'figure'
  | 'cutout'
  | 'frameShape'
  | 'center'
  | 'cover'
  | 'lyrics'
  | 'particles'
  | 'weather'
  | 'customLayers'
  | 'accent'
  | 'sensitivity';

export interface TemplateDef {
  id: TemplateId;
  title: string;
  detail: string;
  glyph: string;
  defaultRatio: AspectRatio;
  slots: TemplateSlot[];
  layers: LayerDef[];
}

export function resolvePlacement(layer: { x: number; y: number; size: number; portrait?: Placement }, width: number, height: number): Placement {
  if (height > width && layer.portrait) return layer.portrait;
  return { x: layer.x, y: layer.y, size: layer.size };
}
