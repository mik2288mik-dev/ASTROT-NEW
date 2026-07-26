import type { NatalChartData } from '../types';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  type ForecastEvidenceView,
  type ForecastTopicText,
  type PersonalForecastPackage,
} from '../lib/personalForecastContract';
import { APP_VOICE_VERSION } from '../lib/appVoice';

export const chartFixture = {
  sun: { planet: 'Sun', sign: 'Aries', degree: 10, longitude: 10, house: 1 },
  moon: { planet: 'Moon', sign: 'Taurus', degree: 12, longitude: 42, house: 2 },
  rising: { planet: 'Ascendant', sign: 'Gemini', degree: 4, longitude: 64, house: 1 },
  mercury: { planet: 'Mercury', sign: 'Pisces', degree: 28, longitude: 358, house: 10 },
  venus: { planet: 'Venus', sign: 'Aquarius', degree: 18, longitude: 318, house: 9 },
  mars: { planet: 'Mars', sign: 'Cancer', degree: 8, longitude: 98, house: 3 },
  jupiter: { planet: 'Jupiter', sign: 'Leo', degree: 10, longitude: 130, house: 4 },
  saturn: { planet: 'Saturn', sign: 'Scorpio', degree: 10, longitude: 220, house: 6 },
  uranus: { planet: 'Uranus', sign: 'Sagittarius', degree: 10, longitude: 250, house: 7 },
  neptune: { planet: 'Neptune', sign: 'Capricorn', degree: 10, longitude: 280, house: 8 },
  pluto: { planet: 'Pluto', sign: 'Scorpio', degree: 20, longitude: 230, house: 6 },
  houses: Array.from({ length: 12 }, (_, index) => ({
    house: index + 1,
    sign: 'Aries',
    degree: 0,
    longitude: index * 30,
  })),
  aspects: [],
  timezone: 'Europe/Moscow',
  calculationVersion: 'swisseph-test-v1',
} as unknown as NatalChartData;

const evidenceView: ForecastEvidenceView = {
  id: 'e1',
  factor: 'Марс — трин к Солнцу',
  orb: 1.2,
  status: 'applying',
  period: '2026-07-26',
  meaning: 'Фактор поддерживает тему.',
};

export function topicFixture(id = 'e1'): ForecastTopicText {
  return {
    card: 'Сейчас проще увидеть главный участок и принять точное решение.',
    reading: 'Период подчёркивает одну конкретную задачу. Вывод основан на рассчитанном факторе и не обещает внешнее событие.',
    astrology: {
      explanation: 'Рассчитанный аспект усиливает тему и задаёт период её проявления.',
      evidence_ids: [id],
    },
  };
}

export function personalForecastFixture(): PersonalForecastPackage {
  return {
    period: 'day',
    periodKey: '2026-07-26',
    periodStart: '2026-07-26',
    periodEnd: '2026-07-26',
    timezone: 'Europe/Moscow',
    overview: topicFixture(),
    love: topicFixture(),
    work: topicFixture(),
    money: topicFixture(),
    mood_energy: topicFixture(),
    communication: topicFixture(),
    luck: topicFixture(),
    dynamic: [
      { key: 'business', title: 'Бизнес', text: topicFixture() },
      { key: 'study', title: 'Учёба', text: topicFixture() },
    ],
    evidence: { e1: evidenceView },
    visual: { heroAssetId: null, topicAssetIds: {} },
    meta: {
      model: 'gpt-4.1',
      promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
      voiceVersion: APP_VOICE_VERSION,
      calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
      generatedAt: '2026-07-26T10:00:00.000Z',
      status: 'ready',
      diagnosticCode: null,
    },
  };
}
