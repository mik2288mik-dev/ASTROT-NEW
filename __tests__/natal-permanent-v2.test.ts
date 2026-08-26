import { readFileSync } from 'fs';
import { join } from 'path';
import type { UserProfile } from '../types';
import type {
  NatalAngleV2,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../lib/natalChartV2Types';
import {
  buildNatalModelContext,
  buildNatalReaderChapterPlan,
  buildNatalReportScopeKey,
  buildPermanentNatalCacheKey,
  buildPermanentFreeFallback,
  buildPermanentNatalInputHash,
  materializePermanentFreeReport,
  materializePermanentPremiumReport,
  NATAL_PERMANENT_FREE_PROMPT_VERSION,
  NATAL_PERMANENT_FREE_CACHE_KEY,
  type RawNatalFreePayload,
  type RawNatalPremiumPayload,
} from '../lib/natalReading/permanentReport';
import { buildPermanentNatalPremiumPrompt } from '../lib/natalReading/permanentGeneration';
import {
  buildNatalQuestionPrompt,
  buildNatalQuestionPromptContext,
  validateNatalQuestionAnswer,
} from '../lib/natalReading/natalQuestion';
import type { NatalQuestionStoredMessage } from '../lib/natalReading/natalQuestionStore';

const BODY_KEYS: NatalBodyKey[] = [
  'sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn',
  'uranus', 'neptune', 'pluto', 'chiron', 'northNode', 'southNode',
];

function position(key: NatalBodyKey, index: number): NatalPositionV2 {
  return {
    object: key,
    planet: key,
    key,
    kind: key.endsWith('Node') ? 'lunar_node' : 'planet',
    longitude: index * 23.5,
    sign: ['Aries', 'Taurus', 'Gemini', 'Cancer'][index % 4],
    degree: (index * 7.25) % 30,
    retrograde: index % 3 === 0,
    speedLongitude: index % 3 === 0 ? -0.2 : 0.8,
    house: (index % 12) + 1,
    source: key === 'southNode' ? 'derived' : 'swisseph',
    reliability: 'exact',
    stable: { sign: true, retrograde: true, house: true },
  };
}

function angle(key: 'ascendant' | 'mc' | 'descendant' | 'ic', degree: number): NatalAngleV2 {
  return {
    key,
    object: key,
    planet: key,
    longitude: degree,
    sign: 'Libra',
    degree: degree % 30,
    source: 'swisseph',
    reliability: 'exact',
    stableSign: true,
  };
}

function chart(quality: 'exact' | 'unknown' = 'exact'): NatalChartDataV2 {
  const positions = Object.fromEntries(
    BODY_KEYS.map((key, index) => [key, position(key, index)]),
  ) as Record<NatalBodyKey, NatalPositionV2>;
  const angles = {
    ascendant: angle('ascendant', 185),
    mc: angle('mc', 95),
    descendant: angle('descendant', 5),
    ic: angle('ic', 275),
  };
  const aspects: NatalAspectV2[] = [
    {
      id: 'sun-square-moon',
      type: 'square',
      exactAngle: 90,
      angle: 90,
      angularDistance: 89.4,
      orb: 0.6,
      orbRange: { min: 0.6, max: 0.6 },
      from: 'Sun',
      to: 'Moon',
      fromKey: 'sun',
      toKey: 'moon',
      phase: 'applying',
      reliable: true,
      sampleCoverage: 1,
    },
    {
      id: 'sun-trine-ascendant',
      type: 'trine',
      exactAngle: 120,
      angle: 120,
      angularDistance: 119,
      orb: 1,
      orbRange: { min: 1, max: 1 },
      from: 'Sun',
      to: 'Ascendant',
      fromKey: 'sun',
      toKey: 'ascendant',
      phase: 'separating',
      reliable: true,
      sampleCoverage: 1,
    },
    {
      id: 'sun-sextile-venus-unreliable',
      type: 'sextile',
      exactAngle: 60,
      angle: 60,
      angularDistance: 58.9,
      orb: 1.1,
      orbRange: { min: 1.1, max: 1.1 },
      from: 'Sun',
      to: 'Venus',
      fromKey: 'sun',
      toKey: 'venus',
      phase: 'applying',
      reliable: false,
      sampleCoverage: 0.4,
    },
  ];
  const houses = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    longitude: index * 30,
    sign: ['Aries', 'Taurus', 'Gemini', 'Cancer'][index % 4],
    degree: 0,
    reliability: 'exact' as const,
    stableSign: true,
  }));
  return {
    schemaVersion: 'natal-chart-data-v2',
    birth: {
      localDate: '1990-04-12',
      localTime: '12:00',
      place: 'Moscow',
      latitude: 55.75,
      longitude: 37.61,
      timezone: 'Europe/Moscow',
      time: {
        mode: quality,
        localTime: quality === 'unknown' ? null : '12:00',
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
      },
      interval: {
        mode: quality,
        localDate: '1990-04-12',
        timezone: 'Europe/Moscow',
        localTime: quality === 'unknown' ? null : '12:00',
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
        startUtc: '1990-04-12T09:00:00.000Z',
        endUtc: '1990-04-12T09:00:00.000Z',
        referenceUtc: quality === 'unknown' ? null : '1990-04-12T09:00:00.000Z',
        sampleUtc: ['1990-04-12T09:00:00.000Z'],
      },
    },
    positions,
    angles,
    houses,
    aspects,
    chartQuality: {
      birthTimeMode: quality,
      birthTimeQuality: quality,
      exactTime: quality === 'exact',
      anglesAvailable: true,
      housesAvailable: true,
      ascendantReliable: quality === 'exact',
      housesReliable: quality === 'exact',
      houseBasedPersonalization: quality === 'exact',
      stableHousePlacements: BODY_KEYS,
      variableBodies: [],
      variableAngles: [],
      variableHouses: [],
      variableAspectIds: [],
      notes: [],
    },
    calculationMetadata: {
      ephemerisEngine: 'Swiss Ephemeris',
      ephemerisMode: 'swisseph',
      ephemerisLibraryVersion: '2.10',
      zodiac: 'tropical',
      coordinateCenter: 'geocentric',
      houseSystem: 'placidus',
      houseFallbackUsed: false,
      housesComputedFrom: quality === 'exact' ? 'exact_time' : 'not_computed',
      aspectRulesVersion: 'aspects-v1',
      calculationVersion: 'natal-v2-test',
      calculatedAt: '2026-01-01T00:00:00.000Z',
      sampleCount: 1,
    },
    calculationVersion: 'natal-v2-test',
    ...positions,
    rising: angles.ascendant,
    mc: angles.mc,
    latitude: 55.75,
    longitude: 37.61,
    timezone: 'Europe/Moscow',
    birthTimeQuality: quality,
  };
}

