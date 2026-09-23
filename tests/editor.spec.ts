import { test, expect } from '@playwright/test';

test('local images, portrait preview, playback and MP4 export', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined }); });
  await page.goto('/');
  const canvas = page.locator('.visualizer-canvas');
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('width', '1080');
  await expect(canvas).toHaveAttribute('height', '1920');
  const bounds = await canvas.boundingBox();
  expect(bounds!.height).toBeLessThan(720);
  expect(bounds!.width / bounds!.height).toBeCloseTo(1080 / 1920, 2);
  const inputs = page.locator('input[type=file]');
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ff2200"/></svg>');
  await inputs.nth(1).setInputFiles({ name: 'cover.svg', mimeType: 'image/svg+xml', buffer: svg });
  await inputs.nth(3).setInputFiles({ name: 'background.svg', mimeType: 'image/svg+xml', buffer: svg });
  await expect(page.getByText('Fondo listo')).toBeVisible();
  // Read a rendered frame through the canvas, checking actual pixels rather than the upload label.
  await expect.poll(() => canvas.evaluate((source: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const copy = document.createElement('canvas'); copy.width = 108; copy.height = 192;
    const ctx = copy.getContext('2d')!; ctx.drawImage(source, 0, 0, 108, 192);
    const data = ctx.getImageData(0, 0, 108, 192).data;
    let red = 0; for (let i = 0; i < data.length; i += 4) if (data[i] > 100 && data[i] > data[i+1] * 2) red++;
    resolve(red);
  })))).toBeGreaterThan(5000);
  // Generate a one-second PCM WAV fixture with an audible tone.
  const wav = Buffer.alloc(44 + 48000 * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(48000,24); wav.writeUInt32LE(96000,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write('data',36); wav.writeUInt32LE(96000,40);
  for(let i=0;i<48000;i++) wav.writeInt16LE(Math.round(Math.sin(i/48000*Math.PI*880)*8000),44+i*2);
  await inputs.nth(0).setInputFiles({ name: 'test.wav', mimeType: 'audio/wav', buffer: wav });
  await expect(page.getByRole('button', {name: /Exportar MP4/})).toBeEnabled();
  await page.getByRole('button', {name: 'Espejo', exact: true}).click();
  await page.getByRole('textbox', {name:'Nombre de la plantilla',exact:true}).fill('Exportación guardada');
  await page.getByRole('button', {name:'Guardar como nueva'}).click();
  await expect(page.getByRole('status')).toContainText('Plantilla guardada');
  await page.getByRole('button', {name:'Usar Exportación guardada',exact:true}).click();
  await expect(page.locator('audio')).toHaveAttribute('src', /^blob:/);
  await page.getByRole('button',{name:'Reproducir',exact:true}).click();
  await expect.poll(() => page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime)).toBeGreaterThan(0);
  await canvas.screenshot({ path: 'test-results/preview.png' });
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: /Exportar MP4/}).click();
  const download = await downloadPromise;
  await download.saveAs('test-results/video.mp4');
  const bytes = await import('node:fs/promises').then(fs => fs.readFile('test-results/video.mp4'));
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.includes(Buffer.from('avc1'))).toBeTruthy();
  expect(bytes.includes(Buffer.from('mp4a'))).toBeTruthy();
  const metadata = await page.evaluate(async (base64) => {
    const video = document.createElement('video');
    video.src = 'data:video/mp4;base64,'+base64;
    await new Promise<void>((resolve,reject) => {video.onloadedmetadata=()=>resolve(); video.onerror=()=>reject(new Error('Invalid MP4'));});
    return {width:video.videoWidth,height:video.videoHeight,duration:video.duration};
  },bytes.toString('base64'));
  expect(metadata.width).toBe(1080); expect(metadata.height).toBe(1920); expect(metadata.duration).toBeCloseTo(1,1);
  expect(errors).toEqual([]);
});

test('spectrum styles keep assets and frequency analysis distinguishes notes from silence', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const snapshots = new Set<string>();
  for (const style of ['Barras', 'Espejo', 'Anillo', 'Línea espectral', 'Sin barras']) {
    await page.getByRole('button', { name: style, exact: true }).click();
    await expect(page.getByRole('button', { name: style, exact: true })).toHaveAttribute('aria-pressed', 'true');
    if (style !== 'Sin barras') {
      await page.getByRole('slider', {name: 'Cantidad de barras'}).fill('96');
      await page.getByRole('slider', {name: 'Altura del espectro'}).fill('1.8');
    }
    snapshots.add(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => new Promise<string>(resolve => requestAnimationFrame(() => resolve(canvas.toDataURL())))));
  }
  expect(snapshots.size).toBeGreaterThanOrEqual(4);
  const levels = await page.evaluate(async () => {
    const modulePath = '/src/audio/analysis.ts';
    const { analyseAudioBuffer } = await import(modulePath);
    const context = new AudioContext({sampleRate:48000});
    try {
      const results = [];
      for (const hz of [0, 220, 4000]) {
        const buffer = context.createBuffer(1, 4800, 48000);
        const samples = buffer.getChannelData(0);
        for(let i=0;i<samples.length;i++) samples[i]=0.5*Math.sin(2*Math.PI*hz*i/48000);
        const features = await analyseAudioBuffer(buffer,30);
        const spectrum: number[] = features[1].spectrum;
        results.push({ peak: Math.max(...spectrum), index: spectrum.indexOf(Math.max(...spectrum)) });
      }
      return results;
    } finally { await context.close(); }
  });
  expect(levels[0].peak).toBe(0);
  expect(levels[1].peak).toBeGreaterThan(0.5);
  expect(levels[2].index).toBeGreaterThan(levels[1].index);
  expect(errors).toEqual([]);
});

test('PNG figure, custom SVG, replacement and invalid image errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#00ff00'; ctx.fillRect(16,16,96,96);
    return canvas.toDataURL().split(',')[1];
  });
  const inputs = page.locator('input[type=file]');
  await inputs.nth(2).setInputFiles({ name: 'figure.png', mimeType: 'image/png', buffer: Buffer.from(png,'base64') });
  await expect(page.getByText('Figura lista')).toBeVisible();
  await inputs.nth(4).setInputFiles({ name: 'layer.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="lime"/></svg>') });
  await expect.poll(() => page.locator('canvas').evaluate((source: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const c = document.createElement('canvas'); c.width = 108; c.height = 192;
    const ctx = c.getContext('2d')!; ctx.drawImage(source,0,0,108,192);
    const data = ctx.getImageData(0,0,108,192).data;
    let green=0; for(let i=0;i<data.length;i+=4) if(data[i+1]>100 && data[i+1]>data[i]*2) green++;
    resolve(green);
  })))).toBeGreaterThan(500);
  await inputs.nth(2).setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: Buffer.from(png,'base64') });
  await inputs.nth(1).setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('invalid') });
  await expect(page.locator('.notice')).toContainText('No se pudo abrir la imagen');
  await page.getByRole('button', {name:/16:9/}).click();
  await expect(page.locator('canvas')).toHaveAttribute('width','1920');
  await page.getByRole('button', {name:/1:1/}).click();
  await expect(page.locator('canvas')).toHaveAttribute('height','1080');
  expect(errors).toEqual([]);
});
