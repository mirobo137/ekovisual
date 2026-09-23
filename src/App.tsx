import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DynamicLayer, LyricLine, MotionStyle, PresetName, VisualConfig } from './types';
import { DEFAULT_CONFIG, RATIO_SIZE } from './types';
import { parseLrc } from './audio/lyrics';
import type { VisualizerStageHandle } from './visualizer/VisualizerStage';

const VisualizerStage = lazy(() => import('./visualizer/VisualizerStage'));

const presetCopy: Record<PresetName, { title: string; detail: string; glyph: string }> = {
  aurora: { title: 'Aurora', detail: 'Partículas + espectro', glyph: '✦' },
  heart: { title: 'Latido', detail: 'Corazón reactivo', glyph: '♡' },
  storm: { title: 'Tormenta', detail: 'Lluvia + relámpagos', glyph: 'ϟ' },
  vizy: { title: 'Retrato', detail: 'Avatar + anillo reactivo', glyph: '◉' },
};

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function safeName(file: File) {
  return file.name.replace(/\.[^.]+$/, '');
}

export default function App() {
  const [config, setConfig] = useState<VisualConfig>(DEFAULT_CONFIG);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string>();
  const [coverUrl, setCoverUrl] = useState<string>();
  const [avatarUrl, setAvatarUrl] = useState<string>();
  const [backgroundUrl, setBackgroundUrl] = useState<string>();
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsName, setLyricsName] = useState('');
  const [layers, setLayers] = useState<DynamicLayer[]>([]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('Exportar MP4');
  const [error, setError] = useState('');
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const stageRef = useRef<VisualizerStageHandle>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const vectorInputRef = useRef<HTMLInputElement>(null);
  const lyricsInputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [stageReady, setStageReady] = useState(false);
  const layersRef = useRef(layers);
  const markStageReady = useCallback(() => setStageReady(true), []);

  useEffect(() => { layersRef.current = layers; }, [layers]);

  useEffect(() => {
    if (!audioUrl) return;
    return () => URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);
  useEffect(() => {
    if (!coverUrl) return;
    return () => URL.revokeObjectURL(coverUrl);
  }, [coverUrl]);
  useEffect(() => {
    if (!avatarUrl) return;
    return () => URL.revokeObjectURL(avatarUrl);
  }, [avatarUrl]);
  useEffect(() => {
    if (!backgroundUrl) return;
    return () => URL.revokeObjectURL(backgroundUrl);
  }, [backgroundUrl]);
  useEffect(() => () => layersRef.current.forEach((layer) => URL.revokeObjectURL(layer.url)), []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => setCurrentTime(audio.currentTime || 0);
    const ended = () => setPlaying(false);
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('ended', ended);
    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('ended', ended);
    };
  }, [audioUrl]);

  const ratio = RATIO_SIZE[config.ratio];
  const ratioStyle = useMemo(() => ({ aspectRatio: `${ratio.width} / ${ratio.height}` }), [ratio.width, ratio.height]);

  const patchConfig = (patch: Partial<VisualConfig>) => setConfig((current) => ({ ...current, ...patch }));

  const onAudioChange = async (file?: File) => {
    if (!file) return;
    setError('');
    setAudioFile(file);
    setConfig((current) => ({ ...current, title: current.title === DEFAULT_CONFIG.title ? safeName(file) : current.title }));
    setAudioUrl(URL.createObjectURL(file));
    setAudioBuffer(null);
    setIsDecoding(true);
    let decoder: AudioContext | undefined;
    try {
      decoder = new AudioContext();
      const decoded = await decoder.decodeAudioData(await file.arrayBuffer());
      setAudioBuffer(decoded);
      setDuration(decoded.duration);
    } catch {
      setError('No pude leer este archivo de audio en el navegador. Prueba con MP3 o WAV.');
    } finally {
      await decoder?.close().catch(() => undefined);
      setIsDecoding(false);
    }
  };

  const onCoverChange = (file?: File) => {
    if (!file) return;
    setCoverUrl(URL.createObjectURL(file));
  };

  const onAvatarChange = (file?: File) => {
    if (!file) return;
    setAvatarUrl(URL.createObjectURL(file));
  };

  const onLyricsChange = async (file?: File) => {
    if (!file) return;
    const parsed = parseLrc(await file.text());
    if (!parsed.length) {
      setError('No encontré líneas con tiempo en este archivo. Usa un .LRC con marcas como [00:12.50]Letra.');
      return;
    }
    setLyrics(parsed);
    setLyricsName(file.name);
    setError('');
  };

  const onBackgroundChange = (file?: File) => {
    if (!file) return;
    setBackgroundUrl(URL.createObjectURL(file));
  };

  const onVectorChange = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming: DynamicLayer[] = Array.from(files).map((file) => ({
      id: crypto.randomUUID(),
      name: file.name,
      url: URL.createObjectURL(file),
      visible: true,
      motion: 'pulse',
      opacity: 0.9,
      size: 0.3,
      x: 0.5,
      y: 0.48,
    }));
    setLayers((current) => [...current, ...incoming]);
    if (vectorInputRef.current) vectorInputRef.current.value = '';
  };

  const setLayer = (id: string, patch: Partial<DynamicLayer>) => {
    setLayers((current) => current.map((layer) => layer.id === id ? { ...layer, ...patch } : layer));
  };

  const removeLayer = (id: string) => {
    setLayers((current) => {
      const removed = current.find((layer) => layer.id === id);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((layer) => layer.id !== id);
    });
  };

  const choosePreset = (preset: PresetName) => {
    const common = { preset };
    if (preset === 'aurora') patchConfig({ ...common, showHeart: false, showSpectrum: true, showParticles: true, showWeather: false });
    if (preset === 'heart') patchConfig({ ...common, showHeart: true, showSpectrum: false, showParticles: true, showWeather: false });
    if (preset === 'storm') patchConfig({ ...common, showHeart: false, showSpectrum: true, showParticles: false, showWeather: true });
    if (preset === 'vizy') patchConfig({ ...common, ratio: 'portrait', showHeart: false, showSpectrum: true, radialSpectrum: true, showParticles: false, showWeather: false, showSmoke: true, centerMode: 'cover' });
    if (preset !== 'vizy') patchConfig({ radialSpectrum: false, showSmoke: false });
  };

  const resetProject = () => {
    layersRef.current.forEach((layer) => URL.revokeObjectURL(layer.url));
    setLayers([]);
    setConfig(DEFAULT_CONFIG);
  };

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audioUrl || !audio) {
      audioInputRef.current?.click();
      return;
    }
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  const seek = (value: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrentTime(value);
  };

  const doExport = async () => {
    if (!audioBuffer || !stageRef.current) return;
    setError('');
    setIsExporting(true);
    setProgress(0);
    try {
      const pickerWindow = window as Window & {
        showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<{ createWritable(): Promise<WritableStream<Uint8Array>> }>;
      };
      const suggestedName = `${config.artist}-${config.title}`.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 100) + '.mp4';
      const saveChoice = pickerWindow.showSaveFilePicker
        ? pickerWindow.showSaveFilePicker({ suggestedName, types: [{ description: 'Video MP4', accept: { 'video/mp4': ['.mp4'] } }] })
            .then((handle) => ({ handle }), (reason: unknown) => ({ error: reason }))
        : undefined;
      setProgressText('Cargando exportador…');
      const { exportVideo } = await import('./export/renderMp4');
      await exportVideo({
        stage: stageRef.current,
        audioBuffer,
        config,
        aspect: config.ratio,
        saveChoice,
        onProgress: (value, message) => {
          setProgress(value);
          setProgressText(message);
        },
      });
    } catch (reason) {
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) {
        setError(reason instanceof Error ? reason.message : 'No se pudo exportar el video.');
      }
    } finally {
      setIsExporting(false);
      setProgress(0);
      setProgressText('Exportar MP4');
    }
  };

  const updateMetadata = (key: 'title' | 'artist' | 'link', value: string) => patchConfig({ [key]: value });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark"><span>∿</span></div>
          <div><strong>eko<span>visual</span></strong><small>STUDIO · AUDIO REACTIVE</small></div>
        </div>
        <div className="topbar-middle"><span className="status-dot" /> Todo se procesa en tu dispositivo</div>
        <button className="quiet-button help-button" onClick={() => setError('Importa tu audio y portada; luego elige un preset o combina capas vectoriales, fondo y clima.')}>Cómo empezar <span>↗</span></button>
      </header>

      <main className="workspace">
        <aside className="editor-panel">
          <div className="panel-heading"><div><p className="eyebrow">PROYECTO NUEVO</p><h1>Tu próximo visual</h1></div><span className="project-pill">SIN GUARDAR</span></div>

          <section className="editor-section first-section">
            <div className="section-title"><span className="section-number">01</span><h2>Tu canción</h2></div>
            <button className={`upload-card audio-upload ${audioFile ? 'has-file' : ''}`} onClick={() => audioInputRef.current?.click()}>
              <span className="upload-icon">♫</span>
              <span className="upload-copy"><strong>{audioFile ? audioFile.name : 'Añade una canción'}</strong><small>{audioFile ? (isDecoding ? 'Analizando audio…' : 'Cambiar archivo') : 'MP3, WAV, M4A o FLAC'}</small></span>
              <span className="upload-action">{audioFile ? '↻' : '+'}</span>
            </button>
            <input ref={audioInputRef} className="file-input" type="file" accept="audio/*,.mp3,.wav,.m4a,.flac" onChange={(event) => void onAudioChange(event.target.files?.[0])} />
            <div className="two-fields">
              <label className="field"><span>TÍTULO</span><input value={config.title} onChange={(e) => updateMetadata('title', e.target.value)} /></label>
              <label className="field"><span>ARTISTA</span><input value={config.artist} onChange={(e) => updateMetadata('artist', e.target.value)} /></label>
            </div>
          </section>

          <section className="editor-section">
            <div className="section-title"><span className="section-number">02</span><h2>Formato de salida</h2></div>
            <div className="ratio-picker">
              {(['landscape', 'portrait', 'square'] as const).map((item) => <button key={item} className={`ratio-option ${config.ratio === item ? 'selected' : ''}`} onClick={() => patchConfig({ ratio: item })}>
                <span className={`ratio-icon ${item}`}><i /></span><strong>{RATIO_SIZE[item].label}</strong><small>{item === 'landscape' ? 'YouTube' : item === 'portrait' ? 'Shorts / Reels' : 'Cuadrado'}</small>
              </button>)}
            </div>
          </section>

          <section className="editor-section">
            <div className="section-title"><span className="section-number">03</span><h2>Estilo visual</h2></div>
            <div className="preset-grid">
              {(Object.keys(presetCopy) as PresetName[]).map((preset) => <button key={preset} onClick={() => choosePreset(preset)} className={`preset-card preset-${preset} ${config.preset === preset ? 'selected' : ''}`}>
                <span className="preset-art">{presetCopy[preset].glyph}</span><span><strong>{presetCopy[preset].title}</strong><small>{presetCopy[preset].detail}</small></span>
              </button>)}
              </div>
            <label className="range-field"><span>Sensibilidad al audio <b>{config.sensitivity.toFixed(1)}×</b></span><input type="range" min="0.3" max="2.4" step="0.1" value={config.sensitivity} onChange={(e) => patchConfig({ sensitivity: Number(e.target.value) })} /></label>
            <label className="color-field"><span>Color de acento</span><input type="color" value={config.accent} onChange={(e) => patchConfig({ accent: e.target.value })} /></label>
          </section>

          <section className="editor-section assets-section">
            <div className="section-title"><span className="section-number">04</span><h2>Capas y recursos</h2></div>
            <p className="section-hint">Combina portada, fondos e ilustraciones. Las capas vectoriales pueden pulsar, flotar o girar con la canción.</p>
            <div className="asset-buttons">
              <button className={`asset-button ${avatarUrl ? 'asset-added' : ''}`} onClick={() => avatarInputRef.current?.click()}><span className="asset-glyph avatar-glyph">♙</span><span><b>{avatarUrl ? 'Avatar listo' : 'Avatar PNG'}</b><small>PNG transparente</small></span><i>{avatarUrl ? '✓' : '+'}</i></button>
              <button className={`asset-button ${coverUrl ? 'asset-added' : ''}`} onClick={() => coverInputRef.current?.click()}><span className="asset-glyph cover-glyph">▧</span><span><b>{coverUrl ? 'Portada lista' : 'Portada'}</b><small>JPG, PNG, WebP</small></span><i>{coverUrl ? '✓' : '+'}</i></button>
              <button className={`asset-button ${backgroundUrl ? 'asset-added' : ''}`} onClick={() => backgroundInputRef.current?.click()}><span className="asset-glyph bg-glyph">▨</span><span><b>{backgroundUrl ? 'Fondo listo' : 'Fondo extra'}</b><small>Imagen con movimiento</small></span><i>{backgroundUrl ? '✓' : '+'}</i></button>
              <button className="asset-button vector-add" onClick={() => vectorInputRef.current?.click()}><span className="asset-glyph vector-glyph">◇</span><span><b>Añadir vector o imagen</b><small>SVG, PNG, WebP · varias capas</small></span><i>+</i></button>
            </div>
            <input ref={coverInputRef} className="file-input" type="file" accept="image/*" onChange={(e) => onCoverChange(e.target.files?.[0])} />
            <input ref={avatarInputRef} className="file-input" type="file" accept="image/png,image/webp,image/jpeg" onChange={(e) => onAvatarChange(e.target.files?.[0])} />
            <input ref={backgroundInputRef} className="file-input" type="file" accept="image/*" onChange={(e) => onBackgroundChange(e.target.files?.[0])} />
            <input ref={vectorInputRef} className="file-input" type="file" accept="image/svg+xml,image/png,image/webp,image/jpeg" multiple onChange={(e) => onVectorChange(e.target.files)} />
            <div className="center-content-editor">
              <div className="layer-list-heading"><span>CONTENIDO DEL CÍRCULO</span><span>{lyrics.length ? `${lyrics.length} líneas` : 'opcional'}</span></div>
              <div className="center-mode-picker">
                <button className={config.centerMode === 'cover' ? 'selected' : ''} onClick={() => patchConfig({ centerMode: 'cover' })}>Portada</button>
                <button className={config.centerMode === 'lyrics' ? 'selected' : ''} onClick={() => lyrics.length && patchConfig({ centerMode: 'lyrics' })} disabled={!lyrics.length}>Letra sincronizada</button>
              </div>
              <button className="lyrics-upload" onClick={() => lyricsInputRef.current?.click()}><span>♫</span><b>{lyricsName || 'Cargar letras .LRC'}</b><i>{lyrics.length ? 'Cambiar' : '+'}</i></button>
              <input ref={lyricsInputRef} className="file-input" type="file" accept=".lrc,text/plain" onChange={(e) => void onLyricsChange(e.target.files?.[0])} />
              <small className="lyrics-note">Las letras con marcas de tiempo se dibujan en el video y siguen el audio al exportar.</small>
            </div>
            {avatarUrl && <div className="avatar-controls">
              <label className="range-field compact-range"><span>Tamaño del avatar <b>{Math.round(config.avatarScale * 100)}%</b></span><input type="range" min="0.45" max="1.1" step="0.02" value={config.avatarScale} onChange={(e) => patchConfig({ avatarScale: Number(e.target.value) })} /></label>
              <label className="range-field compact-range"><span>Altura del avatar <b>{Math.round(config.avatarY * 100)}%</b></span><input type="range" min="0.35" max="0.75" step="0.01" value={config.avatarY} onChange={(e) => patchConfig({ avatarY: Number(e.target.value) })} /></label>
            </div>}
            <div className="effect-toggles">
              <Toggle label="Corazón vectorial" enabled={config.showHeart} onChange={(showHeart) => patchConfig({ showHeart })} glyph="♡" />
              <Toggle label="Espectro reactivo" enabled={config.showSpectrum} onChange={(showSpectrum) => patchConfig({ showSpectrum })} glyph="▥" />
              <Toggle label="Partículas" enabled={config.showParticles} onChange={(showParticles) => patchConfig({ showParticles })} glyph="✦" />
              <Toggle label="Lluvia y relámpagos" enabled={config.showWeather} onChange={(showWeather) => patchConfig({ showWeather })} glyph="ϟ" />
              <Toggle label="Espectro circular" enabled={config.radialSpectrum} onChange={(radialSpectrum) => patchConfig({ radialSpectrum })} glyph="◎" />
              <Toggle label="Humo ambiental" enabled={config.showSmoke} onChange={(showSmoke) => patchConfig({ showSmoke })} glyph="〰" />
            </div>
            <label className="range-field compact-range"><span>Movimiento del fondo <b>{Math.round(config.backgroundMotion * 100)}%</b></span><input type="range" min="0" max="1" step="0.05" value={config.backgroundMotion} onChange={(e) => patchConfig({ backgroundMotion: Number(e.target.value) })} /></label>
            {backgroundUrl && <label className="range-field compact-range"><span>Opacidad del fondo extra <b>{Math.round(config.backgroundOpacity * 100)}%</b></span><input type="range" min="0.15" max="1" step="0.05" value={config.backgroundOpacity} onChange={(e) => patchConfig({ backgroundOpacity: Number(e.target.value) })} /></label>}
            <label className="range-field compact-range"><span>Densidad de partículas <b>{Math.round(config.particleAmount * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.05" value={config.particleAmount} onChange={(e) => patchConfig({ particleAmount: Number(e.target.value) })} /></label>
            {config.showWeather && <label className="range-field compact-range"><span>Intensidad de lluvia <b>{Math.round(config.weatherAmount * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.05" value={config.weatherAmount} onChange={(e) => patchConfig({ weatherAmount: Number(e.target.value) })} /></label>}
            {config.showSmoke && <label className="range-field compact-range"><span>Densidad del humo <b>{Math.round(config.smokeAmount * 100)}%</b></span><input type="range" min="0.1" max="1" step="0.05" value={config.smokeAmount} onChange={(e) => patchConfig({ smokeAmount: Number(e.target.value) })} /></label>}
            {layers.length > 0 && <div className="dynamic-layer-list"><div className="layer-list-heading"><span>ILUSTRACIONES VECTORIALES</span><span>{layers.length} capas</span></div>
              {layers.map((layer) => <div className="dynamic-layer" key={layer.id}>
                <button className={`layer-visibility ${layer.visible ? 'on' : ''}`} aria-label={layer.visible ? 'Ocultar capa' : 'Mostrar capa'} onClick={() => setLayer(layer.id, { visible: !layer.visible })}>{layer.visible ? '◉' : '○'}</button>
                <div className="dynamic-layer-main"><b title={layer.name}>{layer.name}</b><div className="layer-controls"><select aria-label={`Animación de ${layer.name}`} value={layer.motion} onChange={(e) => setLayer(layer.id, { motion: e.target.value as MotionStyle })}><option value="pulse">Pulso</option><option value="float">Flotar</option><option value="rotate">Girar</option></select><input aria-label={`Tamaño de ${layer.name}`} title="Tamaño" type="range" min="0.12" max="0.72" step="0.02" value={layer.size} onChange={(e) => setLayer(layer.id, { size: Number(e.target.value) })} /><input aria-label={`Opacidad de ${layer.name}`} title="Opacidad" type="range" min="0.1" max="1" step="0.05" value={layer.opacity} onChange={(e) => setLayer(layer.id, { opacity: Number(e.target.value) })} /></div><div className="layer-position-controls"><label>X<input aria-label={`Posición horizontal de ${layer.name}`} type="range" min="0.05" max="0.95" step="0.02" value={layer.x} onChange={(e) => setLayer(layer.id, { x: Number(e.target.value) })} /></label><label>Y<input aria-label={`Posición vertical de ${layer.name}`} type="range" min="0.05" max="0.95" step="0.02" value={layer.y} onChange={(e) => setLayer(layer.id, { y: Number(e.target.value) })} /></label></div></div>
                <button className="remove-layer" aria-label={`Eliminar ${layer.name}`} onClick={() => removeLayer(layer.id)}>×</button>
              </div>)}
            </div>}
          </section>

          <section className="editor-section link-section">
            <div className="section-title"><span className="section-number">05</span><h2>Comparte tu música</h2></div>
            <label className="field link-field"><span>ENLACE DE SPOTIFY / REDES</span><input value={config.link} onChange={(e) => updateMetadata('link', e.target.value)} placeholder="open.spotify.com/track/…" /></label>
            <small className="field-note">Se muestra en el video. Para que sea pulsable, agrega el enlace en la descripción de tu publicación.</small>
          </section>
        </aside>

        <section className="preview-area">
          <div className="preview-toolbar"><div><p className="eyebrow">VISTA PREVIA</p><h2>Escena en vivo</h2></div><div className="preview-actions"><span className="canvas-size">{ratio.width} × {ratio.height}</span><button className="quiet-button" onClick={resetProject}>Restablecer</button></div></div>
          <div className="preview-wrap">
            <div className="preview-stage" style={ratioStyle}>
              <Suspense fallback={<div className="stage-loading">Preparando escena visual…</div>}>
                <VisualizerStage ref={stageRef} config={config} coverUrl={coverUrl} avatarUrl={avatarUrl} backgroundUrl={backgroundUrl} lyrics={lyrics} audioElement={audioRef.current} dynamicLayers={layers} onReady={markStageReady} />
              </Suspense>
              {!coverUrl && config.centerMode === 'cover' && <div className="empty-overlay"><div className="empty-orbit"><span>♫</span></div><b>Tu portada aparecerá aquí</b><small>Añade música y empieza a combinar capas</small></div>}
              <div className="preview-label"><span className="status-dot" /> PREVIEW</div>
            </div>
          </div>
          <div className="transport-bar">
            <button className="play-button" onClick={() => void togglePlayback()} aria-label={playing ? 'Pausar' : 'Reproducir'}>{playing ? 'Ⅱ' : '▶'}</button>
            <span className="timecode">{formatTime(currentTime)}</span>
            <input className="timeline" type="range" min="0" max={duration || 1} step="0.1" value={Math.min(currentTime, duration || 1)} onChange={(e) => seek(Number(e.target.value))} />
            <span className="timecode muted-time">{formatTime(duration)}</span>
            <audio ref={audioRef} src={audioUrl} onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)} />
          </div>

          <div className="preview-bottom-grid">
            <div className="tip-card"><span className="tip-icon">✧</span><div><b>Construye tu identidad visual</b><p>Añade varios SVG para superponer símbolos, formas o ilustraciones propias. Cada capa tiene su propia animación.</p></div></div>
            <div className="export-card"><div className="export-card-top"><div><p className="eyebrow">LISTO PARA PUBLICAR</p><h3>Video completo · {RATIO_SIZE[config.ratio].label}</h3></div><span className="mp4-badge">MP4</span></div>
              {isExporting && <div className="export-progress"><div className="progress-track"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div><span>{progressText}</span></div>}
              <button className="export-button" disabled={!audioBuffer || !stageReady || isDecoding || isExporting} onClick={() => void doExport()}><span>{isExporting ? '◌' : '↓'}</span>{isExporting ? progressText : isDecoding ? 'Preparando audio…' : !stageReady ? 'Preparando visual…' : 'Exportar MP4'}<i>↗</i></button>
              <small>{audioBuffer ? 'H.264 + AAC · 30 fps · 1080p' : 'Añade una canción para habilitar la exportación'}</small>
            </div>
          </div>
          {error && <div className="notice" role="status"><span>ⓘ</span><p>{error}</p><button onClick={() => setError('')}>×</button></div>}
        </section>
      </main>
    </div>
  );
}

function Toggle({ label, enabled, onChange, glyph }: { label: string; enabled: boolean; onChange: (value: boolean) => void; glyph: string }) {
  return <button className={`effect-toggle ${enabled ? 'enabled' : ''}`} onClick={() => onChange(!enabled)}><span className="effect-glyph">{glyph}</span><span>{label}</span><i className="toggle-switch"><b /></i></button>;
}
