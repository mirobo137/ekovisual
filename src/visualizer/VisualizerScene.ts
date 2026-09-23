import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { AudioBands, DynamicLayer, LyricLine, VisualConfig } from '../types';

interface SceneAssets {
  cover?: string;
  avatar?: string;
  background?: string;
}

interface SmokeSeed {
  side: number;
  y: number;
  size: number;
  phase: number;
  speed: number;
  alpha: number;
}

function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return Texture.EMPTY;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(222,236,240,0.24)');
  gradient.addColorStop(0.38, 'rgba(194,218,225,0.14)');
  gradient.addColorStop(1, 'rgba(170,205,214,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return Texture.from(canvas);
}

interface ParticleSeed {
  x: number;
  y: number;
  speed: number;
  size: number;
  phase: number;
  alpha: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

async function loadImageTexture(url: string): Promise<Texture> {
  const texture = await Assets.load<Texture>(url);
  return texture;
}

export class VisualizerScene {
  readonly root = new Container();
  private background = new Sprite();
  private tint = new Graphics();
  private ambiance = new Graphics();
  private rain = new Graphics();
  private bolt = new Graphics();
  private stars = new Graphics();
  private smokeContainer = new Container();
  private heart = new Graphics();
  private spectrum = new Graphics();
  private cover = new Sprite();
  private avatar = new Sprite();
  private coverMask = new Graphics();
  private coverFrame = new Graphics();
  private lyricBackdrop = new Graphics();
  private lyricsText: Text;
  private titleText: Text;
  private artistText: Text;
  private linkText: Text;
  private customContainer = new Container();
  private customSprites = new Map<string, Sprite>();
  private smokeSprites: Sprite[] = [];
  private smokeSeeds: SmokeSeed[] = [];
  private particleSeeds: ParticleSeed[] = [];
  private width = 1920;
  private height = 1080;
  private config: VisualConfig;
  private coverUrl?: string;
  private avatarUrl?: string;
  private backgroundUrl?: string;
  private generation = 0;
  private coverTexture?: Texture;
  private avatarTexture?: Texture;
  private backgroundTexture?: Texture;
  private backgroundFitScale = 1;
  private smokeTexture?: Texture;
  private lyrics: LyricLine[] = [];
  private lastLyricText = '';
  private currentFlash = 0;

  constructor(config: VisualConfig) {
    this.config = config;
    this.titleText = new Text({
      text: config.title,
      style: { fontFamily: 'Arial, sans-serif', fontSize: 66, fontWeight: '700', fill: '#ffffff', align: 'center', dropShadow: { color: '#000000', alpha: 0.65, blur: 10, distance: 2 } },
    });
    this.artistText = new Text({
      text: config.artist,
      style: { fontFamily: 'Arial, sans-serif', fontSize: 32, fontWeight: '500', fill: '#d0d1dd', align: 'center', dropShadow: { color: '#000000', alpha: 0.7, blur: 8, distance: 1 } },
    });
    this.linkText = new Text({
      text: '',
      style: { fontFamily: 'Arial, sans-serif', fontSize: 24, fontWeight: '600', fill: config.accent, align: 'center', dropShadow: { color: '#000000', alpha: 0.8, blur: 6, distance: 1 } },
    });
    this.lyricsText = new Text({
      text: '',
      style: { fontFamily: 'Arial, sans-serif', fontSize: 36, fontWeight: '700', fill: '#ffffff', align: 'center', wordWrap: true, breakWords: true, dropShadow: { color: '#000000', alpha: 0.75, blur: 8, distance: 1 } },
    });

    this.root.addChild(
      this.ambiance,
      this.background,
      this.tint,
      this.rain,
      this.bolt,
      this.stars,
      this.smokeContainer,
      this.avatar,
      this.heart,
      this.cover,
      this.coverMask,
      this.lyricBackdrop,
      this.coverFrame,
      this.customContainer,
      this.spectrum,
      this.lyricsText,
      this.titleText,
      this.artistText,
      this.linkText,
    );
    this.cover.mask = this.coverMask;
    this.smokeTexture = createSmokeTexture();
    for (let i = 0; i < 28; i += 1) {
      const sprite = new Sprite(this.smokeTexture);
      sprite.anchor.set(0.5);
      sprite.tint = 0xb8ced2;
      this.smokeSprites.push(sprite);
      this.smokeContainer.addChild(sprite);
      this.smokeSeeds.push({
        side: i % 2,
        y: 0.35 + ((i * 17) % 47) / 100,
        size: 0.11 + ((i * 13) % 10) / 100,
        phase: i * 1.73,
        speed: 0.006 + ((i * 7) % 6) / 1000,
        alpha: 0.12 + ((i * 11) % 15) / 100,
      });
    }
    this.seedParticles(260);
    this.resize(this.width, this.height);
  }

