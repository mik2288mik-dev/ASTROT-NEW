import { buildNatalProfileCards } from '../lib/natalProfileCards';
import {
  adaptProfileCardsToStoryCards,
  getSavedNatalStoryState,
  markNatalStoryCompleted,
  resolveNatalStoryCardId,
  saveNatalStoryCard,
  setNatalStoryExpandedCard,
  syncNatalStoryStateFromCloud,
} from '../lib/natalStory';
import { normalizeNatalStoryShareFormat, renderNatalStoryShareSvg } from '../lib/natalStoryShareRenderer';
import { clearHumanReadingSessionCache, loadNatalProfileCards } from '../services/natalReadingService';
import type { NatalChartData, UserProfile } from '../types';

const profile: UserProfile = {
  id: '123',
  name: 'Лина',
  birthDate: '2000-03-01',
  birthTime: '09:20',
  birthPlace: 'Москва',
  isSetup: true,
  language: 'ru',
  theme: 'dark',
  isPremium: false,
};

const chartData: NatalChartData = {
  sun: { planet: 'Sun', sign: 'Pisces', degree: 11, longitude: 341, house: 1, description: '' },
  moon: { planet: 'Moon', sign: 'Scorpio', degree: 18, longitude: 228, house: 9, description: '' },
  rising: { planet: 'Ascendant', sign: 'Scorpio', degree: 4, longitude: 214, house: 1, description: '' },
  mercury: { planet: 'Mercury', sign: 'Aquarius', degree: 26, longitude: 326, house: 4, description: '' },
  venus: { planet: 'Venus', sign: 'Aries', degree: 3, longitude: 3, house: 5, description: '' },
  mars: { planet: 'Mars', sign: 'Taurus', degree: 8, longitude: 38, house: 6, description: '' },
  jupiter: { planet: 'Jupiter', sign: 'Gemini', degree: 2, longitude: 62, house: 7, description: '' },
  saturn: { planet: 'Saturn', sign: 'Taurus', degree: 14, longitude: 44, house: 6, description: '' },
  element: 'Water',
  rulingPlanet: 'Neptune',
  timezone: 'Europe/Moscow',
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: index % 2 === 0 ? 'Scorpio' : 'Taurus',
    degree: index,
    longitude: index * 30,
  })),
  aspects: [
    { type: 'trine', angle: 120, orb: 2, from: 'Sun', to: 'Moon' },
    { type: 'square', angle: 90, orb: 3, from: 'Moon', to: 'Mars' },
  ],
  summary: '',
};

const fogForbidden =
  /(внутри|глубок|мягко|тонко|энергия|вибраци|ритм|поток|опора|внутренний мир|раскрываешь|считыва|твоя сила|ресурс|состояние|фокус души|путь к себе|акцент карты|карта говорит|проявляешь|бережно|осознанно|эмоциональная глубина|кармич|зв[её]зды говорят|мистич|✨|🌙|🔮)/iu;

function cardCopy(card: ReturnType<typeof buildNatalProfileCards>[number]) {
  return [
    card.title,
    card.subtitle,
    card.shortText,
    card.freeText,
    card.premiumText,
    card.teaser,
    card.body?.life,
    card.body?.plus,
    card.body?.risk,
    card.body?.action,
    card.premiumBody?.work,
    card.premiumBody?.relationships,
    card.premiumBody?.money,
    card.premiumBody?.recommendation,
    card.premiumBody?.why,
    card.primaryCta?.label,
    card.secondaryCta?.label,
    ...(card.chips || []),
    ...(card.freeBullets || []),
    ...(card.premiumBullets || []),
  ].filter(Boolean).join('\n');
}

