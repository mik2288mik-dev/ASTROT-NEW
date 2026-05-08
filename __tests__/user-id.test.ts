import { assertValidUserId, isValidUserId, normalizeUserId } from '../lib/userId';

describe('user id validation', () => {
  it('accepts Telegram numeric ids', () => {
    expect(normalizeUserId(123456789)).toBe('123456789');
    expect(isValidUserId('123456789')).toBe(true);
    expect(assertValidUserId('123456789')).toBe('123456789');
  });

  it('rejects placeholder ids before they reach bigint database fields', () => {
    for (const value of ['', undefined, null, 'undefined', 'null', 'anonymous', 'abc123']) {
      expect(isValidUserId(value)).toBe(false);
      expect(() => assertValidUserId(value)).toThrow('Invalid user id');
    }
  });
});
