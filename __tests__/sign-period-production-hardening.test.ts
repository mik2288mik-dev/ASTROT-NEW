import fs from 'fs';
import path from 'path';
import {
  buildSignMonthlyHoroscopePrompt,
  buildSignWeeklyHoroscopePrompt,
  buildSignYearlyHoroscopePrompt,
} from '../lib/contentPromptBuilders';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowYearKey,
} from '../lib/date-utils';
import { normalizeSignPeriodReading } from '../lib/horoscope/signPeriodShared';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const originalApiKey = process.env.OPENAI_API_KEY;

const fullReading = {
  headline: 'Проверь, что тебе действительно подходит',
  summary: 'Не каждое уверенное предложение требует согласия.',
  reading: 'Сравни обещание с тем, как решение будет выглядеть в обычный вторник.',
  focus: 'Смотри на последствия выбора.',
  chance: 'Опирайся на факты и прямые вопросы.',
  risk: 'Не принимай чужую уверенность за доказательство.',
  context: 'Это общий прогноз знака.',
  advice: ['Попроси конкретику.', 'Оставь себе право отказаться.'],
};

afterEach(() => {
  jest.resetModules();
  jest.dontMock('../lib/db');
  if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalApiKey;
});

function mockResponse() {
  const result: { statusCode: number; body: any; headers: Record<string, string> } = {
    statusCode: 200,
    body: null,
    headers: {},
  };
  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: any) {
      result.body = body;
      return response;
    },
    setHeader(name: string, value: string) {
      result.headers[name] = value;
    },
  };
  return { response: response as any, result };
}

describe('sign period production hardening', () => {
  it('accepts a short complete ForecastDailyReading without losing semantic fields', () => {
    const reading = normalizeSignPeriodReading(
      fullReading,
      '2026-W30',
      'SIGN_WEEKLY_GENERATION_FAILED'
    );
    expect(reading).toEqual({ date: '2026-W30', ...fullReading });
    expect(reading.chance).toBe(fullReading.chance);
    expect(reading.risk).toBe(fullReading.risk);
    expect(reading.context).toBe(fullReading.context);
  });

  it('asks week, month, and year for the complete existing response shape without wellness filler', () => {
    const prompts = [
      buildSignWeeklyHoroscopePrompt().user,
      buildSignMonthlyHoroscopePrompt().user,
      buildSignYearlyHoroscopePrompt().user,
    ];
    for (const prompt of prompts) {
      for (const field of ['headline', 'summary', 'reading', 'focus', 'chance', 'risk', 'context', 'advice']) {
        expect(prompt).toContain(`"${field}"`);
      }
      expect(prompt).not.toMatch(/не распыляться|честность с собой|спокойный темп|замедлиться|не спешить|энергия недели|ритм месяца|благоприятный период|Вселенная|держи курс|резкий рывок|пять новых дел/i);
    }
  });

  it.each([
    ['weekly', '../lib/horoscope/signWeekly', 'getCachedSignWeeklyHoroscope', 'getOrGenerateSignWeeklyHoroscope', '2026-W30', 'SIGN_WEEKLY_GENERATION_FAILED'],
    ['monthly', '../lib/horoscope/signMonthly', 'getCachedSignMonthlyHoroscope', 'getOrGenerateSignMonthlyHoroscope', '2026-07', 'SIGN_MONTHLY_GENERATION_FAILED'],
    ['yearly', '../lib/horoscope/signYearly', 'getCachedSignYearlyHoroscope', 'getOrGenerateSignYearlyHoroscope', '2026', 'SIGN_YEARLY_GENERATION_FAILED'],
  ])('%s keeps the full cached shape and never inserts a fallback after model failure', async (
    _label,
    modulePath,
    cachedExport,
    generateExport,
    periodKey,
    errorCode
  ) => {
    delete process.env.OPENAI_API_KEY;
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ payload: fullReading }] })
      .mockResolvedValue({ rows: [] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const module = require(modulePath);

    const cached = await module[cachedExport]('leo', periodKey, 'ru');
    expect(cached).toEqual({
      date: periodKey,
      ...fullReading,
      context: _label === 'yearly'
        ? 'Это общий разбор для твоего знака. Личная картина начинается с натальной карты.'
        : fullReading.context,
    });
    await expect(module[generateExport]('leo', periodKey, 'ru')).rejects.toMatchObject({
      code: errorCode,
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO content_cache'))).toBe(false);
  });

  it.each([
    ['weekly', '../pages/api/content/horoscope/sign-weekly', getMoscowIsoWeekKey(), 'SIGN_WEEKLY_GENERATION_FAILED'],
    ['monthly', '../pages/api/content/horoscope/sign-monthly', getMoscowMonthKey(), 'SIGN_MONTHLY_GENERATION_FAILED'],
    ['yearly', '../pages/api/content/horoscope/sign-yearly', getMoscowYearKey(), 'SIGN_YEARLY_GENERATION_FAILED'],
  ])('%s handler rejects foreign periods, accepts current GET, and returns controlled 503', async (
    _label,
    modulePath,
    currentPeriod,
    errorCode
  ) => {
    delete process.env.OPENAI_API_KEY;
    const query = jest.fn().mockResolvedValue({ rows: [] });
    jest.doMock('../lib/db', () => ({ getPool: () => ({ query }) }));
    const handler = require(modulePath).default;

    const foreign = mockResponse();
    await handler({
      method: 'POST',
      body: { sign: 'leo', periodKey: '1900', language: 'ru' },
    } as any, foreign.response);
    expect(foreign.result).toMatchObject({
      statusCode: 400,
      body: { code: 'PERIOD_NOT_CURRENT' },
    });

    const currentGet = mockResponse();
    await handler({
      method: 'GET',
      query: { sign: 'leo', periodKey: currentPeriod, language: 'ru' },
    } as any, currentGet.response);
    expect(currentGet.result.statusCode).toBe(404);

    const currentPost = mockResponse();
    await handler({
      method: 'POST',
      body: { sign: 'leo', periodKey: currentPeriod, language: 'ru' },
    } as any, currentPost.response);
    expect(currentPost.result).toMatchObject({
      statusCode: 503,
      body: { code: errorCode },
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO content_cache'))).toBe(false);
  });

  it('keeps personal Dashboard lazy and scopes state by chart, period, language, and current key', () => {
    const dashboard = read('views/Dashboard.tsx');
    expect(dashboard).toContain('loadPeriod(activePeriod)');
    expect(dashboard).toContain('`${contextKey}:${period}:${periodKey}`');
    expect(dashboard).toContain('setPeriodStates({})');
    expect(dashboard).toContain('readLocalPersonalForecast');
    expect(dashboard).not.toMatch(/getCachedWeeklySignHoroscope|ensureMonthlySignHoroscope/);
  });
});
