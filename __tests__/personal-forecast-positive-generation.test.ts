jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn() }));
jest.mock('../lib/personalForecastToneReview', () => ({ reviewPersonalForecastTone: jest.fn() }));
jest.mock('../lib/personalForecastDateContext', () => ({ buildPersonalForecastDateContext: () => ({ samples: [] }) }));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { reviewPersonalForecastTone } from '../lib/personalForecastToneReview';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import samples from './fixtures/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';

const writer = createLunaStructuredResponse as jest.Mock;
const reviewer = reviewPersonalForecastTone as jest.Mock;
const base = {
  profile: { isSetup: true, isPremium: true, theme: 'light' as const, name: 'Test', birthDate: '1990-03-14', birthTime: '09:41', birthPlace: 'Moscow', language: 'ru' as const },
  natal: samples.people[0].chart as unknown as NatalChartDataV2,
  model: 'gpt-5.6-luna',
};

beforeEach(() => {
  writer.mockReset();
  reviewer.mockReset();
  reviewer.mockResolvedValue({ accepted: true, reason: 'ok' });
});

it('rejects a problem-led result before review or saving', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Терпение на нуле', body: 'Сегодня всё раздражает.', closing: 'К вечеру станет спокойнее.' }) });
  await expect(generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow') }))
    .rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:TONE:');
  expect(reviewer).not.toHaveBeenCalled();
});

it('does not accept an unpleasant or repeated reading even when wording differs', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Время общения', body: 'Сегодня разговор потечёт легко и непринуждённо.', closing: 'Хорошо поболтать.' }) });
  reviewer.mockResolvedValue({ accepted: false, reason: 'repeated' });
  const history = [{ period: 'day' as const, periodKey: '2026-07-25', fragments: [{ kind: 'forecast' as const, text: 'Можно приятно поговорить.', semanticFingerprint: null }] }];
  await expect(generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow'), history }))
    .rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:TONE:REPEATED');
  expect(reviewer.mock.calls[0][0].history[0].body).toBe('Можно приятно поговорить.');
  expect(reviewer.mock.calls[0][0]).not.toHaveProperty('profile');
});

it('fails closed if the tone review is unavailable', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший день', body: 'Сегодня хочется поболтать и посмеяться.', closing: 'День для общения.' }) });
  reviewer.mockRejectedValue(new Error('provider unavailable'));
  await expect(generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow') }))
    .rejects.toThrow('PERSONAL_FORECAST_TONE_REVIEW_UNAVAILABLE');
});

it('gives the writer feedback when a negative draft is retried', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший день', body: 'Сегодня хочется поболтать и посмеяться.', closing: 'День для общения.' }) });
  await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow'), retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:NEGATIVE' });
  const data = JSON.parse(writer.mock.calls[0][0].input);
  expect(data.retry_feedback).toContain('приятный и спокойный прогноз');
});

it('asks for a natural title and ending after a style rejection', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Есть о чём поговорить', body: 'Сегодня легко разговориться и посмеяться.', closing: 'Хороший день для разговоров.' }) });
  await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow'), retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:STYLE' });
  expect(JSON.parse(writer.mock.calls[0][0].input).retry_feedback).toContain('заголовок');
  expect(JSON.parse(writer.mock.calls[0][0].input).retry_feedback).toContain('финала как с открытки');
});

it.each(['week', 'month'] as const)('reviews %s and does not add a mandatory advice block', async (period) => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Приятное время', body: 'Захочется поделиться тем, что тебя радует. Хорошие разговоры найдутся сами.', action_type: 'stop', action_text: 'Не торопись.' }) });
  const result = await generatePersonalForecastPackage({ ...base, period, window: resolvePersonalForecastWindow(period, period === 'week' ? '2026-W30' : '2026-07', 'Europe/Moscow') });
  expect(reviewer).toHaveBeenCalledTimes(1);
  expect(result.overview.actionType).toBeNull();
  expect(result.overview.actionText).toBeNull();
  expect(writer.mock.calls[0][0].instructions).toContain('приятную или спокойную');
});

it('still checks the period voice when the prior attempt failed tone review', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хорошая неделя', body: 'Не распыляйся.', action_type: 'talk', action_text: '' }) });
  await expect(generatePersonalForecastPackage({ ...base, period: 'week', window: resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow'), retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:NEGATIVE' }))
    .rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:VOICE');
  expect(reviewer).not.toHaveBeenCalled();
});

it('rejects exposed astrological aspects and requests a plain-language retry', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Приятная неделя', body: 'Венера в трине к твоему Солнцу: мягкая связь.', action_type: 'talk', action_text: '' }) });
  const input = { ...base, period: 'week' as const, window: resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow') };
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:TONE:ASTROLOGY_JARGON');
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший разговор', body: 'Эта неделя подходит для приятного разговора.', action_type: 'talk', action_text: '' }) });
  await generatePersonalForecastPackage({ ...input, retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:ASTROLOGY_JARGON' });
  expect(JSON.parse(writer.mock.calls[1][0].input).retry_feedback).toContain('не называя планеты');
});
