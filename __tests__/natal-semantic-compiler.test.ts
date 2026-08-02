import type { NatalChartData, PlanetPosition, UserProfile } from '../types';
import {
  FREE_NATAL_SECTION_KEYS,
  NATAL_SEMANTIC_VERSION,
  PREMIUM_NATAL_SECTION_KEYS,
  buildNatalSectionFallbackContent,
  compileNatalSemantics,
  deterministicNatalBlocks,
  natalPromptPayload,
  validateGeneratedNatalPayload,
  type GeneratedNatalPayload,
  type NatalSemanticCompilation,
} from '../lib/natalSemanticCompiler';
import {
  buildHumanBaseFallback,
  buildHumanPaidFallback,
  generateHumanBaseReport,
} from '../lib/natalHumanInterpretation';
import { llmJson } from '../lib/anthropic';
import {
  HUMAN_BASE_CACHE_KEY,
  HUMAN_BASE_PROMPT_VERSION,
  HUMAN_FREE_SECTION_KEYS,
  HUMAN_PAID_PROMPT_VERSION,
  HUMAN_PAID_SECTION_KEYS,
} from '../lib/natalHumanShared';

jest.mock('../lib/anthropic', () => ({ llmJson: jest.fn() }));

function planet(planetName: string, sign: string, house: number): PlanetPosition {
  return {
    planet: planetName,
    sign,
    degree: 12,
    longitude: 12,
    house,
    description: '',
  };
}

function chart(time: 'exact' | 'approximate' | 'unknown' = 'exact'): NatalChartData {
  const exact = time === 'exact';
  return {
    sun: planet('Sun', 'Aries', 10),
    moon: planet('Moon', 'Cancer', 1),
    rising: planet('Ascendant', 'Scorpio', 1),
    mercury: planet('Mercury', 'Virgo', 9),
    venus: planet('Venus', 'Taurus', 7),
    mars: planet('Mars', 'Gemini', 6),
    jupiter: planet('Jupiter', 'Sagittarius', 2),
    saturn: planet('Saturn', 'Capricorn', 4),
    uranus: planet('Uranus', 'Aquarius', 5),
    neptune: planet('Neptune', 'Pisces', 5),
    pluto: planet('Pluto', 'Scorpio', 3),
    chiron: planet('Chiron', 'Leo', 10),
    element: 'Fire',
    rulingPlanet: 'Mars',
    summary: '',
    houses: Array.from({ length: 12 }, (_, index) => ({
      house: index + 1,
      sign: 'Aries',
      degree: 0,
      longitude: index * 30,
    })),
    aspects: [
      { from: 'Mercury', to: 'Mars', type: 'square', angle: 90, orb: 0.2 },
      { from: 'Sun', to: 'Jupiter', type: 'trine', angle: 120, orb: 1.1 },
      { from: 'Moon', to: 'Venus', type: 'sextile', angle: 60, orb: 4.8 },
      { from: 'Ascendant', to: 'Mars', type: 'opposition', angle: 180, orb: 0.1 },
    ],
    birthTimeQuality: time,
    chartQuality: {
      birthTimeQuality: time,
      housesReliable: exact,
      ascendantReliable: exact,
      houseBasedPersonalization: exact,
      notes: [],
    },
  };
}

const profile: UserProfile = {
  id: 'semantic-user',
  name: 'Ира',
  birthDate: '1990-01-01',
  birthTime: '10:30',
  birthPlace: 'Москва',
  language: 'ru',
  theme: 'light',
  isSetup: true,
  isPremium: false,
  isAdmin: false,
  loginStreak: 0,
  chartSlots: 1,
};

function writerPayload(compilation: NatalSemanticCompilation): GeneratedNatalPayload {
  return {
    sections: compilation.sections.map((section) => ({
      id: section.key,
      blocks: deterministicNatalBlocks(section).map((block) => ({
        id: block.id,
        role: block.role,
        semantic_fact_id: block.semanticFactId,
        evidence_id: block.evidenceId,
        text: block.text,
      })),
    })),
  };
}