  updateConfig(config: VisualConfig) {
    this.config = config;
    this.titleText.text = config.title || ' ';
    this.artistText.text = config.artist || ' ';
    this.linkText.text = config.link ? `↗ ${config.link.replace(/^https?:\/\//, '')}` : '';
    this.titleText.style.fill = '#ffffff';
    this.artistText.style.fill = '#e0dfeb';
    this.linkText.style.fill = config.accent;
    this.layoutText();
    this.layoutCover();
    this.layoutAvatar();
    this.resizeCustom();
  }

  setLyrics(lyrics: LyricLine[]) {
    this.lyrics = lyrics;
    this.lastLyricText = '';
  }

  async setAssets(assets: SceneAssets) {
    const tasks: Promise<void>[] = [];
    if (assets.cover !== this.coverUrl) {
      this.coverUrl = assets.cover;
      tasks.push(this.replaceImage('cover', assets.cover));
    }
    if (assets.avatar !== this.avatarUrl) {
      this.avatarUrl = assets.avatar;
      tasks.push(this.replaceImage('avatar', assets.avatar));
    }
    if (assets.background !== this.backgroundUrl) {
      this.backgroundUrl = assets.background;
      tasks.push(this.replaceImage('background', assets.background));
    }
    await Promise.all(tasks);
  }

  private async replaceImage(kind: 'cover' | 'avatar' | 'background', url?: string) {
    const texture = url ? await loadImageTexture(url).catch(() => undefined) : undefined;
    const latestUrl = kind === 'cover' ? this.coverUrl : kind === 'avatar' ? this.avatarUrl : this.backgroundUrl;
    if (latestUrl !== url) {
      texture?.destroy(true);
      return;
    }
    if (kind === 'cover') {
      this.coverTexture?.destroy(true);
      this.coverTexture = texture;
      this.cover.texture = texture ?? Texture.EMPTY;
    } else if (kind === 'avatar') {
      this.avatarTexture?.destroy(true);
      this.avatarTexture = texture;
      this.avatar.texture = texture ?? Texture.EMPTY;
    } else {
      this.backgroundTexture?.destroy(true);
      this.backgroundTexture = texture;
      this.background.texture = texture ?? Texture.EMPTY;
    }
    this.resize(this.width, this.height);
  }

  async setDynamicLayers(layers: DynamicLayer[]) {
    const myGeneration = ++this.generation;
    const loaded = await Promise.all(layers.map(async (layer) => {
      const texture = await loadImageTexture(layer.url).catch(() => undefined);
      return texture ? { layer, texture } : undefined;
    }));
    if (myGeneration !== this.generation) {
      for (const item of loaded) item?.texture.destroy(true);
      return;
    }
    for (const sprite of this.customSprites.values()) {
      this.customContainer.removeChild(sprite);
      sprite.texture.destroy(true);
      sprite.destroy();
    }
    this.customSprites.clear();
    for (const item of loaded) {
      if (!item) continue;
      const sprite = new Sprite(item.texture);
      sprite.anchor.set(0.5);
      this.customSprites.set(item.layer.id, sprite);
      this.customContainer.addChild(sprite);
    }
    this.resize(this.width, this.height);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.ambiance.clear();
    this.ambiance.rect(0, 0, width, height).fill({ color: 0x10101b });
    this.ambiance.circle(width * 0.18, height * 0.14, Math.max(width, height) * 0.3).fill({ color: 0x452c77, alpha: 0.18 });
    this.ambiance.circle(width * 0.82, height * 0.78, Math.max(width, height) * 0.36).fill({ color: 0x1c655e, alpha: 0.16 });
    this.tint.clear();
    this.tint.rect(0, 0, width, height).fill({ color: 0x090910, alpha: 0.35 });
    this.tint.alpha = this.backgroundTexture ? 0.42 : 0.12;
    this.background.alpha = this.config.backgroundOpacity;
    this.background.anchor.set(0.5);
    if (this.backgroundTexture) {
      this.backgroundFitScale = Math.max(width / this.background.texture.width, height / this.background.texture.height);
      this.background.scale.set(this.backgroundFitScale);
      this.background.x = width / 2;
      this.background.y = height / 2;
    }
    this.layoutText();
    this.layoutCover();
    this.layoutAvatar();
    this.resizeCustom();
  }

