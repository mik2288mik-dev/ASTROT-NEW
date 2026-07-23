import OpenAI from 'openai';
import type {
  AstroEvidenceItem,
  ContentVariant,
  NatalChartData,
  PeriodExtraCard,
  PeriodExtras,
  PeriodExtraVisualTag,
  PersonalPeriodType,
  UserProfile,
} from '../types';
import { getOpenAIModelForContent } from './appSettings';
import {
  formatDisplayDate,
  formatIsoWeekPeriodLabel,
  formatMonthPeriodLabel,
  formatYearPeriodLabel,
  isoWeekToValidRangeUtc,
  monthKeyToValidRangeUtc,
  yearKeyToValidRangeUtc,
} from './date-utils';
import { buildDailyAstroEvidence } from './natalReadings';
import { buildOpenAIChatParams } from './openaiChat';
import { getAppSystemPrompt } from './prompts';
import { detectTransitAspects } from './transitAspects';
import {
  getCurrentTransits,
  type CurrentTransits,
  type PlanetTransit,
} from './transits-calculator';

export const PERIOD_EXTRAS_PROMPT_VERSION = 'period-extras.personal-transits-v1';
export const PERIOD_EXTRAS_CALCULATION_VERSION = 'period-extras-sampled-transits-v1';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const VISUAL_TAGS: PeriodExtraVisualTag[] = [
  'communication',
  'relationships',
  'work',
  'money',
  'goals',
  'family',
  'friendship',
  'energy',
];

const PERIOD_VARIANT: Record<PersonalPeriodType, ContentVariant> = {
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'full',
};

type PeriodSample = {
  date: Date;
  dateKey: string;
  label: string;
};

type PeriodEvidence = {
  id: string;
  label: string;
  humanMeaning: string;
  details: string[];
  activeDates: string[];
  closestSample: string;
  minOrb: number | null;
  priority: number;
};

type GeneratedCard = {
  id?: unknown;
  title?: unknown;
  teaser?: unknown;
  fullText?: unknown;
  visualTag?: unknown;
  basisIds?: unknown;
};

type GeneratedPackage = {
  cards?: unknown;
  influencesCard?: unknown;
};

