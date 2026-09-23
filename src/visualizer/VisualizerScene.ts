import { Assets, Container, Graphics, Texture } from 'pixi.js';
import type { AudioBands, DynamicLayer, LyricLine, VisualConfig } from '../types';
import type { LayerDef, TextLayerDef } from '../scene/model';
import { resolveLayers } from '../scene/resolve';
import { sampleSilhouette, type Silhouette } from '../scene/silhouette';
import { createLayerView, createSmokeTexture, isTextView, type LayerView, type TextView, type ViewContext } from './layerViews';

interface SceneAssets {
  cover?: string;
  avatar?: string;
  background?: string;
}

type Slot = 'cover' | 'figure' | 'background';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export class VisualizerScene {
  readonly root = new Container();
  private ambiance = new Graphics();
  private tint = new Graphics();
  private views = new Map<string, LayerView>();
  private defs: LayerDef[] = [];
  private signature = '';
  private width = 1920;
  private height = 1080;
  private config: VisualConfig;
  private lyrics: LyricLine[] = [];
  private customLayers: DynamicLayer[] = [];
  private textures: Partial<Record<Slot, Texture>> = {};
  private urls: Record<Slot, string> = { cover: '', figure: '', background: '' };
  private tokens: Record<Slot, number> = { cover: 0, figure: 0, background: 0 };
  private customTextures = new Map<string, Texture>();
  private customUrls = new Map<string, string>();
  private generation = 0;
  private silhouette?: Silhouette;
  private figureLayerId = 'figura';
  private smoke = createSmokeTexture();

  constructor(config: VisualConfig) {
    this.config = config;
    this.root.addChild(this.ambiance, this.tint);
    this.resize(this.width, this.height);
  }

  updateConfig(config: VisualConfig) {
    this.config = config;
    this.sync();
  }

  setLyrics(lyrics: LyricLine[]) {
    this.lyrics = lyrics;
  }

  setLayerSettings(layers: DynamicLayer[]) {
    this.customLayers = layers;
  }

  async setAssets(assets: SceneAssets) {
    await Promise.all([
      this.loadSlot('cover', assets.cover),
      this.loadSlot('figure', assets.avatar),
      this.loadSlot('background', assets.background),
    ]);
  }

  async setDynamicLayers(layers: DynamicLayer[]) {
    const generation = ++this.generation;
    const loaded = new Map<string, Texture>();
    await Promise.all(layers.map(async (layer) => {
      const texture = await Assets.load<Texture>(layer.url).catch(() => undefined);
      if (texture) loaded.set(layer.id, texture);
    }));
    if (generation !== this.generation) return;
    for (const [id, url] of this.customUrls) {
      const stillUsed = layers.some((layer) => layer.id === id && layer.url === url);
      if (!stillUsed) void Assets.unload(url).catch(() => undefined);
    }
    this.customUrls = new Map(layers.map((layer) => [layer.id, layer.url]));
    this.customTextures = loaded;
    this.customLayers = layers;
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
    this.tint.alpha = this.textures.background ? 0.42 : 0.12;
  }

  renderAt(time: number, bands: AudioBands) {
    this.sync();
    const ctx: ViewContext = {
      width: this.width,
      height: this.height,
      time: Math.max(0, time),
      bass: clamp(bands.bass * this.config.sensitivity, 0, 1.6),
      mids: clamp(bands.mids * this.config.sensitivity, 0, 1.6),
      highs: clamp(bands.highs * this.config.sensitivity, 0, 1.6),
      accent: this.config.accent,
      title: this.config.title || ' ',
      artist: this.config.artist || ' ',
      link: this.config.link,
      lyrics: this.lyrics,
      background: this.textures.background,
      figure: this.textures.figure,
      cover: this.textures.cover,
      custom: this.customTextures,
      silhouettes: new Map(),
      images: new Map(),
      smoke: this.smoke,
    };
    if (this.silhouette) ctx.silhouettes.set(this.figureLayerId, this.silhouette);
    let flash = 0;
    for (const def of this.defs) {
      if (def.kind !== 'image') continue;
      flash = Math.max(flash, this.views.get(def.id)?.update(ctx) ?? 0);
    }
    for (const def of this.defs) {
      if (def.kind === 'image') continue;
      flash = Math.max(flash, this.views.get(def.id)?.update(ctx) ?? 0);
    }
    this.layoutTexts(ctx);
    this.tint.alpha = clamp((this.textures.background ? 0.42 : 0.12) + flash, 0, 1);
  }

  destroy() {
    this.generation += 1;
    this.tokens.cover += 1;
    this.tokens.figure += 1;
    this.tokens.background += 1;
    if (this.smoke !== Texture.EMPTY) this.smoke.destroy(true);
    for (const url of [this.urls.cover, this.urls.figure, this.urls.background, ...this.customUrls.values()]) {
      if (url) void Assets.unload(url).catch(() => undefined);
    }
    this.root.destroy({ children: true });
  }

  private async loadSlot(slot: Slot, url?: string) {
    const next = url ?? '';
    if (next === this.urls[slot] && (next === '' || this.textures[slot])) return;
    const token = ++this.tokens[slot];
    if (!next) {
      const previous = this.urls[slot];
      this.urls[slot] = '';
      this.textures[slot] = undefined;
      if (slot === 'figure') this.silhouette = undefined;
      if (previous) await Assets.unload(previous).catch(() => undefined);
      return;
    }
    const [texture, silhouette] = await Promise.all([
      Assets.load<Texture>(next).catch(() => undefined),
      slot === 'figure' ? sampleSilhouette(next) : Promise.resolve(undefined),
    ]);
    if (token !== this.tokens[slot]) return;
    const previous = this.urls[slot];
    this.urls[slot] = next;
    this.textures[slot] = texture;
    if (slot === 'figure') this.silhouette = silhouette;
    if (previous && previous !== next) await Assets.unload(previous).catch(() => undefined);
  }

  private sync() {
    const defs = resolveLayers(this.config, this.customLayers);
    const signature = defs.map((layer) => `${layer.kind}:${layer.id}`).join('|');
    this.defs = defs;
    if (signature !== this.signature) {
      this.signature = signature;
      const keep = new Set(defs.map((layer) => layer.id));
      for (const [id, view] of this.views) {
        if (!keep.has(id)) {
          view.destroy();
          this.views.delete(id);
        }
      }
      this.root.removeChildren();
      this.root.addChild(this.ambiance);
      let tintPlaced = false;
      for (const def of defs) {
        let view = this.views.get(def.id);
        if (!view || view.kind !== def.kind) {
          view?.destroy();
          view = createLayerView(def);
          this.views.set(def.id, view);
        }
        this.root.addChild(view.root);
        if (def.kind === 'image' && def.slot === 'background') {
          this.root.addChild(this.tint);
          tintPlaced = true;
        }
      }
      if (!tintPlaced) this.root.addChildAt(this.tint, 1);
    }
    for (const def of defs) {
      const view = this.views.get(def.id);
      if (view) view.def = def;
    }
    const figure = defs.find((layer) => layer.kind === 'image' && layer.slot === 'figure');
    this.figureLayerId = figure?.id ?? 'figura';
  }

  private layoutTexts(ctx: ViewContext) {
    const groups = new Map<string, TextView[]>();
    for (const def of this.defs) {
      const view = this.views.get(def.id);
      if (!view || !isTextView(view) || !view.root.visible) continue;
      const textDef = view.def as TextLayerDef;
      const key = textDef.placement === 'auto' ? (ctx.height > ctx.width ? 'top-left' : 'bottom-center') : textDef.placement;
      const list = groups.get(key) ?? [];
      list.push(view);
      groups.set(key, list);
    }
    const titleSize = clamp(Math.min(ctx.width, ctx.height) * 0.061, 34, 84);
    for (const [placement, group] of groups) {
      const portrait = placement === 'top-left';
      let y = portrait ? ctx.height * 0.045 : ctx.height * 0.82;
      for (const view of group) {
        const textDef = view.def as TextLayerDef;
        const text = view.root;
        text.style.fontSize = textDef.source === 'title' ? titleSize : textDef.source === 'artist' ? clamp(titleSize * 0.47, 18, 38) : clamp(titleSize * 0.34, 15, 28);
        text.style.align = portrait ? 'left' : 'center';
        text.anchor.set(portrait ? 0 : 0.5, portrait ? 0 : 0.5);
        text.x = portrait ? ctx.width * 0.05 : ctx.width / 2;
        text.y = y;
        y += titleSize * (textDef.source === 'title' ? 0.98 : 0.72);
      }
    }
  }
}
