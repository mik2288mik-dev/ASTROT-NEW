import type { UserProfile } from '../types';
import type {
  NatalAngleKey,
  NatalAngleV2,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalPositionV2,
} from '../lib/natalChartV2Types';
import * as permanentReport from '../lib/natalReading/permanentReport';
import type {
  BuiltNatalModelContext,
  RawNatalFreePayload,
  RawNatalPremiumPayload,
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

const profile: UserProfile = {
  id: 'contract-user',
  name: 'Мира',
  birthDate: '1987-02-03',
  birthTime: '04:56',
  birthPlace: 'Сырой-Тестоград',
  isSetup: true,
  language: 'ru',
  theme: 'light',
  isPremium: true,
};

function position(key: NatalBodyKey, index: number): NatalPositionV2 {
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
    house: (index % 12) + 1,
    source: key === 'southNode' ? 'derived' : 'swisseph',
    reliability: 'exact',
    stable: { sign: true, retrograde: true, house: true },
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

function natalChart(birthTimeQuality: 'exact' | 'unknown'): NatalChartDataV2 {
  const positions = Object.fromEntries(
    BODY_KEYS.map((key, index) => [key, position(key, index)]),
  ) as Record<NatalBodyKey, NatalPositionV2>;
  const angles: Record<NatalAngleKey, NatalAngleV2> = {
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
      angularDistance: 119.2,
      orb: 0.8,
      orbRange: { min: 0.8, max: 0.8 },
      from: 'Sun',
      to: 'Ascendant',
      fromKey: 'sun',
      toKey: 'ascendant',
      phase: 'separating',
      reliable: true,
      sampleCoverage: 1,
    },
  ];
  const houses = Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    longitude: index * 30,
    sign: SIGNS[index],
    degree: 0,
    reliability: 'exact' as const,
    stableSign: true,
  }));

  return {
    schemaVersion: 'natal-chart-data-v2',
    birth: {
      localDate: profile.birthDate,
      localTime: birthTimeQuality === 'unknown' ? null : profile.birthTime,
      place: profile.birthPlace,
      latitude: 55.755813,
      longitude: 37.617314,
      timezone: 'Europe/Moscow',
      time: {
        mode: birthTimeQuality,
        localTime: birthTimeQuality === 'unknown' ? null : profile.birthTime,
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
      },
      interval: {
        mode: birthTimeQuality,
        localDate: profile.birthDate,
        timezone: 'Europe/Moscow',
        localTime: birthTimeQuality === 'unknown' ? null : profile.birthTime,
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
        startUtc: '1987-02-03T01:56:00.000Z',
        endUtc: '1987-02-03T01:56:00.000Z',
        referenceUtc: birthTimeQuality === 'unknown' ? null : '1987-02-03T01:56:00.000Z',
        sampleUtc: ['1987-02-03T01:56:00.000Z'],
      },
    },
    positions,
    // Deliberately keep time-dependent values in the unknown-time fixture. The
    // report boundary must filter them even if stale storage contains them.
    angles,
    houses,
    aspects,
    chartQuality: {
      birthTimeMode: birthTimeQuality,
      birthTimeQuality,
      exactTime: birthTimeQuality === 'exact',
      anglesAvailable: birthTimeQuality === 'exact',
      housesAvailable: birthTimeQuality === 'exact',
      ascendantReliable: birthTimeQuality === 'exact',
      housesReliable: birthTimeQuality === 'exact',
      houseBasedPersonalization: birthTimeQuality === 'exact',
      stableHousePlacements: birthTimeQuality === 'exact' ? BODY_KEYS : [],
      variableBodies: [],
      variableAngles: birthTimeQuality === 'unknown'
        ? ['ascendant', 'mc', 'descendant', 'ic']
        : [],
      variableHouses: birthTimeQuality === 'unknown'
        ? Array.from({ length: 12 }, (_, index) => index + 1)
        : [],
      variableAspectIds: birthTimeQuality === 'unknown'
        ? ['sun-trine-ascendant']
        : [],
      notes: [],
    },
    calculationMetadata: {
      ephemerisEngine: 'Swiss Ephemeris',
      ephemerisMode: 'swisseph',
      ephemerisLibraryVersion: '2.10',
      zodiac: 'tropical',
      coordinateCenter: 'geocentric',
      houseSystem: birthTimeQuality === 'exact' ? 'placidus' : null,
      houseFallbackUsed: false,
      housesComputedFrom: birthTimeQuality === 'exact' ? 'exact_time' : 'not_computed',
      aspectRulesVersion: 'aspects-v1',
      calculationVersion: 'natal-personality-contract-fixture-v1',
      calculatedAt: '2026-08-13T00:00:00.000Z',
      sampleCount: 1,
    },
    calculationVersion: 'natal-personality-contract-fixture-v1',
    ...positions,
    rising: angles.ascendant,
    mc: angles.mc,
    latitude: 55.755813,
    longitude: 37.617314,
    timezone: 'Europe/Moscow',
    birthTimeQuality,
  };
}

