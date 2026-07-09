import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { buildStickerEntry } from '../../../lib/stickers/parseName';
import type { StickerCatalog, StickerEntry, StickerOverrides } from '../../../lib/stickers/types';

/**
 * Каталог стикеров как ДАННЫЕ, собираемые из файлов в рантайме: сканирует public/stickers
 * (+ objects/), парсит теги из имён, накладывает необязательные оверрайды. Добавить стикеры =
 * положить корректно названные файлы в папку — никакой пересборки/правки кода. Ответ кэшируется
 * в памяти с коротким TTL, чтобы не читать диск на каждый заход.
 */

const STICKERS_DIR = path.join(process.cwd(), 'public', 'stickers');
const OBJECTS_DIR = path.join(STICKERS_DIR, 'objects');
const OVERRIDES_FILE = path.join(STICKERS_DIR, 'catalog.overrides.json');
const TTL_MS = 60_000;

let cache: { catalog: StickerCatalog; at: number } | null = null;

async function listWebp(dir: string): Promise<string[]> {
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.toLowerCase().endsWith('.webp'));
  } catch {
    return [];
  }
}

async function loadOverrides(): Promise<StickerOverrides> {
  try {
    const raw = await fs.readFile(OVERRIDES_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: StickerOverrides = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('_')) continue; // служебные ключи (_comment/_example)
      if (value && typeof value === 'object') out[key] = value as StickerOverrides[string];
    }
    return out;
  } catch {
    return {};
  }
}

async function buildCatalog(): Promise<StickerCatalog> {
  const [mascots, objects, overrides] = await Promise.all([
    listWebp(STICKERS_DIR),
    listWebp(OBJECTS_DIR),
    loadOverrides(),
  ]);

  const entries: StickerEntry[] = [];
  for (const file of mascots) {
    const base = file.replace(/\.webp$/i, '');
    const e = buildStickerEntry(base, `/stickers/${file}`, overrides);
    if (e) entries.push(e);
  }
  for (const file of objects) {
    const base = file.replace(/\.webp$/i, '');
    const e = buildStickerEntry(base, `/stickers/objects/${file}`, overrides);
    if (e) entries.push(e);
  }

  // version = хэш состава (id + оверрайды): меняется при добавлении/удалении/правке.
  const version = createHash('sha1')
    .update(JSON.stringify(entries.map((e) => e.id)) + JSON.stringify(overrides))
    .digest('hex')
    .slice(0, 12);

  return { version, entries };
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      cache = { catalog: await buildCatalog(), at: Date.now() };
    }
    // Кэш на клиенте/эдже — короткий: стикеры декоративны, свежесть не критична.
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(cache.catalog);
  } catch {
    return res.status(200).json({ version: 'empty', entries: [] } satisfies StickerCatalog);
  }
}
