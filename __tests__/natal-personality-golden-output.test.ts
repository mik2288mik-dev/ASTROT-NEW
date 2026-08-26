import type { UserProfile } from '../types';
import type {
  NatalAngleKey,
  NatalAngleV2,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../lib/natalChartV2Types';
import {
  buildNatalModelContext,
  buildNatalReaderChapterPlan,
  materializePermanentFreeReport,
  materializePermanentPremiumReport,
  type BuiltNatalModelContext,
  type NatalPermanentFreeReport,
  type NatalPermanentPremiumReport,
  type NatalPersonalityDomain,
  type NatalReportPlanItem,
  type RawNatalFreePayload,
  type RawNatalPremiumPayload,
  type RawNatalSection,
} from '../lib/natalReading/permanentReport';

const BODY_KEYS: NatalBodyKey[] = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'chiron',
  'northNode',
  'southNode',
];

const SIGNS = [
  'Aries',
  'Cancer',
  'Taurus',
  'Gemini',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

const PRIMARY_PROFILE: UserProfile = {
  id: 'golden-owner',
  name: 'Мира',
  birthDate: '1987-02-03',
  birthTime: '04:56',
  birthPlace: 'Москва',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: true,
};

export const SAVED_PERSON_GOLDEN_PROFILE: UserProfile = {
  id: 'golden-owner',
  name: 'Илья',
  birthDate: '1992-11-18',
  birthTime: '21:20',
  birthPlace: 'Казань',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: true,
};

export const EXACT_TIME_GOLDEN_HOOK =
  'Ты быстро замечаешь, где слова расходятся с реальностью, и не делаешь вид, что всё в порядке ради удобного разговора.';

export const UNKNOWN_TIME_GOLDEN_HOOK =
  'Тебе мало красивой формулировки: пока детали не сходятся, согласие не считается окончательным.';

export const SAVED_PERSON_GOLDEN_HOOK =
  'Ты редко споришь ради самого спора: обычно тебе нужно добраться до решения, которое выдержит проверку делом.';

export const NATAL_PERSONALITY_GOLDEN_SECTION_COPY: Record<
  NatalPersonalityDomain,
  { title: string; content: string }
> = {
  base_portrait: {
    title: 'Ты без декораций',
    content: 'Ты быстро находишь суть и не любишь долго ходить вокруг неё. Но твоя решительность устроена сложнее, чем кажется: за первым импульсом идёт строгая проверка, не пришлось ли ради скорости проигнорировать собственную реакцию. Отсюда твой узнаваемый ритм — резко стартовать, на секунду притормозить и уже после этого стоять на решении крепко.',
  },
  first_impression: {
    title: 'Как тебя читают сначала',
    content: 'При знакомстве ты держишься собранно и не выкладываешь всё на стол. Люди обычно видят спокойную уверенность и понятные границы; только позже замечают, сколько быстрых решений уже принято за этой внешней ровностью. Поэтому первое впечатление о тебе часто строже и спокойнее, чем дальнейшее общение.',
  },
  close_relationship: {
    title: 'Когда дистанция исчезает',
    content: 'Когда доверие уже есть, сухая вежливость быстро заканчивается. Ты становишься теплее, внимательнее к мелочам и гораздо прямее говоришь о том, что подходит, а что нет. Близкий человек получает не удобную версию тебя, а честную — временами резкую, зато без двойного дна.',
  },
  thinking: {
    title: 'Как ты принимаешь решение',
    content: 'Ты думаешь через сравнение: что обещали, что получилось и где между ними спряталась ошибка. Абстрактная идея цепляет тебя только тогда, когда из неё можно сделать понятный вывод. Из-за этого ты быстро разбираешь запутанные ситуации, но можешь раздражаться, если собеседник долго объясняет то, что уже ясно по фактам.',
  },
  communication: {
    title: 'Как звучит твоя позиция',
    content: 'В разговоре ты быстро замечаешь слабое место аргумента и можешь сразу нажать именно туда. Объясняешь лучше всего на конкретном примере, без длинной подводки. Когда уверен в выводе, тон становится жёстче, чем ты планировал, и людям приходится отдельно различать точность мысли и давление подачи.',
  },
  emotional_world: {
    title: 'Что происходит внутри',
    content: 'Сильная реакция у тебя редко остаётся бесформенной: ты стараешься понять, что именно задело и что с этим делать. Чувство может прийти раньше объяснения, поэтому снаружи видна пауза, а внутри уже идёт серьёзная работа. Ты не любишь, когда эту паузу принимают за равнодушие.',
  },
  relationships_deep: {
    title: 'Близость без игры в угадайку',
    content: 'В отношениях тебе нужны и живой интерес, и ясные договорённости. Одна только нежность без честного разговора кажется ненадёжной, а одни правила без тепла быстро утомляют. Ты сближаешься по-настоящему, когда можно прямо назвать желание, несогласие и границу, не устраивая из этого спектакль.',
  },
  conflict: {
    title: 'Когда разговор становится жёстким',
    content: 'В споре ты сначала цепляешься за несостыковку и пытаешься вернуть разговор к сути. Если тебя не слышат, аргументы становятся короче, а напор — заметнее. Слабое место здесь не в самом несогласии, а в скорости: ты уже дошёл до вывода, пока другой человек ещё только собирает свою версию.',
  },
  control_freedom_trust: {
    title: 'Свобода, доверие и правила',
    content: 'Чужие правила ты принимаешь не по должности и не из вежливости, а после проверки на смысл. Свобода для тебя не равна беспорядку: свои обещания ты воспринимаешь серьёзно и того же ждёшь в ответ. Контроль начинает раздражать там, где от тебя требуют послушания, но не могут объяснить причину.',
  },
  work_ambition: {
    title: 'Как ты добиваешься результата',
    content: 'В работе ты сильнее всего там, где можно самому увидеть проблему, выбрать способ и довести дело до измеримого результата. Амбиция у тебя практичная: громкое название роли значит меньше, чем реальное влияние на итог. Ты способен долго держать нагрузку, если понимаешь, ради чего она нужна и где проходит финиш.',
  },
  strengths: {
    title: 'Что у тебя получается особенно хорошо',
    content: 'Ты умеешь соединить смелый старт с проверкой деталей. Там, где одни долго сомневаются, а другие бросаются вперёд вслепую, ты можешь сначала обозначить направление, а затем быстро укрепить решение фактами. Особенно хорошо это работает в ситуациях, где нужно одновременно видеть цель и не пропускать слабые места.',
  },
  central_contradictions: {
    title: 'Две силы в одном решении',
    content: 'Ты умеешь быстро выбрать курс, но собственная эмоциональная реакция может потребовать пересмотра. Поэтому решение иногда выглядит как спор с самим собой: нажать сейчас или сначала убедиться, что цена не окажется лишней. Обе стороны сильные; свести всё к одной означало бы описать тебя наполовину.',
  },
  misunderstood: {
    title: 'Что в тебе часто читают неверно',
    content: 'Твою сдержанность могут принять за холодность, а самостоятельность — за нежелание считаться с другими. На деле ты просто не выдаёшь согласие раньше, чем понял собственную позицию. Когда решение принято, ты способен быть очень надёжным; просто путь к этому решению не всегда виден со стороны.',
  },
};

function position(
  key: NatalBodyKey,
  index: number,
  includeHouse: boolean,
): NatalPositionV2 {
  return {
    object: key,
    planet: key,
    key,
    kind: key.endsWith('Node') ? 'lunar_node' : 'planet',
    longitude: (index * 27.125) % 360,
    sign: SIGNS[index % SIGNS.length],
    degree: (index * 7.125) % 30,
    retrograde: false,
    speedLongitude: 0.75,
    house: includeHouse ? (index % 12) + 1 : null,
    source: key === 'southNode' ? 'derived' : 'swisseph',
    reliability: 'exact',
    stable: { sign: true, retrograde: true, house: includeHouse },
  };
}

function angle(key: NatalAngleKey, longitude: number): NatalAngleV2 {
  return {
    key,
    object: key,
    planet: key,
    longitude,
    sign: key === 'ascendant' ? 'Libra' : 'Cancer',
    degree: longitude % 30,
    source: 'swisseph',
    reliability: 'exact',
    stableSign: true,
  };
}

function chartFixture(
  birthTimeQuality: 'exact' | 'unknown',
  subject: UserProfile = PRIMARY_PROFILE,
): NatalChartDataV2 {
  const includeTimeDependentFacts = birthTimeQuality === 'exact';
  const positions = Object.fromEntries(
    BODY_KEYS.map((key, index) => [
      key,
      position(key, index, includeTimeDependentFacts),
    ]),
  ) as Record<NatalBodyKey, NatalPositionV2>;
  const exactAngles: Record<NatalAngleKey, NatalAngleV2> = {
    ascendant: angle('ascendant', 185),
    mc: angle('mc', 95),
    descendant: angle('descendant', 5),
    ic: angle('ic', 275),
  };
  const angles: Record<NatalAngleKey, NatalAngleV2 | null> = includeTimeDependentFacts
    ? exactAngles
    : { ascendant: null, mc: null, descendant: null, ic: null };
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
      id: 'mercury-square-mars',
      type: 'square',
      exactAngle: 90,
      angle: 90,
      angularDistance: 90.7,
      orb: 0.7,
      orbRange: { min: 0.7, max: 0.7 },
      from: 'Mercury',
      to: 'Mars',
      fromKey: 'mercury',
      toKey: 'mars',
      phase: 'separating',
      reliable: true,
      sampleCoverage: 1,
    },
    {
      id: 'venus-trine-mars',
      type: 'trine',
      exactAngle: 120,
      angle: 120,
      angularDistance: 119.5,
      orb: 0.5,
      orbRange: { min: 0.5, max: 0.5 },
      from: 'Venus',
      to: 'Mars',
      fromKey: 'venus',
      toKey: 'mars',
      phase: 'applying',
      reliable: true,
      sampleCoverage: 1,
    },
    {
      id: 'saturn-sextile-jupiter',
      type: 'sextile',
      exactAngle: 60,
      angle: 60,
      angularDistance: 60.4,
      orb: 0.4,
      orbRange: { min: 0.4, max: 0.4 },
      from: 'Saturn',
      to: 'Jupiter',
      fromKey: 'saturn',
      toKey: 'jupiter',
      phase: 'applying',
      reliable: true,
      sampleCoverage: 1,
    },
    ...(includeTimeDependentFacts ? [{
      id: 'sun-trine-ascendant',
      type: 'trine' as const,
      exactAngle: 120,
      angle: 120,
      angularDistance: 119.2,
      orb: 0.8,
      orbRange: { min: 0.8, max: 0.8 },
      from: 'Sun',
      to: 'Ascendant',
      fromKey: 'sun' as const,
      toKey: 'ascendant' as const,
      phase: 'separating' as const,
      reliable: true,
      sampleCoverage: 1,
    }] : []),
  ];
  const houses = includeTimeDependentFacts
    ? Array.from({ length: 12 }, (_, index) => ({
        house: index + 1,
        longitude: index * 30,
        sign: SIGNS[index % SIGNS.length],
        degree: 0,
        reliability: 'exact' as const,
        stableSign: true,
      }))
    : [];

  return {
    schemaVersion: 'natal-chart-data-v2',
    birth: {
      localDate: subject.birthDate,
      localTime: includeTimeDependentFacts ? subject.birthTime : null,
      place: subject.birthPlace,
      latitude: subject === SAVED_PERSON_GOLDEN_PROFILE ? 55.796127 : 55.755813,
      longitude: subject === SAVED_PERSON_GOLDEN_PROFILE ? 49.106405 : 37.617314,
      timezone: 'Europe/Moscow',
      time: {
        mode: birthTimeQuality,
        localTime: includeTimeDependentFacts ? subject.birthTime : null,
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
      },
      interval: {
        mode: birthTimeQuality,
        localDate: subject.birthDate,
        timezone: 'Europe/Moscow',
        localTime: includeTimeDependentFacts ? subject.birthTime : null,
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
        startUtc: '1987-02-03T01:56:00.000Z',
        endUtc: includeTimeDependentFacts
          ? '1987-02-03T01:56:00.000Z'
          : '1987-02-03T23:59:59.999Z',
        referenceUtc: includeTimeDependentFacts ? '1987-02-03T01:56:00.000Z' : null,
        sampleUtc: ['1987-02-03T01:56:00.000Z'],
      },
    },
    positions,
    angles,
    houses,
    aspects,
    chartQuality: {
      birthTimeMode: birthTimeQuality,
      birthTimeQuality,
      exactTime: includeTimeDependentFacts,
      anglesAvailable: includeTimeDependentFacts,
      housesAvailable: includeTimeDependentFacts,
      ascendantReliable: includeTimeDependentFacts,
      housesReliable: includeTimeDependentFacts,
      houseBasedPersonalization: includeTimeDependentFacts,
      stableHousePlacements: includeTimeDependentFacts ? BODY_KEYS : [],
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
      houseSystem: includeTimeDependentFacts ? 'placidus' : null,
      houseFallbackUsed: false,
      housesComputedFrom: includeTimeDependentFacts ? 'exact_time' : 'not_computed',
      aspectRulesVersion: 'aspects-v1',
      calculationVersion: 'natal-personality-golden-v1',
      calculatedAt: '2026-08-13T00:00:00.000Z',
      sampleCount: includeTimeDependentFacts ? 1 : 48,
    },
    calculationVersion: 'natal-personality-golden-v1',
    ...positions,
    rising: angles.ascendant,
    mc: angles.mc,
    latitude: subject === SAVED_PERSON_GOLDEN_PROFILE ? 55.796127 : 55.755813,
    longitude: subject === SAVED_PERSON_GOLDEN_PROFILE ? 49.106405 : 37.617314,
    timezone: 'Europe/Moscow',
    birthTimeQuality,
  };
}

