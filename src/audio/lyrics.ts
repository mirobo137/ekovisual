import type { LyricLine } from '../types';

/** Parse timestamped LRC lines. Untimed metadata and blank lines are ignored. */
export function parseLrc(source: string): LyricLine[] {
  const result: LyricLine[] = [];
  const timestampPattern = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const rawLine of source.split(/\r?\n/)) {
    const matches = Array.from(rawLine.matchAll(timestampPattern));
    if (!matches.length) continue;
    const text = rawLine.slice((matches.at(-1)?.index ?? 0) + (matches.at(-1)?.[0].length ?? 0)).trim();
    if (!text) continue;

    for (const match of matches) {
      const minutes = Number(match[1]);
      const seconds = Number(match[2]);
      const fraction = (match[3] ?? '').padEnd(3, '0').slice(0, 3);
      result.push({ time: minutes * 60 + seconds + Number(`0.${fraction}`), text });
    }
  }

  return result.sort((left, right) => left.time - right.time);
}
