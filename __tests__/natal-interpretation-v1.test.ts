import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';
import { natalPlainLanguageError } from '../lib/natalInterpretation/plainLanguage';
import { buildMapData, explainMapSelection } from '../components/NatalReading/mapExplanation';

describe('unified natal interpretation', () => {
  it('retains reliable calculator data but selects relevant observations for reading', () => {
    const chart = canonicalNatalChart();
    const result = buildNatalInterpretation(chart);

    expect(result.evidence.length).toBeGreaterThan(20);
    expect(result.meanings.length).toBeLessThan(result.evidence.length);
    expect(result.storyMeaningIds.length).toBeLessThanOrEqual(16);

    const covered = new Set(result.meanings.flatMap((meaning) => meaning.evidenceIds));
    expect([...covered].every(id => result.evidence.some(fact => fact.id === id))).toBe(true);
    expect(result.meanings.some(meaning => meaning.semanticKey.startsWith('body-retrograde:'))).toBe(false);
    expect(result.meanings.some(meaning => meaning.semanticKey.startsWith('body-house:'))).toBe(false);
  });

  it('does not invent conflict/control/boredom categories', () => {
    const result = buildNatalInterpretation(canonicalNatalChart());
    const payload = JSON.stringify(result);
    expect(payload).not.toContain('control_freedom_trust');
    expect(payload).not.toContain('central_contradictions');
    expect(payload).not.toContain('character_boredom');
    expect(payload).not.toContain('lose_interest');
    expect(payload).not.toContain('"conflict"');
  });
  it('keeps source observations plain across all signs and never modifies the saved calculation', () => {
    const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
    for (const sign of signs) {
      const chart = canonicalNatalChart();
      Object.values(chart.positions).forEach(position => { position.sign = sign; });
      const before = JSON.stringify(chart);
      for (const language of ['ru', 'en'] as const) {
        const reading = buildNatalInterpretation(chart, language);
        expect(reading.meanings.every(meaning => natalPlainLanguageError(meaning.text) === null)).toBe(true);
      }
      expect(JSON.stringify(chart)).toBe(before);
    }
  });

  it('uses stable approximate houses and angles but rejects individually unstable ones', () => {
    const chart = canonicalNatalChart({
      time: {
        mode: 'approximate',
        localTime: '08:15',
        uncertaintyMinutes: 30,
        rangeStart: null,
        rangeEnd: null,
      },
    });
    chart.positions.moon.stable.house = false;
    chart.angles.ascendant!.stableSign = false;
    chart.aspects[0].reliable = false;

    const result = buildNatalInterpretation(chart);
    const ids = new Set(result.evidence.map((fact) => fact.id));

    expect(ids.has('position:sun:house')).toBe(true);
    expect(ids.has('position:moon:house')).toBe(false);
    expect(ids.has('angle:ascendant:sign')).toBe(false);
    expect(ids.has(`aspect:${chart.aspects[0].id}`)).toBe(false);
  });

  it('keeps a stable sign even when another field of the same body is unstable', () => {
    const chart = canonicalNatalChart({
      time: {
        mode: 'approximate',
        localTime: '08:15',
        uncertaintyMinutes: 30,
        rangeStart: null,
        rangeEnd: null,
      },
    });
    chart.positions.moon.reliability = 'variable_in_range';
    chart.positions.moon.stable.sign = true;
    chart.positions.moon.stable.retrograde = false;
    chart.positions.moon.retrograde = null;
    chart.positions.moon.stable.house = true;

    const result = buildNatalInterpretation(chart);
    const ids = new Set(result.evidence.map((fact) => fact.id));

    expect(ids.has('position:moon:sign')).toBe(true);
    expect(ids.has('position:moon:house')).toBe(true);
    expect(ids.has('position:moon:retrograde')).toBe(false);
  });

  it('does not use houses or angles when birth time is unknown', () => {
    const chart = canonicalNatalChart({
      time: {
        mode: 'unknown',
        localTime: null,
        uncertaintyMinutes: null,
        rangeStart: null,
        rangeEnd: null,
      },
    });
    const result = buildNatalInterpretation(chart);

    expect(result.evidence.some((fact) => fact.kind === 'body_house')).toBe(false);
    expect(result.evidence.some((fact) => fact.kind === 'house_cusp')).toBe(false);
    expect(result.evidence.some((fact) => fact.kind === 'angle_sign')).toBe(false);
    expect(result.evidence.some((fact) => fact.kind === 'body_sign')).toBe(true);
    expect(result.evidence.some((fact) => fact.kind === 'aspect')).toBe(true);
  });

  it('keeps technical evidence separate from the plain meaning', () => {
    const result = buildNatalInterpretation(canonicalNatalChart());
    const sun = result.meanings.find((meaning) => meaning.semanticKey.startsWith('body-sign:sun:'));

    expect(sun).toBeDefined();
    expect(sun!.technicalText).toContain('Солнце');
    expect(sun!.text).not.toContain('Солнце');
    expect(sun!.text).not.toContain('дом');
    expect(sun!.evidenceIds).toEqual(['position:sun:sign', 'position:sun:house']);
    expect(sun!.area).toBeTruthy();
  });
  it('keeps every meaning explicitly scoped instead of silently dropping background factors', () => {
    const result = buildNatalInterpretation(canonicalNatalChart());

    expect(result.meanings.every((meaning) => (
      meaning.scope === 'personal'
      || meaning.scope === 'background'
      || meaning.scope === 'structural'
    ))).toBe(true);

    const saturnSign = result.meanings.find((meaning) => meaning.semanticKey.startsWith('body-sign:saturn:'));
    const sunSign = result.meanings.find((meaning) => meaning.semanticKey.startsWith('body-sign:sun:'));
    expect(saturnSign?.scope).toBe('background');
    expect(sunSign?.scope).toBe('personal');
    expect(result.storyMeaningIds).not.toContain(saturnSign!.id);
    expect(result.storyMeaningIds).toContain(sunSign!.id);
  });

  it('does not bring the old negative-routing vocabulary into the new semantic layer', () => {
    const result = buildNatalInterpretation(canonicalNatalChart());
    const copy = result.meanings.map((meaning) => meaning.text).join(' ').toLowerCase();

    for (const banned of [
      'скука',
      'потеря интереса',
      'непонимание',
      'центральное противоречие',
      'контроль и свобода',
    ]) {
      expect(copy).not.toContain(banned);
    }
  });

  it('treats aspects as interaction, not automatic good/bad labels', () => {
    const chart = canonicalNatalChart();
    chart.aspects = [
      {
        id: 'sun-mars-square',
        from: 'Sun',
        to: 'Mars',
        fromKey: 'sun',
        toKey: 'mars',
        type: 'square',
        exactAngle: 90,
        angle: 90,
        angularDistance: 89,
        orb: 1,
        orbRange: { min: 1, max: 1 },
        phase: 'applying',
        reliable: true,
        sampleCoverage: 1,
      },
      {
        id: 'uranus-neptune-trine',
        from: 'Uranus',
        to: 'Neptune',
        fromKey: 'uranus',
        toKey: 'neptune',
        type: 'trine',
        exactAngle: 120,
        angle: 120,
        angularDistance: 120,
        orb: 0,
        orbRange: { min: 0, max: 0 },
        phase: 'exact',
        reliable: true,
        sampleCoverage: 1,
      },
    ];

    const result = buildNatalInterpretation(chart);
    const square = result.meanings.find((meaning) => meaning.semanticKey === 'aspect:sun:square:mars');
    const outerTrine = result.meanings.find((meaning) => meaning.semanticKey === 'aspect:uranus:trine:neptune');

    expect(square?.text.toLowerCase()).not.toContain('плох');
    expect(square?.text.toLowerCase()).not.toContain('негатив');
    expect(outerTrine).toBeUndefined();
    expect(result.evidence.some(fact => fact.id === 'aspect:uranus-neptune-trine')).toBe(true);
  });

  it('shows one technical title and the approved explanation without duplicating an ending', () => {
    const chart = canonicalNatalChart();
    const explanation = explainMapSelection(chart, { kind: 'point', id: 'sun' })!;
    const reading = buildNatalInterpretation(chart);
    const sun = reading.meanings.find(item => item.semanticKey.startsWith('body-sign:sun:'))!;
    expect(explanation.reasons.filter(reason => reason.text === sun.text)).toHaveLength(1);
    expect(explanation.reasons.every(reason => !reason.facts)).toBe(true);
    expect(explanation.summary).toBe('');
    expect(explanation.reasons[0].title).not.toMatch(/Aries|Taurus|Cancer/);
    expect(explanation.what).not.toContain('описывает как');
  });

  it('does not turn opposite ends of one calculated axis into a personal difficulty', () => {
    const chart = canonicalNatalChart();
    const aspect = { ...chart.aspects[0], id: 'asc-dsc-axis', from: 'Ascendant', to: 'Descendant',
      fromKey: 'ascendant' as const, toKey: 'descendant' as const, type: 'opposition' as const,
      exactAngle: 180 as const, angle: 180, angularDistance: 180, orb: 0 };
    chart.aspects = [aspect];
    const before = JSON.stringify(chart);
    const reading = buildNatalInterpretation(chart);
    expect(reading.evidence.some(item => item.id === 'aspect:asc-dsc-axis')).toBe(true);
    expect(reading.meanings.some(item => item.evidenceIds.includes('aspect:asc-dsc-axis'))).toBe(false);
    const wheelAspect = buildMapData(chart).aspects.find(item => item.fromKey === 'ascendant')!;
    const explanation = explainMapSelection(chart, { kind: 'aspect', id: wheelAspect.id })!;
    expect(explanation.meaning).toContain('всегда 180°');
    expect(explanation.meaning).not.toMatch(/тебе|ты выбираешь|иногда|трудно/);
    expect(JSON.stringify(chart)).toBe(before);
  });

  it('localizes house facts and gives a calculation explanation instead of a fabricated minor-point trait', () => {
    const chart = canonicalNatalChart();
    const house = explainMapSelection(chart, { kind: 'house', id: '2' })!;
    expect(house.yours).toContain('Телец');
    expect(house.yours).not.toContain('Taurus');
    const minor = explainMapSelection(chart, { kind: 'point', id: 'chiron' })!;
    expect(minor.meaning).not.toContain('недостаточно');
    expect(minor.meaning).not.toContain('ты');
    expect(minor.meaning).not.toContain(minor.what);
    expect(minor.reasons).toHaveLength(1);
    expect(minor.summary).toBe('');
  });

  it('does not repeat a general character observation as money or work without relevant evidence', () => {
    const chart = canonicalNatalChart();
    chart.positions.sun.house = 1;
    const reading = buildNatalInterpretation(chart);
    const sun = reading.meanings.find(item => item.semanticKey.startsWith('body-sign:sun:'))!;
    expect(reading.topics.find(topic => topic.key === 'work')?.meaningIds || []).not.toContain(sun.id);
    expect(reading.topics.find(topic => topic.key === 'money')?.meaningIds || []).not.toContain(sun.id);
    expect(reading.topics.find(topic => topic.key === 'character')!.meaningIds).toContain(sun.id);
  });
});
