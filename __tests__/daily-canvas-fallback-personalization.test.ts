import { buildDailyCanvasFallback } from '../lib/natalHumanInterpretation';
import type { NatalChartData, PlanetPosition, UserProfile } from '../types';

function profile(id: string, name: string, birthDate: string, birthTime: string, birthPlace: string): UserProfile {
  return {
    id,
    name,
    birthDate,
    birthTime,
    birthPlace,
    isSetup: true,
    language: 'ru',
    theme: 'light',
    isPremium: true,
  };
}

function position(planet: string, sign: string, degree: number): PlanetPosition {
  return {
    planet,
    sign,
    degree,
    description: '',
  };
}

function chart(sun: string, moon: string, rising: string): NatalChartData {
  return {
    sun: position('sun', sun, 12),
    moon: position('moon', moon, 18),
    rising: position('rising', rising, 4),
    mercury: position('mercury', 'Gemini', 7),
    venus: position('venus', 'Taurus', 22),
    mars: position('mars', 'Leo', 3),
    element: 'Fire',
    rulingPlanet: 'Mars',
    summary: '',
    calculationVersion: 'test',
    chartQuality: {
      birthTimeQuality: 'exact',
      ascendantReliable: true,
      housesReliable: false,
      houseBasedPersonalization: false,
      notes: [],
    },
  };
}

describe('daily canvas fallback personalization', () => {
  it('does not collapse different profiles into the same hero fallback for one date', () => {
    const first = buildDailyCanvasFallback(
      profile('101', 'Михаил', '1990-03-21', '08:15', 'Moscow'),
      chart('Aries', 'Cancer', 'Libra'),
      '2026-07-10',
    );
    const second = buildDailyCanvasFallback(
      profile('202', 'Анна', '1988-11-09', '21:40', 'Saint Petersburg'),
      chart('Scorpio', 'Aquarius', 'Capricorn'),
      '2026-07-10',
    );

    expect(first.summary).not.toBe(second.summary);
    expect(first.do).not.toEqual(second.do);
    expect(first.dont).not.toEqual(second.dont);
    expect(first.summary).toContain('Михаил');
    expect(second.summary).toContain('Анна');
  });

  it('keeps the fallback stable for the same profile, chart, and date', () => {
    const user = profile('101', 'Михаил', '1990-03-21', '08:15', 'Moscow');
    const natal = chart('Aries', 'Cancer', 'Libra');

    expect(buildDailyCanvasFallback(user, natal, '2026-07-10')).toEqual(
      buildDailyCanvasFallback(user, natal, '2026-07-10'),
    );
  });
});
