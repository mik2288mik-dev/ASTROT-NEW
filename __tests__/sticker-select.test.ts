import { buildStickerEntry, parseStickerName } from '../lib/stickers/parseName';
import { selectScreenStickers } from '../lib/stickers/select';
import { SURFACE_POSITIONS } from '../lib/stickers/rules';
import type { StickerCatalog, StickerEntry } from '../lib/stickers/types';

function entry(base: string, folder = ''): StickerEntry {
  const src = `/stickers/${folder}${base}.webp`;
  const e = buildStickerEntry(base, src);
  if (!e) throw new Error(`excluded: ${base}`);
  return e;
}

// Небольшой каталог из реальных имён + один СИНТЕТИЧЕСКИЙ новый предмет ("palm"),
// который в коде нигде не прописан — проверяем расширяемость «drop file → работает».
const catalog: StickerCatalog = {
  version: 'test',
  entries: [
    entry('capy_coffee_sit_calm'),
    entry('capy_flashlight_point_thinking'),
    entry('cat_hoodie_peek_happy'),
    entry('cat_gift_stand_hype'),
    entry('capy_gamepad_sit_hype'),
    entry('cat_notebook_peek_calm'),
    entry('palm', 'objects/'), // новый предмет, только файл + имя
    entry('slippers', 'objects/'),
  ],
};

describe('sticker parseName', () => {
  it('parses a character filename into tags', () => {
    expect(parseStickerName('capy_coffee_sit_calm')).toEqual({
      animal: 'capy', object: 'coffee', pose: 'sit', mood: 'calm',
    });
  });
  it('parses an object filename (no pose/mood)', () => {
    expect(parseStickerName('headphones_black')).toEqual({
      animal: null, object: 'headphones_black', pose: null, mood: null,
    });
  });
  it('a brand-new object auto-gets type/moods/surfaces/positions with zero code', () => {
    const e = entry('palm', 'objects/');
    expect(e.type).toBe('object');
    expect(e.moods.length).toBeGreaterThan(0);
    expect(e.surfaces.length).toBeGreaterThan(0);
    expect(e.positions.length).toBeGreaterThan(0);
  });
});

describe('sticker selection', () => {
  const requests = [
    { surface: 'hero' as const, mood: 'calm' as const },
    { surface: 'moon' as const, mood: 'calm' as const },
    { surface: 'sphere' as const },
  ];

  it('never exceeds the total screen limit of 3', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests, totalMax: 3 });
      const total = Object.values(r).reduce((n, ps) => n + ps.length, 0);
      expect(total).toBeLessThanOrEqual(3);
    }
  });

  it('varies across loads (different seeds give different placements)', () => {
    const sig = (seed: number) => {
      const r = selectScreenStickers(catalog, { seed, requests, totalMax: 3 });
      return Object.entries(r)
        .map(([s, ps]) => `${s}:${ps.map((p) => `${p.entry.id}@${p.position}`).join(',')}`)
        .join('|');
    };
    const signatures = new Set(Array.from({ length: 30 }, (_, i) => sig(i)));
    // Из 30 заходов должно получиться много разных раскладов, не один и тот же.
    expect(signatures.size).toBeGreaterThan(10);
  });

  it('is stable for a given seed (same open = same stickers)', () => {
    const a = selectScreenStickers(catalog, { seed: 42, requests, totalMax: 3 });
    const b = selectScreenStickers(catalog, { seed: 42, requests, totalMax: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('respects mood filter and valid positions per surface', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests, totalMax: 3 });
      for (const [surface, ps] of Object.entries(r)) {
        for (const p of ps) {
          expect(SURFACE_POSITIONS[surface as keyof typeof SURFACE_POSITIONS]).toContain(p.position);
        }
      }
      for (const p of r.hero || []) expect(p.entry.moods).toContain('calm');
    }
  });

  it('never repeats a sticker across the screen', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests, totalMax: 3 });
      const ids = Object.values(r).flat().map((p) => p.entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
