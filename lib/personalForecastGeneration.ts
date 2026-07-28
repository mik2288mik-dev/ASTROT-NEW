import OpenAI from 'openai';
import type { NatalChartData, UserProfile } from '../types';
import {
  APP_VOICE_VERSION,
  getAppSystemVoice,
  hasAppVoiceViolation,
} from './appVoice';
import { buildOpenAIChatParams } from './openaiChat';
import {
  DYNAMIC_FORECAST_FOCUS_LABELS,
  FIXED_FORECAST_SECTION_KEYS,
  FORECAST_FIXED_TITLES,
  FORECAST_WISHES_TITLES,
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  isSimpleDynamicTitle,
  personalForecastExplanationLimit,
  personalForecastSectionTextLimit,
  selectTodayFreeSections,
  validateForecastSectionRepetition,
  type CalculatedAstroEvidence,
  type CrossPeriodLink,
  type DynamicForecastTopicKey,
  type ExplanationAnchor,
  type FixedForecastSectionKey,
  type ForecastInlineAstroAccent,
  type ForecastSection,
  type ForecastSectionKind,
  type ForecastTopicKey,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
  type TopicEvidence,
} from './personalForecastContract';
import {
  calculatePersonalForecastEvidence,
  resolvePersonalForecastChartReliability,
  type EvidenceCalculationResult,
} from './personalForecastEvidence';

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

type ForecastSectionPlan = {
  id: string;
  kind: ForecastSectionKind;
  fixedKey?: FixedForecastSectionKey;
  sourceTopicKey: ForecastTopicKey;
  staticTitle?: string;
  focusLabel: string;
  importance: number;
  visualTag: string;
  evidence: TopicEvidence;
  inlineEvidenceIds: string[];
};

type GeneratedAnchorPayload = {
  id?: unknown;
  conclusion?: unknown;
  explanation?: unknown;
  evidence_ids?: unknown;
};

type GeneratedInlineAccentPayload = {
  text?: unknown;
  evidence_ids?: unknown;
};

type GeneratedSectionPayload = {
  id?: unknown;
  title?: unknown;
  text?: unknown;
  premium_teaser?: unknown;
  explanation_anchors?: unknown;
  inline_astro_accent?: GeneratedInlineAccentPayload | null;
};

type GeneratedFeedPayload = {
  overview?: GeneratedSectionPayload;
  sections?: unknown;
};

type DateReference = {
  raw: string;
  isoDate?: string;
  monthDay?: string;
};

const MONTH_BY_NAME: Record<string, number> = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

const DYNAMIC_INSERT_AFTER: Record<DynamicForecastTopicKey, FixedForecastSectionKey> = {
  professional_path: 'work_money',
  it_direction: 'work_money',
  business: 'work_money',
  income_growth: 'work_money',
  work_change: 'work_money',
  study: 'work_money',
  creativity: 'friends',
  relocation: 'home_family',
  property_decision: 'home_family',
  self_confidence: 'mood',
  important_decision: 'work_money',
  future_direction: 'work_money',
  rest_recovery: 'mood',
  physical_activity: 'mood',
  documents_agreements: 'work_money',
};

const VISUAL_TAG_BY_FIXED: Record<FixedForecastSectionKey, string> = {
  love: 'love',
  mood: 'mood',
  home_family: 'home',
  friends: 'friends',
  work_money: 'work-money',
  wishes: 'wishes',
};

