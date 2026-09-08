import type { UserProfile } from '../types';
import {
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  getPersonalForecastPackageValidationError,
  resolvePersonalForecastWindow,
  slicePersonalForecastForAccess,
} from '../lib/personalForecastContract';
import {
  buildSimplePersonalForecastInput,
  buildSimplePersonalForecastPackage,
  getSimplePersonalForecastSystemPrompt,
} from '../lib/personalForecastSimpleGeneration';

const profile = {
  id: 'forecast-simple-test',
  name: 'Миша',
  language: 'ru',
  gender: 'male',
  birthDate: '1989-03-06',
  birthTime: '23:15',
  birthTimeMode: 'exact',
  birthPlace: 'Сергиев Посад',
  birthTimezone: 'Europe/Moscow',
} as UserProfile;

const payload = {
  title: 'Не делай второй круг',
  summary: 'Сегодня проще решить один затянувшийся вопрос, чем ещё раз репетировать идеальный ответ. Если появится новый вариант, сначала проверь, действительно ли он лучше старого.',
  relationships: {
    title: 'Без телепатии',
    teaser: 'Лучше спросить прямо, чем угадывать чужое настроение.',
    text: 'В разговорах сегодня полезнее обычная ясность. Если человек отвечает странно, один прямой вопрос сэкономит больше времени, чем десять версий в голове.',
  },
  things: {
    title: 'Закрой один хвост',
    teaser: 'Одна законченная мелочь даст больше, чем пять новых стартов.',
    text: 'В делах хорошо работает простой порядок: сначала то, что уже почти готово. Новая идея никуда не убежит, а закрытый хвост перестанет маячить на заднем плане.',
  },
  self: {
    title: 'Не усложняй',
    teaser: 'Не каждый выбор требует отдельного совещания с самим собой.',
    text: 'Для себя оставь чуть меньше церемоний. Если решение уже понятно, можно не устраивать ему ещё один экзамен на идеальность.',
  },
  closing: 'Сегодня достаточно одного нормального решения.',
};

describe('simple personal forecast runtime', () => {
  it('uses one human-facing prompt without the old hidden brief pipeline', () => {
    const prompt = getSimplePersonalForecastSystemPrompt('ru', 'day');
    expect(prompt).toContain('по-человечески');
    expect(prompt).not.toContain('astrologer_brief');
    expect(prompt).not.toContain('минимум слов');
    expect(prompt).not.toContain('предложений');
  });

  it('passes only raw private profile context and the output meaning to the model', () => {
    const window = resolvePersonalForecastWindow('day', '2026-09-08', 'Europe/Moscow');
    const input = JSON.parse(buildSimplePersonalForecastInput({ profile, period: 'day', window }));
    expect(input.person.birthDate).toBe('1989-03-06');
    expect(input.person.birthTime).toBe('23:15');
    expect(input.person.birthPlace).toBe('Сергиев Посад');
    expect(input.astrologer_brief).toBeUndefined();
    expect(input.calculated_transits).toBeUndefined();
  });

  it('builds the new overview plus three readable topics and a closing', () => {
    const window = resolvePersonalForecastWindow('day', '2026-09-08', 'Europe/Moscow');
    const forecast = buildSimplePersonalForecastPackage({ payload, profile, model: 'test-model', period: 'day', window, attempts: 1 });
    expect(forecast.meta.contractVersion).toBe(PERSONAL_FORECAST_CONTRACT_VERSION);
    expect(forecast.meta.promptVersion).toBe(PERSONAL_FORECAST_PROMPT_VERSION);
    expect(forecast.sections.map((section) => section.id)).toEqual([
      'fixed:love', 'fixed:work_money', 'fixed:mood', 'semantic:closing',
    ]);
    expect(getPersonalForecastPackageValidationError(forecast)).toBeNull();
  });

  it('never sends locked personal forecast copy to a free client', () => {
    const window = resolvePersonalForecastWindow('day', '2026-09-08', 'Europe/Moscow');
    const forecast = buildSimplePersonalForecastPackage({ payload, profile, model: 'test-model', period: 'day', window, attempts: 1 });
    const sliced = slicePersonalForecastForAccess(forecast, false);
    expect(sliced.periodLocked).toBe(false);
    expect(sliced.lockedSectionIds.length).toBeGreaterThan(0);
    for (const id of sliced.lockedSectionIds) {
      const section = sliced.forecast.sections.find((item) => item.id === id);
      expect(section?.text).toBe('');
      expect(section?.contentBlocks).toHaveLength(0);
    }
  });
});