function cleanLine(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function normalizeId(value: unknown, fallback: string): string {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

function normalizeVisualTag(value: unknown): PeriodExtraVisualTag {
  const normalized = String(value || '').trim().toLowerCase() as PeriodExtraVisualTag;
  return VISUAL_TAGS.includes(normalized) ? normalized : 'goals';
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeDegree(value: number): number {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function transitLongitude(transit?: PlanetTransit | null): number | null {
  if (!transit) return null;
  if (typeof transit.longitude === 'number' && Number.isFinite(transit.longitude)) {
    return normalizeDegree(transit.longitude);
  }
  const signs = [
    'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
  ];
  const index = signs.indexOf(String(transit.sign || '').toLowerCase());
  if (index < 0 || !Number.isFinite(transit.degree)) return null;
  return normalizeDegree(index * 30 + transit.degree);
}

function transitHouse(chartData: NatalChartData, transit?: PlanetTransit | null): number | null {
  const quality = chartData.chartQuality;
  const birthTimeQuality = chartData.birthTimeQuality || quality?.birthTimeQuality || 'exact';
  if (
    birthTimeQuality !== 'exact' ||
    quality?.housesReliable === false ||
    !Array.isArray(chartData.houses) ||
    chartData.houses.length < 12
  ) {
    return null;
  }
  const longitude = transitLongitude(transit);
  if (longitude == null) return null;
  const houses = [...chartData.houses]
    .filter((house) => Number.isFinite(house.longitude))
    .sort((a, b) => a.house - b.house);
  if (houses.length < 12) return null;

  for (let index = 0; index < houses.length; index += 1) {
    const current = normalizeDegree(houses[index].longitude);
    const next = normalizeDegree(houses[(index + 1) % houses.length].longitude);
    const span = normalizeDegree(next - current);
    const offset = normalizeDegree(longitude - current);
    if (offset < span || (span === 0 && offset === 0)) return houses[index].house;
  }
  return null;
}

function buildTransitHouseEvidence(
  chartData: NatalChartData,
  transits: CurrentTransits,
  language: 'ru' | 'en',
): AstroEvidenceItem[] {
  const themesRu: Record<number, string> = {
    1: 'личная инициатива и способ действовать',
    2: 'деньги, ресурсы и чувство устойчивости',
    3: 'разговоры, сообщения и ближайшие дела',
    4: 'дом, семья и личная опора',
    5: 'романтика, творчество и удовольствие',
    6: 'работа, обязанности и повседневный ритм',
    7: 'отношения, договорённости и партнёрство',
    8: 'общие ресурсы, доверие и глубокие перемены',
    9: 'обучение, поездки и расширение планов',
    10: 'карьера, статус и заметные решения',
    11: 'друзья, команды и планы на будущее',
    12: 'завершение, восстановление и скрытые процессы',
  };
  const themesEn: Record<number, string> = {
    1: 'personal initiative and the way you act',
    2: 'money, resources, and stability',
    3: 'conversations, messages, and immediate tasks',
    4: 'home, family, and inner support',
    5: 'romance, creativity, and enjoyment',
    6: 'work, duties, and daily rhythm',
    7: 'relationships, agreements, and partnership',
    8: 'shared resources, trust, and deep change',
    9: 'learning, travel, and expanding plans',
    10: 'career, status, and visible decisions',
    11: 'friends, teams, and future plans',
    12: 'closure, recovery, and hidden processes',
  };
  const namesRu: Record<string, string> = {
    sun: 'Солнце',
    moon: 'Луна',
    mercury: 'Меркурий',
    venus: 'Венера',
    mars: 'Марс',
    jupiter: 'Юпитер',
    saturn: 'Сатурн',
  };
  const keys: Array<keyof CurrentTransits> = [
    'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  ];
  return keys.flatMap((key) => {
    const transit = transits[key] as PlanetTransit | undefined;
    const house = transitHouse(chartData, transit);
    if (!transit || !house) return [];
    const planet = language === 'ru' ? namesRu[String(key)] : transit.planet;
    const theme = (language === 'ru' ? themesRu : themesEn)[house];
    return [{
      id: `transit-house:${String(key)}:${house}`,
      type: 'house' as const,
      label: language === 'ru'
        ? `${planet} проходит через ${house} дом`
        : `${planet} moves through house ${house}`,
      detail: language === 'ru'
        ? `${planet} в ${transit.sign} проходит через ${house} дом персональной карты.`
        : `${planet} in ${transit.sign} moves through house ${house} of the personal chart.`,
      humanMeaning: language === 'ru'
        ? `Сейчас сильнее выделена тема: ${theme}.`
        : `The highlighted area now is ${theme}.`,
      priority: key === 'jupiter' || key === 'saturn' ? 84 : key === 'mars' || key === 'venus' ? 78 : 68,
      planet: String(key),
      sign: transit.sign,
      house,
    }];
  });
}

function buildPersonalAspectEvidence(
  chartData: NatalChartData,
  transits: CurrentTransits,
  language: 'ru' | 'en',
): AstroEvidenceItem[] {
  const planetRu: Record<string, string> = {
    sun: 'Солнце',
    moon: 'Луна',
    mercury: 'Меркурий',
    venus: 'Венера',
    mars: 'Марс',
    jupiter: 'Юпитер',
    saturn: 'Сатурн',
    rising: 'Асцендент',
  };
  const aspectRu: Record<string, string> = {
    conjunction: 'соединение',
    sextile: 'секстиль',
    square: 'квадрат',
    trine: 'трин',
    opposition: 'оппозиция',
  };
  const aspectDetailRu: Record<string, string> = {
    ...aspectRu,
    opposition: 'оппозицию',
  };
  const themeRu: Record<string, string> = {
    sun: 'личные решения, уверенность и направление действий',
    moon: 'эмоциональную реакцию, близость и чувство безопасности',
    mercury: 'разговоры, сообщения, документы и выбор слов',
    venus: 'отношения, симпатию, ценности и денежные решения',
    mars: 'инициативу, спор, нагрузку и скорость действий',
    jupiter: 'рост, обучение и расширение планов',
    saturn: 'обязательства, границы и долгосрочные решения',
    rising: 'личную подачу и способ входить в ситуацию',
  };
  const themeEn: Record<string, string> = {
    sun: 'personal decisions, confidence, and direction',
    moon: 'emotional response, closeness, and safety',
    mercury: 'conversations, messages, documents, and wording',
    venus: 'relationships, attraction, values, and money choices',
    mars: 'initiative, conflict, workload, and pace',
    jupiter: 'growth, learning, and expanding plans',
    saturn: 'commitments, boundaries, and long-term decisions',
    rising: 'personal presence and the way you enter a situation',
  };

  return detectTransitAspects(chartData, transits, { limit: 20 }).map((aspect) => {
    const transit = transits[aspect.transitPlanet as keyof CurrentTransits] as PlanetTransit | undefined;
    const transitName = language === 'ru'
      ? planetRu[aspect.transitPlanet] || aspect.transitPlanet
      : transit?.planet || aspect.transitPlanet;
    const natalName = language === 'ru'
      ? planetRu[aspect.natalPlanet] || aspect.natalPlanet
      : aspect.natalPlanet;
    const aspectName = language === 'ru'
      ? aspectRu[aspect.type] || aspect.type
      : aspect.type;
    return {
      id: `transit:${aspect.transitPlanet}:${aspect.type}:${aspect.natalPlanet}`,
      type: 'transit' as const,
      label: language === 'ru'
        ? `${transitName}: ${aspectName} к натальному ${natalName}`
        : `${transitName}: ${aspectName} to natal ${natalName}`,
      detail: language === 'ru'
        ? `${transitName}${transit?.sign ? ` в ${transit.sign}` : ''} формирует ${aspectDetailRu[aspect.type] || aspect.type} к натальному ${natalName}, орб ${aspect.orb.toFixed(1)}°.`
        : `${transitName}${transit?.sign ? ` in ${transit.sign}` : ''} forms a ${aspectName} to natal ${natalName}, orb ${aspect.orb.toFixed(1)}°.`,
      humanMeaning: language === 'ru'
        ? `В этот момент сильнее затронуты ${themeRu[aspect.natalPlanet] || 'личные решения'}.`
        : `This timing highlights ${themeEn[aspect.natalPlanet] || 'personal decisions'}.`,
      priority: 124 - aspect.orb * 8,
      planet: aspect.natalPlanet,
      sign: transit?.sign,
      aspectType: aspect.type,
      orb: aspect.orb,
    };
  });
}

function uniqueSampleEvidence(items: AstroEvidenceItem[]): AstroEvidenceItem[] {
  const unique = new Map<string, AstroEvidenceItem>();
  for (const item of items) {
    if (item.id.endsWith(':sign')) continue;
    const current = unique.get(item.id);
    if (!current || (item.priority || 0) > (current.priority || 0)) {
      unique.set(item.id, item);
    }
  }
  return [...unique.values()];
}

function uniqueDates(dates: Date[]): Date[] {
  const seen = new Set<string>();
  return dates.filter((date) => {
    const key = date.toISOString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function periodSamples(
  periodType: PersonalPeriodType,
  periodKey: string,
  language: 'ru' | 'en',
): PeriodSample[] {
  let dates: Date[] = [];

  if (periodType === 'daily') {
    dates = [6, 12, 18].map((hour) => new Date(`${periodKey}T${String(hour).padStart(2, '0')}:00:00.000Z`));
  } else if (periodType === 'weekly') {
    const { validFrom } = isoWeekToValidRangeUtc(periodKey);
    const start = new Date(validFrom);
    dates = Array.from({ length: 7 }, (_, index) => addDays(start, index + 0.5));
  } else if (periodType === 'monthly') {
    const { validFrom, validTo } = monthKeyToValidRangeUtc(periodKey);
    const start = new Date(validFrom);
    const end = new Date(validTo);
    const span = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000));
    dates = [
      ...Array.from({ length: Math.floor(span / 4) + 1 }, (_, index) => addDays(start, index * 4)),
      addDays(start, span),
    ];
  } else {
    const year = Number(periodKey);
    dates = Array.from(
      { length: 24 },
      (_, index) => new Date(Date.UTC(year, Math.floor(index / 2), index % 2 === 0 ? 1 : 15, 12, 0, 0, 0)),
    );
  }

  const locale = language === 'ru' ? 'ru-RU' : 'en-US';
  return uniqueDates(dates)
    .filter((date) => !Number.isNaN(date.getTime()))
    .map((date) => ({
      date,
      dateKey: utcDateKey(date),
      label: periodType === 'daily'
        ? new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'Europe/Moscow',
          }).format(date)
        : formatDisplayDate(date, language),
    }));
}

function canonicalEvidenceId(item: AstroEvidenceItem): string {
  if (item.id.endsWith(':sign')) {
    return `${item.id}:${cleanLine(item.label, 120).toLowerCase()}`;
  }
  return item.id;
}

function buildEvidence(
  samples: Array<{ sample: PeriodSample; items: AstroEvidenceItem[] }>,
  periodType: PersonalPeriodType,
): PeriodEvidence[] {
  const grouped = new Map<string, {
    item: AstroEvidenceItem;
    occurrences: Array<{ label: string; item: AstroEvidenceItem }>;
  }>();

  for (const { sample, items } of samples) {
    for (const item of items) {
      if (item.type !== 'transit' && item.type !== 'house') continue;
      if (item.id.endsWith(':sign')) continue;
      if (
        (periodType === 'monthly' || periodType === 'yearly') &&
        (item.id.startsWith('transit:moon:') || item.id.startsWith('transit-house:moon:'))
      ) {
        continue;
      }
      const key = canonicalEvidenceId(item);
      const group = grouped.get(key) || { item, occurrences: [] };
      group.occurrences.push({ label: sample.label, item });
      if ((item.orb ?? Number.POSITIVE_INFINITY) < (group.item.orb ?? Number.POSITIVE_INFINITY)) {
        group.item = item;
      }
      grouped.set(key, group);
    }
  }

  return [...grouped.values()]
    .map((group, index): PeriodEvidence => {
      const sorted = [...group.occurrences].sort(
        (a, b) => (a.item.orb ?? Number.POSITIVE_INFINITY) - (b.item.orb ?? Number.POSITIVE_INFINITY),
      );
      const best = sorted[0];
      return {
        id: `signal-${index + 1}`,
        label: cleanLine(best.item.label, 220),
        humanMeaning: cleanLine(best.item.humanMeaning || best.item.label, 260),
        details: group.occurrences
          .map(({ label, item }) => `${label}: ${cleanLine(item.detail || item.label, 360)}`)
          .filter(Boolean)
          .slice(0, 12),
        activeDates: group.occurrences.map(({ label }) => label),
        closestSample: best.label,
        minOrb: typeof best.item.orb === 'number' ? best.item.orb : null,
        priority: Math.max(...group.occurrences.map(({ item }) => item.priority || 0)),
      };
    })
    .sort((a, b) => {
      if (a.minOrb != null && b.minOrb != null && a.minOrb !== b.minOrb) return a.minOrb - b.minOrb;
      return b.priority - a.priority;
    })
    .slice(0, 18)
    .map((item, index) => ({ ...item, id: `signal-${index + 1}` }));
}

function periodLabel(periodType: PersonalPeriodType, periodKey: string, language: 'ru' | 'en'): string {
  if (periodType === 'daily') return formatDisplayDate(periodKey, language);
  if (periodType === 'weekly') return formatIsoWeekPeriodLabel(periodKey, language);
  if (periodType === 'monthly') return formatMonthPeriodLabel(periodKey, language);
  return formatYearPeriodLabel(periodKey, language);
}

function periodLogic(periodType: PersonalPeriodType, language: 'ru' | 'en'): string {
  if (language === 'en') {
    const values: Record<PersonalPeriodType, string> = {
      daily: 'specific events today: messages, meetings, answers, changed plans, and morning/day/evening timing',
      weekly: 'development across seven days: beginning, middle, end, key days, a conversation, a returning topic, and what changes by the weekend',
      monthly: 'the main change, strongest and tense weeks, a start or decision window, and what becomes clear by month end',
      yearly: 'the main story, key months, long processes, a major choice, first versus second half, and the result by year end',
    };
    return values[periodType];
  }
  const values: Record<PersonalPeriodType, string> = {
    daily: 'конкретные события сегодня: сообщения, встречи, ответы, изменение планов и разница между утром, днём и вечером',
    weekly: 'развитие ситуации за семь дней: начало, середина и конец недели, важные дни, разговор, возвращение темы и изменение к выходным',
    monthly: 'главное изменение, сильная и напряжённая недели, момент старта или выбора и ясность к концу месяца',
    yearly: 'главная история, ключевые месяцы, длительные процессы, крупный выбор, первая и вторая половина и результат к концу года',
  };
  return values[periodType];
}

function buildPrompt(
  profile: UserProfile,
  periodType: PersonalPeriodType,
  periodKey: string,
  language: 'ru' | 'en',
  evidence: PeriodEvidence[],
): string {
  const evidenceJson = JSON.stringify(evidence, null, 2);
  const schema = `{
  "cards": [
    {
      "id": "short-stable-id",
      "title": "short personal question tied to this exact period",
      "teaser": "one concrete preview sentence",
      "fullText": "2-4 short paragraphs with a direct useful answer and timing",
      "visualTag": "communication|relationships|work|money|goals|family|friendship|energy",
      "basisIds": ["signal-1"]
    }
  ],
  "influencesCard": {
    "id": "influences",
    "title": "human title about how this period changes",
    "teaser": "plain-language preview",
    "fullText": "plain-language explanation of the active influences and their timing",
    "visualTag": "energy",
    "basisIds": ["signal-1", "signal-2"]
  }
}`;

  const common = `
Return only a valid JSON object matching this schema:
${schema}

Create exactly 4 distinct reading cards plus exactly 1 influencesCard.
Every card must use 1-3 basisIds from the supplied evidence. Never invent a planet, aspect, house, date, or calculation.
Each card must cover a different active theme. Do not repeat one conclusion with different wording.
Titles must be short, personal, concrete questions about this exact period and promise a specific answer.
Do not use dry category titles such as Work, Love, Money, Energy, Relationships, Career, Advice.
Do not ask permanent personality questions. This is period forecasting, not a natal personality reading.
Do not use astrology terms in titles. Do not use fatalism, inevitability, slang, coaching filler, mystical clichés, or scare tactics.
Teasers must be one short concrete sentence. fullText must give a clear answer, include real timing from the evidence, and stay readable.
Do not mention that you are an AI. Do not mention zodiac-sign horoscopes.
The voice is a bold, precise, kind and honest friend: direct, lively, confident, simple, without rudeness or teenage language.
Period logic: ${periodLogic(periodType, language)}.
Period: ${periodType}; key: ${periodKey}; label: ${periodLabel(periodType, periodKey, language)}.
User first name: ${cleanLine(profile.name, 80) || (language === 'ru' ? 'пользователь' : 'user')}.

Calculated personal transit evidence:
${evidenceJson}
`;

  return language === 'ru'
    ? `${common}
Пиши весь пользовательский текст только по-русски. Заголовки должны явно содержать временную привязку: сегодня, на этой неделе, в этом месяце или в этом году.`
    : `${common}
Write all user-facing text in English. Titles must explicitly anchor the time: today, this week, this month, or this year.`;
}

function basisForCard(
  basisIds: unknown,
  evidenceById: Map<string, PeriodEvidence>,
  minimum = 1,
) {
  const ids = Array.isArray(basisIds)
    ? [...new Set(basisIds.map(String).filter((id) => evidenceById.has(id)))].slice(0, 3)
    : [];
  if (ids.length < minimum) return null;
  const selected = ids.map((id) => evidenceById.get(id)!);
  return {
    basisSummary: selected
      .map((item) => item.humanMeaning)
      .filter(Boolean)
      .slice(0, 2)
      .join(' '),
    basisDetails: selected
      .flatMap((item) => item.details)
      .filter(Boolean)
      .slice(0, 8),
  };
}

function normalizeGeneratedCard(
  raw: GeneratedCard,
  fallbackId: string,
  evidenceById: Map<string, PeriodEvidence>,
  minimumBasis = 1,
): PeriodExtraCard | null {
  const title = cleanLine(raw.title, 120);
  const teaser = cleanLine(raw.teaser, 260);
  const fullText = cleanText(raw.fullText, 2600);
  const basis = basisForCard(raw.basisIds, evidenceById, minimumBasis);

  if (title.length < 10 || teaser.length < 28 || fullText.length < 140 || !basis) return null;
  return {
    id: normalizeId(raw.id, fallbackId),
    title,
    teaser,
    fullText,
    visualTag: normalizeVisualTag(raw.visualTag),
    isPremium: true,
    ...basis,
  };
}

function titleMatchesPeriod(title: string, periodType: PersonalPeriodType): boolean {
  const normalized = title.toLowerCase();
  const periodWords: Record<PersonalPeriodType, RegExp> = {
    daily: /(сегодня|утром|дн[её]м|вечером|today|morning|afternoon|evening)/i,
    weekly: /(недел|выходн|week|weekend)/i,
    monthly: /(месяц|недел|month|week)/i,
    yearly: /(год|месяц|полугод|year|month|half)/i,
  };
  const dryTitles = new Set([
    'работа', 'любовь', 'деньги', 'дела', 'энергия', 'отношения', 'карьера', 'совет дня',
    'work', 'love', 'money', 'energy', 'relationships', 'career', 'advice',
  ]);
  return periodWords[periodType].test(normalized) && !dryTitles.has(normalized.replace(/[?!.]+$/, '').trim());
}

function normalizeGeneratedPackage(
  raw: GeneratedPackage,
  periodType: PersonalPeriodType,
  periodKey: string,
  evidence: PeriodEvidence[],
): PeriodExtras {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]));
  const cards = (Array.isArray(raw.cards) ? raw.cards : [])
    .map((item, index) => normalizeGeneratedCard(
      (item && typeof item === 'object' ? item : {}) as GeneratedCard,
      `reading-${index + 1}`,
      evidenceById,
    ))
    .filter((item): item is PeriodExtraCard => !!item)
    .filter((item) => titleMatchesPeriod(item.title, periodType));

  const seenTitles = new Set<string>();
  const uniqueCards = cards.filter((card) => {
    const key = card.title.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '');
    if (!key || seenTitles.has(key)) return false;
    seenTitles.add(key);
    return true;
  }).slice(0, 4);

  const influencesCard = normalizeGeneratedCard(
    (raw.influencesCard && typeof raw.influencesCard === 'object'
      ? raw.influencesCard
      : {}) as GeneratedCard,
    'influences',
    evidenceById,
    2,
  );

  if (uniqueCards.length !== 4 || !influencesCard || !titleMatchesPeriod(influencesCard.title, periodType)) {
    throw new Error('PERIOD_EXTRAS_INVALID_MODEL_OUTPUT');
  }

  return {
    periodType,
    periodKey,
    cards: uniqueCards,
    influencesCard: { ...influencesCard, id: 'influences' },
  };
}