type ExpectedReportPlanItem = {
  key: string;
  evidenceIds: string[];
  requiredEvidenceIds: string[];
};

type ExpectedPromptContextBuilder = (
  built: BuiltNatalModelContext,
) => Record<string, unknown>;

type ExpectedScopeCacheIdentity = {
  chartFingerprint: string;
  reportVersion: string;
};

const buildNatalPromptContext = (
  permanentReport as typeof permanentReport & {
    buildNatalPromptContext: ExpectedPromptContextBuilder;
  }
).buildNatalPromptContext;

const buildNatalReportScopeKey = permanentReport.buildNatalReportScopeKey as unknown as (
  userId: string,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: ExpectedScopeCacheIdentity,
) => string;

function reportPlanOf(built: BuiltNatalModelContext): ExpectedReportPlanItem[] {
  return (
    built.context as typeof built.context & { reportPlan: ExpectedReportPlanItem[] }
  ).reportPlan;
}

function freePayload(
  content: string,
  evidenceIds: string[],
): RawNatalFreePayload {
  return {
    hook: {
      text: 'Ты быстро замечаешь, где слова расходятся с реальностью.',
      evidence_ids: ['natal.position.sun'],
    },
    sections: [
      {
        section_key: 'base_portrait',
        title: 'Как ты устроен',
        free: true,
        content,
        evidence_ids: evidenceIds,
      },
    ],
  };
}

function contradictionPayload(evidenceIds: string[]): RawNatalPremiumPayload {
  return {
    sections: [
      {
        section_key: 'central_contradictions',
        title: 'Две сильные реакции',
        free: false,
        content: 'Ты можешь быстро выбрать направление, а затем остановиться, чтобы проверить эмоциональную цену решения. Это не слабость и не одна из двух версий характера: обе реакции у тебя сильные.',
        evidence_ids: evidenceIds,
      },
    ],
  };
}

describe('natal personality report reliability contract', () => {
  test('exact birth time keeps ASC and houses and enables first_impression', () => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));

    expect(built.context.chart.angles?.ascendant).toBeDefined();
    expect(built.context.chart.houses).toHaveLength(12);

    const reportPlan = reportPlanOf(built);
    expect(reportPlan).toEqual(expect.any(Array));
    const firstImpression = reportPlan.find((item) => item.key === 'first_impression');
    expect(firstImpression).toBeDefined();
    expect(firstImpression?.evidenceIds).toContain('natal.angle.ascendant');
  });

  test('unknown birth time strips angles, houses, angle aspects and first_impression', () => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('unknown'));

    expect(built.context.chart.angles).toBeUndefined();
    expect(built.context.chart.houses).toBeUndefined();
    expect(built.context.chart.aspects.map((aspect) => aspect.id)).toEqual([
      'sun-square-moon',
    ]);
    expect([...built.evidenceIds].some((id) => id.startsWith('natal.angle.'))).toBe(false);
    expect([...built.evidenceIds].some((id) => id.startsWith('natal.house.'))).toBe(false);
    expect([...built.evidenceIds]).not.toContain('natal.aspect.sun-trine-ascendant');

    const reportPlan = reportPlanOf(built);
    expect(reportPlan).toEqual(expect.any(Array));
    expect(reportPlan.map((item) => item.key)).not.toContain('first_impression');
  });

  test('unknown-time plan ignores a body whose sign varies across the sampled interval', () => {
    const variableMoon = natalChart('unknown');
    variableMoon.positions.moon.reliability = 'variable_in_range';
    variableMoon.positions.moon.stable.sign = false;
    variableMoon.positions.moon.stable.retrograde = false;
    variableMoon.chartQuality.variableBodies = ['moon'];
    const built = permanentReport.buildNatalModelContext(profile, variableMoon);

    expect(built.context.chart.positions.moon.sign).toBeNull();
    expect(reportPlanOf(built).map((item) => item.key)).toContain('base_portrait');
    expect(reportPlanOf(built).map((item) => item.key)).not.toContain('emotional_world');
  });

  test('requires a hard direct Mercury-Mars factor before adding conflict', () => {
    const withoutConflictAspect = natalChart('exact');
    withoutConflictAspect.aspects = withoutConflictAspect.aspects.filter(
      (aspect) => !(
        (aspect.fromKey === 'mercury' && aspect.toKey === 'mars')
        || (aspect.fromKey === 'mars' && aspect.toKey === 'mercury')
      ),
    );

    expect(reportPlanOf(permanentReport.buildNatalModelContext(profile, withoutConflictAspect))
      .map((item) => item.key)).not.toContain('conflict');
  });

  test('domain plan does not mistake an aspect to a third body for a direct pair', () => {
    const chart = natalChart('exact');
    chart.aspects = [
      chart.aspects[0],
      {
        ...chart.aspects[0],
        id: 'venus-square-sun',
        from: 'Venus',
        fromKey: 'venus',
        to: 'Sun',
        toKey: 'sun',
      },
      {
        ...chart.aspects[0],
        id: 'mercury-square-saturn',
        from: 'Mercury',
        fromKey: 'mercury',
        to: 'Saturn',
        toKey: 'saturn',
      },
    ];
    const plan = reportPlanOf(permanentReport.buildNatalModelContext(profile, chart));

    expect(plan.find((item) => item.key === 'relationships_deep')?.evidenceIds)
      .not.toContain('natal.aspect.venus-square-sun');
    expect(plan.find((item) => item.key === 'conflict')).toBeUndefined();
  });
});

