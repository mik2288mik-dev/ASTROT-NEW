import fs from 'fs';
import path from 'path';
import { buildSynastryPrompt } from '../lib/contentPromptBuilders';
import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import { buildCompatibilityResult } from '../lib/synastry/compatibilityNarrative';
import { getCompatibilityRingGeometry } from '../lib/synastry/compatibilityPresentation';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function houses() {
  return Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    longitude: index * 30,
    sign: 'Aries',
    degree: 0,
    reliability: 'exact',
  }));
}

function chart(offset = 0, timed = true) {
  const position = (key: string, longitude: number, reliability = 'exact') => ({
    key,
    planet: key,
    object: key,
    longitude: (longitude + offset) % 360,
    sign: 'Aries',
    degree: 0,
    reliability,
    retrograde: false,
    speedLongitude: 1,
    house: timed ? 1 : null,
  });
  const positions = {
    sun: position('sun', 10),
    moon: position('moon', 42),
    mercury: position('mercury', 70),
    venus: position('venus', 100),
    mars: position('mars', 130),
    jupiter: position('jupiter', 160),
    saturn: position('saturn', 190),
    uranus: position('uranus', 220),
    neptune: position('neptune', 250),
    pluto: position('pluto', 280),
  } as any;
  return {
    schemaVersion: 'natal-chart-data-v2',
    positions,
    ...positions,
    angles: {
      ascendant: timed ? { longitude: (10 + offset) % 360, reliability: 'exact' } : null,
      mc: timed ? { longitude: (100 + offset) % 360, reliability: 'exact' } : null,
    },
    houses: timed ? houses() : [],
    chartQuality: {
      anglesAvailable: timed,
      housesReliable: timed,
      ascendantReliable: timed,
    },
    birthTimeQuality: timed ? 'exact' : 'unknown',
  } as any;
}

