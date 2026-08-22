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
    expect(forecastVoice).toContain('короткий, колкий, дерзкий вход');
    expect(forecastVoice).toContain('headline, forecast, closing');
    expect(forecastVoice).toContain('обязательную проблему перед хорошей новостью');
  });

  it('puts ordinary-life meaning before astrology and keeps headings purposeful', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemPrompt('ru', 'day');

    expect(appVoice).toContain('переводи контекст в обычный язык жизни');
    expect(appVoice).toContain('Астрологические термины допустимы только');
    expect(appVoice).toContain('Заголовок нужен только когда он действительно помогает читать');
    expect(forecastVoice).toContain('видимых астрологических терминов');
    expect(forecastVoice).toContain('для одного человека');
  });

  it('explicitly rejects coaching, mysticism, and empty machine wording', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemPrompt('ru', 'day');

    expect(appVoice).toContain('коучинговой жвачки');
    expect(appVoice).toContain('Не придумывай события, биографию, мотивы');
    expect(forecastVoice).toContain('психолог, коуч');
    expect(hasAppVoiceViolation('Вселенная подсказывает тебе правильный путь.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Твоя сила — в спокойном присутствии.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Черновик попал в яблочко.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Дому станет легче.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Не прячь пробу до совершенства.')).toBe(true);
  });
});
