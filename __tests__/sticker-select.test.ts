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
    entry('capy_coffee_sit_calm'), // drink/cozy, calm
    entry('cat_notebook_peek_calm'), // read, calm
    entry('capy_book_sit_calm'), // read/cozy, calm
    entry('cat_gift_stand_hype'), // gift, hype
    entry('capy_gamepad_sit_hype'), // tech/active, hype
    entry('capy_flashlight_stand_thinking'), // study, thinking
    entry('palm', 'objects/'), // object — не должен выбираться
    entry('headphones_black', 'objects/'), // object tech — не должен выбираться
  ],
};

const REQUESTS: SurfaceRequest[] = [
  { surface: 'hero', moods: ['calm', 'happy', 'chill'], themes: ['drink', 'read', 'cozy', 'study'] },
  { surface: 'moon', moods: ['calm', 'chill', 'thinking'], themes: ['drink', 'read', 'cozy'] },
];

describe('parseName + themes', () => {
  it('parses a character filename', () => {
    expect(parseStickerName('capy_coffee_sit_calm')).toEqual({
      animal: 'capy', object: 'coffee', pose: 'sit', mood: 'calm',
    });
  });
  it('derives themes from the object (coffee → drink/cozy)', () => {
    expect(entry('capy_coffee_sit_calm').themes).toEqual(expect.arrayContaining(['drink', 'cozy']));
  });
  it('a new object still parses with valid fields', () => {
    const e = entry('palm', 'objects/');
    expect(e.type).toBe('object');
    expect(e.moods.length).toBeGreaterThan(0);
    expect(e.positions.length).toBeGreaterThan(0);
  });
});

describe('selection — hard rules', () => {
  it('rule 1: never exceeds the total screen limit', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, totalMax: 3 });
      const total = Object.values(r).reduce((n, ps) => n + ps.length, 0);
      expect(total).toBeLessThanOrEqual(3);
    }
  });

  it('rule 2: at most ONE sticker per card, and it is a maskot (never an object)', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, totalMax: 3 });
      for (const ps of Object.values(r)) {
        expect(ps.length).toBeLessThanOrEqual(1);
        for (const p of ps) expect(p.entry.type).toBe('character'); // rule 3: no lone objects
      }
    }
  });

  it('rule 5: moon only gets calm/night themes — never tech/active (no headphones/gamepad)', () => {
    for (let seed = 0; seed < 300; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, totalMax: 3 });
      for (const p of r.moon || []) {
        expect(['calm', 'chill', 'thinking'].some((m) => p.entry.moods.includes(m as any))).toBe(true);
        expect(['drink', 'read', 'cozy'].some((t) => p.entry.themes.includes(t as any))).toBe(true);
        expect(p.entry.themes).not.toContain('tech');
        expect(p.entry.themes).not.toContain('active');
      }
    }
  });

  it('rule 4: positions are the text-safe slots', () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, totalMax: 3 });
      for (const p of r.hero || []) expect(p.position).toBe('hero-scene');
      for (const p of r.moon || []) expect(p.position).toBe('moon-gutter');
    }
  });

  it('never repeats a sticker across the screen', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const r = selectScreenStickers(catalog, { seed, requests: REQUESTS, totalMax: 3 });
      const ids = Object.values(r).flat().map((p) => p.entry.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('rule 6 — time-based rotation (twice a day)', () => {
  it('same 12h window → same key; the two halves differ', () => {
    const morning = new Date('2026-07-09T06:00:00Z'); // 09:00 MSK → am
    const morning2 = new Date('2026-07-09T08:30:00Z'); // 11:30 MSK → am
    const evening = new Date('2026-07-09T15:00:00Z'); // 18:00 MSK → pm
    expect(getStickerTimeKey(morning)).toBe(getStickerTimeKey(morning2));
    expect(getStickerTimeKey(morning)).not.toBe(getStickerTimeKey(evening));
    expect(getStickerTimeKey(morning).endsWith(':am')).toBe(true);
    expect(getStickerTimeKey(evening).endsWith(':pm')).toBe(true);
  });

  it('same time key → same layout; different key → layout may change', () => {
    const kMorning = hashSeed(getStickerTimeKey(new Date('2026-07-09T06:00:00Z')));
    const kEvening = hashSeed(getStickerTimeKey(new Date('2026-07-09T15:00:00Z')));
    const a = selectScreenStickers(catalog, { seed: kMorning, requests: REQUESTS, totalMax: 3 });
    const a2 = selectScreenStickers(catalog, { seed: kMorning, requests: REQUESTS, totalMax: 3 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(a2)); // стабильно в окне
    expect(typeof kEvening).toBe('number');
  });
});