function evidenceForPlan(item: NatalReportPlanItem): string[] {
  if (item.key !== 'central_contradictions') return [...item.evidenceIds];
  return [...new Set([...item.requiredEvidenceIds, ...item.evidenceIds])];
}

function rawSectionsFromPlan(
  built: BuiltNatalModelContext,
  access: NatalReportPlanItem['access'],
): RawNatalSection[] {
  return built.context.reportPlan
    .filter((item) => item.access === access)
    .map((item) => ({
      section_key: item.key,
      title: NATAL_PERSONALITY_GOLDEN_SECTION_COPY[item.key].title,
      free: item.access === 'free',
      content: NATAL_PERSONALITY_GOLDEN_SECTION_COPY[item.key].content,
      evidence_ids: evidenceForPlan(item),
    }));
}

function freePayloadFromPlan(
  built: BuiltNatalModelContext,
  hookText: string,
): RawNatalFreePayload {
  const firstFree = built.context.reportPlan.find((item) => item.access === 'free');
  if (!firstFree) throw new Error('golden fixture requires at least one Free report section');
  return {
    hook: {
      text: hookText,
      evidence_ids: evidenceForPlan(firstFree),
    },
    sections: rawSectionsFromPlan(built, 'free'),
  };
}

function premiumPayloadFromPlan(built: BuiltNatalModelContext): RawNatalPremiumPayload {
  return {
    sections: rawSectionsFromPlan(built, 'premium'),
  };
}

