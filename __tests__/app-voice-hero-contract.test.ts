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

  it('writes date-specific prose without requiring a brief, quotas or a closing',()=>{
    const voice=getPersonalForecastSystemPrompt('ru');
    expect(voice).toContain('сам гороскоп');
    expect(voice).toContain('без астрологических терминов');
    expect(voice).toContain('Не приписывай людям привычки и намерения');
    expect(voice).not.toContain('title, forecast, closing');
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
