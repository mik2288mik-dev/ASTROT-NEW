import fs from 'fs';
import path from 'path';
import { normalizeZodiacKey, ZODIAC_KEYS } from '../lib/zodiacKeys';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('client-safe zodiac keys', () => {
  it('preserves the canonical sign normalization contract', () => {
    expect(ZODIAC_KEYS).toHaveLength(12);
    expect(normalizeZodiacKey('Aries')).toBe('Aries');
    expect(normalizeZodiacKey(' pisces ')).toBe('Pisces');
    expect(normalizeZodiacKey('unknown')).toBeNull();
  });

  it('keeps browser compatibility helpers away from server-only horoscope code', () => {
    const zodiacKeys = read('lib/zodiacKeys.ts');
    const localSignText = read('lib/synastry/localSignText.ts');
    const horoscopeReader = read('views/v2/HoroscopeReader.tsx');

    expect(zodiacKeys).not.toContain("from '../db'");
    expect(zodiacKeys).not.toContain("from 'openai'");
    expect(localSignText).toContain("from '../zodiacKeys'");
    expect(localSignText).not.toContain('horoscope/signDaily');
    expect(horoscopeReader).toContain("from '../../lib/zodiacKeys'");
  });
});