describe('natal profile cards mapper', () => {
  it('builds six ordered profile cards from existing chart calculations', () => {
    const cards = buildNatalProfileCards({ profile, chartData, isPremium: false, todayContext: { localHour: 13 } });

    expect(cards.map((card) => card.id)).toEqual([
      'first_impression',
      'inner_base',
      'strengths',
      'overload',
      'relationships',
      'today_bridge',
    ]);
    expect(cards.map((card) => card.title)).toEqual([
      'Как ты ведёшь себя с новыми людьми',
      'Как ты принимаешь решения',
      'Как ты общаешься',
      'Как ты в отношениях',
      'Что тебя сбивает',
      'Где у тебя получается лучше всего',
    ]);
    expect(cards.map((card) => card.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cards.every((card) => card.mapperVersion === 'profile_cards.v2')).toBe(true);
    expect(cards.every((card) => card.chips.length >= 2 && card.shortText.length > 20)).toBe(true);
    expect(cards.every((card) => card.body?.life && card.body?.plus && card.body?.risk && card.body?.action)).toBe(true);
    expect(cards.every((card) => card.assetKey && card.sourceKeys.length && card.confidence)).toBe(true);
  });

  it('keeps card copy concrete and free of esoteric fog', () => {
    const cards = buildNatalProfileCards({ profile, chartData, isPremium: false });

    for (const card of cards) {
      expect(cardCopy(card)).not.toMatch(fogForbidden);
      expect(card.shortText).toMatch(/[.?!]$/);
      expect(card.freeText).toMatch(/Пример|Например|Где это видно|Что делать/);
    }
  });

  it('keeps the whole six-card general map available for free users', () => {
    const freeCards = buildNatalProfileCards({ profile, chartData, isPremium: false });
    const premiumCards = buildNatalProfileCards({ profile: { ...profile, isPremium: true }, chartData, isPremium: true });

    expect(freeCards.some((card) => card.isPremiumLocked)).toBe(false);
    expect(premiumCards.some((card) => card.isPremiumLocked)).toBe(false);
    expect(freeCards.every((card) => card.primaryCta?.action === 'read_deeper')).toBe(true);
  });

  it('keeps today context as metadata without turning the general map into a day forecast', () => {
    const cards = buildNatalProfileCards({
      profile,
      chartData,
      todayContext: {
        localHour: 14,
        shortText: 'Сегодня лучше выбрать одно главное и не распыляться.',
        bestWindowLabel: '14:00-16:00: лучший момент для задач',
        checkinCompleted: true,
        recentActionCount: 2,
      },
    });

    expect(cards[5].primaryCta?.action).toBe('read_deeper');
    expect(cards[5].title).toBe('Где у тебя получается лучше всего');
    expect(cards[5].sourceDebug?.join(' ')).toContain('recentActions:2');
  });

  it('does not slice or expose an existing long generated report as profileCards', () => {
    const noisyChart = {
      ...chartData,
      summary: 'OLD_LONG_REPORT_SHOULD_NOT_APPEAR_IN_STORY',
    };
    const cards = buildNatalProfileCards({ profile, chartData: noisyChart, isPremium: false });
    const allText = JSON.stringify(cards);

    expect(allText).not.toContain('OLD_LONG_REPORT_SHOULD_NOT_APPEAR_IN_STORY');
  });

  it('adapts backend profileCards into story UI cards without using long-report slicing', () => {
    const profileCards = buildNatalProfileCards({ profile, chartData, isPremium: false });
    const storyCards = adaptProfileCardsToStoryCards(profileCards);

    expect(storyCards).toHaveLength(6);
    expect(storyCards[0].summaryShort).toBe(profileCards[0].shortText);
    expect(storyCards[2].paidSectionKey).toBeUndefined();
    expect(storyCards[2].ctaPrimary.label).toBe('Разобрать общение');
  });
});

describe('natal story local state helpers', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (global as any).window = {
      localStorage: {
        getItem: jest.fn((key: string) => store.get(key) || null),
        setItem: jest.fn((key: string, value: string) => {
          store.set(key, value);
        }),
        removeItem: jest.fn((key: string) => {
          store.delete(key);
        }),
      },
    };
  });

  afterEach(() => {
    delete (global as any).window;
  });

  it('resolves aliases and stores saved story cards safely', () => {
    expect(resolveNatalStoryCardId('card4_overload')).toBe('overload');
    expect(resolveNatalStoryCardId('card5_blockers')).toBe('relationships');

    const saved = saveNatalStoryCard('overload');
    expect(saved.savedCardIds).toEqual(['overload']);
    expect(getSavedNatalStoryState().lastCardId).toBe('overload');
  });

  it('tracks expanded card, completion, and tolerates missing Telegram CloudStorage', async () => {
    setNatalStoryExpandedCard('relationships');
    const completed = markNatalStoryCompleted();

    expect(completed.storyCompleted).toBe(true);
    expect(getSavedNatalStoryState().lastExpandedCardId).toBe('relationships');
    await expect(syncNatalStoryStateFromCloud()).resolves.toMatchObject({
      storyCompleted: true,
      lastExpandedCardId: 'relationships',
    });
  });
});

describe('natal story share renderer', () => {
  it('renders share SVGs in supported formats', () => {
    const card = buildNatalProfileCards({ profile, chartData, isPremium: false })[0];
    const story = renderNatalStoryShareSvg(card, 'story');
    const feed = renderNatalStoryShareSvg(card, 'feed');

    expect(story.width).toBe(1080);
    expect(story.height).toBe(1920);
    expect(feed.height).toBe(1350);
    expect(story.svg).toContain('LUMIA');
    expect(story.svg).not.toMatch(fogForbidden);
    expect(normalizeNatalStoryShareFormat('unknown')).toBe('story');
  });
});

describe('natal profile cards service cache', () => {
  beforeEach(() => {
    clearHumanReadingSessionCache();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not fetch profileCards again for the same session key', async () => {
    const payload = {
      profileCards: buildNatalProfileCards({ profile, chartData, isPremium: false }),
      meta: { version: 'test' },
    };
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    });
    (global as any).fetch = fetchMock;

    const first = await loadNatalProfileCards('123', 7, { localHour: 13 });
    const second = await loadNatalProfileCards('123', 7, { localHour: 13 });

    expect(first.profileCards).toHaveLength(6);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
