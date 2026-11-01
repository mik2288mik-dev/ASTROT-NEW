jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn() }));
jest.mock('../lib/personalForecastDateContext', () => ({ buildPersonalForecastDateContext: () => ({ samples: [] }) }));

import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow } from '../lib/personalForecastContract';
import samples from './fixtures/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';

const writer = createLunaStructuredResponse as jest.Mock;
const base = {
  profile: { isSetup: true, isPremium: true, theme: 'light' as const, name: 'Test', birthDate: '1990-03-14', birthTime: '09:41', birthPlace: 'Moscow', language: 'ru' as const },
  natal: samples.people[0].chart as unknown as NatalChartDataV2,
  model: 'gpt-5.6-luna',
};

beforeEach(() => {
  writer.mockReset();
});

it('returns a problem-led result rather than hiding the only reading', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Терпение на нуле', body: 'Сегодня всё раздражает.', closing: 'К вечеру станет спокойнее.' }) });
  const result = await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow') });
  expect(result.overview.text).toContain('Сегодня всё раздражает.');
});

it('returns an identical earlier reading without another model call', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Время общения', body: 'Сегодня разговор потечёт легко и непринуждённо.', closing: 'Хорошо поболтать.' }) });
  const history = [{ period: 'day' as const, periodKey: '2026-07-25', fragments: [{ kind: 'forecast' as const, text: 'Сегодня разговор потечёт легко и непринуждённо.', semanticFingerprint: null }] }];
  const result = await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow'), history });
  expect(result.overview.text).toContain('Сегодня разговор потечёт легко и непринуждённо.');
  expect(writer).toHaveBeenCalledTimes(1);
});

it.each([
  'Появится возможность встретиться с друзьями.',
  'Сегодня интерес к музыке вырастет.',
  'Сегодня можно спокойно провести день в своём темпе.',
  'Не спеши — музыка подождёт.',
  'Спокойный ритм песни делает её похожей на колыбельную.',
  'Не торопись раскрывать сюрприз: так шутка получится смешнее.',
])('accepts ordinary Russian wording in the forecast body: %s', async (body) => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший день', body, closing: 'Время для приятного.' }) });
  const result = await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow') });
  expect(result.overview.text).toContain(body);
  expect(result.overview.title).toBe('Хороший день');
  expect(writer).toHaveBeenCalledTimes(1);
});

it.each(['week', 'month'] as const)('accepts normal wording in the %s forecast', async (period) => {
  const body = 'Появится возможность встретиться с друзьями. Сегодня интерес к музыке вырастет.';
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хорошее время', body, action_type: 'talk', action_text: '' }) });
  const result = await generatePersonalForecastPackage({ ...base, period, window: resolvePersonalForecastWindow(period, period === 'week' ? '2026-W30' : '2026-07', 'Europe/Moscow') });
  expect(result.overview.text).toBe(body);
});

it('preserves ordinary wording in the closing instead of hiding it', async () => {
  const closing = 'Появится возможность встретиться с друзьями.';
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший день', body: 'Тебе захочется провести время с друзьями.', closing }) });
  const result = await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow') });
  expect(result.overview.text).toContain(closing);
  expect(result.meta.diagnosticCode).toBeNull();
});

it('gives the writer feedback when a negative draft is retried', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хороший день', body: 'Сегодня хочется поболтать и посмеяться.', closing: 'День для общения.' }) });
  await generatePersonalForecastPackage({ ...base, period: 'day', window: resolvePersonalForecastWindow('day', '2026-07-26', 'Europe/Moscow'), retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:NEGATIVE' });
  const data = JSON.parse(writer.mock.calls[0][0].input);
  expect(data.retry_feedback).toContain('приятный и спокойный прогноз');
});

it.each(['week', 'month'] as const)('generates %s with one model call and no mandatory advice block', async (period) => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Приятное время', body: 'Захочется поделиться тем, что тебя радует. Хорошие разговоры найдутся сами.', action_type: 'stop', action_text: 'Не торопись.' }) });
  const result = await generatePersonalForecastPackage({ ...base, period, window: resolvePersonalForecastWindow(period, period === 'week' ? '2026-W30' : '2026-07', 'Europe/Moscow') });
  expect(writer).toHaveBeenCalledTimes(1);
  expect(result.overview.actionType).toBeNull();
  expect(result.overview.actionText).toBeNull();
});

it('keeps a period reading with voice warnings', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Хорошая неделя', body: 'Твоя карта показывает перемены.', action_type: 'talk', action_text: '' }) });
  const result = await generatePersonalForecastPackage({ ...base, period: 'week', window: resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow'), retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:TONE:NEGATIVE' });
  expect(result.overview.text).toBe('Твоя карта показывает перемены.');
});

it('keeps a period reading that exposes astrological aspects', async () => {
  writer.mockResolvedValue({ content: JSON.stringify({ title: 'Приятная неделя', body: 'Венера в трине к твоему Солнцу: мягкая связь.', action_type: 'talk', action_text: '' }) });
  const input = { ...base, period: 'week' as const, window: resolvePersonalForecastWindow('week', '2026-W30', 'Europe/Moscow') };
  expect((await generatePersonalForecastPackage(input)).overview.text).toContain('Венера в трине');
  expect(writer).toHaveBeenCalledTimes(1);
});