type MaterializedReport = NatalPermanentFreeReport | NatalPermanentPremiumReport;

function everyNestedEvidenceId(report: MaterializedReport): string[] {
  if (report.tier === 'free') {
    return [
      ...report.evidenceIds,
      ...report.hook.evidenceIds,
      ...report.freeSections.flatMap((section) => section.evidenceIds),
      ...(report.shortCard.evidenceIds || []),
    ].filter((id): id is string => typeof id === 'string');
  }
  return [
    ...report.evidenceIds,
    ...report.headlineEvidenceIds,
    ...report.lead.evidenceIds,
    ...report.sections.flatMap((section) => (
      section.paragraphs.flatMap((paragraph) => paragraph.evidenceIds)
    )),
    ...report.strategies.flatMap((strategy) => strategy.evidenceIds),
    ...report.pitfalls.flatMap((pitfall) => pitfall.evidenceIds),
    ...report.conclusion.evidenceIds,
  ];
}

function expectEveryEvidenceIdToExist(
  report: MaterializedReport,
  built: BuiltNatalModelContext,
) {
  const ids = everyNestedEvidenceId(report);
  expect(ids.length).toBeGreaterThan(0);
  for (const id of ids) expect(built.evidenceIds.has(id)).toBe(true);
}

function expectPayloadMatchesPlan(
  sections: RawNatalSection[] | undefined,
  plan: NatalReportPlanItem[],
) {
  expect(sections).toHaveLength(plan.length);
  expect(sections?.map((section) => section.section_key)).toEqual(
    plan.map((item) => item.key),
  );
  sections?.forEach((section, index) => {
    const item = plan[index];
    expect(section.free).toBe(item.access === 'free');
    expect(section.evidence_ids).toEqual(evidenceForPlan(item));
    if (item.key === 'central_contradictions') {
      expect(section.evidence_ids).toEqual(
        expect.arrayContaining(item.requiredEvidenceIds),
      );
    }
  });
}