describe('natal personality report evidence grounding', () => {
  test('accepts a Sun-square-Moon contradiction only with the aspect and both endpoints', () => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));
    const completeEvidence = [
      'natal.aspect.sun-square-moon',
      'natal.position.sun',
      'natal.position.moon',
    ];

    expect(permanentReport.materializePermanentPremiumReport({
      raw: contradictionPayload(completeEvidence),
      built,
    })).not.toBeNull();

    for (const incompleteEvidence of [
      ['natal.aspect.sun-square-moon'],
      ['natal.aspect.sun-square-moon', 'natal.position.sun'],
      ['natal.position.sun', 'natal.position.moon'],
    ]) {
      expect(permanentReport.materializePermanentPremiumReport({
        raw: contradictionPayload(incompleteEvidence),
        built,
      })).toBeNull();
    }
  });

  test('skips unusable hard angle aspects until it finds a grounded contradiction', () => {
    const chart = natalChart('unknown');
    const unusable = {
      ...chart.aspects[0],
      id: 'sun-square-ascendant-unusable',
      from: 'Sun',
      fromKey: 'sun' as const,
      to: 'Ascendant',
      toKey: 'ascendant' as const,
    };
    chart.aspects = [unusable, { ...unusable, id: 'moon-square-mc-unusable', from: 'Moon', fromKey: 'moon', to: 'MC', toKey: 'mc' }, chart.aspects[0]];
    chart.chartQuality.variableAspectIds = [unusable.id, 'moon-square-mc-unusable'];
    const plan = reportPlanOf(permanentReport.buildNatalModelContext(profile, chart));

    expect(plan.find((item) => item.key === 'central_contradictions')?.requiredEvidenceIds)
      .toEqual(expect.arrayContaining([
        'natal.aspect.sun-square-moon',
        'natal.position.sun',
        'natal.position.moon',
      ]));
  });

  test('rejects evidence IDs that are absent from the calculated chart', () => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));

    expect(permanentReport.materializePermanentFreeReport({
      raw: freePayload(
        'Ты проверяешь решение на прочность до того, как объявить его окончательным.',
        ['natal.position.sun', 'natal.aspect.venus-conjunction-pluto'],
      ),
      profile,
      built,
    })).toBeNull();
  });

  test.each([
    ['invented placement', 'Марс в Рыбах заставляет тебя всегда уходить от прямого ответа.', ['natal.position.mars']],
    ['invented aspect', 'Соединение Венеры и Плутона заставляет тебя всё контролировать.', ['natal.position.venus', 'natal.position.pluto']],
    ['visible ascendant', 'Асцендент в Овне делает первое впечатление резче, чем ты ожидаешь.', ['natal.angle.ascendant']],
    ['visible house', 'Марс в 5 доме заставляет тебя превращать любое дело в соревнование.', ['natal.position.mars']],
    ['visible retrograde claim', 'Меркурий ретроградный, поэтому ты неизбежно возвращаешься к каждому решению.', ['natal.position.mercury']],
    ['visible MC', 'МС показывает, что тебе нужна только публичная работа.', ['natal.angle.mc']],
  ])('rejects visible %s terminology even when every supplied evidence ID exists', (
    _case,
    content,
    evidenceIds,
  ) => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));

    expect(permanentReport.materializePermanentFreeReport({
      raw: freePayload(content, evidenceIds),
      profile,
      built,
    })).toBeNull();
  });

  test.each([
    'Марс заставляет тебя спорить жёстче, чем ты сам планировал.',
    'Меркурий и Марс заметно ускоряют твои ответы в любом разговоре.',
    'Your Mars makes every disagreement feel more urgent than it needs to be.',
    'Овен заставляет тебя спорить жёстче, чем требует ситуация.',
    'Aries makes you argue harder than the situation requires.',
    'Десятый дом решает, как ты работаешь и когда тебе остановиться.',
    'The tenth house decides how you work and when you stop.',
  ])('rejects technical object names from user-facing narrative: %s', (content) => {
    expect(permanentReport.hasNatalPersonalityCopyViolation(content)).toBe(true);
  });

  test.each([
    'Это весомый аргумент, и ты не станешь от него отмахиваться.',
    'От неудобного вопроса уже некуда деваться, поэтому ты отвечаешь прямо.',
    'Девушка привела девять точных примеров, и ты пересмотрел решение.',
  ])('does not mistake ordinary Russian words for zodiac terminology: %s', (content) => {
    expect(permanentReport.hasNatalPersonalityCopyViolation(content)).toBe(false);
  });

  test.each([
    'Звёзды говорят, что ты всегда найдёшь правильный путь.',
    'Вселенная приглашает тебя сделать следующий шаг.',
    'Твоя уникальная энергия сразу меняет атмосферу.',
    'Тебе важно прислушаться к себе, прежде чем решать.',
    'Ты обладаешь глубоким внутренним миром.',
    'Твоя главная опора проявляется в умении находить внутренний ресурс.',
    'Этот паттерн раскрывает твой потенциал через внутреннее противоречие.',
    'Ты чувствуешь глубже, чем показываешь.',
    'Тебя не всегда понимают, потому что в тебе сочетаются разные стороны.',
    'Тебе важно научиться лучше держать границы.',
    'Позволь себе раскрыть свою настоящую энергию.',
    'Попробуй практиковать это каждый день.',
  ])('rejects prohibited mystical or coaching copy: %s', (content) => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));

    expect(permanentReport.materializePermanentFreeReport({
      raw: freePayload(content, ['natal.position.sun']),
      profile,
      built,
    })).toBeNull();
  });
});