describe('deterministic natal semantic compiler', () => {
  it('builds a complete seven-part Free product from ranked supported facts', () => {
    const result = compileNatalSemantics(chart(), 'free', 'ru');

    expect(result.version).toBe(NATAL_SEMANTIC_VERSION);
    expect(result.sections.map((section) => section.key)).toEqual(FREE_NATAL_SECTION_KEYS);
    expect(result.sections).toHaveLength(7);
    for (const section of result.sections) {
      expect(section.facts.length).toBeGreaterThan(0);
      expect(section.facts.length).toBeLessThanOrEqual(3);
      expect(section.evidenceIds).toEqual(section.facts.map((fact) => fact.id));
      expect(buildNatalSectionFallbackContent(section)).not.toHaveLength(0);
    }
    expect(result.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'placement', planet: 'rising' }),
      expect.objectContaining({ kind: 'placement', planet: 'mc', house: 10 }),
    ]));
  });

  it('makes Premium a separate nine-chapter product instead of a padded Free reading', () => {
    const result = compileNatalSemantics(chart(), 'premium', 'ru');

    expect(result.sections.map((section) => section.key)).toEqual(PREMIUM_NATAL_SECTION_KEYS);
    expect(result.sections).toHaveLength(9);
    expect(PREMIUM_NATAL_SECTION_KEYS.some((key) => FREE_NATAL_SECTION_KEYS.includes(key as never))).toBe(false);
    expect(result.sections.find((section) => section.key === 'important_aspects')?.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'aspect',
          from: 'mercury',
          to: 'mars',
          orb: 0.2,
        }),
      ]),
    );
    const chapterFactIds = result.sections
      .filter((section) => section.key !== 'important_aspects')
      .flatMap((section) => section.facts)
      .filter((fact) => fact.kind !== 'aggregate')
      .map((fact) => fact.id);
    expect(new Set(chapterFactIds).size).toBe(chapterFactIds.length);
  });

  it('drops weak aspects before they can become model input', () => {
    const result = compileNatalSemantics(chart(), 'premium', 'ru');
    const payload = JSON.stringify(natalPromptPayload(result));

    expect(result.facts.some((fact) => fact.id.includes('moon:sextile:venus'))).toBe(false);
    expect(result.rejectedFacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ reason: 'weak_orb' }),
    ]));
    expect(payload).not.toContain('moon:sextile:venus');
  });

  it.each(['unknown', 'approximate'] as const)(
    'excludes houses and angles when birth time is %s',
    (time) => {
      const result = compileNatalSemantics(chart(time), 'premium', 'ru');
      const serializedFacts = JSON.stringify(result.facts);

      expect(result.reliability.housesReliable).toBe(false);
      expect(result.reliability.anglesReliable).toBe(false);
      expect(result.facts.every((fact) => fact.house == null)).toBe(true);
      expect(result.facts.some((fact) => fact.planet === 'rising')).toBe(false);
      expect(result.facts.some((fact) => fact.planet === 'mc')).toBe(false);
      expect(result.facts.some((fact) => fact.from === 'rising' || fact.to === 'rising')).toBe(false);
      expect(serializedFacts).not.toContain('Асцендент');
      expect(serializedFacts).not.toMatch(/·\s*\d{1,2}\s+дом/u);
      expect(result.rejectedFacts).toEqual(expect.arrayContaining([
        expect.objectContaining({ reason: 'unreliable_birth_time' }),
      ]));
    },
  );

  it('requires reliable houses for MC even when another angle flag is true', () => {
    const input = chart('exact');
    input.chartQuality = {
      ...input.chartQuality!,
      housesReliable: false,
      ascendantReliable: true,
    };
    input.aspects = [
      { from: 'MC', to: 'Sun', type: 'conjunction', angle: 0, orb: 0.1 },
    ];
    const result = compileNatalSemantics(input, 'premium', 'ru');

    expect(result.facts.some((fact) => fact.planet === 'rising')).toBe(true);
    expect(result.facts.some((fact) => fact.planet === 'mc')).toBe(false);
    expect(result.facts.some((fact) => fact.from === 'mc' || fact.to === 'mc')).toBe(false);
  });

  it('accepts only exact block identity with copy grounded in the approved meaning', () => {
    const result = compileNatalSemantics(chart('unknown'), 'free', 'ru');
    const valid = writerPayload(result);
    expect(validateGeneratedNatalPayload({
      raw: valid,
      plans: result.sections,
      reliability: result.reliability,
    }).errors).toEqual([]);

    const changedIdentity = structuredClone(valid) as {
      sections: Array<{ blocks: Array<{ evidence_id: string }> }>;
    };
    changedIdentity.sections[0].blocks[0].evidence_id = result.sections[1].evidenceIds[0];
    expect(validateGeneratedNatalPayload({
      raw: changedIdentity,
      plans: result.sections,
      reliability: result.reliability,
    }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('changed its semantic identity'),
    ]));

    const ungrounded = structuredClone(valid) as {
      sections: Array<{ blocks: Array<{ text: string }> }>;
    };
    ungrounded.sections[0].blocks[0].text = 'Сегодня лучше купить билет, позвонить начальнику и срочно переехать в другой город.';
    expect(validateGeneratedNatalPayload({
      raw: ungrounded,
      plans: result.sections,
      reliability: result.reliability,
    }).errors.length).toBeGreaterThan(0);

    const biography = structuredClone(valid) as {
      sections: Array<{ blocks: Array<{ text: string }> }>;
    };
    biography.sections[0].blocks[0].text = 'В детстве твоя мать создала эту травму, поэтому решение начинается с прямого действия.';
    expect(validateGeneratedNatalPayload({
      raw: biography,
      plans: result.sections,
      reliability: result.reliability,
    }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('failed independent copy validation'),
    ]));
  });

  it('separates Ascendant reliability from houses and MC in generated copy checks', () => {
    const input = chart('exact');
    input.chartQuality = {
      ...input.chartQuality!,
      housesReliable: false,
      houseBasedPersonalization: false,
      ascendantReliable: true,
    };
    const result = compileNatalSemantics(input, 'free', 'ru');
    const plan = result.sections[0];
    const raw = writerPayload({ ...result, sections: [plan] }) as {
      sections: Array<{ blocks: Array<{ text: string }> }>;
    };
    raw.sections[0].blocks[0].text = `${raw.sections[0].blocks[0].text} Асцендент описывает первую реакцию.`;
    const ascendantCheck = validateGeneratedNatalPayload({
      raw,
      plans: [plan],
      reliability: result.reliability,
    });
    expect(ascendantCheck.errors).not.toEqual(expect.arrayContaining([
      expect.stringContaining('failed independent copy validation'),
    ]));

    raw.sections[0].blocks[0].text = `${plan.blocks[0].exactMeaning} MC и 10 дом обещают карьеру.`;
    expect(validateGeneratedNatalPayload({
      raw,
      plans: [plan],
      reliability: result.reliability,
    }).errors).toEqual(expect.arrayContaining([
      expect.stringContaining('failed independent copy validation'),
    ]));
  });

  it('uses an honest topic-specific aggregate instead of an unrelated global fallback', () => {
    const input = chart('unknown');
    input.venus = null as unknown as PlanetPosition;
    input.aspects = [];
    const result = compileNatalSemantics(input, 'premium', 'ru');
    const relationships = result.sections.find((section) => section.key === 'relationships_deep');

    expect(relationships?.facts).toEqual([
      expect.objectContaining({
        kind: 'aggregate',
        id: 'natal:aggregate:relationships_deep:no-strong-indicator',
      }),
    ]);
    expect(relationships?.facts[0].claim).toContain('не выбран отдельный достаточно сильный показатель');
  });
});

