jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn() }));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { reviewPersonalForecastTone } from '../lib/personalForecastToneReview';

const request = createLunaStructuredResponse as jest.Mock;
const input = {
  language: 'ru' as const,
  reading: { title: 'Хороший разговор', body: 'Сегодня приятно поболтать.', closing: 'Можно и посмеяться.' },
  history: [{ title: 'Время для себя', body: 'Приятно заняться тем, что нравится.', closing: '' }],
};

beforeEach(() => request.mockReset());

it.each([
  [true, 'ok'],
  [false, 'negative'],
  [false, 'repeated'],
  [false, 'style'],
] as const)('returns a validated review: %s, %s', async (accepted, reason) => {
  request.mockResolvedValue({ content: JSON.stringify({ accepted, reason }) });
  await expect(reviewPersonalForecastTone(input)).resolves.toEqual({ accepted, reason });
  const payload = JSON.parse(request.mock.calls[0][0].input);
  expect(payload).toEqual({ language: 'ru', reading: input.reading, recent_readings: input.history });
  expect(request.mock.calls[0][0].store).toBe(false);
});

it.each([
  '{invalid',
  JSON.stringify({ accepted: true, reason: 'negative' }),
  JSON.stringify({ accepted: false, reason: 'ok' }),
  JSON.stringify({ accepted: 'yes', reason: 'ok' }),
  JSON.stringify({ accepted: false, reason: 'unknown' }),
])('fails closed on an invalid review', async (content) => {
  request.mockResolvedValue({ content });
  await expect(reviewPersonalForecastTone(input)).rejects.toThrow('PERSONAL_FORECAST_TONE_REVIEW_UNAVAILABLE');
});

it('fails closed on a provider error without exposing its text', async () => {
  request.mockRejectedValue(new Error('private provider detail'));
  await expect(reviewPersonalForecastTone(input)).rejects.toThrow('PERSONAL_FORECAST_TONE_REVIEW_UNAVAILABLE');
});

it('asks the reviewer to assess title, excessive sweetness, forced familiarity and the closing without banning warm words', async () => {
  request.mockResolvedValue({ content: JSON.stringify({ accepted: false, reason: 'style' }) });
  const awkward = {
    language: 'ru' as const,
    reading: {
      title: 'Разговоров хороших день',
      body: 'Лови вайб, бро: милота этого дня просто зашкаливает!',
      closing: 'Пусть каждый миг сияет волшебством.',
    },
    history: [],
  };
  await expect(reviewPersonalForecastTone(awkward)).resolves.toEqual({ accepted: false, reason: 'style' });
  const { instructions, input: requestInput } = request.mock.calls[0][0];
  expect(instructions).toContain('Review the title on its own too');
  expect(instructions).toContain('unnatural word order');
  expect(instructions).toContain('saccharine');
  expect(instructions).toContain('forced slang');
  expect(instructions).toContain('greeting-card-style closing');
  expect(instructions).toContain('judge the phrase in context, not individual words');
  expect(instructions).toContain('normal pleasant, calm or brief reading');
  expect(JSON.parse(requestInput)).toEqual({ language: 'ru', reading: awkward.reading, recent_readings: [] });
});

it('passes an ordinary warm reading through to the reviewer without filtering its words', async () => {
  request.mockResolvedValue({ content: JSON.stringify({ accepted: true, reason: 'ok' }) });
  const ordinary = {
    language: 'ru' as const,
    reading: { title: 'Хороший разговор', body: 'Сегодня приятно поболтать и вместе посмеяться.', closing: 'Пусть день будет хорошим.' },
    history: [],
  };
  await expect(reviewPersonalForecastTone(ordinary)).resolves.toEqual({ accepted: true, reason: 'ok' });
  expect(JSON.parse(request.mock.calls[0][0].input).reading).toEqual(ordinary.reading);
});
