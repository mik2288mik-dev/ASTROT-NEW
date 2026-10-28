import { TAROT_CARDS, cardOfTheDay, drawSpread, weekKeyOf, cardImage } from '../lib/tarot';
import { RUNES, runeOfTheDay, drawRunes } from '../lib/runes';

describe('tarot', () => {
  it('has the 22 major arcana with every text filled', () => {
    expect(TAROT_CARDS).toHaveLength(22);
    expect(new Set(TAROT_CARDS.map((card) => card.slug)).size).toBe(22);
    for (const card of TAROT_CARDS) {
      expect(card.name.length).toBeGreaterThan(2);
      expect(card.keyword.length).toBeGreaterThan(2);
      for (const field of ['day', 'past', 'now', 'next', 'advice'] as const) expect(card[field].length).toBeGreaterThan(8);
    }
  });

  it('keeps the card of the day for a person and a day, and changes it over days', () => {
    expect(cardOfTheDay('u1', '2026-10-28')).toBe(cardOfTheDay('u1', '2026-10-28'));
    const names = new Set(Array.from({ length: 20 }, (_, day) => cardOfTheDay('u1', `2026-10-${String(day + 1).padStart(2, '0')}`).name));
    expect(names.size).toBeGreaterThan(5);
  });

  it('draws three different cards', () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const [a, b, c] = drawSpread();
      expect(new Set([a.n, b.n, c.n]).size).toBe(3);
    }
  });

  it('keys the week by its Monday and knows which cards have a painted face', () => {
    expect(weekKeyOf(new Date(2026, 9, 28))).toBe('2026-10-26');
    expect(weekKeyOf(new Date(2026, 9, 25))).toBe('2026-10-19');
    expect(cardImage(TAROT_CARDS.find((card) => card.slug === 'sun')!)).toBe('/assets/tarot/sun.webp');
    expect(cardImage(TAROT_CARDS[0])).toBeNull();
  });
});

describe('runes', () => {
  it('has the 24 runes of the Elder Futhark with every text filled', () => {
    expect(RUNES).toHaveLength(24);
    expect(new Set(RUNES.map((rune) => rune.glyph)).size).toBe(24);
    for (const rune of RUNES) {
      expect(rune.name.length).toBeGreaterThan(2);
      expect(rune.keyword.length).toBeGreaterThan(2);
      for (const field of ['day', 'past', 'now', 'next', 'advice'] as const) expect(rune[field].length).toBeGreaterThan(8);
    }
  });

  it('keeps the rune of the day and draws three different runes', () => {
    expect(runeOfTheDay('u1', '2026-10-28')).toBe(runeOfTheDay('u1', '2026-10-28'));
    const [a, b, c] = drawRunes();
    expect(new Set([a.n, b.n, c.n]).size).toBe(3);
  });
});
