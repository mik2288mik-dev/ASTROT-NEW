import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { buildNatalInterpretation } from '../lib/natalInterpretation';

describe('unified natal interpretation', () => {
  it('interprets every reliable extracted fact instead of selecting only important ones', () => {
    const chart = canonicalNatalChart();
    const result = buildNatalInterpretation(chart);

    expect(result.evidence.length).toBeGreaterThan(20);
    expect(result.meanings).toHaveLength(result.evidence.length);
    expect(result.storyMeaningIds).toHaveLength(result.meanings.length);

    const covered = new Set(result.meanings.flatMap((meaning) => meaning.evidenceIds));
    expect([...result.evidence.map((fact) => fact.id).filter((id) => !covered.has(id))]).toEqual([]);
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
    expect(sun!.evidenceIds).toEqual(['position:sun:sign']);
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
    expect(result.storyMeaningIds).toContain(saturnSign!.id);
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
    expect(outerTrine?.scope).toBe('background');
    expect(result.storyMeaningIds).toContain(outerTrine!.id);
  });

});