function expectUsefulCompleteFreeReport(
  report: NatalPermanentFreeReport,
  built: BuiltNatalModelContext,
) {
  const chapters = buildNatalReaderChapterPlan(built.context.reportPlan, 'free', 'ru');
  expect(report.freeSections).toHaveLength(chapters.length);
  for (const chapter of chapters) {
    const expectedContent = chapter.domainKeys
      .map((key) => NATAL_PERSONALITY_GOLDEN_SECTION_COPY[key].content)
      .join('\n\n');
    const materialized = report.freeSections.find((section) => section.title === chapter.title);
    expect(materialized?.content).toBe(expectedContent);
    expect(materialized?.content.length).toBeGreaterThan(150);
  }
  expect(report.freeSections.map((section) => section.content).join('\n').length)
    .toBeGreaterThan(800);
}

const DEEP_PREMIUM_DOMAINS: NatalPersonalityDomain[] = [
  'close_relationship',
  'relationships_deep',
  'conflict',
  'work_ambition',
  'central_contradictions',
];

function expectSupportedPremiumDepth(
  report: NatalPermanentPremiumReport,
  built: BuiltNatalModelContext,
) {
  const supported = new Set(
    built.context.reportPlan
      .filter((item) => item.access === 'premium')
      .map((item) => item.key),
  );
  for (const domain of DEEP_PREMIUM_DOMAINS) {
    expect(supported.has(domain)).toBe(true);
  }
  const chapters = buildNatalReaderChapterPlan(built.context.reportPlan, 'premium', 'ru');
  expect(report.sections.map((section) => section.id)).toEqual(
    chapters.map((chapter) => chapter.key),
  );
  expect(report.sections.map((section) => section.title)).toEqual(
    chapters.map((chapter) => chapter.title),
  );
}

