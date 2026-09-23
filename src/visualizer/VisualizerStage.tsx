import { Application } from 'pixi.js';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { analyseLiveFrequencies } from '../audio/analysis';
import type { AudioBands, DynamicLayer, LyricLine, VisualConfig } from '../types';
import { RATIO_SIZE } from '../types';
import { VisualizerScene } from './VisualizerScene';

export interface VisualizerStageHandle {
  ready: () => Promise<void>;
  canvas: () => HTMLCanvasElement | null;
  renderAt: (time: number, bands: AudioBands) => void;
  pause: () => void;
  resume: () => void;
  resize: (width: number, height: number) => void;
}

interface Props {
  config: VisualConfig;
  coverUrl?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  lyrics: LyricLine[];
  audioElement: HTMLAudioElement | null;
  dynamicLayers: DynamicLayer[];
  onReady?: () => void;
  onError?: (message: string) => void;
}

// A media element can be attached to only one source node, including StrictMode remounts.
const audioGraphs = new WeakMap<HTMLAudioElement, { context: AudioContext; analyser: AnalyserNode }>();

const VisualizerStage = forwardRef<VisualizerStageHandle, Props>(function VisualizerStage(
  { config, coverUrl, avatarUrl, backgroundUrl, lyrics, audioElement, dynamicLayers, onReady, onError },
  forwardedRef,
) {
  const pendingRef = useRef(new Set<Promise<unknown>>());
  const track = (task: Promise<unknown>) => {
    pendingRef.current.add(task);
    void task.catch((error: unknown) => onError?.(error instanceof Error ? error.message : 'No se pudo cargar la escena.'))
      .finally(() => pendingRef.current.delete(task));
  };
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const sceneRef = useRef<VisualizerScene | null>(null);
  const exportModeRef = useRef(false);
  const configRef = useRef(config);
  const assetsRef = useRef({ coverUrl, avatarUrl, backgroundUrl, dynamicLayers, lyrics });
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);
  const audioElementRef = useRef(audioElement);
  const dynamicAssetKey = dynamicLayers.map((layer) => `${layer.id}:${layer.url}`).join('|');

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { assetsRef.current = { coverUrl, avatarUrl, backgroundUrl, dynamicLayers, lyrics }; }, [coverUrl, avatarUrl, backgroundUrl, dynamicLayers, lyrics]);
  useEffect(() => { audioElementRef.current = audioElement; }, [audioElement]);

  useImperativeHandle(forwardedRef, () => ({
    ready: async () => {
      while (pendingRef.current.size) await Promise.all([...pendingRef.current]);
    },
    canvas: () => appRef.current?.canvas ?? null,
    renderAt: (time, bands) => {
      const app = appRef.current;
      const scene = sceneRef.current;
      if (!app || !scene) return;
      scene.renderAt(time, bands);
      app.renderer.render({ container: app.stage, clear: true });
    },
    pause: () => {
      exportModeRef.current = true;
      appRef.current?.ticker.stop();
    },
    resume: () => {
      exportModeRef.current = false;
      appRef.current?.ticker.start();
    },
    resize: (width, height) => {
      const app = appRef.current;
      if (!app) return;
      app.renderer.resize(width, height);
      sceneRef.current?.resize(width, height);
      app.renderer.render({ container: app.stage, clear: true });
    },
  }), []);

  useEffect(() => {
    let disposed = false;
    let tick: (() => void) | undefined;

    const setup = async () => {
      const app = new Application();
      const dimensions = RATIO_SIZE[configRef.current.ratio];
      await app.init({
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: 0x10101b,
        antialias: true,
        autoDensity: true,
        resolution: 1,
        preference: 'webgl',
        autoStart: false,
      });
      if (disposed) {
        app.destroy(true);
        return;
      }
      appRef.current = app;
      const scene = new VisualizerScene(configRef.current);
      sceneRef.current = scene;
      scene.resize(dimensions.width, dimensions.height);
      scene.setLayerSettings(assetsRef.current.dynamicLayers);
      track(scene.setAssets({ cover: assetsRef.current.coverUrl, avatar: assetsRef.current.avatarUrl, background: assetsRef.current.backgroundUrl }));
      scene.setLyrics(assetsRef.current.lyrics);
      track(scene.setDynamicLayers(assetsRef.current.dynamicLayers));
      app.stage.addChild(scene.root);
      mountRef.current?.replaceChildren(app.canvas);
      app.canvas.className = 'visualizer-canvas';

      tick = () => {
        if (exportModeRef.current) return;
        let bands: AudioBands = { bass: 0, mids: 0, highs: 0 };
        if (analyserRef.current && frequencyDataRef.current) {
          analyserRef.current.getByteFrequencyData(frequencyDataRef.current);
          bands = analyseLiveFrequencies(frequencyDataRef.current);
        }
        scene.renderAt(audioElementRef.current?.hasAttribute('src') ? audioElementRef.current.currentTime : performance.now() / 1000, bands);
        app.renderer.render({ container: app.stage, clear: true });
      };
      app.ticker.add(tick);
      app.ticker.start();
      onReady?.();
    };

    void setup().catch((error: unknown) => {
      if (!disposed) onError?.(`No se pudo iniciar la previsualización: ${error instanceof Error ? error.message : 'error del navegador'}`);
    });
    return () => {
      disposed = true;
      const app = appRef.current;
      if (app && tick) app.ticker.remove(tick);
      sceneRef.current?.destroy();
      app?.destroy(true);
      appRef.current = null;
      sceneRef.current = null;
    };
  }, [onReady, onError]);

  useEffect(() => {
    if (!audioElement) return;
    let graph = audioGraphs.get(audioElement);
    try {
      if (!graph) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        context.createMediaElementSource(audioElement).connect(analyser);
        analyser.connect(context.destination);
        graph = { context, analyser };
        audioGraphs.set(audioElement, graph);
      }
      analyserRef.current = graph.analyser;
      frequencyDataRef.current = new Uint8Array(graph.analyser.frequencyBinCount);
    } catch (error) {
      console.warn('No se pudo iniciar el análisis de audio en vivo.', error);
    }
    const resume = () => { void graph?.context.resume().catch(() => undefined); };
    audioElement.addEventListener('play', resume);
    if (!audioElement.paused) resume();
    return () => {
      audioElement.removeEventListener('play', resume);
      analyserRef.current = null;
      frequencyDataRef.current = null;
    };
  }, [audioElement]);

  useEffect(() => {
    sceneRef.current?.updateConfig(config);
    const size = RATIO_SIZE[config.ratio];
    const app = appRef.current;
    if (app) {
      app.renderer.resize(size.width, size.height);
      sceneRef.current?.resize(size.width, size.height);
    }
  }, [config]);

  useEffect(() => {
    if (sceneRef.current) track(sceneRef.current.setAssets({ cover: coverUrl, avatar: avatarUrl, background: backgroundUrl }));
  }, [coverUrl, avatarUrl, backgroundUrl]);

  useEffect(() => {
    sceneRef.current?.setLyrics(lyrics);
  }, [lyrics]);

  useEffect(() => {
    sceneRef.current?.setLayerSettings(dynamicLayers);
  }, [dynamicLayers]);

  useEffect(() => {
    if (sceneRef.current) track(sceneRef.current.setDynamicLayers(dynamicLayers));
  }, [dynamicAssetKey]);

  return <div className="stage-mount" ref={mountRef} aria-label="Previsualización del visualizador musical" />;
});

export default VisualizerStage;
