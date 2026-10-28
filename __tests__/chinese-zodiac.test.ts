import { CHINESE_ANIMALS, chineseAdjective, chineseRelation, chineseSign, chineseYears } from '../lib/chineseZodiac';

describe('chinese zodiac', () => {
  it('counts a January birthday to the previous Chinese year', () => {
    expect(CHINESE_ANIMALS[chineseSign('1989-03-06')!.animal].name).toBe('Змея');
    expect(CHINESE_ANIMALS[chineseSign('1989-01-10')!.animal].name).toBe('Дракон');
  });

  it('names the element and animal in agreement', () => {
    expect(chineseAdjective(chineseSign('1988-06-01')!)).toBe('Земляной Дракон');
    expect(chineseAdjective(chineseSign('1989-06-01')!)).toBe('Земляная Змея');
  });

  it('lists the years from 1930 for one animal', () => {
    expect(chineseYears(4)).toEqual([1940, 1952, 1964, 1976, 1988, 2000, 2012, 2024]);
  });

  it('finds allies, clashes and the same animal', () => {
    expect(chineseRelation(0, 4)).toBe('trine');
    expect(chineseRelation(0, 6)).toBe('clash');
    expect(chineseRelation(3, 3)).toBe('same');
  });

  it('rejects a broken date', () => {
    expect(chineseSign('')).toBeNull();
  });
});
