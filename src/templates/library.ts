import type { DynamicLayer, LyricLine, VisualConfig } from '../types';

export interface TemplateDraft {
  config: VisualConfig;
  coverUrl?: string;
  avatarUrl?: string;
  backgroundUrl?: string;
  layers: DynamicLayer[];
  lyrics: LyricLine[];
  lyricsName: string;
}

export interface SavedTemplate {
  id: string;
  version: 1;
  name: string;
  updatedAt: number;
  config: VisualConfig;
  cover?: Blob;
  avatar?: Blob;
  background?: Blob;
  layers: Array<Omit<DynamicLayer, 'url'> & { image: Blob }>;
  lyrics: LyricLine[];
  lyricsName: string;
}

function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('eko-template-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('templates', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Cierra otras pestañas del editor y vuelve a intentarlo.'));
  });
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openLibrary();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('templates', mode);
    let request: IDBRequest<T>;
    try {
      request = action(tx.objectStore('templates'));
    } catch (error) {
      tx.abort(); db.close(); reject(error); return;
    }
    tx.oncomplete = () => { db.close(); resolve(request.result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('No se pudo guardar la plantilla.')); };
    tx.onerror = () => { /* onabort reports the transaction failure. */ };
  });
}

export async function listTemplates() {
  const templates = await transaction<SavedTemplate[]>('readonly', (store) => store.getAll());
  return templates.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function imageBlob(url?: string) {
  if (!url) return undefined;
  const response = await fetch(url);
  if (!response.ok) throw new Error('No se pudo conservar una imagen. Vuelve a importarla antes de guardar.');
  const blob = await response.blob();
  const image = new Image();
  image.src = url;
  await image.decode();
  return blob;
}

export async function saveTemplate(name: string, draft: TemplateDraft, id: string = crypto.randomUUID()) {
  if (!name.trim()) throw new Error('Escribe un nombre para la plantilla.');
  // Store image bytes, never temporary blob URLs. Music is deliberately absent.
  const [cover, avatar, background, layers] = await Promise.all([
    imageBlob(draft.coverUrl), imageBlob(draft.avatarUrl), imageBlob(draft.backgroundUrl),
    Promise.all(draft.layers.map(async ({ url, ...layer }) => ({ ...layer, image: (await imageBlob(url))! }))),
  ]);
  const saved: SavedTemplate = {
    id, version: 1, name: name.trim(), updatedAt: Date.now(), config: { ...draft.config },
    cover, avatar, background, layers, lyrics: draft.lyrics, lyricsName: draft.lyricsName,
  };
  await transaction('readwrite', (store) => store.put(saved));
  return saved;
}

export async function deleteTemplate(id: string) {
  await transaction('readwrite', (store) => store.delete(id));
}

export function restoreTemplate(saved: SavedTemplate): TemplateDraft {
  const url = (blob?: Blob) => blob ? URL.createObjectURL(blob) : undefined;
  return {
    config: { ...saved.config }, coverUrl: url(saved.cover), avatarUrl: url(saved.avatar), backgroundUrl: url(saved.background),
    layers: saved.layers.map(({ image, ...layer }) => ({ ...layer, url: URL.createObjectURL(image) })),
    lyrics: saved.lyrics, lyricsName: saved.lyricsName,
  };
}