describe('natal personality prompt and cache privacy contract', () => {
  test('prompt context keeps calculated evidence but omits raw birth data', () => {
    const built = permanentReport.buildNatalModelContext(profile, natalChart('exact'));
    const promptContext = buildNatalPromptContext(built);
    const serialized = JSON.stringify(promptContext);

    expect(promptContext).toEqual(expect.objectContaining({
      evidence: expect.any(Array),
      chart: expect.any(Object),
    }));
    expect(promptContext).not.toHaveProperty('subject.birthData');
    expect(serialized).toContain('natal.position.sun');
    expect(serialized).toContain('natal.aspect.sun-square-moon');
    expect(serialized).not.toContain(profile.birthDate);
    expect(serialized).not.toContain(profile.birthTime);
    expect(serialized).not.toContain(profile.birthPlace);
    expect(serialized).not.toContain('55.755813');
    expect(serialized).not.toContain('37.617314');
    expect(serialized).not.toContain('Europe/Moscow');
    expect(serialized).not.toContain('ephemerisEngine');
    expect(serialized).not.toContain('houseSystem');
    expect(serialized).not.toContain('housesComputedFrom');
  });

  test('client scope changes with chart fingerprint and report version', () => {
    const first = buildNatalReportScopeKey('contract-user', 17, 'ru', {
      chartFingerprint: 'chart-fingerprint-a',
      reportVersion: 'natal-report-v1',
    });
    const same = buildNatalReportScopeKey('contract-user', 17, 'ru', {
      chartFingerprint: 'chart-fingerprint-a',
      reportVersion: 'natal-report-v1',
    });
    const anotherChart = buildNatalReportScopeKey('contract-user', 17, 'ru', {
      chartFingerprint: 'chart-fingerprint-b',
      reportVersion: 'natal-report-v1',
    });
    const anotherReportVersion = buildNatalReportScopeKey('contract-user', 17, 'ru', {
      chartFingerprint: 'chart-fingerprint-a',
      reportVersion: 'natal-report-v2',
    });

    expect(first).toBe(same);
    expect(first).not.toBe(anotherChart);
    expect(first).not.toBe(anotherReportVersion);
  });
});
