import fs from 'fs';
import path from 'path';
import { APP_VOICE_VERSION } from '../lib/appVoice';
import {
  buildBlindSpotPrompt,
  buildDayCardPrompt,
  buildNatalSectionPrompt,
  buildPushDailyPrompt,
  buildSignCompatibilityPrompt,
  buildSignDailyHoroscopePrompt,
  buildSignMonthlyHoroscopePrompt,
  buildSignWeeklyHoroscopePrompt,
  buildSignYearlyHoroscopePrompt,
  buildSynastryPrompt,
  parseModelJson,
} from '../lib/contentPromptBuilders';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const builders = [
  buildPushDailyPrompt,
  buildDayCardPrompt,
  buildSignDailyHoroscopePrompt,
  buildSignWeeklyHoroscopePrompt,
  buildSignMonthlyHoroscopePrompt,
  buildSignYearlyHoroscopePrompt,
  buildBlindSpotPrompt,
  buildNatalSectionPrompt,
  buildSignCompatibilityPrompt,
  buildSynastryPrompt,
];

describe('Lumia content prompt builders', () => {
  it('provides a dedicated versioned JSON prompt for every requested content shape', () => {
    expect(builders).toHaveLength(10);
    for (const build of builders) {
      const prompt = build({ context: { example: 'разговор после работы' } });
      expect(prompt.responseFormat).toBe('json_object');
      expect(prompt.promptVersion).toContain('.v');
      expect(prompt.promptVersion.endsWith(`+voice.${APP_VOICE_VERSION}`)).toBe(true);
      expect(prompt.user).toContain('Верни только валидный JSON');
      expect(prompt.user).toContain('Объём: не больше');
      expect(prompt.user).toContain('конкретную ситуацию, действие, разговор или решение');
      expect(prompt.user).toContain('Сразу отвечай по существу');
    }
  });

  it('keeps daily, weekly, natal, compatibility, and relationship prompts focused', () => {
    expect(buildSignDailyHoroscopePrompt().user).toContain('не больше 130 слов');
    expect(buildSignDailyHoroscopePrompt().user).toContain('Не перечисляй подряд любовь');
    expect(buildSignDailyHoroscopePrompt().user).toContain('реальная фаза Луны');
    for (const prompt of [buildSignWeeklyHoroscopePrompt(), buildSignMonthlyHoroscopePrompt(), buildSignYearlyHoroscopePrompt()]) {
      for (const field of ['headline', 'summary', 'reading', 'focus', 'chance', 'risk', 'context', 'advice']) {
        expect(prompt.user).toContain(`"${field}"`);
      }
      expect(prompt.user).toContain('Если ответ уже закончен — остановись раньше');
    }
    expect(buildNatalSectionPrompt({ title: 'Отношения' }).user).toContain('не больше 200 слов');
    expect(buildNatalSectionPrompt({ title: 'Отношения' }).user).toContain('Первое предложение — прямой вывод');
    expect(buildSignCompatibilityPrompt().user).toContain('без счёта совместимости');
    expect(buildSynastryPrompt().user).toContain('Не используй термин «синастрия»');
    expect(buildSynastryPrompt().user).toContain('В context.relationship передан тип связи');
    expect(buildSynastryPrompt().user).toContain('не добавляй романтическое притяжение');
  });

  it('uses a safe fallback for malformed model JSON', () => {
    const fallback = { headline: 'Проверь главное', text: 'Сначала закончи один конкретный шаг.' };
    expect(parseModelJson('{broken', fallback)).toEqual(fallback);
    expect(parseModelJson('[]', fallback)).toEqual(fallback);
    expect(parseModelJson('{"headline":"Готово"}', fallback)).toEqual({ headline: 'Готово' });
  });

  it('connects dedicated builders to active generators instead of one shared prompt', () => {
    expect(read('lib/horoscope/signDaily.ts')).toContain('buildSignDailyHoroscopePrompt');
    expect(read('lib/horoscope/signWeekly.ts')).toContain('buildSignWeeklyHoroscopePrompt');
    expect(read('lib/personalForecastGeneration.ts')).toContain('buildPersonalForecastFeedPrompt');
    expect(read('lib/personalForecastGeneration.ts')).not.toContain('buildPersonalForecastTopicPrompt');
    expect(read('lib/personalForecastGeneration.ts')).toContain('getAppSystemVoice');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('compileNatalSemantics');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('natalPromptPayload');
    expect(read('lib/natalHumanInterpretation.ts')).not.toContain('buildNatalSectionPrompt');
    expect(read('lib/synastry/signCompatibility.ts')).toContain('buildSignCompatibilityPrompt');
    expect(read('pages/api/content/synastry/extended.ts')).toContain('buildSynastryPrompt');
    expect(read('lib/synastryExtended.ts')).toContain("getContentPolicy('deep_report').promptVersion");
  });
});
