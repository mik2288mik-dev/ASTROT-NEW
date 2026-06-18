import { reduceToArcana, computeMatrix } from '../lib/matrixOfDestiny';

describe('matrix of destiny', () => {
  it('reduces numbers into 1..22', () => {
    expect(reduceToArcana(17)).toBe(17);
    expect(reduceToArcana(22)).toBe(22);
    expect(reduceToArcana(23)).toBe(5); // 2+3
    expect(reduceToArcana(44)).toBe(8); // 4+4
    expect(reduceToArcana(31)).toBe(4); // 3+1
  });

  it('computes deterministic arcana from a birth date (no AI)', () => {
    // 1990-08-17: day 17, month 8, year 1+9+9+0=19
    const r = computeMatrix('1990-08-17');
    expect(r).not.toBeNull();
    const by = Object.fromEntries(r!.positions.map((p) => [p.key, p.arcana]));
    expect(by.portrait).toBe(17); // day
    expect(by.talents).toBe(8); // month
    expect(by.karma).toBe(19); // year digits
    expect(by.comfort).toBe(8); // 17+8+19=44 -> 8
    expect(by.self).toBe(7); // 17+8+19+8=52 -> 7
    expect(r!.center).toBe(7);
  });

  it('returns null for invalid input', () => {
    expect(computeMatrix('')).toBeNull();
    expect(computeMatrix('not-a-date')).toBeNull();
    expect(computeMatrix('1990-13-40')).toBeNull();
  });
});