describe('active human natal products', () => {
  it('uses semantic cache versions and the compiler-owned chapter contracts', () => {
    expect(HUMAN_FREE_SECTION_KEYS).toEqual(FREE_NATAL_SECTION_KEYS);
    expect(HUMAN_PAID_SECTION_KEYS).toEqual(PREMIUM_NATAL_SECTION_KEYS);
    expect(HUMAN_BASE_CACHE_KEY).toContain('human_v3.semantic.base');
    expect(HUMAN_BASE_PROMPT_VERSION).toContain(NATAL_SEMANTIC_VERSION);
    expect(HUMAN_PAID_PROMPT_VERSION).toContain(NATAL_SEMANTIC_VERSION);
  });

  it('builds evidence-backed deterministic fallbacks for both products', () => {
    const base = buildHumanBaseFallback(profile, chart());
    const premium = buildHumanPaidFallback(profile, chart(), 'communication');

    expect(base.freeSections.map((section) => section.key)).toEqual(FREE_NATAL_SECTION_KEYS);
    expect(base.freeSections.every((section) => section.content && section.evidenceIds?.length)).toBe(true);
    expect(base.paidSections).toHaveLength(9);
    expect(premium.key).toBe('communication');
    expect(premium.evidenceIds?.length).toBeGreaterThan(0);
    expect(premium.content).toContain('Меркурий');
  });

  it('sends only exact semantic blocks to one writer call and keeps identity out of the prompt', async () => {
    const compilation = compileNatalSemantics(chart(), 'free', 'ru');
    (llmJson as jest.Mock).mockResolvedValueOnce(writerPayload(compilation));

    const report = await generateHumanBaseReport(profile, chart());

    const call = (llmJson as jest.Mock).mock.calls[0][0];
    expect(llmJson).toHaveBeenCalledTimes(1);
    expect(call.user).toContain('AUTHORITATIVE SEMANTIC WRITING PLAN');
    expect(call.user).toContain('confirmedClaims');
    expect(call.user).toContain('requiredBlocks');
    expect(call.user).not.toContain(profile.name);
    expect(call.user).not.toContain(profile.birthDate);
    expect(call.user).not.toContain(profile.birthPlace);
    expect(call.temperature).toBeLessThanOrEqual(0.35);
    expect(report.shortCard.title).toBe('Главный рисунок характера');
    expect(report.shortCard.text).toBe(report.freeSections[0].content.split(/\n\n+/u)[0]);
  });

  it('falls back deterministically when any writer block changes meaning', async () => {
    const inputChart = chart();
    const compilation = compileNatalSemantics(inputChart, 'free', 'ru');
    const raw = writerPayload(compilation) as {
      sections: Array<{ blocks: Array<{ text: string }> }>;
    };
    raw.sections[0].blocks[0].text = 'Переезд завтра неизбежен, потому что всё уже решено.';
    (llmJson as jest.Mock).mockResolvedValueOnce(raw);

    const result = await generateHumanBaseReport(profile, inputChart);
    const fallback = buildHumanBaseFallback(profile, inputChart);

    expect(result.freeSections).toEqual(fallback.freeSections);
    expect(result.shortCard).toEqual(fallback.shortCard);
  });
});
