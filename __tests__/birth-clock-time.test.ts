import { isSameBirthClockTime } from '../lib/natalChartCanonical';

describe('birth clock time comparison', () => {
  it('treats a SQL TIME with seconds as the same chart time', () => {
    expect(isSameBirthClockTime('23:15', '23:15:00')).toBe(true);
    expect(isSameBirthClockTime('9:05', '09:05:00')).toBe(true);
  });

  it('still tells different times and missing times apart', () => {
    expect(isSameBirthClockTime('23:15', '23:16:00')).toBe(false);
    expect(isSameBirthClockTime('23:15', null)).toBe(false);
    expect(isSameBirthClockTime(undefined, '')).toBe(true);
  });
});