const VISUAL_TAG_BY_DYNAMIC: Record<DynamicForecastTopicKey, string> = {
  professional_path: 'career',
  it_direction: 'technology',
  business: 'business',
  income_growth: 'money',
  work_change: 'career-change',
  study: 'study',
  creativity: 'creativity',
  relocation: 'relocation',
  property_decision: 'property',
  self_confidence: 'confidence',
  important_decision: 'decision',
  future_direction: 'future',
  rest_recovery: 'rest',
  physical_activity: 'movement',
  documents_agreements: 'documents',
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function compactEvidence(evidence: TopicEvidence) {
  const compact = (items: CalculatedAstroEvidence[]) => items.map((item) => ({
    id: item.id,
    kind: item.kind,
    transitPlanet: item.transitPlanet ?? null,
    natalPoint: item.natalPoint ?? null,
    aspect: item.aspect ?? null,
    house: item.house ?? null,
    orb: item.orb ?? null,
    status: item.status,
    exactAt: item.exactAt ?? null,
    startsAt: item.startsAt ?? null,
    endsAt: item.endsAt ?? null,
    strength: item.strength,
    polarity: item.polarity,
  }));
  return {
    primary: compact(evidence.primary),
    supporting: compact(evidence.supporting),
    conflicting: compact(evidence.conflicting),
    confidence: evidence.confidence,
  };
}

function compactNatalChart(chart: NatalChartData) {
  const reliability = resolvePersonalForecastChartReliability(chart);
  const point = (key: keyof NatalChartData) => {
    const value = chart[key] as {
      sign?: string;
      degree?: number;
      house?: string | number;
    } | null | undefined;
    if (!value || typeof value !== 'object') return null;
    return {
      sign: value.sign || null,
      degree: Number.isFinite(value.degree) ? Number(value.degree).toFixed(2) : null,
      house: (
        reliability.houseBasedPersonalization
        && value.house != null
      )
        ? String(value.house)
        : null,
    };
  };
  return {
    sun: point('sun'),
    moon: point('moon'),
    rising: reliability.ascendantReliable ? point('rising') : null,
    mercury: point('mercury'),
    venus: point('venus'),
    mars: point('mars'),
    jupiter: point('jupiter'),
    saturn: point('saturn'),
    uranus: point('uranus'),
    neptune: point('neptune'),
    pluto: point('pluto'),
    houses: reliability.houseBasedPersonalization
      ? (chart.houses || []).map((house) => ({
          house: house.house,
          sign: house.sign,
        }))
      : [],
    birthTimeQuality: reliability.birthTimeQuality,
    chartQuality: {
      ascendantReliable: reliability.ascendantReliable,
      housesReliable: reliability.housesReliable,
      houseBasedPersonalization: reliability.houseBasedPersonalization,
    },
    calculationVersion: chart.calculationVersion || null,
  };
}

function evidenceImportance(evidence: TopicEvidence): number {
  const all = [
    ...evidence.primary,
    ...evidence.supporting,
    ...evidence.conflicting,
  ];
  if (!all.length) return 0;
  const primary = evidence.primary[0]?.strength || 0;
  const supporting = all.slice(1, 4).reduce((sum, item) => sum + item.strength, 0);
  return Math.max(1, Math.min(100, Math.round(primary * 0.78 + supporting * 0.12)));
}

function topicEvidenceFor(
  calculated: EvidenceCalculationResult,
  key: ForecastTopicKey,
): TopicEvidence {
  return calculated.topicEvidence[key] || {
    primary: [],
    supporting: [],
    conflicting: [],
    confidence: 'low',
  };
}

function astroTitle(
  evidence: CalculatedAstroEvidence,
  language: 'ru' | 'en',
): string {
  const planet = String(evidence.transitPlanet || '').toLowerCase();
  const planetNames: Record<'ru' | 'en', Record<string, string>> = {
    ru: {
      sun: 'Солнце',
      moon: 'Луна',
      mercury: 'Меркурий',
      venus: 'Венера',
      mars: 'Марс',
      jupiter: 'Юпитер',
      saturn: 'Сатурн',
      uranus: 'Уран',
      neptune: 'Нептун',
      pluto: 'Плутон',
    },
    en: {
      sun: 'Sun',
      moon: 'Moon',
      mercury: 'Mercury',
      venus: 'Venus',
      mars: 'Mars',
      jupiter: 'Jupiter',
      saturn: 'Saturn',
      uranus: 'Uranus',
      neptune: 'Neptune',
      pluto: 'Pluto',
    },
  };
  const names = {
    ru: {
      newMoon: 'Новолуние задаёт заметный ритм',
      fullMoon: 'Полнолуние задаёт заметный ритм',
      moon: 'Луна выходит на первый план',
      mercury: evidence.kind === 'station'
        ? 'Меркурий меняет направление'
        : 'Меркурий выходит на первый план',
    },
    en: {
      newMoon: 'The New Moon sets a noticeable pace',
      fullMoon: 'The Full Moon sets a noticeable pace',
      moon: 'The Moon comes to the foreground',
      mercury: evidence.kind === 'station'
        ? 'Mercury changes direction'
        : 'Mercury comes to the foreground',
    },
  };
  if (evidence.kind === 'lunation') {
    return evidence.aspect === 'opposition'
      ? names[language].fullMoon
      : names[language].newMoon;
  }
  if (planet === 'moon' || planet === 'mercury') {
    return names[language][planet];
  }
  const label = planetNames[language][planet]
    || (language === 'ru' ? 'Планета' : 'Planet');
  if (evidence.kind === 'station') {
    return language === 'ru'
      ? `${label} меняет направление`
      : `${label} changes direction`;
  }
  return language === 'ru'
    ? `${label}: важный акцент периода`
    : `${label}: an important period accent`;
}

function astroVisualTag(evidence: CalculatedAstroEvidence): string {
  const planet = String(evidence.transitPlanet || '').toLowerCase();
  if (evidence.kind === 'lunation' || planet === 'moon') return 'moon';
  if (planet === 'mercury') return evidence.kind === 'station' ? 'retrograde' : 'mercury';
  if (evidence.kind === 'station') return 'retrograde';
  return 'astro';
}

function evidenceBundle(items: CalculatedAstroEvidence[]): TopicEvidence {
  return {
    primary: items.slice(0, 1),
    supporting: items.slice(1, 3),
    conflicting: items.filter((item) => item.polarity === 'challenging').slice(0, 1),
    confidence: (items[0]?.strength || 0) >= 70 ? 'high' : 'medium',
  };
}

function chooseStrongAstroEvidence(
  evidence: CalculatedAstroEvidence[],
): CalculatedAstroEvidence[] {
  return evidence
    .filter((item) => (
      item.strength >= 68
      && (
        item.kind === 'lunation'
        || item.kind === 'station'
        || item.transitPlanet === 'moon'
        || item.transitPlanet === 'mercury'
      )
    ))
    .sort((a, b) => b.strength - a.strength)
    .filter((item, index, all) => (
      all.findIndex((candidate) => (
        candidate.kind === item.kind
        && candidate.transitPlanet === item.transitPlanet
      )) === index
    ))
    .slice(0, 2);
}

function fixedFocusLabel(
  key: FixedForecastSectionKey,
  language: 'ru' | 'en',
  period: PersonalForecastPeriod,
): string {
  if (key === 'wishes') return FORECAST_WISHES_TITLES[language][period];
  return FORECAST_FIXED_TITLES[language][key];
}

export function buildPersonalForecastSectionPlans(input: {
  calculated: EvidenceCalculationResult;
  period: PersonalForecastPeriod;
  language: 'ru' | 'en';
}): {
  overview: ForecastSectionPlan;
  sections: ForecastSectionPlan[];
} {
  const { calculated, language, period } = input;
  const overviewEvidence = topicEvidenceFor(calculated, 'overview');
  const overview: ForecastSectionPlan = {
    id: 'overview',
    kind: 'overview',
    sourceTopicKey: 'overview',
    focusLabel: language === 'ru' ? 'главный разбор периода' : 'main period overview',
    importance: evidenceImportance(overviewEvidence),
    visualTag: 'overview',
    evidence: overviewEvidence,
    inlineEvidenceIds: [],
  };

  const dynamicPlans = calculated.dynamicTopicKeys.map((key): ForecastSectionPlan => {
    const evidence = topicEvidenceFor(calculated, key);
    return {
      id: `dynamic:${key}`,
      kind: 'dynamic',
      sourceTopicKey: key,
      focusLabel: DYNAMIC_FORECAST_FOCUS_LABELS[language][key],
      importance: evidenceImportance(evidence),
      visualTag: VISUAL_TAG_BY_DYNAMIC[key],
      evidence,
      inlineEvidenceIds: [],
    };
  });

  const strongAstro = chooseStrongAstroEvidence(calculated.evidence);
  const strongAstroIds = new Set(strongAstro.map((item) => item.id));
  const weakAstro = calculated.evidence
    .filter((item) => !strongAstroIds.has(item.id))
    .filter((item) => (
      item.strength >= 36
      && (
        item.kind === 'lunation'
        || item.kind === 'station'
        || item.transitPlanet === 'moon'
        || item.transitPlanet === 'mercury'
      )
    ))
    .sort((a, b) => b.strength - a.strength);

  const fixedPlans = FIXED_FORECAST_SECTION_KEYS.map((key): ForecastSectionPlan => {
    const evidence = topicEvidenceFor(calculated, key);
    const weak = weakAstro.find((item) => item.topicKeys.includes(key));
    return {
      id: key,
      kind: key === 'wishes' ? 'wishes' : 'fixed',
      fixedKey: key,
      sourceTopicKey: key,
      staticTitle: fixedFocusLabel(key, language, period),
      focusLabel: fixedFocusLabel(key, language, period),
      importance: evidenceImportance(evidence),
      visualTag: VISUAL_TAG_BY_FIXED[key],
      evidence,
      inlineEvidenceIds: weak ? [weak.id] : [],
    };
  });

  const astroPlans = strongAstro.map((item): ForecastSectionPlan => ({
    id: `astro:${item.id}`,
    kind: 'astro_accent',
    sourceTopicKey: item.topicKeys.find((key) => key !== 'overview' && key !== 'wishes')
      || 'overview',
    staticTitle: astroTitle(item, language),
    focusLabel: astroTitle(item, language),
    importance: Math.min(100, Math.round(item.strength)),
    visualTag: astroVisualTag(item),
    evidence: evidenceBundle([
      item,
      ...calculated.evidence
        .filter((candidate) => (
          candidate.id !== item.id
          && (
            candidate.transitPlanet === item.transitPlanet
            || candidate.kind === item.kind
          )
        ))
        .slice(0, 2),
    ]),
    inlineEvidenceIds: [],
  }));

  const sections: ForecastSectionPlan[] = [];
  for (const fixed of fixedPlans) {
    sections.push(fixed);
    if (fixed.fixedKey === 'mood') {
      sections.push(...astroPlans.filter((plan) => (
        plan.visualTag === 'moon'
        || plan.visualTag === 'mercury'
        || plan.visualTag === 'retrograde'
      )));
    }
    sections.push(...dynamicPlans.filter((plan) => (
      DYNAMIC_INSERT_AFTER[plan.sourceTopicKey as DynamicForecastTopicKey] === fixed.fixedKey
    )));
  }
  const placedAstro = new Set(sections.filter((plan) => plan.kind === 'astro_accent').map((plan) => plan.id));
  const unplacedAstro = astroPlans.filter((plan) => !placedAstro.has(plan.id));
  const wishesIndex = sections.findIndex((plan) => plan.fixedKey === 'wishes');
  if (unplacedAstro.length && wishesIndex >= 0) {
    sections.splice(wishesIndex, 0, ...unplacedAstro);
  }

  return { overview, sections };
}

function promptPlan(plan: ForecastSectionPlan) {
  return {
    id: plan.id,
    kind: plan.kind,
    fixedTitle: plan.staticTitle || null,
    lifeFocus: plan.focusLabel,
    importance: plan.importance,
    evidence: compactEvidence(plan.evidence),
    inlineEvidenceIds: plan.inlineEvidenceIds,
  };
}

export function buildPersonalForecastFeedPrompt(input: {
  language: 'ru' | 'en';
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  chartData: NatalChartData;
  overview: ForecastSectionPlan;
  sections: ForecastSectionPlan[];
  repairErrors?: string[];
}): string {
  const sectionLimit = personalForecastSectionTextLimit(input.period);
  const explanationLimit = personalForecastExplanationLimit(input.period);
  const repair = input.repairErrors?.length
    ? `\nThe previous JSON was rejected:\n- ${input.repairErrors.join('\n- ')}\nReturn a corrected complete object.`
    : '';
  const languageInstruction = input.language === 'en'
    ? 'Write all user-facing text in English.'
    : 'Весь пользовательский текст напиши на русском языке.';
  return `Create one structured personal forecast feed for the supplied period.

${languageInstruction}
Period: ${input.period}
Calculated interval: ${input.window.periodStart} — ${input.window.periodEnd}
Timezone: ${input.window.timezone}

The natal chart and all period evidence below were calculated by the server. Do not calculate astrology, infer missing aspects, or add biographical facts.
Natal chart:
${JSON.stringify(compactNatalChart(input.chartData), null, 2)}

Overview plan:
${JSON.stringify(promptPlan(input.overview), null, 2)}

Ordered section plans:
${JSON.stringify(input.sections.map(promptPlan), null, 2)}

Return exactly one JSON object:
{
  "overview": {
    "id": "overview",
    "text": "complete main period analysis",
    "premium_teaser": "specific teaser grounded in supplied evidence",
    "explanation_anchors": [
      {
        "id": "overview-conclusion-1",
        "conclusion": "one important human conclusion",
        "explanation": "plain-language reason for that exact conclusion",
        "evidence_ids": ["only IDs assigned to overview"]
      }
    ],
    "inline_astro_accent": null
  },
  "sections": [
    {
      "id": "exact id from the ordered plan",
      "title": "only for dynamic sections; a simple life title",
      "text": "full section text",
      "premium_teaser": "specific value of the full section",
      "explanation_anchors": [],
      "inline_astro_accent": {
        "text": "short plain-language insert only when inlineEvidenceIds were supplied",
        "evidence_ids": ["only supplied inlineEvidenceIds"]
      }
    }
  ]
}

Technical constraints:
- return every planned section exactly once and in the supplied order;
- omit a generated title for fixed, wishes, overview, and astro_accent sections;
- dynamic titles use one to seven ordinary words and must not use “Публичность”, “Важный выбор”, “Поездки и движение”, “Public visibility”, “Important choice”, or “Travel and movement”;
- each text starts with a direct conclusion, then explains its meaning, then naturally gives the calculated basis when useful;
- text length is flexible, but each section is at most ${sectionLimit} characters and must not repeat one point in different words;
- premium_teaser is 40–300 characters, starts from a real supplied conclusion, tells what the full text clarifies, and contains no invented intrigue;
- explanation_anchors contain zero to two items; each explanation is at most ${explanationLimit} characters and uses one to four evidence IDs assigned to that section;
- overview must contain at least one explanation anchor;
- inline_astro_accent is null unless inlineEvidenceIds are supplied; when supplied it uses only those IDs;
- no duplicate titles, duplicate opening sentences, templated introductions, markdown, technical field names, or fields outside the schema;
- never mention orbs, internal weights, applying/separating status, JSON, evidence, or service terminology in user-facing text;
- do not invent an event, person, job, purchase, conflict, biography, or guaranteed future outcome;
- mention a date only when it is present in the supplied calculations.${repair}`;
}

function dateReference(
  raw: string,
  day: number,
  month: number,
  year?: number,
): DateReference | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const monthDay = `${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return {
    raw,
    monthDay,
    isoDate: year ? `${year}-${monthDay}` : undefined,
  };
}

function datesInText(value: string): DateReference[] {
  const references: DateReference[] = (value.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [])
    .map((raw) => ({ raw, isoDate: raw, monthDay: raw.slice(5) }));
  const numericDayFirst = /(?:^|[^\d])(\d{1,2})([./])(\d{1,2})\2(\d{4})(?!\d)/gu;
  for (const match of value.matchAll(numericDayFirst)) {
    const raw = `${match[1]}${match[2]}${match[3]}${match[2]}${match[4]}`;
    const parsed = dateReference(
      raw,
      Number(match[1]),
      Number(match[3]),
      Number(match[4]),
    );
    if (parsed) references.push(parsed);
  }
  const russian = /(?:^|[^\p{L}\d])(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)(?:\s+(\d{4}))?/giu;
  for (const match of value.matchAll(russian)) {
    const raw = `${match[1]} ${match[2]}${match[3] ? ` ${match[3]}` : ''}`;
    const parsed = dateReference(
      raw,
      Number(match[1]),
      MONTH_BY_NAME[match[2].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  const englishMonthFirst = /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/giu;
  for (const match of value.matchAll(englishMonthFirst)) {
    const parsed = dateReference(
      match[0],
      Number(match[2]),
      MONTH_BY_NAME[match[1].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  const englishDayFirst = /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s*,?\s*(\d{4}))?\b/giu;
  for (const match of value.matchAll(englishDayFirst)) {
    const parsed = dateReference(
      match[0],
      Number(match[1]),
      MONTH_BY_NAME[match[2].toLowerCase()],
      match[3] ? Number(match[3]) : undefined,
    );
    if (parsed) references.push(parsed);
  }
  return references;
}

function evidenceIdsForPlan(plan: ForecastSectionPlan): Set<string> {
  return new Set([
    ...plan.evidence.primary,
    ...plan.evidence.supporting,
    ...plan.evidence.conflicting,
  ].map((item) => item.id));
}

function allowedDates(plans: ForecastSectionPlan[]): Set<string> {
  return new Set(
    plans
      .flatMap((plan) => [
        ...plan.evidence.primary,
        ...plan.evidence.supporting,
        ...plan.evidence.conflicting,
      ])
      .flatMap((item) => [item.exactAt, item.startsAt, item.endsAt])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.slice(0, 10)),
  );
}

function validateDates(value: string, dateWhitelist: Set<string>): string[] {
  return datesInText(value)
    .filter((date) => (
      date.isoDate
        ? !dateWhitelist.has(date.isoDate)
        : ![...dateWhitelist].some((allowed) => allowed.endsWith(date.monthDay || ''))
    ))
    .map((date) => date.raw);
}

function hasGuaranteedFutureClaim(value: string): boolean {
  return [
    /\b(?:will|shall)\s+(?:definitely|certainly|inevitably)\b/iu,
    /\b(?:definitely|certainly|inevitably)\s+(?:will|shall)\b/iu,
    /\b(?:is|are)\s+guaranteed\s+to\b/iu,
    /\b(?:must|will)\s+(?:happen|occur)\s+(?:for sure|without fail)\b/iu,
    /\b(?:точно|обязательно|гарантированно|непременно)\s+(?:произойд[её]т|случится|будет|получишь|получите)\b/iu,
    /\b(?:произойд[её]т|случится)\s+(?:точно|обязательно|гарантированно|непременно)\b/iu,
  ].some((pattern) => pattern.test(value));
}

function parseAnchors(input: {
  raw: unknown;
  plan: ForecastSectionPlan;
  period: PersonalForecastPeriod;
  dateWhitelist: Set<string>;
}): ExplanationAnchor[] {
  if (!Array.isArray(input.raw)) return [];
  const supplied = evidenceIdsForPlan(input.plan);
  const anchors: ExplanationAnchor[] = [];
  const anchorIds = new Set<string>();
  input.raw.slice(0, 2).forEach((item) => {
    const raw = (item || {}) as GeneratedAnchorPayload;
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    const conclusion = typeof raw.conclusion === 'string' ? raw.conclusion.trim() : '';
    const explanation = typeof raw.explanation === 'string' ? raw.explanation.trim() : '';
    const evidenceIds = Array.isArray(raw.evidence_ids)
      ? unique(raw.evidence_ids.filter((value): value is string => typeof value === 'string'))
      : [];
    const anchorText = `${conclusion}\n${explanation}`;
    const valid = (
      !!id
      && !anchorIds.has(id)
      && !!conclusion
      && conclusion.length <= 220
      && !!explanation
    );
    if (
      !valid
      || explanation.length > personalForecastExplanationLimit(input.period)
      || evidenceIds.length < 1
      || evidenceIds.length > 4
      || evidenceIds.some((value) => !supplied.has(value))
      || validateDates(anchorText, input.dateWhitelist).length > 0
      || hasGuaranteedFutureClaim(anchorText)
      || hasAppVoiceViolation(anchorText)
    ) return;
    anchorIds.add(id);
    anchors.push({ id, conclusion, explanation, evidenceIds });
  });
  return anchors;
}

function parseInlineAccent(input: {
  raw: GeneratedInlineAccentPayload | null | undefined;
  plan: ForecastSectionPlan;
  errors: string[];
}): ForecastInlineAstroAccent | null {
  if (!input.plan.inlineEvidenceIds.length) {
    if (input.raw) input.errors.push(`${input.plan.id}: unexpected inline_astro_accent`);
    return null;
  }
  if (!input.raw) {
    input.errors.push(`${input.plan.id}: inline_astro_accent is required`);
    return null;
  }
  const text = typeof input.raw.text === 'string' ? input.raw.text.trim() : '';
  const evidenceIds = Array.isArray(input.raw.evidence_ids)
    ? unique(input.raw.evidence_ids.filter((value): value is string => typeof value === 'string'))
    : [];
  if (!text || text.length > 360) {
    input.errors.push(`${input.plan.id}: inline_astro_accent text is invalid`);
  }
  if (
    evidenceIds.length < 1
    || evidenceIds.some((id) => !input.plan.inlineEvidenceIds.includes(id))
  ) {
    input.errors.push(`${input.plan.id}: inline_astro_accent evidence_ids are invalid`);
  }
  return { text, evidenceIds };
}

function parseSection(input: {
  raw: GeneratedSectionPayload;
  plan: ForecastSectionPlan;
  period: PersonalForecastPeriod;
  dateWhitelist: Set<string>;
  errors: string[];
}): ForecastSection {
  const id = typeof input.raw.id === 'string' ? input.raw.id.trim() : '';
  const title = typeof input.raw.title === 'string' ? input.raw.title.trim() : '';
  const text = typeof input.raw.text === 'string' ? input.raw.text.trim() : '';
  const premiumTeaser = typeof input.raw.premium_teaser === 'string'
    ? input.raw.premium_teaser.trim()
    : '';
  const lockedPreview = buildForecastLockedPreview(text, premiumTeaser);
  if (id !== input.plan.id) input.errors.push(`${input.plan.id}: returned id does not match`);
  if (!text || text.length > personalForecastSectionTextLimit(input.period)) {
    input.errors.push(`${input.plan.id}: text is invalid`);
  }
  if (
    !premiumTeaser
    || premiumTeaser.length < 40
    || premiumTeaser.length > 300
  ) {
    input.errors.push(`${input.plan.id}: premium_teaser is invalid`);
  }
  if (!lockedPreview.blurred.trim()) {
    input.errors.push(
      `${input.plan.id}: text is too short for an honest locked preview`,
    );
  }
  if (input.plan.kind === 'dynamic') {
    if (!isSimpleDynamicTitle(title)) input.errors.push(`${input.plan.id}: dynamic title is invalid`);
  } else if (title) {
    input.errors.push(`${input.plan.id}: generated title is not allowed`);
  }
  const anchors = parseAnchors({
    raw: input.raw.explanation_anchors,
    plan: input.plan,
    period: input.period,
    dateWhitelist: input.dateWhitelist,
  });
  const inlineAstroAccent = parseInlineAccent({
    raw: input.raw.inline_astro_accent,
    plan: input.plan,
    errors: input.errors,
  });
  const unsupportedDates = validateDates(
    [
      title,
      text,
      premiumTeaser,
      inlineAstroAccent?.text || '',
    ].join('\n'),
    input.dateWhitelist,
  );
  if (unsupportedDates.length) {
    input.errors.push(`${input.plan.id}: unsupported dates ${unique(unsupportedDates).join(', ')}`);
  }
  const userFacingText = [
    title,
    text,
    premiumTeaser,
    inlineAstroAccent?.text || '',
  ].join('\n');
  if (hasGuaranteedFutureClaim(userFacingText)) {
    input.errors.push(`${input.plan.id}: guaranteed future outcome`);
  }
  if (hasAppVoiceViolation(userFacingText)) {
    input.errors.push(`${input.plan.id}: app voice violation`);
  }
  return {
    id: input.plan.id,
    kind: input.plan.kind,
    status: 'ready',
    diagnosticCode: null,
    fixedKey: input.plan.fixedKey,
    sourceTopicKey: input.plan.sourceTopicKey,
    title: input.plan.staticTitle || title || undefined,
    text,
    importance: input.plan.importance,
    visualTag: input.plan.visualTag,
    premiumTeaser,
    lockedPreview,
    explanationAnchors: anchors,
    inlineAstroAccent,
  };
}

const UNAVAILABLE_SECTION_COPY = {
  ru: {
    text: 'Этот раздел временно недоступен: его текст не прошёл проверку.',
    teaser: 'Раздел появится после успешной проверки текста; остальные выводы периода уже доступны.',
    dynamicTitle: 'Личная тема',
  },
  en: {
    text: 'This section is temporarily unavailable because its text did not pass validation.',
    teaser: 'The section will return after its text passes validation; the other period conclusions remain available.',
    dynamicTitle: 'Personal topic',
  },
} as const;

function sentenceCase(value: string, language: 'ru' | 'en'): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed[0].toLocaleUpperCase(language === 'ru' ? 'ru-RU' : 'en-US')}${trimmed.slice(1)}`;
}

