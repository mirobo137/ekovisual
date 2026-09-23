export type AspectRatio = 'landscape' | 'portrait' | 'square';
export type TemplateId = 'aurora' | 'heart' | 'storm' | 'retrato';
export type MotionStyle = 'pulse' | 'float' | 'rotate';
export type BackgroundMotion = 'pan' | 'zoom' | 'both';
export type FrameShape = 'circle' | 'rect' | 'rounded' | 'heart';
export type CenterMode = 'cover' | 'lyrics' | 'artist' | 'title' | 'none';
export type AudioBand = 'bass' | 'mids' | 'highs';

export interface LyricLine {
  time: number;
  text: string;
}

export interface AudioBands {
  bass: number;
  mids: number;
  highs: number;
}

export interface DynamicLayer {
  id: string;
  name: string;
  url: string;
  visible: boolean;
  motion: MotionStyle;
  opacity: number;
  size: number;
  x: number;
  y: number;
}

export interface VisualConfig {
  ratio: AspectRatio;
  template: TemplateId;
  title: string;
  artist: string;
  link: string;
  accent: string;
  sensitivity: number;
  backgroundMotion: BackgroundMotion;
  backgroundMotionAmount: number;
  frameShape: FrameShape;
  centerMode: CenterMode;
  avatarScale: number;
  avatarY: number;
  particleAmount: number;
  weatherAmount: number;
}

export const RATIO_SIZE: Record<AspectRatio, { width: number; height: number; label: string }> = {
  landscape: { width: 1920, height: 1080, label: '16:9' },
  portrait: { width: 1080, height: 1920, label: '9:16' },
  square: { width: 1080, height: 1080, label: '1:1' },
};

export const DEFAULT_CONFIG: VisualConfig = {
  ratio: 'portrait',
  template: 'retrato',
  title: 'Tu canción',
  artist: 'Nombre del artista',
  link: '',
  accent: '#91e5d0',
  sensitivity: 1.2,
  backgroundMotion: 'both',
  backgroundMotionAmount: 0.7,
  frameShape: 'circle',
  centerMode: 'cover',
  avatarScale: 0.92,
  avatarY: 0.46,
  particleAmount: 0.65,
  weatherAmount: 0.55,
};