export function contentVariantForPeriodExtras(periodType: PersonalPeriodType): ContentVariant {
  return PERIOD_VARIANT[periodType];
}

export function buildPeriodExtrasCacheKey(input: {
  userId: string;
  chartId: number | null;
  periodType: PersonalPeriodType;
  periodKey: string;
  language: 'ru' | 'en';
}): string {
  return [
    'period-extras',
    PERIOD_EXTRAS_PROMPT_VERSION,
    input.userId,
    input.chartId ?? 'primary',
    input.periodType,
    input.periodKey,
    input.language,
  ].join(':');
}

export function validRangeForPeriodExtras(periodType: PersonalPeriodType, periodKey: string) {
  if (periodType === 'daily') {
    return {
      validFrom: `${periodKey}T00:00:00.000Z`,
      validTo: `${periodKey}T23:59:59.999Z`,
    };
  }
  if (periodType === 'weekly') return isoWeekToValidRangeUtc(periodKey);
  if (periodType === 'monthly') return monthKeyToValidRangeUtc(periodKey);
  return yearKeyToValidRangeUtc(periodKey);
}

export function stripLockedPeriodExtras(extras: PeriodExtras, isPremium: boolean): PeriodExtras {
  if (isPremium) return extras;
  const lockCard = (card: PeriodExtraCard): PeriodExtraCard => ({
    ...card,
    fullText: '',
    basisSummary: undefined,
    basisDetails: undefined,
    isPremium: true,
  });
  return {
    ...extras,
    cards: extras.cards.map(lockCard),
    influencesCard: lockCard(extras.influencesCard),
  };
}

