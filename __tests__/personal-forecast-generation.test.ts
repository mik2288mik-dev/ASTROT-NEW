import {
  buildPersonalForecastTopicPrompt,
  validateGeneratedForecastTopic,
} from '../lib/personalForecastGeneration';
import type { TopicEvidence } from '../lib/personalForecastContract';

const evidence: TopicEvidence = {
  primary: [{
    id: 'aspect-1',
    kind: 'transit_to_natal',
    transitPlanet: 'mars',
    natalPoint: 'sun',
    aspect: 'trine',
    orb: 1.2,
    status: 'applying',
    startsAt: '2026-07-26T00:00:00.000Z',
    endsAt: '2026-07-26T23:59:59.000Z',
    strength: 78,
    polarity: 'supporting',
    topicKeys: ['overview', 'work'],
    calculationSource: 'test:swisseph',
  }],
  supporting: [],
  conflicting: [],
  confidence: 'high',
};

describe('personal forecast evidence-only generation', () => {
  it('task prompt supplies calculations and JSON constraints without a local persona', () => {
    const prompt = buildPersonalForecastTopicPrompt({
      language: 'ru',
      period: 'day',
      periodStart: '2026-07-26',
      periodEnd: '2026-07-26',
      timezone: 'Europe/Moscow',
      topicKey: 'work',
      topicTitle: 'Работа и дела',
      evidence,
    });
    expect(prompt).toContain('"aspect-1"');
    expect(prompt).toContain('"evidence_ids"');
    expect(prompt).toContain('astrology');
    expect(prompt).toMatch(/не придумывай бытовую сцену/i);
    expect(prompt).not.toMatch(/astrologer|psychologist|therapist|coach|mentor|эзотерик|психолог|коуч/i);
  });

  it('accepts a short complete answer and natural-language dates supplied by evidence', () => {
    const valid = validateGeneratedForecastTopic({
      period: 'day',
      evidence,
      raw: {
        card: 'Рабочий вопрос требует точного решения.',
        reading: '26 июля тема становится заметнее, но результат зависит от твоего решения.',
        astrology: {
          explanation: 'Марс поддерживает натальное Солнце.',
          evidence_ids: ['aspect-1'],
        },
      },
    });
    expect(valid.errors).toEqual([]);
    expect(valid.value?.card.length).toBeLessThan(80);
  });

  it('rejects IDs and natural or ISO dates absent from deterministic evidence', () => {
    const invalid = validateGeneratedForecastTopic({
      period: 'day',
      evidence,
      raw: {
        card: 'Рабочий вопрос решится.',
        reading: '2026-08-10 ты получишь новую работу.',
        astrology: {
          explanation: 'Юпитер гарантирует событие.',
          evidence_ids: ['invented-aspect'],
        },
      },
    });
    expect(invalid.value).toBeNull();
    expect(invalid.errors.join(' ')).toContain('outside');
    expect(invalid.errors.join(' ')).toContain('unsupported dates');

    const naturalDate = validateGeneratedForecastTopic({
      period: 'day',
      evidence,
      raw: {
        card: 'Рабочий вопрос требует точного решения.',
        reading: '10 августа тема станет заметнее.',
        astrology: {
          explanation: 'Марс поддерживает натальное Солнце.',
          evidence_ids: ['aspect-1'],
        },
      },
    });
    expect(naturalDate.errors.join(' ')).toContain('unsupported dates');
  });
});
