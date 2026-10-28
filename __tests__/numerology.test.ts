import {
  lifePathNumber, nameNumbers, nameNumberText, parseBirthDate, personalDayNumber, personalMonthNumber,
  personalYearNumber, pythagorasSquare, reduceNumber, squareSummary, SQUARE_CELLS, LIFE_PATH,
} from '../lib/numerology';

const birth = parseBirthDate('1989-03-06')!;

describe('numerology', () => {
  it('reduces numbers and keeps the master numbers 11 and 22 on request', () => {
    expect(reduceNumber(27)).toBe(9);
    expect(reduceNumber(29, true)).toBe(11);
    expect(reduceNumber(29)).toBe(2);
    expect(reduceNumber(22, true)).toBe(22);
  });

  it('parses a birth date and refuses nonsense', () => {
    expect(birth).toEqual({ year: 1989, month: 3, day: 6 });
    expect(parseBirthDate('')).toBeNull();
    expect(parseBirthDate('1989-13-40')).toBeNull();
  });

  it('computes the life path number from the canvas example', () => {
    expect(lifePathNumber(birth)).toBe(9);
    expect(lifePathNumber({ year: 1991, month: 4, day: 5 })).toBe(11);
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22]) expect(LIFE_PATH[n].text.length).toBeGreaterThan(40);
  });

  it('computes the personal year, month and day in a chain', () => {
    expect(personalYearNumber(birth, 2026)).toBe(1);
    expect(personalMonthNumber(birth, 2026, 10)).toBe(2);
    expect(personalDayNumber(birth, 2026, 10, 28)).toBe(3);
  });

  it('builds the Pythagorean square with the working numbers', () => {
    const square = pythagorasSquare(birth);
    expect(square.working).toEqual([36, 9, 24, 6]);
    expect(square.cells).toHaveLength(9);
    const total = square.cells.reduce((sum, cell) => sum + cell.count, 0);
    expect(total).toBeGreaterThan(8);
    for (const cell of square.cells) expect(SQUARE_CELLS[cell.n].title).toBeTruthy();
    expect(squareSummary(square).length).toBeGreaterThan(10);
  });

  it('counts the numbers of a Russian name and ignores other letters', () => {
    expect(nameNumbers('Михаил')).toEqual({ soul: 3, outer: 5, destiny: 8 });
    expect(nameNumbers('Q')).toBeNull();
    expect(nameNumberText('soul', 3)).toMatch(/^В глубине: тебе нужно выражать себя\.$/);
  });
});
