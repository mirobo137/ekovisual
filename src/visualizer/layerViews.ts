import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { FrameShape, LyricLine } from '../types';
import type { FrameLayerDef, ImageLayerDef, LayerDef, TextLayerDef } from '../scene/model';
import { resolvePlacement } from '../scene/model';
import type { EmitterLayerDef } from '../scene/model';
import { bandEnergy, lyricAt, randomFrom, sampleMotion } from '../scene/motions';
import type { Silhouette, SilhouettePoint } from '../scene/silhouette';

export interface ImageBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewContext {
  width: number;
  height: number;
  time: number;
  bass: number;
  mids: number;
  highs: number;
  accent: string;
  title: string;
  artist: string;
  link: string;
  lyrics: LyricLine[];
  background?: Texture;
  figure?: Texture;
  cover?: Texture;
  custom: Map<string, Texture>;
  silhouettes: Map<string, Silhouette>;
  images: Map<string, ImageBounds>;
  smoke: Texture;
}

export interface LayerView {
  readonly kind: LayerDef['kind'];
  readonly root: Container;
  def: LayerDef;
  update(ctx: ViewContext): number;
  destroy(): void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function createSmokeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return Texture.EMPTY;
  const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62);
  gradient.addColorStop(0, 'rgba(226,238,242,0.28)');
  gradient.addColorStop(0.42, 'rgba(198,220,226,0.14)');
  gradient.addColorStop(1, 'rgba(170,205,214,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  return Texture.from(canvas);
}

function pointOnRect(t: number, cx: number, cy: number, hx: number, hy: number) {
  const width = hx * 2;
  const height = hy * 2;
  const perimeter = 2 * (width + height);
  let distance = ((t % 1) + 1) % 1 * perimeter;
  if (distance <= width) return { x: cx - hx + distance, y: cy - hy, nx: 0, ny: -1 };
  distance -= width;
  if (distance <= height) return { x: cx + hx, y: cy - hy + distance, nx: 1, ny: 0 };
  distance -= height;
  if (distance <= width) return { x: cx + hx - distance, y: cy + hy, nx: 0, ny: 1 };
  distance -= width;
  return { x: cx - hx, y: cy + hy - distance, nx: -1, ny: 0 };
}

function drawHeart(graphics: Graphics, cx: number, cy: number, size: number, accent: string, bass: number) {
  graphics.moveTo(cx, cy + size * 0.36)
    .bezierCurveTo(cx - size * 1.15, cy - size * 0.36, cx - size * 0.62, cy - size * 0.9, cx, cy - size * 0.34)
    .bezierCurveTo(cx + size * 0.62, cy - size * 0.9, cx + size * 1.15, cy - size * 0.36, cx, cy + size * 0.36)
    .closePath()
    .fill({ color: accent, alpha: 0.2 + bass * 0.22 })
    .stroke({ color: accent, alpha: 0.85, width: 4 + bass * 5 });
}

class ImageView implements LayerView {
  readonly kind = 'image' as const;
  readonly root = new Container();
  def: LayerDef;
  private sprite = new Sprite();
  private stroke = new Graphics();

  constructor(def: ImageLayerDef) {
    this.def = def;
    this.sprite.anchor.set(0.5);
    this.root.addChild(this.sprite, this.stroke);
  }