function unavailableForecastSection(
  plan: ForecastSectionPlan,
  language: 'ru' | 'en',
): ForecastSection {
  const copy = UNAVAILABLE_SECTION_COPY[language];
  const focusTitle = sentenceCase(plan.focusLabel, language);
  const dynamicTitle = isSimpleDynamicTitle(focusTitle)
    ? focusTitle
    : copy.dynamicTitle;
  return {
    id: plan.id,
    kind: plan.kind,
    status: 'unavailable',
    diagnosticCode: 'PERSONAL_FORECAST_SECTION_UNAVAILABLE',
    fixedKey: plan.fixedKey,
    sourceTopicKey: plan.sourceTopicKey,
    title: plan.staticTitle || (plan.kind === 'dynamic' ? dynamicTitle : undefined),
    text: copy.text,
    importance: plan.importance,
    visualTag: plan.visualTag,
    premiumTeaser: copy.teaser,
    lockedPreview: buildForecastLockedPreview(copy.text, copy.teaser),
    explanationAnchors: [],
    inlineAstroAccent: null,
  };
}

export function validateGeneratedForecastFeed(input: {
  raw: GeneratedFeedPayload;
  period: PersonalForecastPeriod;
  overviewPlan: ForecastSectionPlan;
  sectionPlans: ForecastSectionPlan[];
  language?: 'ru' | 'en';
  allowPartialFallback?: boolean;
}): {
  overview: ForecastSection | null;
  sections: ForecastSection[];
  errors: string[];
} {
  const errors: string[] = [];
  const structuralErrors: string[] = [];
  const rawSections = Array.isArray(input.raw.sections)
    ? input.raw.sections as GeneratedSectionPayload[]
    : [];
  if (!input.raw.overview || typeof input.raw.overview !== 'object') {
    structuralErrors.push('overview is missing');
  }
  if (!Array.isArray(input.raw.sections)) {
    structuralErrors.push('sections must be an array');
  }
  const expectedIds = input.sectionPlans.map((plan) => plan.id);
  const expectedIdSet = new Set(expectedIds);
  const rawIds = rawSections.map((raw) => (
    raw && typeof raw === 'object' && typeof raw.id === 'string'
      ? raw.id.trim()
      : ''
  ));
  const knownRawIds = rawIds.filter((id) => expectedIdSet.has(id));
  const missingIds = expectedIds.filter((id) => !knownRawIds.includes(id));
  const unknownOrEmptyIds = rawIds.filter((id) => !expectedIdSet.has(id));
  const duplicateIds = knownRawIds.filter(
    (id, index) => knownRawIds.indexOf(id) !== index,
  );
  const oneMissingSection = (
    rawSections.length === input.sectionPlans.length - 1
    && missingIds.length === 1
    && unknownOrEmptyIds.length === 0
    && duplicateIds.length === 0
  );
  if (
    rawSections.length !== input.sectionPlans.length
    && !oneMissingSection
  ) {
    structuralErrors.push('sections count does not match the plan');
  }
  if (unknownOrEmptyIds.length || duplicateIds.length) {
    structuralErrors.push('sections contain unknown or duplicate ids');
  }
  if (
    rawSections.length === input.sectionPlans.length
    && rawIds.some((id, index) => id !== expectedIds[index])
  ) {
    structuralErrors.push('sections order does not match the plan');
  }
  const dateWhitelist = allowedDates([input.overviewPlan, ...input.sectionPlans]);
  const overviewErrors: string[] = [];
  const overview = input.raw.overview && typeof input.raw.overview === 'object'
    ? parseSection({
        raw: input.raw.overview,
        plan: input.overviewPlan,
        period: input.period,
        dateWhitelist,
        errors: overviewErrors,
      })
    : null;
  const rawById = new Map(
    rawSections
      .filter((raw): raw is GeneratedSectionPayload & { id: string } => (
        !!raw
        && typeof raw === 'object'
        && typeof raw.id === 'string'
        && expectedIdSet.has(raw.id.trim())
      ))
      .map((raw) => [raw.id.trim(), raw]),
  );
  const invalidSections: Array<{
    plan: ForecastSectionPlan;
    section: ForecastSection;
    errors: string[];
  }> = [];
  const sections = input.sectionPlans.map((plan) => {
    const sectionErrors: string[] = [];
    const raw = rawById.get(plan.id);
    if (!raw) sectionErrors.push(`${plan.id}: section is missing`);
    const section = parseSection({
      raw: raw || {},
      plan,
      period: input.period,
      dateWhitelist,
      errors: sectionErrors,
    });
    if (sectionErrors.length) {
      invalidSections.push({ plan, section, errors: sectionErrors });
    }
    return section;
  });

  errors.push(...structuralErrors, ...overviewErrors);
  if (
    input.allowPartialFallback
    && !structuralErrors.length
    && !overviewErrors.length
    && invalidSections.length === 1
  ) {
    const invalid = invalidSections[0];
    const index = input.sectionPlans.findIndex((plan) => plan.id === invalid.plan.id);
    sections[index] = unavailableForecastSection(
      invalid.plan,
      input.language || 'en',
    );
  } else {
    errors.push(...invalidSections.flatMap((item) => item.errors));
  }
  if (overview && !errors.length) {
    errors.push(...validateForecastSectionRepetition([overview, ...sections]));
  }
  return { overview, sections, errors };
}

