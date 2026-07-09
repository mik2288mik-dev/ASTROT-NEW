import { buildStickerEntry, parseStickerName } from '../lib/stickers/parseName';
import {
  selectScreenStickers,
  getStickerTimeKey,
  hashSeed,
  type SurfaceRequest,
} from '../lib/stickers/select';
import type { StickerCatalog, StickerEntry } from '../lib/stickers/types';

function entry(base: string, folder = ''): StickerEntry {
  const e = buildStickerEntry(base, `/stickers/${folder}${base}.webp`);
  if (!e) throw new Error(`excluded: ${base}`);
  return e;
}

const catalog: StickerCatalog = {
  version: 'test',
  entries: [
    // маскоты
    entry('capy_coffee_sit_calm'),
    entry('cat_notebook_peek_calm'),
    entry('capy_book_sit_calm'),
    entry('cat_gift_stand_hype'),
    entry('capy_gamepad_sit_hype'),
    // предметы для композиции (cozy/read/drink)
    entry('candle', 'objects/'),
    entry('plant', 'objects/'),
    entry('notebook', 'objects/'),
    entry('coffee', 'objects/'),
    entry('headphones_black', 'objects/'), // tech — не в теме композиции
  ],
};

const REQUESTS: SurfaceRequest[] = [
  { surface: 'hero', kind: 'maskot', moods: ['calm', 'happy', 'chill'], themes: ['drink', 'read', 'cozy', 'study'] },
  { surface: 'feed', kind: 'composition', count: 2, themes: ['drink', 'read', 'cozy'] },
];

describe('parseName + themes', () => {
  it('parses a character filename', () => {
    expect(parseStickerName('capy_coffee_sit_calm')).toEqual({
      animal: 'capy', object: 'coffee', pose: 'sit', mood: 'calm',
    });
  });
  it('coffee → drink/cozy theme', () => {
    expect(entry('capy_coffee_sit_calm').themes).toEqual(expect.arrayContaining(['drink', 'cozy']));
  });
});

describe('selection — user rules', () => {
  it('at most ONE maskot on the whole page', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, maxMaskots: 1 });
      const maskots = Object.values(r).flat().filter((p) => p.entry.type === 'character');
      expect(maskots.length).toBeLessThanOrEqual(1);
    }
  });

  it('hero holds a single maskot (character), never an object', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, maxMaskots: 1 });
      expect((r.hero || []).length).toBeLessThanOrEqual(1);
      for (const p of r.hero || []) expect(p.entry.type).toBe('character');
    }
  });

  it('composition is 2 distinct OBJECTS (never a maskot, never a lone single)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, maxMaskots: 1 });
      const comp = r.feed || [];
      expect(comp.length === 0 || comp.length === 2).toBe(true); // 0 или пара, не одиночка
      for (const p of comp) expect(p.entry.type).toBe('object');
      expect(new Set(comp.map((p) => p.entry.id)).size).toBe(comp.length);
      const positions = comp.map((p) => p.position);
      expect(new Set(positions).size).toBe(positions.length);
    }
  });

  it('composition respects theme — never the tech object (headphones)', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, maxMaskots: 1 });
      for (const p of r.feed || []) expect(p.entry.object).not.toBe('headphones_black');
    }
  });

  it('same seed → same layout (stable)', () => {
    const a = selectScreenStickers(catalog, { seed: 42, requests: REQUESTS, maxMaskots: 1 });
    const b = selectScreenStickers(catalog, { seed: 42, requests: REQUESTS, maxMaskots: 1 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('does NOT crash on a stale-cache entry missing themes/moods/surfaces (prod incident)', () => {
    const stale: StickerCatalog = {
      version: 'stale',
      entries: [
        // запись из старого кэша: нет themes (и др.) — раньше валило .some → краш экрана
        { id: 'old', src: '/stickers/old.webp', type: 'character', object: 'coffee', pose: null } as any,
        entry('capy_coffee_sit_calm'),
      ],
    };
    expect(() => selectScreenStickers(stale, { seed: 5, requests: REQUESTS, maxMaskots: 1 })).not.toThrow();
  });
});

describe('time-based rotation (twice a day)', () => {
  it('same 12h window → same key; halves differ', () => {
    const am = new Date('2026-07-09T06:00:00Z'); // 09:00 MSK
    const am2 = new Date('2026-07-09T08:30:00Z'); // 11:30 MSK
    const pm = new Date('2026-07-09T15:00:00Z'); // 18:00 MSK
    expect(getStickerTimeKey(am)).toBe(getStickerTimeKey(am2));
    expect(getStickerTimeKey(am)).not.toBe(getStickerTimeKey(pm));
    expect(getStickerTimeKey(am).endsWith(':am')).toBe(true);
    expect(getStickerTimeKey(pm).endsWith(':pm')).toBe(true);
  });
  it('hashSeed is deterministic', () => {
    expect(hashSeed('x')).toBe(hashSeed('x'));
  });
});
