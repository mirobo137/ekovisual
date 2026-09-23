import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  StreamTarget,
  type StreamTargetChunk,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { analyseAudioBuffer } from '../audio/analysis';
import type { AspectRatio, VisualConfig } from '../types';
import { RATIO_SIZE } from '../types';
import type { VisualizerStageHandle } from '../visualizer/VisualizerStage';

export interface SaveHandle {
  createWritable(): Promise<WritableStream<Uint8Array>>;
}

export interface ExportOptions {
  stage: VisualizerStageHandle;
  audioBuffer: AudioBuffer;
  config: VisualConfig;
  aspect: AspectRatio;
  saveChoice?: Promise<{ handle: SaveHandle } | { error: unknown }>;
  onProgress: (progress: number, message: string) => void;
}

function filenamePart(value: string) {
  return value.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 60) || 'track';
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function exportVideo({ stage, audioBuffer, config, aspect, saveChoice, onProgress }: ExportOptions) {
  await stage.ready();
  const canvas = stage.canvas();
  if (!canvas) throw new Error('El visualizador todavía se está preparando.');

  const dimensions = RATIO_SIZE[aspect];
  const fps = 30;
  const videoQuality = new Quality({ bitrate: 7_000_000 });
  const audioQuality = new Quality({ bitrate: 192_000 });
  const baseName = `${filenamePart(config.artist)}-${filenamePart(config.title)}`;
  const suggestedName = `${baseName}.mp4`;
  onProgress(0.01, 'Comprobando codificadores…');
  const [avc, aac] = await Promise.all([
    canEncodeVideo('avc', { width: dimensions.width, height: dimensions.height, frameRate: fps, quality: videoQuality }),
    canEncodeAudio('aac', { numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2), sampleRate: audioBuffer.sampleRate, quality: audioQuality }),
  ]);
  if (!avc) throw new Error('Este navegador no puede codificar H.264 en este tamaño. Prueba la app en Chrome o Edge actualizado.');
  if (!aac) {
    onProgress(0.02, 'Preparando codificador AAC local…');
    const { registerAacEncoder } = await import('@mediabunny/aac-encoder');
    registerAacEncoder();
  }

  onProgress(0.04, 'Analizando la canción…');
  const features = await analyseAudioBuffer(audioBuffer, fps, (progress) => {
    onProgress(0.04 + progress * 0.12, 'Analizando la canción…');
  });
  let fileHandle: SaveHandle | undefined;
  let output: Output;

  const result = await saveChoice;
  if (result && 'error' in result) throw result.error;
  fileHandle = result && 'handle' in result ? result.handle : undefined;

  if (fileHandle) {
    output = new Output({
      format: new Mp4OutputFormat(),
      target: new StreamTarget(await fileHandle.createWritable() as unknown as WritableStream<StreamTargetChunk>, { chunked: true }),
    });
  } else {
    output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  }

  const videoSource = new CanvasSource(canvas, { codec: 'avc', quality: videoQuality, latencyMode: 'quality' });
  const audioSource = new AudioBufferSource({ codec: 'aac', quality: audioQuality });
  output.addVideoTrack(videoSource, { frameRate: fps });
  output.addAudioTrack(audioSource);
  output.setMetadataTags({ title: config.title, artist: config.artist, comment: config.link || undefined });

  stage.pause();
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  try {
    stage.resize(dimensions.width, dimensions.height);
    await output.start();
    await audioSource.add(audioBuffer);
    audioSource.close();
    const frameCount = Math.ceil(audioBuffer.duration * fps);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const timestamp = frame / fps;
      stage.renderAt(timestamp, features[frame] ?? { bass: 0, mids: 0, highs: 0 });
      await videoSource.add(timestamp, 1 / fps);
      if (frame % 15 === 0 || frame === frameCount - 1) {
        onProgress(0.16 + (frame + 1) / frameCount * 0.82, `Renderizando ${Math.floor((frame + 1) / frameCount * 100)}%`);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    }
    videoSource.close();
    await output.finalize();
    if (!fileHandle) {
      const target = output.target as BufferTarget;
      if (!target.buffer) throw new Error('No se pudo crear el archivo MP4.');
      triggerDownload(new Blob([target.buffer], { type: 'video/mp4' }), suggestedName);
    }
    onProgress(1, 'Video listo');
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    stage.resize(previousWidth, previousHeight);
    stage.resume();
  }
}

export async function canExportMp4(width: number, height: number, channels = 2, sampleRate = 48000) {
  const quality = new Quality({ bitrate: 7_000_000 });
  const [video, audio] = await Promise.all([
    canEncodeVideo('avc', { width, height, frameRate: 30, quality }),
    canEncodeAudio('aac', { numberOfChannels: channels, sampleRate, quality: new Quality({ bitrate: 192_000 }) }),
  ]);
  return { video, audio };
}
