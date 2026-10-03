import fs from 'fs';
import path from 'path';
import { claimableGift, daysToStreakGift } from '../lib/forecastGifts';
import { ALL_MIN_VOTES, buildQuestionResults, DAILY_QUESTIONS, questionForDay, SIGN_MIN_VOTES } from '../lib/dailyQuestion';
import { buildForYouOffers, type ForYouContext } from '../lib/forYou';

describe('days in a row', () => {
  it('gives a week reading for seven days in a row, once per seven days of the same run', () => {
    expect(claimableGift({ today: '2026-10-10', streak: 6, createdAt: null, claims: [] })).toBeNull();
    expect(claimableGift({ today: '2026-10-10', streak: 7, createdAt: null, claims: [] })).toBe('streak');
    const claim = { reason: 'streak' as const, claimedOn: '2026-10-10', streakAtClaim: 7 };
    expect(claimableGift({ today: '2026-10-11', streak: 8, createdAt: null, claims: [claim] })).toBeNull();
    expect(claimableGift({ today: '2026-10-16', streak: 13, createdAt: null, claims: [claim] })).toBeNull();
    expect(claimableGift({ today: '2026-10-17', streak: 14, createdAt: null, claims: [claim] })).toBe('streak');
    // The run broke and a new one reached seven: no penalty, a new gift.
    expect(claimableGift({ today: '2026-10-25', streak: 7, createdAt: null, claims: [claim] })).toBe('streak');
    expect(daysToStreakGift(5, [], '2026-10-10')).toBe(2);
    expect(daysToStreakGift(12, [claim], '2026-10-15')).toBe(2);
  });

  it('gives a gift once a year after a year with NEBO', () => {
    expect(claimableGift({ today: '2026-10-10', streak: 1, createdAt: '2025-10-01T10:00:00Z', claims: [] })).toBe('anniversary');
    expect(claimableGift({ today: '2026-10-10', streak: 1, createdAt: '2026-01-01T10:00:00Z', claims: [] })).toBeNull();
    expect(claimableGift({ today: '2026-10-10', streak: 1, createdAt: '2025-10-01T10:00:00Z', claims: [{ reason: 'anniversary', claimedOn: '2026-10-02', streakAtClaim: 0 }] })).toBeNull();
  });

  it('opens the gifted week through the personal forecast route, nothing else changes', () => {
    const route = fs.readFileSync(path.join(__dirname, '..', 'pages/api/content/forecast/personal.ts'), 'utf8');
    expect(route).toContain('hasWeekGift(userId, periodKey)');
    expect(route).toContain("const premiumAccess = entitlement.isPremium || weekGift;");
  });

  const base: ForYouContext = {
    language: 'ru', todayKey: '2026-10-14', weekKey: '2026-W42', birthDate: '1990-03-01', birthTimeKnown: true,
    premium: false, premiumEndsAt: null, premiumAutoRenew: null,
    signals: { compatibilityOpens: 0, loveReads: 0, openedPairs: [] }, savedPeople: [],
    newMoonKey: null, mercuryRetroKey: null, wishKeys: new Set(), reviewedMonths: new Set(), dismissed: new Set(),
  };

  it('offers the gift softly, without pressure', () => {
    const gift = buildForYouOffers({ ...base, gift: { streak: 7, daysToGift: 0, claimable: 'streak', hasWeekGift: false } })[0];
    expect(gift).toMatchObject({ id: 'streak_gift', title: '7 дней подряд', action: { type: 'gift', reason: 'streak' } });
    const progress = buildForYouOffers({ ...base, gift: { streak: 5, daysToGift: 2, claimable: null, hasWeekGift: false } })[0];
    expect(progress.title).toBe('Уже 5 дней подряд');
    expect(progress.body).toContain('ничего страшного');
    const all = [gift, progress].map((offer) => `${offer.title} ${offer.body}`).join(' ');
    expect(all).not.toMatch(/потеря|сгор|не упусти|последн/u);
    expect(buildForYouOffers({ ...base, premium: true, gift: { streak: 7, daysToGift: 0, claimable: 'streak', hasWeekGift: false } })).toEqual([]);
  });
});

describe('question of the day', () => {
  it('picks the same question for everyone on a day and has plain options', () => {
    expect(questionForDay('2026-10-14')).toBe(questionForDay('2026-10-14'));
    expect(questionForDay('2026-10-14')).not.toBe(questionForDay('2026-10-15'));
    for (const question of DAILY_QUESTIONS) {
      expect(question.options.length).toBeGreaterThanOrEqual(3);
      expect(`${question.text.ru} ${question.options.map((option) => option.ru).join(' ')}`).not.toMatch(/\(а\)|\p{Extended_Pictographic}/u);
    }
  });

  it('shows percentages only after a minimal sample and they add up to 100', () => {
    expect(buildQuestionResults({ optionCount: 3, signCounts: [5, 3, 1], allCounts: [9, 5, 2] })).toEqual({ scope: null, total: 16, percents: [] });
    const all = buildQuestionResults({ optionCount: 3, signCounts: [1, 0, 0], allCounts: [10, 10, ALL_MIN_VOTES - 20] });
    expect(all.scope).toBe('all');
    expect(all.percents.reduce((sum, value) => sum + value, 0)).toBe(100);
    const sign = buildQuestionResults({ optionCount: 3, signCounts: [SIGN_MIN_VOTES - 9, 6, 3], allCounts: [40, 30, 30] });
    expect(sign).toEqual({ scope: 'sign', total: 20, percents: [55, 30, 15] });
  });
});