describe('calculated compatibility pipeline', () => {
  it('produces the same deterministic score for the same charts and context', () => {
    const input = {
      subjectChart: chart(0),
      partnerChart: chart(0),
      calculationLevel: 'full' as const,
      relationshipContext: 'romance' as const,
      subjectName: 'Анна',
      partnerName: 'Максим',
      language: 'ru' as const,
    };

    const first = calculateCompatibility(input);
    const second = calculateCompatibility(input);

    expect(first.overallScore).toBe(second.overallScore);
    expect(first.dimensions).toEqual(second.dimensions);
    expect(first.evidence.some((item) => item.type === 'aspect')).toBe(true);
  });

  it('keeps AI out of score calculation and excludes score from the writer schema', () => {
    const calculated = calculateCompatibility({
      subjectChart: chart(0),
      partnerChart: chart(21),
      calculationLevel: 'full',
      relationshipContext: 'relationship',
      language: 'ru',
    });
    const result = buildCompatibilityResult(
      calculated,
      { summary: 'Текст модели.', sections: [], compatibilityScore: 1 },
      { subjectName: 'Анна', partnerName: 'Максим', language: 'ru' },
    );
    const api = read('pages/api/content/synastry/extended.ts');
    const prompt = buildSynastryPrompt().user;

    expect(result.overallScore).toBe(calculated.overallScore);
    expect(result.compatibilityScore).toBe(calculated.overallScore);
    expect(api).toContain("from '../../../../lib/swisseph-calculator'");
    expect(api).toContain('calculateCompatibility({');
    expect(api).toContain('calculated.aspects.map');
    expect(api).not.toContain("compatibilityScore: { type: 'number' }");
    expect(api).toContain("required: ['summary', 'sections', 'closing']");
    expect(prompt).toContain('Ты — только writer layer');
    expect(prompt).toContain('Не возвращай compatibilityScore');
    expect(prompt).toContain('не начинай два раздела одинаково');
    expect(prompt).toContain('Избегай машинных связок');
    expect(result.closing?.strength).toBeTruthy();
  });

  it('rejects short machine-like writer copy and keeps a data-grounded payoff', () => {
    const calculated = calculateCompatibility({
      subjectChart: chart(0),
      partnerChart: chart(21),
      calculationLevel: 'full',
      relationshipContext: 'romance',
      language: 'ru',
    });
    const result = buildCompatibilityResult(
      calculated,
      {
        summary: 'Между вами присутствует динамика.',
        sections: [{ id: 'between_you', text: 'Эмоциональный контакт считывается.' }],
        closing: { strength: 'Связь.', risk: 'Риск.', action: 'Говорите.' },
      },
      { subjectName: 'Анна', partnerName: 'Максим', language: 'ru' },
    );

    expect(result.summary).toContain('Анна и Максим');
    expect(result.sections?.[0].text).not.toContain('считывается');
    expect(result.closing?.strength.length).toBeGreaterThan(40);
    expect(result.closing?.action).toMatch(/[.!?]$/);
  });

  it('excludes angles and houses when birth time is unknown', () => {
    const result = calculateCompatibility({
      subjectChart: chart(0, false),
      partnerChart: chart(9, false),
      calculationLevel: 'reduced',
      relationshipContext: 'romance',
      language: 'ru',
    });

    expect(result.evidence.some((item) => item.type === 'angle')).toBe(false);
    expect(result.evidence.some((item) => item.type === 'house_overlay')).toBe(false);
    expect(result.limitations.join(' ')).toContain('Асцендент');
  });

  it('weights a tight aspect more strongly and treats Venus-Mars tension thematically', () => {
    const exact = calculateCompatibility({ subjectChart: chart(0), partnerChart: chart(0), calculationLevel: 'full', relationshipContext: 'romance', language: 'ru' });
    const wide = calculateCompatibility({ subjectChart: chart(0), partnerChart: chart(7), calculationLevel: 'full', relationshipContext: 'romance', language: 'ru' });
    const tense = calculateCompatibility({ subjectChart: chart(0), partnerChart: chart(60), calculationLevel: 'full', relationshipContext: 'romance', language: 'ru' });
    const exactSun = exact.evidence.find((item) => item.technical?.subjectKey === 'sun' && item.technical?.partnerKey === 'sun' && item.technical?.aspect === 'conjunction');
    const wideSun = wide.evidence.find((item) => item.technical?.subjectKey === 'sun' && item.technical?.partnerKey === 'sun' && item.technical?.aspect === 'conjunction');
    const venusMars = tense.evidence.find((item) => item.technical?.subjectKey === 'venus' && item.technical?.partnerKey === 'mars' && item.technical?.aspect === 'square');

    expect(exactSun!.weight).toBeGreaterThan(wideSun!.weight);
    expect(venusMars!.dimensionEffects.attraction).toBeGreaterThan(0);
    expect(venusMars!.dimensionEffects.conflict_ease).toBeLessThan(0);
    expect(read('lib/synastry/compatibilityEngine.ts')).toContain('Math.min(positiveOuter, 0.9)');
  });

  it('uses reliable angle and directional house evidence for an exact pair', () => {
    const result = calculateCompatibility({
      subjectChart: chart(0),
      partnerChart: chart(0),
      calculationLevel: 'full',
      relationshipContext: 'relationship',
      language: 'ru',
    });

    expect(result.evidence.some((item) => item.type === 'angle')).toBe(true);
    expect(result.evidence.some((item) => item.type === 'house_overlay')).toBe(true);
    expect(result.evidence.some((item) => item.direction === 'subject_to_partner')).toBe(true);
    expect(result.evidence.some((item) => item.direction === 'partner_to_subject')).toBe(true);
  });

  it('uses distinct, non-romantic section sets for each relationship context', () => {
    const base = { subjectChart: chart(0), partnerChart: chart(13), calculationLevel: 'full' as const, language: 'ru' as const };
    const love = calculateCompatibility({ ...base, relationshipContext: 'romance' });
    const relationship = calculateCompatibility({ ...base, relationshipContext: 'relationship' });
    const friendship = calculateCompatibility({ ...base, relationshipContext: 'friendship' });
    const work = calculateCompatibility({ ...base, relationshipContext: 'work' });

    expect(love.sectionPlan.map((section) => section.id)).not.toEqual(relationship.sectionPlan.map((section) => section.id));
    expect(love.dimensions.map((dimension) => dimension.id)).not.toEqual(relationship.dimensions.map((dimension) => dimension.id));
    expect(friendship.sectionPlan.some((section) => section.id === 'attraction')).toBe(false);
    expect(work.sectionPlan.some((section) => section.id === 'attraction')).toBe(false);
    expect(work.dimensions.some((dimension) => dimension.id === 'attraction')).toBe(false);
  });

  it('builds meaningfully different fallback readings for different pairs and contexts', () => {
    const loveCalculation = calculateCompatibility({ subjectChart: chart(0), partnerChart: chart(13), calculationLevel: 'full', relationshipContext: 'romance', language: 'ru' });
    const workCalculation = calculateCompatibility({ subjectChart: chart(0), partnerChart: chart(60), calculationLevel: 'full', relationshipContext: 'work', language: 'ru' });
    const love = buildCompatibilityResult(loveCalculation, null, { subjectName: 'Анна', partnerName: 'Максим', language: 'ru' });
    const work = buildCompatibilityResult(workCalculation, null, { subjectName: 'Ирина', partnerName: 'Олег', language: 'ru' });

    expect(love.summary).not.toBe(work.summary);
    expect(love.closing).not.toEqual(work.closing);
    expect(love.sections?.map((section) => section.id)).not.toEqual(work.sections?.map((section) => section.id));
    expect(work.sections?.some((section) => section.id === 'under_pressure')).toBe(true);
    expect(work.sections?.some((section) => section.id === 'attraction')).toBe(false);
  });

  it('maps score to ring distance monotonically at 0, 50 and 100', () => {
    const low = getCompatibilityRingGeometry(0);
    const middle = getCompatibilityRingGeometry(50);
    const high = getCompatibilityRingGeometry(100);

    expect(low.centerDistance).toBe(112);
    expect(middle.centerDistance).toBe(56);
    expect(high.centerDistance).toBe(0);
    expect(low.centerDistance).toBeGreaterThan(middle.centerDistance);
    expect(middle.centerDistance).toBeGreaterThan(high.centerDistance);
  });
});
