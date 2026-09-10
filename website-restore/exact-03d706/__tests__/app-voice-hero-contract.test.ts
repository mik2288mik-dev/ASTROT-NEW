import {
  APP_VOICE_VERSION,
  PERSONAL_FORECAST_VOICE_VERSION,
  getAppSystemVoice,
  hasAppVoiceViolation,
  hasPersonalForecastVoiceViolation,
} from '../lib/appVoice';
import { getPersonalForecastSystemPrompt } from '../lib/personalForecastGeneration';

describe('app and personal forecast voice contracts', () => {
  it('keeps generated content direct, grounded, and free of personas', () => {
    const voice = getAppSystemVoice('ru');

    expect(APP_VOICE_VERSION).toBe('10');
    expect(Number(PERSONAL_FORECAST_VOICE_VERSION)).toBeGreaterThanOrEqual(6);
    expect(voice).toContain('точно, спокойно, живо и без церемоний');
    expect(voice).toContain('Используй только переданный надёжный контекст');
    expect(voice).toContain('Говори с человеком на «ты»');
    expect(voice).not.toContain('hero_title генерируется');
    expect(voice).not.toContain('добрый, дерзкий и современный друг');
  });

  it('keeps one canonical personal prompt separate from the app-wide voice', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemPrompt('ru', 'day');

    expect(forecastVoice).not.toContain(appVoice);
    expect(forecastVoice).not.toContain('ГОЛОС ЛИЧНОГО ПРОГНОЗА');
    expect(forecastVoice).toContain('title — точная живая реплика из 1–5 слов');
    expect(forecastVoice).toContain('title, forecast, closing');
    expect(forecastVoice).toContain('forecast — один связный абзац');
    expect(forecastVoice).toContain('обязательного конфликта нет');
    expect(forecastVoice).toContain('не обязана давать совет');
    expect(forecastVoice).toContain('две связанные мысли');
  });

  it('puts ordinary-life meaning before astrology and keeps headings purposeful', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemPrompt('ru', 'day');

    expect(appVoice).toContain('переводи контекст в обычный язык жизни');
    expect(appVoice).toContain('Астрологические термины допустимы только');
    expect(appVoice).toContain('Заголовок нужен только когда он действительно помогает читать');
    expect(forecastVoice).toContain('Не называй планеты, аспекты, транзиты');
    expect(forecastVoice).toContain('персональный гороскоп');
  });

  it('explicitly rejects coaching, mysticism, and empty machine wording', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemPrompt('ru', 'day');

    expect(appVoice).toContain('коучинговой жвачки');
    expect(appVoice).toContain('Не придумывай события, биографию, мотивы');
    expect(forecastVoice).toContain('Никакой терапии, коучинга, диагнозов');
    expect(hasAppVoiceViolation('Вселенная подсказывает тебе правильный путь.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Твоя карта показывает готовое решение.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Это читается через внутренний рисунок.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Твоя сила — в спокойном присутствии.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Рабочая стратегия требует жёстких границ.')).toBe(true);
  });

  it('allows ordinary feelings and actions without turning them into coaching', () => {
    expect(hasPersonalForecastVoiceViolation('Чужая уверенность иногда вызывает раздражение.')).toBe(false);
    expect(hasPersonalForecastVoiceViolation('Труднее остановиться после хорошего результата.')).toBe(false);
    expect(hasPersonalForecastVoiceViolation('Пора остановиться.')).toBe(true);
  });

  it('allows ordinary spoken qualifiers without rejecting the whole forecast', () => {
    expect(hasPersonalForecastVoiceViolation('Сначала назовут одну сумму, и она покажется вполне обычной.')).toBe(false);
  });
});
