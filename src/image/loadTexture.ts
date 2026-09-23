import { Texture } from 'pixi.js';

// Local blob URLs have no extension. Decode the image before giving it to Pixi.
export async function loadImageTexture(url: string): Promise<Texture> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error('No se pudo abrir la imagen. Prueba con PNG, JPG, WebP o un SVG válido.');
  }
  return Texture.from(image);
}
