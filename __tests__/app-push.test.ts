jest.mock('../lib/db', () => ({ getPool: jest.fn() }));

import { isAppPushToken, validateAppPushDraft } from '../lib/appPush';

const now = new Date('2026-10-02T09:00:00Z');
const base = { title: 'Доброе утро!', body: 'Гороскоп на сегодня уже готов', route: 'horoscope', audience: 'all' };

describe('admin app push draft', () => {
  it('accepts a broadcast and defaults to now with a 48h lifetime', () => {
    const draft = validateAppPushDraft(base, now);
    expect(draft).toMatchObject({ title: 'Доброе утро!', route: 'horoscope', audience: 'all', target: null });
    if (typeof draft === 'string') throw new Error(draft);
    expect(draft.sendAt.getTime()).toBe(now.getTime());
    expect(draft.expiresAt.getTime() - draft.sendAt.getTime()).toBe(48 * 3_600_000);
  });

  it('collapses whitespace and enforces native text limits', () => {
    expect(validateAppPushDraft({ ...base, title: '  Привет \n мир  ' }, now)).toMatchObject({ title: 'Привет мир' });
    expect(typeof validateAppPushDraft({ ...base, title: 'x'.repeat(71) }, now)).toBe('string');
    expect(typeof validateAppPushDraft({ ...base, body: 'x'.repeat(241) }, now)).toBe('string');
    expect(typeof validateAppPushDraft({ ...base, body: '   ' }, now)).toBe('string');
  });

  it('validates the screen and the audience target', () => {
    expect(typeof validateAppPushDraft({ ...base, route: 'https://evil.example' }, now)).toBe('string');
    expect(typeof validateAppPushDraft({ ...base, audience: 'user', target: 'abc' }, now)).toBe('string');
    expect(validateAppPushDraft({ ...base, audience: 'user', target: ' 12345 ' }, now)).toMatchObject({ target: '12345' });
    expect(typeof validateAppPushDraft({ ...base, audience: 'sign', target: 'Ophiuchus' }, now)).toBe('string');
    expect(validateAppPushDraft({ ...base, audience: 'sign', target: 'Pisces' }, now)).toMatchObject({ target: 'Pisces' });
  });

  it('schedules within 30 days only', () => {
    const later = new Date(now.getTime() + 3 * 3_600_000).toISOString();
    expect(validateAppPushDraft({ ...base, sendAt: later }, now)).toMatchObject({ sendAt: new Date(later) });
    expect(typeof validateAppPushDraft({ ...base, sendAt: new Date(now.getTime() + 31 * 86_400_000).toISOString() }, now)).toBe('string');
    expect(typeof validateAppPushDraft({ ...base, ttlHours: 0 }, now)).toBe('string');
  });

  it('accepts only 48-hex device tokens', () => {
    expect(isAppPushToken('a'.repeat(48))).toBe(true);
    expect(isAppPushToken('A'.repeat(48))).toBe(false);
    expect(isAppPushToken("' OR 1=1 --")).toBe(false);
  });
});