function nextPeriod(period: PersonalForecastPeriod): PersonalForecastPeriod | null {
  if (period === 'day') return 'week';
  if (period === 'week') return 'month';
  if (period === 'month') return 'year';
  return null;
}

export function buildCrossPeriodLinks(input: {
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  sections: ForecastSection[];
  plans: ForecastSectionPlan[];
  continuationEvidence: CalculatedAstroEvidence[];
  language: 'ru' | 'en';
}): CrossPeriodLink[] {
  const targetPeriod = nextPeriod(input.period);
  if (!targetPeriod) return [];
  const byId = new Map(input.plans.map((plan) => [plan.id, plan]));
  const continuation = input.sections
    .map((section) => ({ section, plan: byId.get(section.id) }))
    .filter((item): item is { section: ForecastSection; plan: ForecastSectionPlan } => !!item.plan)
    // Cross-period targets must be stable in the destination feed. Dynamic and
    // astro-accent sections are selected independently for every period, while
    // fixed life sections always retain the same IDs.
    .filter(({ section }) => (
      section.status === 'ready'
      &&
      section.kind === 'fixed'
      && !!section.fixedKey
      && section.fixedKey !== 'wishes'
    ))
    .map(({ section, plan }) => {
      const evidence = input.continuationEvidence.find((item) => {
        const start = item.startsAt || item.exactAt || item.endsAt;
        const end = item.endsAt || item.exactAt;
        const startTime = start ? new Date(start).getTime() : Number.NaN;
        const endTime = end ? new Date(end).getTime() : Number.NaN;
        const continuationTime = Math.max(
          input.window.endsAt.getTime() + 1,
          startTime,
        );
        return (
          item.topicKeys.includes(plan.sourceTopicKey)
          && item.strength >= 62
          && Number.isFinite(continuationTime)
          && Number.isFinite(endTime)
          && continuationTime <= endTime
        );
      });
      if (!evidence) return null;
      const start = evidence.startsAt || evidence.exactAt || evidence.endsAt;
      const continuationAt = new Date(Math.max(
        input.window.endsAt.getTime() + 1,
        new Date(start as string).getTime(),
      )).toISOString();
      return { section, evidence, continuationAt };
    })
    .filter((item): item is {
      section: ForecastSection;
      evidence: CalculatedAstroEvidence;
      continuationAt: string;
    } => !!item)
    .sort((a, b) => b.evidence.strength - a.evidence.strength)
    .slice(0, 2);
  return continuation.map(({ section, continuationAt }, index) => ({
    id: `${input.period}:${section.id}:${targetPeriod}:${index}`,
    fromSectionId: section.id,
    targetPeriod,
    targetSectionId: section.id,
    continuationAt,
    label: input.language === 'ru'
      ? `Продолжение темы — в периоде «${targetPeriod === 'week' ? 'Неделя' : targetPeriod === 'month' ? 'Месяц' : 'Год'}»`
      : `Continue this topic in ${targetPeriod === 'week' ? 'Week' : targetPeriod === 'month' ? 'Month' : 'Year'}`,
  }));
}

