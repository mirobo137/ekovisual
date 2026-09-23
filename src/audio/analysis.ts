import type { AudioBands } from '../types';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function analyseLiveFrequencies(data: Uint8Array): AudioBands {
  const average = (from: number, to: number) => {
    let sum = 0;
    const end = Math.min(to, data.length);
    for (let i = from; i < end; i += 1) sum += data[i] ?? 0;
    return end <= from ? 0 : sum / (end - from) / 255;
  };

  return {
    bass: average(2, 22),
    mids: average(22, 160),
    highs: average(160, 620),
  };
}

function fft(real: Float32Array, imag: Float32Array) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j]!, real[i]!];
      [imag[i], imag[j]] = [imag[j]!, imag[i]!];
    }
  }

  for (let length = 2; length <= n; length <<= 1) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImag = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let twiddleReal = 1;
      let twiddleImag = 0;
      const half = length >> 1;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd]! * twiddleReal - imag[odd]! * twiddleImag;
        const oddImag = real[odd]! * twiddleImag + imag[odd]! * twiddleReal;
        const evenReal = real[even]!;
        const evenImag = imag[even]!;
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
        const nextReal = twiddleReal * stepReal - twiddleImag * stepImag;
        twiddleImag = twiddleReal * stepImag + twiddleImag * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
}

function scaledBandEnergy(real: Float32Array, imag: Float32Array, sampleRate: number, low: number, high: number) {
  const binHz = sampleRate / real.length;
  const from = Math.max(1, Math.floor(low / binHz));
  const to = Math.min(real.length >> 1, Math.ceil(high / binHz));
  let sum = 0;
  let count = 0;
  for (let bin = from; bin < to; bin += 1) {
    sum += Math.hypot(real[bin]!, imag[bin]!) / real.length;
    count += 1;
  }
  const mean = count ? sum / count : 0;
  return clamp01(Math.log1p(mean * 28) / Math.log(8));
}

/** Create frame-aligned features so exported visuals do not depend on preview FPS. */
export async function analyseAudioBuffer(
  buffer: AudioBuffer,
  fps: number,
  onProgress?: (progress: number) => void,
): Promise<AudioBands[]> {
  const size = 2048;
  const frameCount = Math.ceil(buffer.duration * fps);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
  const taper = Float32Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  const features: AudioBands[] = new Array(frameCount);
  const halfWindow = size >> 1;
  const yieldToUi = () => new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));

  for (let frame = 0; frame < frameCount; frame += 1) {
    const center = Math.floor((frame / fps) * buffer.sampleRate);
    for (let i = 0; i < size; i += 1) {
      const sampleIndex = center - halfWindow + i;
      let value = 0;
      if (sampleIndex >= 0 && sampleIndex < buffer.length) {
        for (const channel of channels) value += channel[sampleIndex] ?? 0;
        value /= channels.length;
      }
      real[i] = value * taper[i]!;
      imag[i] = 0;
    }
    fft(real, imag);
    features[frame] = {
      bass: scaledBandEnergy(real, imag, buffer.sampleRate, 35, 250),
      mids: scaledBandEnergy(real, imag, buffer.sampleRate, 250, 4000),
      highs: scaledBandEnergy(real, imag, buffer.sampleRate, 4000, 16000),
    };
    if (frame % 48 === 0) {
      onProgress?.(frameCount ? frame / frameCount : 1);
      await yieldToUi();
    }
  }
  onProgress?.(1);
  return features;
}