  update(ctx: ViewContext) {
    const def = this.def as ImageLayerDef;
    const texture = def.slot === 'background' ? ctx.background
      : def.slot === 'figure' ? ctx.figure
        : def.slot === 'cover' ? ctx.cover
          : ctx.custom.get(def.customId ?? '');
    if (!texture || texture === Texture.EMPTY || def.opacity <= 0 || texture.width < 1) {
      this.root.visible = false;
      return 0;
    }
    this.root.visible = true;
    this.sprite.texture = texture;
    const place = resolvePlacement(def, ctx.width, ctx.height);
    const energy = def.react ? bandEnergy({ bass: ctx.bass, mids: ctx.mids, highs: ctx.highs }, def.react.band) : 0;
    const delta = sampleMotion(def.motion, def.motionAmount, ctx.time, ctx.width, ctx.height, energy, def.react?.amount ?? 0);
    const fit = def.coverFit
      ? Math.max(ctx.width / texture.width, ctx.height / texture.height) * 1.22
      : (Math.min(ctx.width, ctx.height) * place.size) / Math.max(texture.width, texture.height);
    this.sprite.position.set(ctx.width * place.x + delta.dx, ctx.height * place.y + delta.dy);
    this.sprite.scale.set(fit * delta.scale);
    this.sprite.rotation = delta.rotation;
    this.sprite.alpha = def.opacity;
    const drawnWidth = texture.width * Math.abs(this.sprite.scale.x);
    const drawnHeight = texture.height * Math.abs(this.sprite.scale.y);
    ctx.images.set(def.id, { x: this.sprite.x, y: this.sprite.y, width: drawnWidth, height: drawnHeight });
    this.stroke.clear();
    if (def.stroke) {
      const pad = 11;
      this.stroke.roundRect(this.sprite.x - drawnWidth / 2 - pad, this.sprite.y - drawnHeight / 2 - pad, drawnWidth + pad * 2, drawnHeight + pad * 2, 24)
        .stroke({ color: ctx.accent, alpha: 0.3 + ctx.bass * 0.3, width: 3 + ctx.bass * 5 });
    }
    return 0;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

interface Seed {
  a: number;
  b: number;
  speed: number;
  size: number;
  phase: number;
  alpha: number;
}

function bornAt(def: EmitterLayerDef, ctx: ViewContext, seed: Seed) {
  if (def.anchor === 'screen') return null;
  const bounds = ctx.images.get(def.anchor);
  if (!bounds) return null;
  const silhouette = ctx.silhouettes.get(def.anchor);
  const points: SilhouettePoint[] | undefined = silhouette?.[def.origin];
  if (points?.length) {
    const point = points[Math.floor(seed.a * (points.length - 1))]!;
    return {
      bounds,
      x: bounds.x + (point.u - 0.5) * bounds.width,
      y: bounds.y + (point.v - 0.5) * bounds.height,
    };
  }
  const v = def.origin === 'base' ? 0.9 : def.origin === 'edge' ? (seed.b > 0.5 ? 0.97 : 0.03) : seed.b;
  return {
    bounds,
    x: bounds.x + (seed.a - 0.5) * bounds.width,
    y: bounds.y + (v - 0.5) * bounds.height,
  };
}

class EmitterView implements LayerView {
  readonly kind = 'emitter' as const;
  readonly root = new Container();
  def: LayerDef;
  private graphics = new Graphics();
  private bolt = new Graphics();
  private sprites: Sprite[] = [];
  private seeds: Seed[];
  private flash = 0;

  constructor(def: EmitterLayerDef) {
    this.def = def;
    const count = def.style === 'smoke' ? 32 : def.style === 'sparks' ? 90 : def.style === 'rain' ? 210 : 200;
    const random = randomFrom(def.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 19) * 131);
    this.seeds = Array.from({ length: count }, () => ({
      a: random(),
      b: random(),
      speed: 0.08 + random() * (def.style === 'smoke' ? 0.16 : 0.42),
      size: def.style === 'smoke' ? 0.1 + random() * 0.12 : 0.7 + random() * 2.2,
      phase: random() * Math.PI * 2,
      alpha: 0.16 + random() * 0.5,
    }));
    if (def.style === 'smoke') {
      for (let index = 0; index < count; index += 1) {
        const sprite = new Sprite();
        sprite.anchor.set(0.5);
        sprite.tint = 0xc5d6dc;
        this.sprites.push(sprite);
        this.root.addChild(sprite);
      }
    }
    this.root.addChild(this.graphics, this.bolt);
  }

  update(ctx: ViewContext) {
    const def = this.def as EmitterLayerDef;
    const energy = bandEnergy({ bass: ctx.bass, mids: ctx.mids, highs: ctx.highs }, def.band);
    this.graphics.clear();
    this.bolt.clear();
    if (def.style === 'smoke' || def.style === 'sparks') return this.drawAnchored(def, ctx, energy);
    if (def.style === 'rain') return this.drawRain(def, ctx, energy);
    this.hideSmoke();
    const visible = Math.floor(this.seeds.length * def.amount * (0.72 + energy * 0.4));
    for (let index = 0; index < visible; index += 1) {
      const seed = this.seeds[index]!;
      const x = seed.a * ctx.width + Math.sin(ctx.time * 0.8 + seed.phase) * 26;
      const y = (seed.b * ctx.height + ctx.time * seed.speed * ctx.height * 0.12) % ctx.height;
      const radius = seed.size * (0.8 + energy * 1.6);
      this.graphics.circle(x, y, radius).fill({ color: ctx.accent, alpha: seed.alpha * (0.55 + energy * 0.35) });
    }
    return 0;
  }

  private hideSmoke() {
    for (const sprite of this.sprites) sprite.visible = false;
  }

  private drawAnchored(def: EmitterLayerDef, ctx: ViewContext, energy: number) {
    const visible = Math.max(0, Math.floor(this.seeds.length * def.amount * (0.58 + energy * 0.55)));
    for (let index = 0; index < this.seeds.length; index += 1) {
      const seed = this.seeds[index]!;
      const sprite = this.sprites[index];
      const born = index < visible ? bornAt(def, ctx, seed) : null;
      if (!born) {
        if (sprite) sprite.visible = false;
        continue;
      }
      const rise = (seed.b + ctx.time * seed.speed * (def.style === 'sparks' ? 1.35 : 0.7)) % 1;
      const drift = Math.sin(ctx.time * 0.65 + seed.phase) * born.bounds.width * (def.style === 'sparks' ? 0.03 : 0.05);
      const x = born.bounds.x + (born.x - born.bounds.x) * (def.style === 'sparks' ? 1 + rise * 0.4 : 1) + drift;
      const y = born.y - rise * born.bounds.height * (def.style === 'sparks' ? 0.22 : 0.4);
      const alpha = seed.alpha * (1 - rise * 0.82) * (0.45 + energy * 0.8);
      if (def.style === 'smoke' && sprite) {
        sprite.visible = true;
        sprite.texture = ctx.smoke;
        sprite.position.set(x, y);
        sprite.rotation = Math.sin(ctx.time * 0.22 + seed.phase) * 0.08;
        const size = Math.min(ctx.width, ctx.height) * seed.size * (1 + Math.sin(ctx.time * 0.5 + seed.phase) * 0.12);
        sprite.scale.set(size / 128);
        sprite.alpha = alpha;
      } else {
        this.graphics.circle(x, y, seed.size * (0.55 + energy * 0.85) * (1 - rise * 0.4))
          .fill({ color: ctx.accent, alpha });
      }
    }
    return 0;
  }

  private drawRain(def: EmitterLayerDef, ctx: ViewContext, energy: number) {
    this.hideSmoke();
    const dropCount = Math.floor(this.seeds.length * def.amount);
    for (let index = 0; index < dropCount; index += 1) {
      const xSeed = (index * 97.31 % 997) / 997;
      const ySeed = (index * 47.17 % 991) / 991;
      const x = xSeed * ctx.width - ctx.width * 0.04;
      const y = (ySeed * ctx.height + ctx.time * (0.48 + (index % 9) * 0.035) * ctx.height) % ctx.height;
      this.graphics.moveTo(x, y).lineTo(x - ctx.width * 0.012, y + ctx.height * 0.04)
        .stroke({ color: '#b6d7ed', alpha: 0.17 + energy * 0.16, width: 2 });
    }
    const pulse = clamp(ctx.bass * 0.9 + ctx.highs * 0.8, 0, 1);
    const beat = Math.sin(ctx.time * 9.3 + 0.7) > 0.94 ? pulse * 0.8 : 0;
    this.flash = Math.max(beat, this.flash * 0.81);
    if (this.flash > 0.025) {
      const startX = ctx.width * (0.2 + ((Math.sin(ctx.time * 1.73) + 1) / 2) * 0.6);
      let x = startX;
      let y = 0;
      this.bolt.moveTo(x, y);
      for (let segment = 0; segment < 8; segment += 1) {
        y += ctx.height * (0.045 + (segment % 3) * 0.009);
        x += Math.sin(ctx.time * 67 + segment * 8.1) * ctx.width * 0.023;
        this.bolt.lineTo(x, y);
        if (segment === 3 || segment === 5) {
          this.bolt.moveTo(x, y);
          this.bolt.lineTo(x + Math.cos(ctx.time * 30 + segment) * ctx.width * 0.035, y + ctx.height * 0.045);
          this.bolt.moveTo(x, y);
        }
      }
      this.bolt.stroke({ color: '#e8f7ff', alpha: clamp(this.flash * 2.2, 0.15, 0.95), width: Math.max(3, Math.min(ctx.width, ctx.height) * 0.003) });
    }
    return this.flash;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

function traceShape(graphics: Graphics, shape: FrameShape, cx: number, cy: number, hx: number, hy: number, radius: number) {
  if (shape === 'circle' || shape === 'heart') graphics.circle(cx, cy, radius);
  else if (shape === 'rect') graphics.rect(cx - hx, cy - hy, hx * 2, hy * 2);
  else graphics.roundRect(cx - hx, cy - hy, hx * 2, hy * 2, 24);
  return graphics;
}

class FrameView implements LayerView {
  readonly kind = 'frame' as const;
  readonly root = new Container();
  def: LayerDef;
  private backdrop = new Graphics();
  private shape = new Graphics();
  private bars = new Graphics();
  private mask = new Graphics();
  private cover = new Sprite();
  private label: Text;
  private lastLabel = '';

  constructor(def: FrameLayerDef) {
    this.def = def;
    this.cover.anchor.set(0.5);
    this.cover.mask = this.mask;
    this.label = new Text({
      text: '',
      style: {
        fontFamily: 'Arial, sans-serif', fontSize: 36, fontWeight: '700', fill: '#ffffff', align: 'center',
        wordWrap: true, breakWords: true,
        dropShadow: { color: '#000000', alpha: 0.75, blur: 8, distance: 1 },
      },
    });
    this.label.anchor.set(0.5);
    this.root.addChild(this.backdrop, this.cover, this.mask, this.shape, this.bars, this.label);
  }

  update(ctx: ViewContext) {
    const def = this.def as FrameLayerDef;
    const place = resolvePlacement(def, ctx.width, ctx.height);
    const shortSide = Math.min(ctx.width, ctx.height);
    const cx = ctx.width * place.x;
    const cy = ctx.height * place.y;
    const radius = shortSide * place.size * 0.5;
    const hx = def.shape === 'rect' ? radius * 1.28 : radius;
    const hy = def.shape === 'rect' ? radius * 0.86 : radius;
    const showOutline = def.showShape || def.center !== 'none';
    const showLabel = def.center === 'lyrics' || def.center === 'artist' || def.center === 'title';
    this.shape.clear();
    this.backdrop.clear();
    this.bars.clear();
    this.mask.clear();

    if (def.shape === 'heart' && def.showShape) {
      const pulse = 1 + ctx.bass * 0.25 + Math.sin(ctx.time * 2.2) * 0.012;
      drawHeart(this.shape, cx, cy, shortSide * place.size * pulse, ctx.accent, ctx.bass);
    } else if (showOutline && def.shape !== 'heart' && !showLabel) {
      traceShape(this.shape, def.shape, cx, cy, hx, hy, radius)
        .stroke({ color: ctx.accent, alpha: 0.3 + ctx.bass * 0.3, width: 3 + ctx.bass * 5 });
    }

    const showCover = def.center === 'cover' && Boolean(ctx.cover);
    this.cover.visible = showCover;
    if (showCover && ctx.cover) {
      this.cover.texture = ctx.cover;
      this.cover.position.set(cx, cy);
      const side = def.shape === 'rect' ? Math.min(hx, hy) * 2 : radius * 2;
      this.cover.scale.set((side / Math.max(ctx.cover.width, ctx.cover.height)) * (1 + ctx.bass * 0.04));
      traceShape(this.mask, def.shape, cx, cy, hx, hy, radius).fill({ color: 0xffffff });
    }

    const labelText = def.center === 'lyrics' ? lyricAt(ctx.lyrics, ctx.time)
      : def.center === 'artist' ? ctx.artist
        : def.center === 'title' ? ctx.title
          : '';
    this.label.visible = showLabel;
    if (showLabel) {
      if (labelText !== this.lastLabel) {
        this.lastLabel = labelText;
        this.label.text = labelText;
      }
      this.label.position.set(cx, cy);
      this.label.style.fontSize = clamp(radius * 0.34, 18, 42);
      this.label.style.wordWrapWidth = (def.shape === 'rect' ? hx : radius) * 1.45;
      traceShape(this.backdrop, def.shape, cx, cy, hx, hy, radius)
        .fill({ color: 0x06131b, alpha: 0.84 })
        .stroke({ color: ctx.accent, alpha: 0.32 + ctx.bass * 0.18, width: Math.max(3, shortSide * 0.004) });
    }

    if (def.bars === 'radial') this.drawRadial(def.shape, ctx, cx, cy, hx, hy, radius, shortSide);
    else if (def.bars === 'linear') this.drawLinear(ctx);
    return 0;
  }

  private drawRadial(shape: FrameShape, ctx: ViewContext, cx: number, cy: number, hx: number, hy: number, radius: number, shortSide: number) {
    const count = 72;
    const lineWidth = clamp(shortSide * 0.005, 3, 8);
    const pad = 8;
    for (let index = 0; index < count; index += 1) {
      const band = index % 3 === 0 ? ctx.bass : index % 3 === 1 ? ctx.mids : ctx.highs;
      const variation = 0.72 + Math.abs(Math.sin(index * 0.71 + ctx.time * 1.8)) * 0.28;
      const length = shortSide * (0.018 + clamp(band, 0, 1.5) * 0.048) * variation;
      let x: number;
      let y: number;
      let nx: number;
      let ny: number;
      if (shape === 'rect' || shape === 'rounded') {
        const point = pointOnRect(index / count, cx, cy, hx, hy);
        x = point.x + point.nx * pad;
        y = point.y + point.ny * pad;
        nx = point.nx;
        ny = point.ny;
      } else {
        const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
        nx = Math.cos(angle);
        ny = Math.sin(angle);
        x = cx + nx * (radius + pad);
        y = cy + ny * (radius + pad);
      }
      this.bars.moveTo(x, y).lineTo(x + nx * length, y + ny * length)
        .stroke({ color: ctx.accent, alpha: 0.44 + clamp(band, 0, 1) * 0.48, width: lineWidth, cap: 'round' });
    }
  }

  private drawLinear(ctx: ViewContext) {
    const count = 48;
    const maxHeight = Math.min(ctx.height * 0.15, ctx.width * 0.14);
    const baseline = ctx.height * (ctx.height > ctx.width ? 0.7 : 0.68);
    const totalWidth = ctx.width * 0.74;
    const gap = totalWidth / count;
    for (let index = 0; index < count; index += 1) {
      const wave = 0.17 + Math.abs(Math.sin(index * 0.43 + ctx.time * 1.7)) * 0.28;
      const band = index < count * 0.3 ? ctx.bass : index < count * 0.72 ? ctx.mids : ctx.highs;
      const height = maxHeight * clamp(wave + band * 0.62, 0.08, 1);
      this.bars.roundRect(ctx.width / 2 - totalWidth / 2 + index * gap, baseline - height / 2, Math.max(3, gap * 0.43), height, 8)
        .fill({ color: ctx.accent, alpha: 0.35 + band * 0.55 });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}

export class TextView implements LayerView {
  readonly kind = 'text' as const;
  readonly root: Text;
  def: LayerDef;

  constructor(def: TextLayerDef) {
    this.def = def;
    this.root = new Text({
      text: ' ',
      style: {
        fontFamily: 'Arial, sans-serif', fontSize: 64, fontWeight: def.source === 'title' ? '700' : '500',
        fill: '#ffffff', align: 'center',
        dropShadow: { color: '#000000', alpha: 0.7, blur: 8, distance: 1 },
      },
    });
  }

  update(ctx: ViewContext) {
    const def = this.def as TextLayerDef;
    const value = def.source === 'title' ? ctx.title
      : def.source === 'artist' ? ctx.artist
        : ctx.link ? `↗ ${ctx.link.replace(/^https?:\/\//, '')}` : '';
    this.root.visible = value.trim().length > 0;
    this.root.text = value || ' ';
    this.root.style.fill = def.source === 'link' ? ctx.accent : def.source === 'artist' ? '#e0dfeb' : '#ffffff';
    this.root.alpha = def.source === 'title' ? 0.92 + ctx.mids * 0.08 : def.source === 'artist' ? 0.82 + ctx.highs * 0.18 : 1;
    return 0;
  }

  destroy() {
    this.root.destroy();
  }
}

export function isTextView(view: LayerView): view is TextView {
  return view.kind === 'text';
}

export function createLayerView(def: LayerDef): LayerView {
  switch (def.kind) {
    case 'image': return new ImageView(def);
    case 'emitter': return new EmitterView(def);
    case 'frame': return new FrameView(def);
    case 'text': return new TextView(def);
  }
}