async function requestGeneratedFeed(input: {
  language: 'ru' | 'en';
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  chartData: NatalChartData;
  overviewPlan: ForecastSectionPlan;
  sectionPlans: ForecastSectionPlan[];
}): Promise<{ overview: ForecastSection; sections: ForecastSection[] }> {
  if (!openai) throw new Error('OPENAI_CONTENT_NOT_CONFIGURED');
  let repairErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt = buildPersonalForecastFeedPrompt({
      language: input.language,
      period: input.period,
      window: input.window,
      chartData: input.chartData,
      overview: input.overviewPlan,
      sections: input.sectionPlans,
      repairErrors,
    });
    const completion = await openai.chat.completions.create(buildOpenAIChatParams(input.model, {
      messages: [
        { role: 'system', content: getAppSystemVoice(input.language) },
        { role: 'user', content: prompt },
      ],
      maxTokens: 9_000,
      temperature: 0.42,
      jsonMode: true,
    }));
    const content = completion.choices[0]?.message?.content || '{}';
    let raw: GeneratedFeedPayload = {};
    try {
      raw = JSON.parse(content) as GeneratedFeedPayload;
    } catch {
      repairErrors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateGeneratedForecastFeed({
      raw,
      period: input.period,
      overviewPlan: input.overviewPlan,
      sectionPlans: input.sectionPlans,
      language: input.language,
      allowPartialFallback: attempt === 1,
    });
    if (validation.overview && !validation.errors.length) {
      return {
        overview: validation.overview,
        sections: validation.sections,
      };
    }
    repairErrors = validation.errors;
  }
  const error = new Error('PERSONAL_FORECAST_FEED_INVALID') as Error & {
    validationErrors?: string[];
  };
  error.validationErrors = repairErrors;
  throw error;
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  previousForecast?: PersonalForecastPackage | null;
}): Promise<PersonalForecastPackage> {
  const language = input.profile.language === 'en' ? 'en' : 'ru';
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
    previousDynamicKeys: input.previousForecast?.sections
      .filter((section) => section.kind === 'dynamic')
      .map((section) => section.sourceTopicKey)
      .filter((key): key is DynamicForecastTopicKey => (
        typeof key === 'string'
        && key !== 'overview'
        && !FIXED_FORECAST_SECTION_KEYS.includes(key as FixedForecastSectionKey)
      )),
  });
  const plans = buildPersonalForecastSectionPlans({
    calculated,
    period: input.period,
    language,
  });
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    chartData: input.chartData,
    overviewPlan: plans.overview,
    sectionPlans: plans.sections,
  });
  const freeSelection = input.period === 'day'
    ? selectTodayFreeSections({
        sections: generated.sections,
        userId: String(input.profile.id || 'guest'),
        periodKey: input.window.periodKey,
        previousSectionIds: input.previousForecast?.meta.freeSelection.sectionIds,
      })
    : {
        strongestSectionId: null,
        rotatedSectionId: null,
        sectionIds: [],
      };
  const links = buildCrossPeriodLinks({
    period: input.period,
    window: input.window,
    sections: generated.sections,
    plans: plans.sections,
    continuationEvidence: calculated.continuationEvidence,
    language,
  });
  return {
    period: input.period,
    periodKey: input.window.periodKey,
    periodStart: input.window.periodStart,
    periodEnd: input.window.periodEnd,
    dateLabel: formatPersonalForecastDateLabel(input.window, language),
    timezone: input.window.timezone,
    overview: generated.overview,
    sections: generated.sections,
    suggestedCrossPeriodLinks: links,
    evidence: calculated.evidenceViews,
    visual: {
      sectionAssetIds: Object.fromEntries(
        [generated.overview, ...generated.sections].map((section) => [section.id, null]),
      ),
    },
    meta: {
      model: input.model,
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: new Date().toISOString(),
      status: 'ready',
      diagnosticCode: null,
      freeSelection,
    },
  };
}