const profile: UserProfile = {
  id: '7',
  name: 'Mira',
  birthDate: '1990-04-12',
  birthTime: '12:00',
  birthPlace: 'Moscow',
  isSetup: true,
  language: 'en',
  theme: 'light',
  isPremium: true,
};

function freePayload(evidenceIds: string[], _includeAscendant: boolean): RawNatalFreePayload {
  const pick = (wanted: string, fallbackIndex: number) => (
    evidenceIds.includes(wanted) ? wanted : evidenceIds[fallbackIndex % evidenceIds.length]
  );
  return {
    hook: {
      text: 'You move once the exact point is visible, and you rarely accept a vague agreement just to end the conversation.',
      evidence_ids: [pick('natal.position.sun', 0)],
    },
    sections: [
      {
        section_key: 'base_portrait',
        title: 'Who you are',
        free: true,
        content: 'You act decisively after you have found the exact point that matters, but you still check whether the result can survive contact with the details.',
        evidence_ids: [pick('natal.position.sun', 0), pick('natal.position.moon', 1)],
      },
      {
        section_key: 'thinking',
        title: 'How you think and speak',
        free: true,
        content: 'Your mind turns a complicated thought into a practical decision, especially when other people are still debating the shape of the problem.',
        evidence_ids: [pick('natal.position.mercury', 2), pick('natal.position.sun', 0)],
      },
      {
        section_key: 'communication',
        title: 'How you explain yourself',
        free: true,
        content: 'You notice what makes an explanation precise without hiding the difficult detail, and your tone gets firmer when the facts are being blurred.',
        evidence_ids: [pick('natal.position.mercury', 2), pick('natal.position.mars', 4)],
      },
      {
        section_key: 'emotional_world',
        title: 'How feelings move',
        free: true,
        content: 'Part of you pushes ahead while another part checks the emotional cost, so a quick decision can be followed by a serious internal review.',
        evidence_ids: [pick('natal.position.moon', 1), pick('natal.position.venus', 3)],
      },
    ],
  };
}