  private layoutText() {
    const shortSide = Math.min(this.width, this.height);
    const portrait = this.height > this.width;
    const titleSize = clamp(shortSide * 0.061, 34, 84);
    this.titleText.style.fontSize = titleSize;
    this.artistText.style.fontSize = clamp(titleSize * 0.47, 18, 38);
    this.linkText.style.fontSize = clamp(titleSize * 0.34, 15, 28);
    if (portrait) {
      this.titleText.anchor.set(0, 0);
      this.artistText.anchor.set(0, 0);
      this.linkText.anchor.set(0, 0);
      this.titleText.style.align = 'left';
      this.artistText.style.align = 'left';
      this.linkText.style.align = 'left';
      this.titleText.x = this.width * 0.05;
      this.artistText.x = this.titleText.x;
      this.linkText.x = this.titleText.x;
      this.titleText.y = this.height * 0.045;
      this.artistText.y = this.titleText.y + titleSize * 0.98;
      this.linkText.y = this.artistText.y + titleSize * 0.72;
    } else {
      this.titleText.anchor.set(0.5);
      this.artistText.anchor.set(0.5);
      this.linkText.anchor.set(0.5);
      this.titleText.style.align = 'center';
      this.artistText.style.align = 'center';
      this.linkText.style.align = 'center';
      this.titleText.x = this.width / 2;
      this.artistText.x = this.width / 2;
      this.linkText.x = this.width / 2;
      this.titleText.y = this.height * 0.82;
      this.artistText.y = this.titleText.y + titleSize * 0.82;
      this.linkText.y = this.artistText.y + titleSize * 0.72;
    }
  }

  private layoutCover() {
    const shortSide = Math.min(this.width, this.height);
    const radial = this.config.radialSpectrum;
    const side = shortSide * (radial ? 0.285 : this.height > this.width ? 0.53 : 0.38);
    this.cover.anchor.set(0.5);
    this.cover.x = this.width / 2;
    this.cover.y = this.height * (radial ? (this.height > this.width ? 0.64 : 0.52) : (this.height > this.width ? 0.37 : 0.48));
    if (this.coverTexture) {
      const scale = side / Math.max(this.cover.texture.width, this.cover.texture.height);
      this.cover.scale.set(scale);
    }
    this.coverMask.clear();
    if (radial) {
      this.coverMask.circle(this.cover.x, this.cover.y, side / 2).fill({ color: 0xffffff });
      this.cover.mask = this.coverMask;
    } else {
      this.cover.mask = null;
    }
    this.lyricsText.anchor.set(0.5);
    this.lyricsText.x = this.cover.x;
    this.lyricsText.y = this.cover.y;
    this.lyricsText.style.fontSize = clamp(side * 0.115, 22, 40);
    this.lyricsText.style.wordWrapWidth = side * 0.78;
    this.lyricsText.visible = this.config.centerMode === 'lyrics';
  }

  private layoutAvatar() {
    const shortSide = Math.min(this.width, this.height);
    this.avatar.anchor.set(0.5);
    this.avatar.x = this.width / 2;
    this.avatar.y = this.height * this.config.avatarY;
    if (this.avatarTexture) {
      const scale = shortSide * this.config.avatarScale / Math.max(this.avatar.texture.width, this.avatar.texture.height);
      this.avatar.scale.set(scale);
    }
    this.avatar.visible = Boolean(this.avatarTexture);
  }

  private resizeCustom() {
    const byId = new Map(this.configurableLayers.map((layer) => [layer.id, layer]));
    for (const [id, sprite] of this.customSprites) {
      const layer = byId.get(id);
      if (!layer) continue;
      const maxSide = Math.min(this.width, this.height) * layer.size;
      const sourceSize = Math.max(sprite.texture.width, sprite.texture.height) || 1;
      sprite.scale.set(maxSide / sourceSize);
      sprite.x = this.width * layer.x;
      sprite.y = this.height * layer.y;
      sprite.alpha = layer.visible ? layer.opacity : 0;
    }
  }

