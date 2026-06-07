import fs from 'fs';
import path from 'path';
import {
  buildBlindSpotPrompt,
  buildDayCardPrompt,
  buildNatalSectionPrompt,
  buildPersonalDailyPrompt,
  buildPushDailyPrompt,
  buildSignCompatibilityPrompt,
  buildSignDailyHoroscopePrompt,
  buildSignWeeklyHoroscopePrompt,
  buildSynastryPrompt,
  parseLumiaJson,
} from '../lib/contentPromptBuilders';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const builders = [
  buildPushDailyPrompt,
  buildDayCardPrompt,
  buildSignDailyHoroscopePrompt,
  buildSignWeeklyHoroscopePrompt,
  buildPersonalDailyPrompt,
  buildBlindSpotPrompt,
  buildNatalSectionPrompt,
  buildSignCompatibilityPrompt,
  buildSynastryPrompt,
];

describe('Lumia content prompt builders', () => {
  it('provides a dedicated versioned JSON prompt for every requested content shape', () => {
    expect(builders).toHaveLength(9);
    for (const build of builders) {
      const prompt = build({ context: { example: 'разговор после работы' } });
      expect(prompt.responseFormat).toBe('json_object');
      expect(prompt.promptVersion).toMatch(/\.v2$/);
      expect(prompt.system).toContain('Верни только валидный JSON');
      expect(prompt.user).toContain('Общий объём всех текстовых полей');
      expect(prompt.user).toContain('конкретный жизненный пример');
    }
  });

  it('encodes the strict personal daily schema and limits', () => {
    const prompt = buildPersonalDailyPrompt({ context: { date: '2026-06-06', chart: 'test chart' } });
    for (const field of ['headline', 'main', 'relationships', 'action', 'risk', 'why']) expect(prompt.user).toContain(`"${field}"`);
    expect(prompt.user).toContain('90-130 слов');
    expect(prompt.user).toContain('why — максимум 15 слов');
    expect(prompt.user).toContain('Не больше двух астрологических терминов');
  });

  it('keeps daily, weekly, natal, compatibility, and relationship prompts focused', () => {
    expect(buildSignDailyHoroscopePrompt().user).toContain('60-80 слов');
    expect(buildSignDailyHoroscopePrompt().user).toContain('Не перечисляй подряд любовь');
    expect(buildSignWeeklyHoroscopePrompt().user).toContain('ровно два коротких практичных совета');
    expect(buildNatalSectionPrompt({ title: 'Как ты любишь' }).user).toContain('150-200 слов');
    expect(buildSignCompatibilityPrompt().user).toContain('без счёта совместимости');
    expect(buildSynastryPrompt().user).toContain('Не используй термин «синастрия»');
  });

  it('uses a safe fallback for malformed model JSON', () => {
    const fallback = { headline: 'Спокойно проверь главное', text: 'Один ясный шаг полезнее спешки.' };
    expect(parseLumiaJson('{broken', fallback)).toEqual(fallback);
    expect(parseLumiaJson('[]', fallback)).toEqual(fallback);
    expect(parseLumiaJson('{"headline":"Готово"}', fallback)).toEqual({ headline: 'Готово' });
  });

  it('connects dedicated builders to active generators instead of one shared prompt', () => {
    expect(read('lib/horoscope/signDaily.ts')).toContain('buildSignDailyHoroscopePrompt');
    expect(read('lib/horoscope/signWeekly.ts')).toContain('buildSignWeeklyHoroscopePrompt');
    expect(read('lib/forecastContent.ts')).toContain('buildPersonalDailyPrompt');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('buildNatalSectionPrompt');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('buildBlindSpotPrompt');
    expect(read('lib/synastry/signCompatibility.ts')).toContain('buildSignCompatibilityPrompt');
    expect(read('pages/api/content/synastry/extended.ts')).toContain('buildSynastryPrompt');
    expect(read('lib/synastryExtended.ts')).toContain("getContentPolicy('deep_report').promptVersion");
  });
});
