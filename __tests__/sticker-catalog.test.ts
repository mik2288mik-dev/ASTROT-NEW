import { promises as fs } from 'fs';
import path from 'path';
import { buildStickerEntry } from '../lib/stickers/parseName';
import type { StickerEntry } from '../lib/stickers/types';

/**
 * Гарантия расширяемости: КАЖДЫЙ реальный файл в public/stickers должен разобраться в
 * валидную запись каталога (тип/настроения/экраны/позиции). Если кто-то добавит стикер с
 * «кривым» именем — этот тест упадёт и подскажет, что имя не по схеме реестра.
 */
const DIR = path.join(process.cwd(), 'public', 'stickers');

async function webp(dir: string): Promise<string[]> {
  try { return (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.webp')); }
  catch { return []; }
}

it('every real sticker file parses into a valid catalog entry', async () => {
  const top = await webp(DIR);
  const objs = await webp(path.join(DIR, 'objects'));
  expect(top.length + objs.length).toBeGreaterThan(100);

  const entries: StickerEntry[] = [];
  const problems: string[] = [];
  const check = (base: string, src: string) => {
    const e = buildStickerEntry(base, src);
    if (!e) return; // намеренно исключённый оверрайдом — ок
    if (!e.moods.length || !e.surfaces.length || !e.positions.length) problems.push(base);
    entries.push(e);
  };
  for (const f of top) check(f.replace(/\.webp$/i, ''), `/stickers/${f}`);
  for (const f of objs) check(f.replace(/\.webp$/i, ''), `/stickers/objects/${f}`);

  expect(problems).toEqual([]);
  expect(entries.length).toBeGreaterThan(100);
});