function premiumPayload(evidenceIds: string[]): RawNatalPremiumPayload {
  const pick = (wanted: string, fallbackIndex: number) => (
    evidenceIds.includes(wanted) ? wanted : evidenceIds[fallbackIndex % evidenceIds.length]
  );
  const definitions = [
    ['close_relationship', 'When someone gets close'],
    ['relationships_deep', 'Relationships'],
    ['conflict', 'Conflict'],
    ['control_freedom_trust', 'Control and trust'],
    ['work_ambition', 'Work and ambition'],
    ['misunderstood', 'What others miss'],
  ] as const;
  const evidenceBySection: Record<string, string[]> = {
    close_relationship: [pick('natal.position.moon', 1), pick('natal.position.venus', 3)],
    relationships_deep: [pick('natal.position.venus', 3), pick('natal.position.mars', 4)],
    conflict: [pick('natal.position.mars', 4), pick('natal.position.mercury', 2)],
    control_freedom_trust: [pick('natal.position.saturn', 6), pick('natal.position.uranus', 7)],
    work_ambition: [pick('natal.position.mars', 4), pick('natal.position.saturn', 6)],
    misunderstood: [pick('natal.position.uranus', 7), pick('natal.position.neptune', 8)],
  };
  return {
    sections: definitions.map(([sectionKey, title], index) => ({
      section_key: sectionKey,
      title,
      free: false,
      content: `This is a concrete permanent observation number ${index + 1} about choices and reactions, grounded in the way two strong tendencies operate together.`,
      evidence_ids: evidenceBySection[sectionKey] || [evidenceIds[index]],
    })),
  };
}

function premiumPayloadForPlan(
  built: ReturnType<typeof buildNatalModelContext>,
): RawNatalPremiumPayload {
  return {
    sections: built.context.reportPlan
      .filter((item) => item.access === 'premium')
      .map((item, index) => ({
        section_key: item.key,
        title: `Permanent section ${index + 1}`,
        free: false,
        content: `This is a concrete permanent observation number ${index + 1} about choices and reactions, grounded in the way the supplied tendencies operate together.`,
        evidence_ids: item.requiredEvidenceIds.length
          ? item.requiredEvidenceIds
          : item.evidenceIds,
      })),
  };
}

