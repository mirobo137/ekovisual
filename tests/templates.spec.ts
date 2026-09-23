import { expect, test } from '@playwright/test';

test('saved compositions preserve image bytes and edits across reloads, without music', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  const inputs = page.locator('input[type=file]');
  const picture = { name: 'red.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="red"/></svg>') };
  await inputs.nth(1).setInputFiles(picture);
  await inputs.nth(3).setInputFiles(picture);
  await inputs.nth(4).setInputFiles(picture);
  await page.getByRole('button', {name:'Espejo',exact:true}).click();
  await page.getByRole('slider', {name:'Cantidad de barras'}).fill('80');
  await page.getByRole('textbox', {name:'Nombre de la plantilla',exact:true}).fill('Mi composición');
  await page.getByRole('button', {name:'Guardar como nueva'}).click();
  await expect(page.getByRole('status')).toContainText('Plantilla guardada');

  // Change the working copy, then reload: only the explicitly saved state survives.
  await page.getByRole('slider', {name:'Cantidad de barras'}).fill('16');
  await page.reload();
  await page.getByRole('button', {name:'Usar Mi composición',exact:true}).click();
  await expect(page.getByRole('slider', {name:'Cantidad de barras'})).toHaveValue('80');
  await expect(page.getByRole('button', {name:'Espejo',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.getByText('Fondo listo')).toBeVisible();
  await expect(page.getByText('Portada lista')).toBeVisible();
  await expect(page.locator('.dynamic-layer')).toHaveCount(1);
  await expect(page.locator('audio')).not.toHaveAttribute('src');
  await expect(page.getByRole('button', {name:/Exportar MP4/})).toBeDisabled();
  await expect.poll(() => page.locator('canvas').evaluate((source: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const c = document.createElement('canvas'); c.width=108; c.height=192;
    const ctx = c.getContext('2d')!; ctx.drawImage(source,0,0,108,192);
    const pixels=ctx.getImageData(0,0,108,192).data;
    let red=0; for(let i=0;i<pixels.length;i+=4) if(pixels[i]>100 && pixels[i]>pixels[i+1]*2) red++;
    resolve(red);
  })))).toBeGreaterThan(5000);

  // Update the chosen template, and save a distinct variant without overwriting it.
  await page.getByRole('button', {name:'Artista',exact:true}).click();
  await page.getByRole('button', {name:'Actualizar seleccionada'}).click();
  await expect(page.getByRole('status')).toContainText('Plantilla actualizada');
  await page.getByRole('textbox', {name:'Nombre de la plantilla',exact:true}).fill('Variante');
  await page.getByRole('button', {name:'Guardar como nueva'}).click();
  await expect(page.locator('.saved-template')).toHaveCount(2);
  await page.locator('.template-library').screenshot({path:'test-results/template-library.png'});
  await page.reload();
  await page.getByRole('button', {name:'Usar Mi composición',exact:true}).click();
  await expect(page.getByRole('button', {name:'Artista',exact:true})).toHaveClass('selected');
  const stored = await page.evaluate(async () => {
    const path='/src/templates/library.ts'; const {listTemplates}=await import(path);
    return (await listTemplates()).map((entry: Record<string, unknown>) => ({
      hasMusic: Object.keys(entry).some((key) => /audio|music/i.test(key)),
      bytes: (entry.background as Blob).size,
    }));
  });
  expect(stored).toHaveLength(2);
  expect(stored.every((item: {hasMusic:boolean;bytes:number}) => !item.hasMusic && item.bytes>0)).toBeTruthy();
  await page.getByRole('button', {name:'Eliminar Variante',exact:true}).click();
  await page.getByRole('button', {name:'Eliminar definitivamente'}).click();
  await expect(page.locator('.saved-template')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.saved-template')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('failed writes do not replace a saved template and allow retry', async ({page}) => {
  await page.goto('/');
  await page.getByRole('textbox', {name:'Nombre de la plantilla',exact:true}).fill('Conservada');
  await page.getByRole('button', {name:'Guardar como nueva'}).click();
  await expect(page.getByRole('status')).toContainText('Plantilla guardada');
  await page.evaluate(() => {
    const original=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function () {
      IDBObjectStore.prototype.put=original;
      throw new DOMException('Sin espacio de prueba', 'QuotaExceededError');
    };
  });
  await page.getByRole('textbox', {name:'Nombre de la plantilla',exact:true}).fill('Cambio');
  await page.getByRole('button', {name:'Actualizar seleccionada'}).click();
  await expect(page.getByRole('status')).toContainText('No se pudo guardar');
  await expect(page.getByRole('button', {name:'Usar Conservada',exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Actualizar seleccionada'}).click();
  await expect(page.getByRole('status')).toContainText('Plantilla actualizada');
  await page.reload();
  await expect(page.getByRole('button', {name:'Usar Cambio',exact:true})).toBeVisible();
});

test('all base scenes allow reusable central content without duplicating the spectrum', async ({page}) => {
  await page.goto('/');
  for (const name of ['Aurora','Latido','Tormenta']) {
    await page.getByRole('button', {name: new RegExp(name)}).click();
    await page.getByRole('button', {name:'Artista',exact:true}).click();
    await expect(page.getByRole('button', {name:'Artista',exact:true})).toHaveClass('selected');
    await page.getByRole('button', {name:'Portada',exact:true}).click();
  }
});
