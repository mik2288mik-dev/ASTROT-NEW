import {
  APP_VOICE_VERSION,
  PERSONAL_FORECAST_VOICE_VERSION,
  getAppSystemVoice,
  getPersonalForecastSystemVoice,
  hasAppVoiceViolation,
  hasPersonalForecastVoiceViolation,
} from '../lib/appVoice';

describe('app and personal forecast voice contracts', () => {
  it('keeps generated content direct, grounded, and free of personas', () => {
    const voice = getAppSystemVoice('ru');

    expect(APP_VOICE_VERSION).toBe('10');
    expect(PERSONAL_FORECAST_VOICE_VERSION).toBe('3');
    expect(voice).toContain('точно, спокойно, живо и без церемоний');
    expect(voice).toContain('Используй только переданный надёжный контекст');
    expect(voice).toContain('Говори с человеком на «ты»');
    expect(voice).not.toContain('hero_title генерируется');
    expect(voice).not.toContain('добрый, дерзкий и современный друг');
  });

  it('layers a distinct personal forecast voice over the calm app voice', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemVoice('ru');

    expect(forecastVoice).toContain(appVoice);
    expect(forecastVoice).toContain('ГОЛОС ЛИЧНОГО ПРОГНОЗА');
    expect(forecastVoice).toContain('прямо, наблюдательно и с характером');
    expect(forecastVoice).toContain('не превращай прогноз в номер');
    expect(forecastVoice).toContain('сохранённый приватный натальный контекст');
    expect(forecastVoice).toContain('оставляй его полностью позитивным');
    expect(forecastVoice).toContain('Финал приносит практическую пользу');
  });

  it('puts ordinary-life meaning before astrology and keeps headings purposeful', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemVoice('ru');

    expect(appVoice).toContain('переводи контекст в обычный язык жизни');
    expect(appVoice).toContain('Астрологические термины допустимы только');
    expect(appVoice).toContain('Заголовок нужен только когда он действительно помогает читать');
    expect(forecastVoice).toContain('не пиши «твоя карта показывает»');
    expect(forecastVoice).toContain('написанным одному человеку');
  });

  it('explicitly rejects coaching, mysticism, and empty machine wording', () => {
    const appVoice = getAppSystemVoice('ru');
    const forecastVoice = getPersonalForecastSystemVoice('ru');

    expect(appVoice).toContain('коучинговой жвачки');
    expect(appVoice).toContain('Не придумывай события, биографию, мотивы');
    expect(forecastVoice).toContain('Не играй психолога, психотерапевта, коуча');
    expect(forecastVoice).toContain('пустые формулы, а не персональный текст');
    expect(hasAppVoiceViolation('Вселенная подсказывает тебе правильный путь.')).toBe(true);
    expect(hasPersonalForecastVoiceViolation('Твоя сила — в спокойном присутствии.')).toBe(true);
  });
});
