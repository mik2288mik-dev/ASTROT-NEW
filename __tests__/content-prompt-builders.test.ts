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
      expect(prompt.promptVersion).toMatch(new RegExp(`\\.v\\d+\\+voice\\.${APP_VOICE_VERSION}$`));
      expect(prompt.user).toContain('Верни только валидный JSON');
      expect(prompt.user).toContain('Объём: не больше');
      expect(prompt.user).toContain('конкретный жизненный пример');
    }
  });

  it('keeps daily, weekly, natal, compatibility, and relationship prompts focused', () => {
    expect(buildSignDailyHoroscopePrompt().user).toContain('не больше 130 слов');
    expect(buildSignDailyHoroscopePrompt().user).toContain('Не перечисляй подряд любовь');
    // Гороскоп по знаку опирается на реальный контекст дня (фаза Луны), а не «знак вообще».
    expect(buildSignDailyHoroscopePrompt().user).toContain('реальная фаза Луны');
    for (const prompt of [buildSignWeeklyHoroscopePrompt(), buildSignMonthlyHoroscopePrompt(), buildSignYearlyHoroscopePrompt()]) {
      for (const field of ['headline', 'summary', 'reading', 'focus', 'chance', 'risk', 'context', 'advice']) {
        expect(prompt.user).toContain(`"${field}"`);
      }
      expect(prompt.user).toContain('Если мысль закончена, остановись');
    }
    expect(buildNatalSectionPrompt({ title: 'Как ты любишь' }).user).toContain('не больше 200 слов');
    expect(buildSignCompatibilityPrompt().user).toContain('без счёта совместимости');
    expect(buildSynastryPrompt().user).toContain('Не используй термин «синастрия»');
  });

  it('uses a safe fallback for malformed model JSON', () => {
    const fallback = { headline: 'Спокойно проверь главное', text: 'Один ясный шаг полезнее спешки.' };
    expect(parseModelJson('{broken', fallback)).toEqual(fallback);
    expect(parseModelJson('[]', fallback)).toEqual(fallback);
    expect(parseModelJson('{"headline":"Готово"}', fallback)).toEqual({ headline: 'Готово' });
  });

  it('connects dedicated builders to active generators instead of one shared prompt', () => {
    expect(read('lib/horoscope/signDaily.ts')).toContain('buildSignDailyHoroscopePrompt');
    expect(read('lib/horoscope/signWeekly.ts')).toContain('buildSignWeeklyHoroscopePrompt');
    expect(read('lib/personalForecastGeneration.ts')).toContain('buildPersonalForecastTopicPrompt');
    expect(read('lib/personalForecastGeneration.ts')).toContain('getAppSystemVoice');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('buildNatalSectionPrompt');
    expect(read('lib/natalHumanInterpretation.ts')).toContain('buildBlindSpotPrompt');
    expect(read('lib/synastry/signCompatibility.ts')).toContain('buildSignCompatibilityPrompt');
    expect(read('pages/api/content/synastry/extended.ts')).toContain('buildSynastryPrompt');
    expect(read('lib/synastryExtended.ts')).toContain("getContentPolicy('deep_report').promptVersion");
  });
});
