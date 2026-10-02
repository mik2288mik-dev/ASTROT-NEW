jest.mock('@capacitor/core', () => ({ Capacitor: { isPluginAvailable: () => false }, registerPlugin: () => ({}) }));

import { shouldAskForReview } from '../services/rustoreReview';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-10-03T12:00:00Z');
const base = { days: ['2026-10-01', '2026-10-02', '2026-10-03'], askedAt: 0, asks: 0, reviewed: false };

describe('RuStore rating prompt timing', () => {
  it('asks a person who came back on three different days', () => {
    expect(shouldAskForReview(base, now)).toBe(true);
  });

  it('waits for the third visit day', () => {
    expect(shouldAskForReview({ ...base, days: base.days.slice(1) }, now)).toBe(false);
  });

  it('asks at most once per 30 days and three times in total', () => {
    expect(shouldAskForReview({ ...base, askedAt: now - 10 * DAY, asks: 1 }, now)).toBe(false);
    expect(shouldAskForReview({ ...base, askedAt: now - 31 * DAY, asks: 1 }, now)).toBe(true);
    expect(shouldAskForReview({ ...base, askedAt: now - 90 * DAY, asks: 3 }, now)).toBe(false);
  });

  it('never asks again after a review', () => {
    expect(shouldAskForReview({ ...base, reviewed: true }, now)).toBe(false);
  });
});
