import { buildForYouOffers, nextBirthdayKey, type ForYouContext } from '../lib/forYou';

function context(overrides: Partial<ForYouContext> = {}): ForYouContext {
  return {
    language: 'ru',
    todayKey: '2026-10-14',
    weekKey: '2026-W42',
    birthDate: '1994-03-02',
    birthTimeKnown: true,
    premium: false,
    premiumEndsAt: null,
    premiumAutoRenew: null,
    signals: { compatibilityOpens: 0, loveReads: 0, openedPairs: [] },
    savedPeople: [],
    newMoonKey: null,
    mercuryRetroKey: null,
    wishKeys: new Set(),
    reviewedMonths: new Set(),
    dismissed: new Set(),
    ...overrides,
  };
}

describe('«Для тебя» rules', () => {
  it('stays empty when nothing personal applies', () => {
    expect(buildForYouOffers(context())).toEqual([]);
  });

  it('suggests the year ahead within 14 days of the birthday', () => {
    const [offer] = buildForYouOffers(context({ birthDate: '1990-10-23' }));
    expect(offer.id).toBe('birthday');
    expect(offer.title).toBe('До дня рождения 9 дней');
    expect(offer.action).toEqual({ type: 'future', monthKey: '2026-10' });
    expect(buildForYouOffers(context({ birthDate: '1990-10-29' }))).toEqual([]);
  });

  it('handles 29 February birthdays in a non-leap year', () => {
    expect(nextBirthdayKey('2000-02-29', '2026-02-20')).toBe('2026-02-28');
  });

  it('invites to write plans before a new moon until they are written', () => {
    const offers = buildForYouOffers(context({ newMoonKey: '2026-10-15' }));
    expect(offers[0]).toMatchObject({ id: 'new_moon', title: 'Новолуние завтра', action: { type: 'wishes', newMoonKey: '2026-10-15' } });
    expect(buildForYouOffers(context({ newMoonKey: '2026-10-15', wishKeys: new Set(['2026-10-15']) }))).toEqual([]);
    expect(buildForYouOffers(context({ newMoonKey: '2026-10-19' }))).toEqual([]);
  });

  it('warns about Mercury only while the turn is still ahead', () => {
    expect(buildForYouOffers(context({ mercuryRetroKey: '2026-10-20' }))[0].title).toBe('Что успеть до 20 октября');
    expect(buildForYouOffers(context({ mercuryRetroKey: '2026-10-14' }))).toEqual([]);
  });

  it('offers the month review on the last three days only once per month', () => {
    expect(buildForYouOffers(context({ todayKey: '2026-10-29' }))[0].id).toBe('month_review');
    expect(buildForYouOffers(context({ todayKey: '2026-10-29', reviewedMonths: new Set(['2026-10']) }))).toEqual([]);
    expect(buildForYouOffers(context({ todayKey: '2026-10-28' }))).toEqual([]);
  });

  it('reminds of a saved person whose pair was never opened', () => {
    const offers = buildForYouOffers(context({ savedPeople: [{ id: '7', name: 'Аня' }] }));
    expect(offers[0]).toMatchObject({ id: 'pair', action: { type: 'pair', chartId: '7', name: 'Аня' } });
    expect(buildForYouOffers(context({
      savedPeople: [{ id: '7', name: 'Аня' }],
      signals: { compatibilityOpens: 1, loveReads: 0, openedPairs: ['7'] },
    }))).toEqual([]);
  });

  it('uses visit counts for compatibility and love', () => {
    const ids = buildForYouOffers(context({ signals: { compatibilityOpens: 3, loveReads: 5, openedPairs: [] } })).map((offer) => offer.id);
    expect(ids).toEqual(['compatibility', 'love_week']);
  });

  it('asks for the birth time when it is unknown', () => {
    expect(buildForYouOffers(context({ birthTimeKnown: false }))[0].action).toEqual({ type: 'birth_time' });
  });

  it('reminds softly before NEBO+ ends without auto-renewal', () => {
    const offer = buildForYouOffers(context({ premium: true, premiumEndsAt: '2026-10-17T10:00:00Z', premiumAutoRenew: false }))[0];
    expect(offer.id).toBe('premium_ending');
    expect(offer.body).not.toMatch(/потеря|сгор|последн/u);
    expect(buildForYouOffers(context({ premium: true, premiumEndsAt: '2026-10-17T10:00:00Z', premiumAutoRenew: true }))).toEqual([]);
  });

  it('shows at most three, most important first, and respects «Скрыть»', () => {
    const busy = context({
      birthDate: '1990-10-20',
      birthTimeKnown: false,
      newMoonKey: '2026-10-15',
      mercuryRetroKey: '2026-10-20',
      savedPeople: [{ id: '1', name: 'Max' }],
    });
    expect(buildForYouOffers(busy).map((offer) => offer.id)).toEqual(['birthday', 'new_moon', 'mercury']);
    expect(buildForYouOffers({ ...busy, dismissed: new Set(['birthday:2026']) }).map((offer) => offer.id))
      .toEqual(['new_moon', 'mercury', 'pair']);
  });

  it('writes plain words without emoji', () => {
    const all = buildForYouOffers(context({
      todayKey: '2026-10-29', birthDate: '1990-11-01', birthTimeKnown: false, newMoonKey: '2026-10-30',
      mercuryRetroKey: '2026-11-03', savedPeople: [{ id: '1', name: 'Max' }],
      signals: { compatibilityOpens: 4, loveReads: 9, openedPairs: [] },
    }));
    for (const offer of all) {
      expect(`${offer.title} ${offer.body} ${offer.cta}`).not.toMatch(/\p{Extended_Pictographic}|энерги|вселенн|космос/iu);
    }
  });
});
