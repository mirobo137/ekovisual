export interface SilhouettePoint {
  u: number;
  v: number;
}

export interface Silhouette {
  body: SilhouettePoint[];
  base: SilhouettePoint[];
  edge: SilhouettePoint[];
}

function boxFallback(): Silhouette {
  const edge: SilhouettePoint[] = [];
  const base: SilhouettePoint[] = [];
  const body: SilhouettePoint[] = [];
  for (let i = 0; i < 28; i += 1) {
    const u = (i + 0.5) / 28;
    edge.push({ u, v: 0.04 }, { u, v: 0.96 }, { u: 0.04, v: u }, { u: 0.96, v: u });
    base.push({ u, v: 0.9 });
    body.push({ u: (i * 0.37) % 1, v: (i * 0.17) % 1 });
  }
  return { body, base, edge };
}

/** Samples opaque pixels so smoke and sparks can be born on the figure instead of its transparent box. */
export async function sampleSilhouette(url: string): Promise<Silhouette> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    return boxFallback();
  }
  const canvas = document.createElement('canvas');
  const width = 72;
  const height = Math.max(1, Math.round(width * image.height / Math.max(1, image.width)));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return boxFallback();
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data;
  const alphaAt = (x: number, y: number) => pixels[(y * width + x) * 4 + 3] ?? 0;
  const body: SilhouettePoint[] = [];
  const base: SilhouettePoint[] = [];
  const edge: SilhouettePoint[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) < 48) continue;
      const point = { u: (x + 0.5) / width, v: (y + 0.5) / height };
      if ((x + y) % 4 === 0) body.push(point);
      if (point.v > 0.72 && x % 2 === 0) base.push(point);
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1
        || alphaAt(x - 1, y) < 48 || alphaAt(x + 1, y) < 48
        || alphaAt(x, y - 1) < 48 || alphaAt(x, y + 1) < 48;
      if (border && (x + y) % 2 === 0) edge.push(point);
    }
  }
  if (!body.length) return boxFallback();
  return {
    body: body.slice(0, 220),
    base: (base.length ? base : body).slice(0, 160),
    edge: (edge.length ? edge : body).slice(0, 180),
  };
}
