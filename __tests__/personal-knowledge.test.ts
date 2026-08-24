import type { NatalChartData, PlanetPosition } from '../types';
import {
  getKnowledgeTopics,
  resolvePersonalKnowledge,
  type PersonalKnowledgeReliability,
} from '../lib/knowledge';

function position(planet: string, sign: string, house: number): PlanetPosition {
  return { planet, sign, house, retrograde: false, description: '' };
}

const chart: NatalChartData = {
  sun: position('Sun', 'Aries', 5),
  moon: position('Moon', 'Cancer', 3),
  rising: position('Ascendant', 'Scorpio', 1),
  mercury: position('Mercury', 'Pisces', 4),
  venus: position('Venus', 'Taurus', 7),
  mars: position('Mars', 'Gemini', 6),
  jupiter: position('Jupiter', 'Leo', 9),
  saturn: position('Saturn', 'Aquarius', 11),
  element: 'Fire',
  rulingPlanet: 'Mars',
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: ['Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra'][index],
    degree: 0,
    longitude: index * 30,
  })),
  aspects: [
    { type: 'trine', angle: 120, orb: 0.5, from: 'Venus', to: 'Moon' },
    { type: 'square', angle: 90, orb: 0.8, from: 'Mercury', to: 'Mars' },
  ],
  birthTimeQuality: 'exact',
  summary: '',
};

const exactReliability: PersonalKnowledgeReliability = {
  quality: 'exact', anglesIncluded: true, housesIncluded: true,
};

const topics = getKnowledgeTopics('ru');
const topic = (id: string) => topics.find((candidate) => candidate.id === id)!;

describe('personal knowledge fact resolver', () => {
  it('returns only compact calculated facts and a prepared, unsent question', () => {
    const venus = resolvePersonalKnowledge(topic('planet-venus'), chart, exactReliability, 'ru');
    expect(venus).toEqual({
      status: 'ready',
      facts: ['Венера — Телец', '7 дом', 'Трин с Луной'],
      suggestedQuestion: 'Что значит моя Венера в отношениях?',
    });

    const mercury = resolvePersonalKnowledge(topic('planet-mercury'), chart, exactReliability, 'ru');
    expect(mercury?.facts).toEqual(['Меркурий — Рыбы', '4 дом', 'Квадрат с Марсом']);
    expect(mercury?.suggestedQuestion).toBe('Что значит мой Меркурий в Рыбах?');
  });

  it('limits house and aspect facts instead of reproducing a natal report', () => {
    const seventh = resolvePersonalKnowledge(topic('house-7'), chart, exactReliability, 'ru');
    expect(seventh?.facts).toEqual(['В 7 доме: Венера']);
    expect(seventh?.suggestedQuestion).toBe('Что значит мой 7 дом?');

    const aspects = resolvePersonalKnowledge(topic('aspects-overview'), chart, exactReliability, 'ru');
    expect(aspects?.facts).toHaveLength(2);
    expect(aspects?.suggestedQuestion).toBe('Что значат мои главные аспекты?');

    const square = resolvePersonalKnowledge(topic('aspect-square'), chart, exactReliability, 'ru');
    expect(square?.facts).toEqual(['Меркурий — квадрат — Марс']);
    expect(square?.suggestedQuestion).toBe('Что значат квадраты в моей натальной карте?');
  });

  it('suppresses time-sensitive facts when birth time is unknown', () => {
    const unknownReliability: PersonalKnowledgeReliability = {
      quality: 'unknown', anglesIncluded: false, housesIncluded: false,
    };
    const unknownChart = { ...chart, birthTimeQuality: 'unknown' as const };

    expect(resolvePersonalKnowledge(topic('ascendant'), unknownChart, unknownReliability, 'ru')).toEqual({
      status: 'requires_exact_birth_time', facts: [],
    });
    expect(resolvePersonalKnowledge(topic('house-7'), unknownChart, unknownReliability, 'ru')).toEqual({
      status: 'requires_exact_birth_time', facts: [],
    });
  });

  it('does not present unstable approximate-time angles or houses as exact', () => {
    const approximateReliability: PersonalKnowledgeReliability = {
      quality: 'approximate', anglesIncluded: true, housesIncluded: true,
    };
    const approximateChart = { ...chart, birthTimeQuality: 'approximate' as const };

    expect(resolvePersonalKnowledge(topic('ascendant'), approximateChart, approximateReliability, 'ru')).toEqual({
      status: 'requires_exact_birth_time', facts: [],
    });
    expect(resolvePersonalKnowledge(topic('house-7'), approximateChart, approximateReliability, 'ru')).toEqual({
      status: 'requires_exact_birth_time', facts: [],
    });
  });

  it('does not add an empty personal block to a general article', () => {
    expect(resolvePersonalKnowledge(topic('natal-chart-basics'), chart, exactReliability, 'ru')).toBeNull();
    expect(resolvePersonalKnowledge(topic('retrograde-mercury'), chart, exactReliability, 'ru')).toBeNull();
  });
});
