import type { AudioBand, AudioBands, LyricLine } from '../types';
import type { ImageMotion } from './model';

export interface MotionDelta {
  dx: number;
  dy: number;
  scale: number;
  rotation: number;
}

export function bandEnergy(bands: AudioBands, band: AudioBand) {
  return bands[band];
}

export function lyricAt(lines: LyricLine[], time: number) {
  let current = '';
  for (const line of lines) {
    if (line.time > time) break;
    current = line.text;
  }
  return current;
}

/** Shared motions. New templates pick one of these instead of adding animation code. */
export function sampleMotion(
  motion: ImageMotion,
  amount: number,
  time: number,
  width: number,
  height: number,
  energy = 0,
  reactAmount = 0,
): MotionDelta {
  const strength = amount;
  switch (motion) {
    case 'pan':
      return {
        dx: Math.sin(time * 0.16) * width * 0.05 * strength,
        dy: Math.cos(time * 0.12) * height * 0.028 * strength,
        scale: 1,
        rotation: 0,
      };
    case 'zoom':
      return {
        dx: 0,
        dy: 0,
        scale: 1 + (0.5 + 0.5 * Math.sin(time * 0.15)) * 0.1 * strength,
        rotation: 0,
      };
    case 'both':
      return {
        dx: Math.sin(time * 0.16) * width * 0.04 * strength,
        dy: Math.cos(time * 0.13) * height * 0.022 * strength,
        scale: 1 + (0.5 + 0.5 * Math.sin(time * 0.15)) * 0.07 * strength,
        rotation: Math.sin(time * 0.08) * 0.012 * strength,
      };
    case 'pulse':
      return {
        dx: Math.sin(time * 0.25) * width * 0.012,
        dy: 0,
        scale: 1 + energy * reactAmount,
        rotation: Math.sin(time * 0.4) * 0.012 + energy * 0.012,
      };
    case 'float':
      return {
        dx: Math.sin(time * 0.25) * width * 0.012,
        dy: Math.sin(time * 1.2) * height * 0.025,
        scale: 1,
        rotation: 0,
      };
    case 'rotate':
      return {
        dx: Math.sin(time * 0.25) * width * 0.012,
        dy: 0,
        scale: 1,
        rotation: time * 0.15,
      };
    case 'sway':
      return {
        dx: Math.sin(time * 0.34) * width * 0.006,
        dy: Math.sin(time * 0.7) * height * 0.004,
        scale: 1 + energy * reactAmount,
        rotation: 0,
      };
    default:
      return { dx: 0, dy: 0, scale: 1 + energy * reactAmount, rotation: 0 };
  }
}

export function randomFrom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