export function isPeriodExtras(value: unknown): value is PeriodExtras {
  if (!value || typeof value !== 'object') return false;
  const raw = value as Partial<PeriodExtras>;
  const cards = Array.isArray(raw.cards) ? raw.cards : [];
  return (
    ['daily', 'weekly', 'monthly', 'yearly'].includes(String(raw.periodType)) &&
    typeof raw.periodKey === 'string' &&
    cards.length === 4 &&
    cards.every((card) => (
      !!card &&
      typeof card.id === 'string' &&
      typeof card.title === 'string' &&
      typeof card.teaser === 'string' &&
      typeof card.fullText === 'string'
    )) &&
    !!raw.influencesCard &&
    typeof raw.influencesCard.id === 'string' &&
    typeof raw.influencesCard.title === 'string' &&
    typeof raw.influencesCard.teaser === 'string' &&
    typeof raw.influencesCard.fullText === 'string'
  );
}

export async function generatePeriodExtras(
  profile: UserProfile,
  chartData: NatalChartData,
  periodType: PersonalPeriodType,
  periodKey: string,
): Promise<{ extras: PeriodExtras; modelTier: 'base' | 'premium' }> {
  if (!openai) throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  const language: 'ru' | 'en' = profile.language === 'en' ? 'en' : 'ru';
  const samples = periodSamples(periodType, periodKey, language);
  const calculated = await Promise.all(samples.map(async (sample) => {
    const transits = await getCurrentTransits(sample.date);
    return {
      sample,
      items: uniqueSampleEvidence([
        ...buildDailyAstroEvidence(chartData, transits, language),
        ...buildPersonalAspectEvidence(chartData, transits, language),
        ...buildTransitHouseEvidence(chartData, transits, language),
      ]),
    };
  }));
  const evidence = buildEvidence(calculated, periodType);
  if (evidence.length < 4) throw new Error('PERIOD_EXTRAS_TRANSIT_EVIDENCE_UNAVAILABLE');

  const contentVariant = contentVariantForPeriodExtras(periodType);
  const assignment = await getOpenAIModelForContent({
    accessTier: 'premium',
    contentSurface: 'forecast',
    contentVariant,
  });
  const completion = await openai.chat.completions.create(buildOpenAIChatParams(assignment.model, {
    messages: [
      { role: 'system', content: getAppSystemPrompt(language) },
      { role: 'user', content: buildPrompt(profile, periodType, periodKey, language, evidence) },
    ],
    temperature: 0.76,
    maxTokens: 4200,
    jsonMode: true,
  }));
  const content = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(content) as GeneratedPackage;
  return {
    extras: normalizeGeneratedPackage(parsed, periodType, periodKey, evidence),
    modelTier: assignment.modelTier,
  };
}
