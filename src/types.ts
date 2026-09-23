export type AspectRatio = 'landscape' | 'portrait' | 'square';
export type PresetName = 'aurora' | 'heart' | 'storm' | 'vizy';
export type MotionStyle = 'pulse' | 'float' | 'rotate';
export type CenterMode = 'cover' | 'lyrics';

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
  preset: PresetName;
  title: string;
  artist: string;
  link: string;
  accent: string;
  sensitivity: number;
  showCover: boolean;
  showHeart: boolean;
  showSpectrum: boolean;
  showParticles: boolean;
  showWeather: boolean;
  backgroundMotion: number;
  backgroundOpacity: number;
  particleAmount: number;
  weatherAmount: number;
  radialSpectrum: boolean;
  showSmoke: boolean;
  smokeAmount: number;
  centerMode: CenterMode;
  avatarScale: number;
  avatarY: number;
}

export const RATIO_SIZE: Record<AspectRatio, { width: number; height: number; label: string }> = {
  landscape: { width: 1920, height: 1080, label: '16:9' },
  portrait: { width: 1080, height: 1920, label: '9:16' },
  square: { width: 1080, height: 1080, label: '1:1' },
};

export const DEFAULT_CONFIG: VisualConfig = {
  ratio: 'landscape',
  preset: 'aurora',
  title: 'Tu canción',
  artist: 'Nombre del artista',
  link: '',
  accent: '#91e5d0',
  sensitivity: 1.2,
  showCover: true,
  showHeart: false,
  showSpectrum: true,
  showParticles: true,
  showWeather: false,
  backgroundMotion: 0.45,
  backgroundOpacity: 0.78,
  particleAmount: 0.65,
  weatherAmount: 0.55,
  radialSpectrum: false,
  showSmoke: false,
  smokeAmount: 0.55,
  centerMode: 'cover',
  avatarScale: 0.84,
  avatarY: 0.57,
};