describe('permanent natal V2 contract', () => {
  test('unknown birth time removes stored time and every time-dependent structure', () => {
    const built = buildNatalModelContext(profile, chart('unknown'));
    expect(built.context.subject.birthData.time).toBeNull();
    expect(built.context.chart.angles).toBeUndefined();
    expect(built.context.chart.houses).toBeUndefined();
    expect(built.context.chart.aspects).toHaveLength(1);
    expect(built.context.chart.aspects[0].id).toBe('sun-square-moon');
    expect([...built.evidenceIds].some((id) => id.startsWith('natal.angle.'))).toBe(false);
    expect([...built.evidenceIds].some((id) => id.startsWith('natal.house.'))).toBe(false);
    const placementIds = [...built.evidenceIds].filter((id) => id.startsWith('natal.position.'));
    const report = materializePermanentFreeReport({
      raw: freePayload(placementIds, false),
      profile,
      built,
    });
    expect(report?.birthData.birthTime).toBeNull();
    expect(buildPermanentFreeFallback(profile, chart('unknown')).birthData.birthTime).toBeNull();
  });

  test('approximate time includes only individually stable houses and angles', () => {
    const approximate = chart('exact');
    approximate.birth.time.mode = 'approximate';
    approximate.birth.interval.mode = 'approximate';
    approximate.birthTimeQuality = 'approximate';
    approximate.chartQuality.birthTimeMode = 'approximate';
    approximate.chartQuality.birthTimeQuality = 'approximate';
    approximate.chartQuality.exactTime = false;
    approximate.positions.moon.stable.house = false;
    approximate.chartQuality.stableHousePlacements = BODY_KEYS.filter((key) => key !== 'moon');
    approximate.angles.mc!.reliability = 'variable_in_range';
    approximate.angles.mc!.stableSign = false;
    approximate.angles.descendant!.reliability = 'variable_in_range';
    approximate.angles.descendant!.stableSign = false;
    approximate.houses[4].reliability = 'variable_in_range';
    approximate.houses[4].stableSign = false;
    approximate.chartQuality.variableAngles = ['mc', 'descendant'];
    approximate.chartQuality.variableHouses = [5];
    approximate.aspects.push({
      ...approximate.aspects[1],
      id: 'sun-trine-dsc-alias',
      to: 'DSC',
      toKey: 'descendant',
    });

    const built = buildNatalModelContext(profile, approximate);
    expect(built.context.chart.positions.sun.house).toBe(1);
    expect(built.context.chart.positions.moon).not.toHaveProperty('house');
    expect(built.context.chart.angles?.ascendant).toBeDefined();
    expect(built.context.chart.angles?.mc).toBeUndefined();
    expect(built.context.chart.angles?.descendant).toBeUndefined();
    expect(built.context.chart.houses?.some((house) => house.house === 5)).toBe(false);
    expect(built.context.chart.aspects.some((aspect) => aspect.id === 'sun-trine-dsc-alias')).toBe(false);
  });

  test('validates Free and cohesive Premium only against existing evidence IDs', () => {
    const exact = buildNatalModelContext(profile, chart('exact'));
    expect(exact.context.chart.aspects.map((aspect) => aspect.id)).toEqual([
      'sun-square-moon',
      'sun-trine-ascendant',
    ]);
    const ids = [...exact.evidenceIds].filter((id) => id.startsWith('natal.position.'));
    const ascendant = [...exact.evidenceIds].find((id) => id === 'natal.angle.ascendant')!;
    const free = materializePermanentFreeReport({
      raw: freePayload([...ids.slice(0, 5), ascendant], true),
      profile,
      built: exact,
    });
    expect(free?.schemaVersion).toBe('natal-permanent-free-v3');
    expect(free?.freeSections.map((section) => section.key)).toEqual([
      'base_portrait', 'thinking', 'communication',
    ]);
    const premium = materializePermanentPremiumReport({
      raw: premiumPayloadForPlan(exact),
      built: exact,
    });
    expect(premium?.sections).toHaveLength(
      buildNatalReaderChapterPlan(exact.context.reportPlan, 'premium', 'en').length,
    );
    expect(premium?.sections.map((section) => section.title)).toEqual(
      buildNatalReaderChapterPlan(exact.context.reportPlan, 'premium', 'en')
        .map((chapter) => chapter.title),
    );
    expect(premium?.strategies).toHaveLength(0);

    const unknown = buildNatalModelContext(profile, chart('unknown'));
    const unknownFreeWithAngle = freePayload([...ids.slice(0, 5), ascendant], true);
    if (!unknownFreeWithAngle.sections?.[0]) throw new Error('fixture section missing');
    unknownFreeWithAngle.sections[0].evidence_ids = [ascendant];
    expect(materializePermanentFreeReport({
      raw: unknownFreeWithAngle,
      profile,
      built: unknown,
    })).toBeNull();
    expect(materializePermanentPremiumReport({
      raw: {
        sections: premiumPayload([...unknown.evidenceIds]).sections?.map((section, index) => (
          index === 0 ? { ...section, evidence_ids: ['missing'] } : section
        )),
      },
      built: unknown,
    })).toBeNull();
  });

  test('cache identity ignores wall-clock and calculation timestamp but includes chart scope', () => {
    const first = chart('exact');
    const second = chart('exact');
    second.calculationMetadata.calculatedAt = '2031-12-31T23:59:59.000Z';
    const a = buildPermanentNatalInputHash({
      profile,
      chartData: first,
      tier: 'free',
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    });
    const b = buildPermanentNatalInputHash({
      profile,
      chartData: second,
      tier: 'free',
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    });
    expect(a).toBe(b);
    expect(buildPermanentNatalInputHash({
      profile: { ...profile, language: 'ru' },
      chartData: second,
      tier: 'free',
      promptVersion: NATAL_PERMANENT_FREE_PROMPT_VERSION,
    })).not.toBe(b);
    expect(buildNatalReportScopeKey('7', 101)).not.toBe(buildNatalReportScopeKey('7', 102));
    expect(buildNatalReportScopeKey('7', 101, 'ru')).not.toBe(buildNatalReportScopeKey('7', 101, 'en'));
    expect(buildPermanentNatalCacheKey(NATAL_PERMANENT_FREE_CACHE_KEY, 'ru'))
      .not.toBe(buildPermanentNatalCacheKey(NATAL_PERMANENT_FREE_CACHE_KEY, 'en'));

    const freeApi = readFileSync(join(
      process.cwd(), 'pages', 'api', 'content', 'natal', 'human-base.ts',
    ), 'utf8');
    const premiumApi = readFileSync(join(
      process.cwd(), 'lib', 'natalReading', 'permanentApi.ts',
    ), 'utf8');
    expect(freeApi).toContain('generatePermanentFreeWithLock({ userId, ctx })');
    expect(premiumApi).toContain('buildPermanentNatalCacheKey(NATAL_PERMANENT_FREE_CACHE_KEY, language)');
    expect(premiumApi).toContain('buildPermanentNatalCacheKey(NATAL_PERMANENT_PREMIUM_CACHE_KEY, language)');
    expect(premiumApi).toContain('cacheKey: cacheOptions.cacheKey');
    expect(premiumApi).toContain('readerAnchor,');
  });

  test('Premium task prompt has no changing-period inputs or prewritten interpretations', () => {
    const built = buildNatalModelContext(profile, {
      ...chart('exact'),
      summary: 'This legacy prewritten interpretation must not be sent.',
      keywords: { love: 'legacy', career: 'legacy', karma: 'legacy' },
    });
    const anchor = materializePermanentFreeReport({
      raw: freePayload([...built.evidenceIds], true),
      profile,
      built,
    });
    expect(anchor).not.toBeNull();
    const prompt = buildPermanentNatalPremiumPrompt('en', built, anchor!).toLocaleLowerCase();
    expect(prompt).toContain('no current transits, calendar dates, future events, or timing');
    expect(prompt).toContain('reader anchor');
    expect(prompt).toContain(anchor!.hook.text.toLocaleLowerCase());
    expect(prompt).not.toMatch(/\b(?:30|90)\s*(?:day|days|дн(?:я|ей))\b/u);
    expect(prompt).not.toContain('legacy prewritten interpretation');
    expect(prompt).not.toContain('"summary"');
    expect(prompt).not.toContain('"keywords"');
    expect(prompt).not.toMatch(/"title"\s*:/u);
    expect(prompt).toContain('"chapter_title"');
  });

  test('rejects dated or relative-time material before a permanent Premium report can be cached', () => {
    const built = buildNatalModelContext(profile, chart('exact'));
    const ids = [...built.evidenceIds];
    const relative = premiumPayload(ids);
    if (!relative.sections?.[0]) throw new Error('fixture section missing');
    relative.sections[0].content = 'In 30 days this placement will deliver a decisive event.';
    expect(materializePermanentPremiumReport({ raw: relative, built })).toBeNull();

    const dated = premiumPayload(ids);
    if (!dated.sections?.[0]) throw new Error('fixture section missing');
    dated.sections[0].title = 'Your decisive turn in 2031';
    expect(materializePermanentPremiumReport({ raw: dated, built })).toBeNull();

    const monthPromise = premiumPayload(ids);
    if (!monthPromise.sections?.[0]) throw new Error('fixture section missing');
    monthPromise.sections[0].content = 'You will meet the person who changes everything in March.';
    expect(materializePermanentPremiumReport({ raw: monthPromise, built })).toBeNull();

    const russianTiming = premiumPayload(ids);
    if (!russianTiming.sections?.[0]) throw new Error('fixture section missing');
    russianTiming.sections[0].content = 'Через 30 дней карта гарантирует тебе важное событие.';
    expect(materializePermanentPremiumReport({ raw: russianTiming, built })).toBeNull();

    const unknown = buildNatalModelContext(profile, chart('unknown'));
    const placementIds = [...unknown.evidenceIds].filter((id) => id.startsWith('natal.position.'));
    const mentionsAngle = freePayload(placementIds, false);
    if (!mentionsAngle.sections?.[0]) throw new Error('fixture section missing');
    mentionsAngle.sections[0].content = 'Твой Асцендент якобы определяет первое впечатление, хотя время рождения неизвестно.';
    expect(materializePermanentFreeReport({ raw: mentionsAngle, profile, built: unknown })).toBeNull();

    const angleHeadline = freePayload(placementIds, false);
    if (!angleHeadline.sections?.[0]) throw new Error('fixture section missing');
    angleHeadline.sections[0].title = 'Rising sign sets the tone';
    expect(materializePermanentFreeReport({ raw: angleHeadline, profile, built: unknown })).toBeNull();

    const houseSectionTitle = premiumPayload([...unknown.evidenceIds]);
    if (!houseSectionTitle.sections?.[0]) throw new Error('fixture section missing');
    houseSectionTitle.sections[0].title = 'The 10th house decides';
    expect(materializePermanentPremiumReport({ raw: houseSectionTitle, built: unknown })).toBeNull();

    const angleGrowthTitle = premiumPayload([...unknown.evidenceIds]);
    if (!angleGrowthTitle.sections?.[5]) throw new Error('fixture section missing');
    angleGrowthTitle.sections[5].title = 'Follow the Ascendant';
    expect(materializePermanentPremiumReport({ raw: angleGrowthTitle, built: unknown })).toBeNull();
  });

  test('rejects diagnoses, professional imperatives, and guaranteed outcomes in natal answers', () => {
    const allowed = new Set(['natal.position.sun']);
    const raw = (answer: string) => ({ answer, evidence_ids: ['natal.position.sun'] });
    expect(validateNatalQuestionAnswer(raw(
      'You have a diagnosed anxiety disorder. The chart proves this fact. You should accept that label.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Start taking medication immediately. This placement explains your strain. Follow that instruction now.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Invest in this opportunity now. Your placement supports the choice. The guaranteed return will make you rich.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'У тебя диагностировано тревожное расстройство. Карта якобы подтверждает этот диагноз. Считай это точным фактом.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Начни принимать лекарства немедленно. Положение якобы требует этого решения. Не обсуждай его со специалистом.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Доход обязательно случится. Карта якобы обещает точный результат. Риска в этом решении нет.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'В прошлой жизни ты уже сделал этот выбор. Карта якобы доказывает этот кармический факт. Поэтому сомнений быть не может.',
    ), allowed)).toBeNull();
  });

  test('rejects mystical, coaching, and visible technical copy in natal answers', () => {
    const allowed = new Set(['natal.position.sun']);
    const raw = (answer: string) => ({ answer, evidence_ids: ['natal.position.sun'] });

    expect(validateNatalQuestionAnswer(raw(
      'The stars say you have the right answer. The universe invites you to trust it. Your unique energy makes this certain.',
    ), allowed)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Mars makes you answer before others finish. That placement speeds every disagreement. It decides how you defend a point.',
    ), allowed)).toBeNull();
  });

  test('cannot ground a question answer in a variable-in-range placement', () => {
    const variableMoon = chart('unknown');
    variableMoon.positions.moon.reliability = 'variable_in_range';
    variableMoon.positions.moon.stable.sign = false;
    variableMoon.positions.moon.stable.retrograde = false;
    variableMoon.chartQuality.variableBodies = ['moon'];
    const built = buildNatalModelContext(profile, variableMoon);

    expect(validateNatalQuestionAnswer({
      answer: 'You pause before naming a reaction. The first feeling is not always the final one. You prefer to check it before speaking.',
      evidence_ids: ['natal.position.moon'],
    }, built.evidenceIds, built)).toBeNull();

    const context = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: variableMoon,
      permanentReport: materializePermanentPremiumReport({
        raw: premiumPayloadForPlan(built),
        built,
      })!,
      history: [],
      question: 'How do I react?',
    }).context;
    expect(context.chart.evidence.some((fact) => fact.id === 'natal.position.moon')).toBe(false);
    expect(context.chart.chart.positions).not.toHaveProperty('moon');
  });

  test('question prompt keeps astrology terminology out of the visible answer', () => {
    const built = buildNatalModelContext(profile, chart('exact'));
    const context = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: chart('exact'),
      permanentReport: materializePermanentPremiumReport({
        raw: premiumPayloadForPlan(built),
        built,
      })!,
      history: [],
      question: 'How do I argue?',
    }).context;
    const prompt = buildNatalQuestionPrompt('en', context);

    expect(prompt).toContain('Translate those factors into ordinary human language');
    expect(prompt).toContain('keep technical facts only in evidence_ids');
  });

  test('rejects future timing and unreliable structures in natal answers but accepts a timing refusal', () => {
    const exact = buildNatalModelContext(profile, chart('exact'));
    const unknown = buildNatalModelContext(profile, chart('unknown'));
    const id = 'natal.position.sun';
    const raw = (answer: string) => ({ answer, evidence_ids: [id] });

    expect(validateNatalQuestionAnswer(raw(
      'This will happen next month. The chart confirms the date. You should prepare for that outcome.',
    ), exact.evidenceIds, exact)).toBeNull();
    expect(validateNatalQuestionAnswer(raw(
      'Your Ascendant controls this response. It shapes every first impression. That is the decisive factor here.',
    ), unknown.evidenceIds, unknown)).toBeNull();

    expect(validateNatalQuestionAnswer(raw(
      'The natal chart cannot tell you whether this happens next week or provide a date. It can only describe the recurring response behind the question. Use that pattern as context, not as a calendar promise.',
    ), exact.evidenceIds, exact)).not.toBeNull();
  });

  test('permanent natal endpoints reject methods outside GET and POST before context lookup', () => {
    for (const file of ['human-base.ts', 'human-premium.ts']) {
      const source = readFileSync(join(
        process.cwd(),
        'pages',
        'api',
        'content',
        'natal',
        file,
      ), 'utf8');
      const guardAt = source.indexOf("req.method !== 'GET' && req.method !== 'POST'");
      const contextAt = source.indexOf('ensureValidContext(req, res');
      expect(guardAt).toBeGreaterThanOrEqual(0);
      expect(contextAt).toBeGreaterThan(guardAt);
      expect(source).toContain("status(405).json({ error: 'METHOD_NOT_ALLOWED' })");
    }
  });

  test('question context contains the full sanitized chart and only the last eight pairs for this chart', () => {
    const built = buildNatalModelContext(profile, chart('exact'));
    const premium = materializePermanentPremiumReport({
      raw: premiumPayloadForPlan(built),
      built,
    })!;
    const messages: NatalQuestionStoredMessage[] = Array.from({ length: 10 }, (_, index) => {
      const questionId = index * 2 + 1;
      return [
        {
          id: questionId,
          threadId: 1,
          userId: '7',
          chartId: 101,
          role: 'user' as const,
          text: `question ${index + 1}`,
          payload: null,
          createdAt: new Date(2026, 0, questionId).toISOString(),
        },
        {
          id: questionId + 1,
          threadId: 1,
          userId: '7',
          chartId: 101,
          role: 'assistant' as const,
          text: `answer ${index + 1}`,
          payload: { questionMessageId: questionId, evidenceIds: ['natal.position.sun'] },
          createdAt: new Date(2026, 0, questionId + 1).toISOString(),
        },
      ];
    }).flat();
    messages.push(
      {
        id: 30,
        threadId: 1,
        userId: '7',
        chartId: 101,
        role: 'user',
        text: 'incomplete question',
        payload: null,
        createdAt: new Date(2026, 1, 1).toISOString(),
      },
      {
        id: 31,
        threadId: 2,
        userId: '7',
        chartId: 202,
        role: 'user',
        text: 'foreign question',
        payload: null,
        createdAt: new Date(2026, 1, 2).toISOString(),
      },
      {
        id: 32,
        threadId: 2,
        userId: '7',
        chartId: 202,
        role: 'assistant',
        text: 'foreign answer',
        payload: { questionMessageId: 31, evidenceIds: ['natal.position.sun'] },
        createdAt: new Date(2026, 1, 3).toISOString(),
      },
    );
    const context = buildNatalQuestionPromptContext({
      chartId: 101,
      profile,
      chartData: chart('exact'),
      permanentReport: premium,
      history: messages,
      question: 'How do I make decisions?',
    }).context;
    expect(Object.keys(context.chart.chart.positions)).toHaveLength(BODY_KEYS.length);
    expect(context.permanentReport).toBe(premium);
    expect(context.recentMessages).toHaveLength(16);
    expect(context.recentMessages[0].text).toBe('question 3');
    expect(context.recentMessages.at(-1)?.text).toBe('answer 10');
    expect(context.recentMessages.some((message) => message.text.includes('incomplete'))).toBe(false);
    expect(context.recentMessages.some((message) => message.text.includes('foreign'))).toBe(false);

    const store = readFileSync(join(
      process.cwd(),
      'lib',
      'natalReading',
      'natalQuestionStore.ts',
    ), 'utf8');
    expect(store).toContain('WITH recent_pairs AS');
    expect(store).toContain("candidate.content_payload ->> 'questionMessageId' = question.id::text");
    expect(store).toContain('[input.userId, input.chartId, NATAL_QUESTION_THREAD_KIND, pairLimit]');
  });

  test('shares question quota by the primary chart timezone even while reading a saved person', () => {
    const endpoint = readFileSync(join(
      process.cwd(),
      'pages',
      'api',
      'content',
      'natal',
      'questions.ts',
    ), 'utf8');
    expect(endpoint).toMatch(/resolveReadingContext\(\s*userId,\s*null,[\s\S]*?\{ repairCanonical: false \}/u);
    expect(endpoint).toContain('primaryContext?.profile.birthTimezone');
    expect(endpoint).toContain("getPersonalForecastPeriodKey('day', new Date(), quotaTimezone)");
    expect(endpoint).toContain('timezone: quotaTimezone');
  });
});
