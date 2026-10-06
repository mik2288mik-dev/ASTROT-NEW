import { buildNatalTeaserFact } from '../lib/todayExploreFacts';
import type { NatalChartData } from '../types';

function chart(signs: Record<string, string>): NatalChartData {
  const entries = Object.entries(signs).map(([planet, sign]) => [
    planet,
    { planet, sign, longitude: 0, description: '' },
  ]);
  return { ...Object.fromEntries(entries), element: '', rulingPlanet: '', summary: '' } as unknown as NatalChartData;
}

describe('today explore natal teaser fact', () => {
  it('names a stellium with its planets', () => {
    const fact = buildNatalTeaserFact(chart({
      sun: 'Capricorn', moon: 'Cancer', mercury: 'Sagittarius', venus: 'Scorpio', mars: 'Capricorn',
      jupiter: 'Pisces', saturn: 'Libra', uranus: 'Pisces', neptune: 'Aquarius', pluto: 'Capricorn',
    }), 'ru');

    expect(fact?.headline).toBe('У тебя 3 планеты в Козероге');
    expect(fact?.body).toContain('Солнце, Марс и Плутон в одном знаке');
    expect(fact?.highlightSign).toBe('Capricorn');
  });

  it('falls back to an element tilt, then to the Sun and Moon', () => {
    const tilt = buildNatalTeaserFact(chart({
      sun: 'Cancer', moon: 'Scorpio', mercury: 'Pisces', venus: 'Cancer', mars: 'Scorpio', jupiter: 'Leo',
    }), 'ru');
    expect(tilt?.headline).toBe('5 из 6 планет, в знаках Воды');

    const plain = buildNatalTeaserFact(chart({ sun: 'Aries', moon: 'Taurus' }), 'ru');
    expect(plain?.headline).toBe('Солнце в Овне, Луна в Тельце');
  });

  it('returns nothing without a chart', () => {
    expect(buildNatalTeaserFact(null, 'ru')).toBeNull();
  });
});