  private configurableLayers: DynamicLayer[] = [];

  setLayerSettings(layers: DynamicLayer[]) {
    this.configurableLayers = layers;
    this.resizeCustom();
  }

  private seedParticles(count: number) {
    let seed = 70423;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    this.particleSeeds = Array.from({ length: count }, () => ({
      x: random(), y: random(), speed: 0.07 + random() * 0.42,
      size: 0.6 + random() * 2.6, phase: random() * Math.PI * 2,
      alpha: 0.2 + random() * 0.64,
    }));
  }

  renderAt(time: number, bands: AudioBands) {
    const sensitivity = this.config.sensitivity;
    const bass = clamp(bands.bass * sensitivity, 0, 1.6);
    const mids = clamp(bands.mids * sensitivity, 0, 1.6);
    const highs = clamp(bands.highs * sensitivity, 0, 1.6);
    const t = Math.max(0, time);
    const accent = this.config.accent;

    this.background.x = this.width / 2 + Math.sin(t * 0.18) * this.width * 0.018 * this.config.backgroundMotion;
    this.background.y = this.height / 2 + Math.cos(t * 0.14) * this.height * 0.022 * this.config.backgroundMotion;
    this.background.scale.set(this.backgroundFitScale * (1 + this.config.backgroundMotion * 0.07));
    this.background.rotation = Math.sin(t * 0.08) * 0.012 * this.config.backgroundMotion;
    this.background.alpha = this.config.backgroundOpacity;

    this.avatar.visible = Boolean(this.avatarTexture);
    this.avatar.x = this.width / 2 + Math.sin(t * 0.34) * this.width * 0.004;
    this.avatar.y = this.height * this.config.avatarY + Math.sin(t * 0.7) * this.height * 0.003;
    this.avatar.scale.set(this.avatarBaseScale() * (1 + bass * 0.018));

    this.smokeContainer.visible = this.config.showSmoke;
    const smokeCount = Math.floor(this.smokeSprites.length * this.config.smokeAmount);
    for (let i = 0; i < this.smokeSprites.length; i += 1) {
      const sprite = this.smokeSprites[i]!;
      const seed = this.smokeSeeds[i]!;
      sprite.visible = this.config.showSmoke && i < smokeCount;
      const side = seed.side === 0 ? 1 : -1;
      const centerX = this.width * (seed.side === 0 ? 0.2 : 0.8);
      sprite.x = centerX + Math.sin(t * 0.65 + seed.phase) * this.width * 0.035;
      sprite.y = ((seed.y - t * seed.speed + 1) % 1) * this.height;
      sprite.rotation = Math.sin(t * 0.22 + seed.phase) * 0.08;
      const size = Math.min(this.width, this.height) * seed.size * (1 + Math.sin(t * 0.5 + seed.phase) * 0.12);
      sprite.scale.set(size / 128);
      sprite.alpha = seed.alpha * (0.65 + mids * 0.18);
      sprite.x += side * Math.sin(t * 0.25 + seed.phase) * this.width * 0.012;
    }

    const coverPulse = 1 + bass * 0.055;
    const radial = this.config.radialSpectrum;
    const shortSide = Math.min(this.width, this.height);
    const coverSize = shortSide * (radial ? 0.285 : this.height > this.width ? 0.53 : 0.38) * coverPulse;
    this.cover.visible = this.config.showCover && this.config.centerMode === 'cover' && Boolean(this.coverTexture);
    this.cover.scale.set(this.coverBaseScale() * coverPulse);
    this.cover.rotation = Math.sin(t * 0.4) * 0.012 + mids * 0.012;
    this.coverMask.clear();
    if (radial) this.coverMask.circle(this.cover.x, this.cover.y, coverSize / 2).fill({ color: 0xffffff });
    this.coverFrame.clear();
    this.lyricBackdrop.clear();
    if (this.config.centerMode === 'lyrics' && radial) {
      this.lyricBackdrop.circle(this.cover.x, this.cover.y, coverSize / 2)
        .fill({ color: 0x06131b, alpha: 0.84 })
        .stroke({ color: accent, alpha: 0.32 + bass * 0.18, width: Math.max(3, shortSide * 0.004) });
    }
    this.lyricsText.visible = this.config.centerMode === 'lyrics';
    if (this.lyricsText.visible) {
      let currentLyric = '';
      for (const line of this.lyrics) {
        if (line.time > t) break;
        currentLyric = line.text;
      }
      if (currentLyric !== this.lastLyricText) {
        this.lastLyricText = currentLyric;
        this.lyricsText.text = currentLyric;
      }
    }
    if (this.cover.visible) {
      if (radial) {
        this.coverFrame.circle(this.cover.x, this.cover.y, coverSize / 2 + 8)
          .stroke({ color: accent, alpha: 0.3 + bass * 0.3, width: 3 + bass * 5 });
      } else {
      this.coverFrame.roundRect(this.cover.x - coverSize / 2 - 11, this.cover.y - coverSize / 2 - 11, coverSize + 22, coverSize + 22, 24)
        .stroke({ color: accent, alpha: 0.3 + bass * 0.3, width: 3 + bass * 5 });
      }
    }

    const heartPulse = 1 + bass * 0.25 + Math.sin(t * 2.2) * 0.012;
    this.heart.visible = this.config.showHeart;
    this.heart.clear();
    if (this.config.showHeart) {
      const size = Math.min(this.width, this.height) * 0.17 * heartPulse;
      const centerX = this.width * (this.height > this.width ? 0.5 : 0.78);
      const centerY = this.height * (this.height > this.width ? 0.61 : 0.5);
      this.heart.moveTo(centerX, centerY + size * 0.36)
        .bezierCurveTo(centerX - size * 1.15, centerY - size * 0.36, centerX - size * 0.62, centerY - size * 0.9, centerX, centerY - size * 0.34)
        .bezierCurveTo(centerX + size * 0.62, centerY - size * 0.9, centerX + size * 1.15, centerY - size * 0.36, centerX, centerY + size * 0.36)
        .closePath()
        .fill({ color: accent, alpha: 0.2 + bass * 0.22 })
        .stroke({ color: accent, alpha: 0.85, width: 4 + bass * 5 });
    }

    this.stars.clear();
    if (this.config.showParticles) {
      const visibleCount = Math.floor(this.particleSeeds.length * this.config.particleAmount);
      for (let i = 0; i < visibleCount; i += 1) {
        const p = this.particleSeeds[i]!;
        const x = p.x * this.width + Math.sin(t * 0.8 + p.phase) * 26;
        const y = ((p.y * this.height + t * p.speed * this.height * 0.12) % this.height);
        const radius = p.size * (0.8 + highs * 1.6);
        this.stars.circle(x, y, radius).fill({ color: accent, alpha: p.alpha * (0.55 + highs * 0.35) });
      }
    }

    this.rain.clear();
    this.bolt.clear();
    if (this.config.showWeather) {
      const dropCount = Math.floor(210 * this.config.weatherAmount);
      for (let i = 0; i < dropCount; i += 1) {
        const xSeed = (i * 97.31 % 997) / 997;
        const ySeed = (i * 47.17 % 991) / 991;
        const x = xSeed * this.width - this.width * 0.04;
        const y = (ySeed * this.height + t * (0.48 + (i % 9) * 0.035) * this.height) % this.height;
        this.rain.moveTo(x, y).lineTo(x - this.width * 0.012, y + this.height * 0.04)
          .stroke({ color: '#b6d7ed', alpha: 0.17 + highs * 0.16, width: 2 });
      }
      const pulse = clamp(bass * 0.9 + highs * 0.8, 0, 1);
      const beatFlash = (Math.sin(t * 9.3 + 0.7) > 0.94 ? pulse * 0.8 : 0);
      this.currentFlash = Math.max(beatFlash, this.currentFlash * 0.81);
      this.tint.alpha = clamp((this.backgroundTexture ? 0.42 : 0.12) + this.currentFlash, 0, 1);
      if (this.currentFlash > 0.025) {
        const startX = this.width * (0.2 + ((Math.sin(t * 1.73) + 1) / 2) * 0.6);
        let x = startX;
        let y = 0;
        this.bolt.moveTo(x, y);
        for (let segment = 0; segment < 8; segment += 1) {
          y += this.height * (0.045 + (segment % 3) * 0.009);
          x += Math.sin(t * 67 + segment * 8.1) * this.width * 0.023;
          this.bolt.lineTo(x, y);
          if (segment === 3 || segment === 5) {
            this.bolt.moveTo(x, y);
            this.bolt.lineTo(x + Math.cos(t * 30 + segment) * this.width * 0.035, y + this.height * 0.045);
            this.bolt.moveTo(x, y);
          }
        }
        this.bolt.stroke({ color: '#e8f7ff', alpha: clamp(this.currentFlash * 2.2, 0.15, 0.95), width: Math.max(3, Math.min(this.width, this.height) * 0.003) });
      }
    } else {
      this.currentFlash = 0;
      this.tint.alpha = this.backgroundTexture ? 0.42 : 0.12;
    }

    this.spectrum.clear();
    this.spectrum.visible = this.config.showSpectrum;
    if (this.config.showSpectrum && radial) {
      const count = 72;
      const radius = shortSide * 0.166;
      const lineWidth = clamp(shortSide * 0.005, 3, 8);
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const band = i % 3 === 0 ? bass : i % 3 === 1 ? mids : highs;
        const variation = 0.72 + Math.abs(Math.sin(i * 0.71 + t * 1.8)) * 0.28;
        const length = shortSide * (0.018 + clamp(band, 0, 1.5) * 0.048) * variation;
        const inner = radius;
        const outer = radius + length;
        this.spectrum.moveTo(this.width / 2 + Math.cos(angle) * inner, this.cover.y + Math.sin(angle) * inner)
          .lineTo(this.width / 2 + Math.cos(angle) * outer, this.cover.y + Math.sin(angle) * outer)
          .stroke({ color: accent, alpha: 0.44 + clamp(band, 0, 1) * 0.48, width: lineWidth, cap: 'round' });
      }
    } else if (this.config.showSpectrum) {
      const count = 48;
      const maxHeight = Math.min(this.height * 0.15, this.width * 0.14);
      const baseline = this.height * (this.height > this.width ? 0.7 : 0.68);
      const totalWidth = this.width * 0.74;
      const gap = totalWidth / count;
      for (let i = 0; i < count; i += 1) {
        const wave = 0.17 + Math.abs(Math.sin(i * 0.43 + t * 1.7)) * 0.28;
        const band = i < count * 0.3 ? bass : i < count * 0.72 ? mids : highs;
        const h = maxHeight * clamp(wave + band * 0.62, 0.08, 1);
        this.spectrum.roundRect(this.width / 2 - totalWidth / 2 + i * gap, baseline - h / 2, Math.max(3, gap * 0.43), h, 8)
          .fill({ color: accent, alpha: 0.35 + band * 0.55 });
      }
    }

