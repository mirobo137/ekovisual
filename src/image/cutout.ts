export async function imageHasTransparency(file: Blob): Promise<boolean> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(bitmap, 0, 0, size, size);
    const pixels = context.getImageData(0, 0, size, size).data;
    for (let index = 3; index < pixels.length; index += 16) {
      if ((pixels[index] ?? 255) < 250) return true;
    }
    return false;
  } finally {
    bitmap.close();
  }
}

/** Loads the segmentation model the first time it is used. The rest of the app does not download it. */
export async function removeImageBackground(source: Blob, onProgress?: (message: string) => void): Promise<Blob> {
  onProgress?.('Cargando modelo…');
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(source, {
    model: 'isnet_quint8',
    device: 'cpu',
    output: { format: 'image/png', quality: 0.8 },
    progress: (key, current, total) => {
      const done = total > 0 && current >= total;
      const working = key.includes('compute') || key.includes('infer') || done;
      onProgress?.(working ? 'Quitando fondo…' : 'Descargando modelo…');
    },
  });
}
