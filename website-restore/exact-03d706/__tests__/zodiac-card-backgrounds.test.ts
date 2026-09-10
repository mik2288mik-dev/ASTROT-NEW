import {
  formatPassportBirthLine,
  getZodiacCardBackground,
  normalizeZodiacKey,
} from '../lib/zodiacCardBackgrounds';

describe('zodiac card backgrounds', () => {
  it('normalizes all English and Russian zodiac names', () => {
    expect(normalizeZodiacKey('Aries')).toBe('aries');
    expect(normalizeZodiacKey('Taurus')).toBe('taurus');
    expect(normalizeZodiacKey('Gemini')).toBe('gemini');
    expect(normalizeZodiacKey('Cancer')).toBe('cancer');
    expect(normalizeZodiacKey('Leo')).toBe('leo');
    expect(normalizeZodiacKey('Virgo')).toBe('virgo');
    expect(normalizeZodiacKey('Libra')).toBe('libra');
    expect(normalizeZodiacKey('Scorpio')).toBe('scorpio');
    expect(normalizeZodiacKey('Sagittarius')).toBe('sagittarius');
    expect(normalizeZodiacKey('Capricorn')).toBe('capricorn');
    expect(normalizeZodiacKey('Aquarius')).toBe('aquarius');
    expect(normalizeZodiacKey('Pisces')).toBe('pisces');

    expect(normalizeZodiacKey('Овен')).toBe('aries');
    expect(normalizeZodiacKey('Рыбы')).toBe('pisces');
    expect(normalizeZodiacKey('Скорпион')).toBe('scorpio');
  });

  it('returns no raster background path after static asset cleanup', () => {
    expect(getZodiacCardBackground('Pisces', 'user-1:1989-03-06')).toBe('');
  });

  it('returns an empty path for unknown signs so UI can use neutral fallback', () => {
    expect(getZodiacCardBackground('Unknown', 'user')).toBe('');
    expect(normalizeZodiacKey(null)).toBeNull();
  });

  it('formats passport birth line without seconds', () => {
    expect(formatPassportBirthLine({
      birthDate: '1989-03-06',
      birthTime: '23:15:40',
      birthPlace: 'Сергиев Посад',
    }, 'ru')).toBe('06.03.1989 • 23:15 • Сергиев Посад');
  });

  it('skips missing parts and keeps a clear fallback', () => {
    expect(formatPassportBirthLine({
      birthDate: '',
      birthTime: '',
      birthPlace: '',
    }, 'ru')).toBe('Данные рождения не указаны');

    expect(formatPassportBirthLine({
      birthDate: '1989-03-06',
      birthTime: '',
      birthPlace: '',
    }, 'en')).toBe('06.03.1989');
  });
});