describe('natal personality golden outputs', () => {
  test('exact-time chart materializes complete, useful Free and deep Premium reports', () => {
    const built = buildNatalModelContext(PRIMARY_PROFILE, chartFixture('exact'));
    const freeRaw = freePayloadFromPlan(built, EXACT_TIME_GOLDEN_HOOK);
    const premiumRaw = premiumPayloadFromPlan(built);
    const free = materializePermanentFreeReport({
      raw: freeRaw,
      profile: PRIMARY_PROFILE,
      built,
      requireComplete: true,
    });
    const premium = materializePermanentPremiumReport({
      raw: premiumRaw,
      built,
      requireComplete: true,
    });

    expect(built.context.chart.angles?.ascendant).toBeDefined();
    expect(built.context.chart.houses).toHaveLength(12);
    expect(built.context.reportPlan.map((item) => item.key)).toContain('first_impression');
    expectPayloadMatchesPlan(
      freeRaw.sections,
      built.context.reportPlan.filter((item) => item.access === 'free'),
    );
    expectPayloadMatchesPlan(
      premiumRaw.sections,
      built.context.reportPlan.filter((item) => item.access === 'premium'),
    );
    expect(free).not.toBeNull();
    expect(premium).not.toBeNull();
    expectUsefulCompleteFreeReport(free!, built);
    expectSupportedPremiumDepth(premium!, built);
    expectEveryEvidenceIdToExist(free!, built);
    expectEveryEvidenceIdToExist(premium!, built);
  });

  test('accepts schema-valid section order and renders it in the evidence plan order', () => {
    const built = buildNatalModelContext(PRIMARY_PROFILE, chartFixture('exact'));
    const freeRaw = freePayloadFromPlan(built, EXACT_TIME_GOLDEN_HOOK);
    const premiumRaw = premiumPayloadFromPlan(built);
    freeRaw.sections = [...(freeRaw.sections || [])].reverse();
    premiumRaw.sections = [...(premiumRaw.sections || [])].reverse();

    const free = materializePermanentFreeReport({
      raw: freeRaw,
      profile: PRIMARY_PROFILE,
      built,
      requireComplete: true,
    });
    const premium = materializePermanentPremiumReport({
      raw: premiumRaw,
      built,
      requireComplete: true,
    });

    expect(free?.freeSections.map((section) => section.title)).toEqual(
      buildNatalReaderChapterPlan(built.context.reportPlan, 'free', 'ru')
        .map((chapter) => chapter.title),
    );
    expect(premium?.sections.map((section) => section.id)).toEqual(
      buildNatalReaderChapterPlan(built.context.reportPlan, 'premium', 'ru')
        .map((chapter) => chapter.key),
    );
  });

  test('unknown-time chart stays complete without first impression, angles, or houses', () => {
    const built = buildNatalModelContext(PRIMARY_PROFILE, chartFixture('unknown'));
    const freeRaw = freePayloadFromPlan(built, UNKNOWN_TIME_GOLDEN_HOOK);
    const premiumRaw = premiumPayloadFromPlan(built);
    const free = materializePermanentFreeReport({
      raw: freeRaw,
      profile: PRIMARY_PROFILE,
      built,
      requireComplete: true,
    });
    const premium = materializePermanentPremiumReport({
      raw: premiumRaw,
      built,
      requireComplete: true,
    });

    expect(built.context.chart.angles).toBeUndefined();
    expect(built.context.chart.houses).toBeUndefined();
    expect(built.context.reportPlan.map((item) => item.key)).not.toContain('first_impression');
    expect(freeRaw.sections?.map((section) => section.section_key))
      .not.toContain('first_impression');
    expect(free).not.toBeNull();
    expect(premium).not.toBeNull();
    expect(free?.birthData.birthTime).toBeNull();
    expectUsefulCompleteFreeReport(free!, built);
    expectSupportedPremiumDepth(premium!, built);
    expectEveryEvidenceIdToExist(free!, built);
    expectEveryEvidenceIdToExist(premium!, built);
  });

  test('saved-person report uses the selected person profile and calculated chart', () => {
    const savedChart = chartFixture('exact', SAVED_PERSON_GOLDEN_PROFILE);
    const built = buildNatalModelContext(SAVED_PERSON_GOLDEN_PROFILE, savedChart);
    const freeRaw = freePayloadFromPlan(built, SAVED_PERSON_GOLDEN_HOOK);
    const premiumRaw = premiumPayloadFromPlan(built);
    const free = materializePermanentFreeReport({
      raw: freeRaw,
      profile: SAVED_PERSON_GOLDEN_PROFILE,
      built,
      requireComplete: true,
    });
    const premium = materializePermanentPremiumReport({
      raw: premiumRaw,
      built,
      requireComplete: true,
    });

    expect(free).not.toBeNull();
    expect(premium).not.toBeNull();
    expect(free?.userName).toBe(SAVED_PERSON_GOLDEN_PROFILE.name);
    expect(free?.birthData).toEqual({
      birthDate: SAVED_PERSON_GOLDEN_PROFILE.birthDate,
      birthTime: SAVED_PERSON_GOLDEN_PROFILE.birthTime,
      birthPlace: SAVED_PERSON_GOLDEN_PROFILE.birthPlace,
    });
    expect(free?.userName).not.toBe(PRIMARY_PROFILE.name);
    expect(free?.birthData.birthDate).not.toBe(PRIMARY_PROFILE.birthDate);
    expectUsefulCompleteFreeReport(free!, built);
    expectSupportedPremiumDepth(premium!, built);
    expectEveryEvidenceIdToExist(free!, built);
    expectEveryEvidenceIdToExist(premium!, built);
  });
});
