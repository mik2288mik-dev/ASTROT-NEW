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