    for (const [id, sprite] of this.customSprites) {
      const layer = this.configurableLayers.find((item) => item.id === id);
      if (!layer) continue;
      const pulse = layer.motion === 'pulse' ? 1 + bass * 0.18 : 1;
      const float = layer.motion === 'float' ? Math.sin(t * 1.2) * this.height * 0.025 : 0;
      sprite.x = this.width * layer.x + Math.sin(t * 0.25) * this.width * 0.012;
      sprite.y = this.height * layer.y + float;
      sprite.rotation = layer.motion === 'rotate' ? t * 0.15 : 0;
      const maxSide = Math.min(this.width, this.height) * layer.size;
      sprite.scale.set((maxSide / Math.max(sprite.texture.width, sprite.texture.height)) * pulse);
      sprite.alpha = layer.visible ? layer.opacity : 0;
    }

    this.titleText.alpha = 0.92 + mids * 0.08;
    this.artistText.alpha = 0.82 + highs * 0.18;
  }

  private coverBaseScale() {
    if (!this.coverTexture) return 0;
    const side = Math.min(this.width, this.height) * (this.config.radialSpectrum ? 0.285 : this.height > this.width ? 0.53 : 0.38);
    return side / Math.max(this.cover.texture.width, this.cover.texture.height);
  }

  private avatarBaseScale() {
    if (!this.avatarTexture) return 0;
    return Math.min(this.width, this.height) * this.config.avatarScale / Math.max(this.avatar.texture.width, this.avatar.texture.height);
  }

  destroy() {
    this.generation += 1;
    this.coverTexture?.destroy(true);
    this.avatarTexture?.destroy(true);
    this.backgroundTexture?.destroy(true);
    this.smokeTexture?.destroy(true);
    for (const sprite of this.customSprites.values()) sprite.texture.destroy(true);
    this.customSprites.clear();
    this.root.destroy({ children: true });
  }
}
