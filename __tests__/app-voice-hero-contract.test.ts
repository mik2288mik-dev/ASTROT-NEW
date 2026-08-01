import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

describe('single app voice contract', () => {
  it('keeps generated content direct, calculation-led, and free of personas', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain("export const APP_VOICE_VERSION = '3'");
    expect(voice).toContain('прямо, уверенно, конкретно, по расчёту');
    expect(voice).toContain('Каждая фраза должна сообщать конкретную информацию');
    expect(voice).toContain('обращайся к пользователю на «ты»');
    expect(voice).toContain('Не используй голос эзотерика');
    expect(voice).not.toContain('hero_title генерируется');
    expect(voice).not.toContain('добрый, дерзкий и современный друг');
  });

  it('separates descriptive natal copy from practical forecast copy', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('Натальная карта — описательный тон');
    expect(voice).toContain('Прогноз и ответы на вопросы — практичный и местами директивный тон');
    expect(voice).toContain('Сначала дай ясный ответ');
  });

  it('puts plain meaning before astrology and structures only long readings', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('Сначала объясняй смысл, затем показывай расчёт');
    expect(voice).toContain('СТРУКТУРА ДЛИННЫХ РАЗБОРОВ');
    expect(voice).toContain('разбивай его на крупные нумерованные разделы');
    expect(voice).toContain('Не вставляй все эти части механически');
    expect(voice).toContain('короткой жирной вводной фразы');
    expect(voice).toContain('Жизненные сферы называй прямо');
    expect(voice).toContain('«Основание» / «Технические данные»');
    expect(voice).toContain('заканчивай сильным итогом');
  });

  it('explicitly rejects coaching, mysticism, and empty machine wording', () => {
    const voice = read('lib/appVoice.ts');

    expect(voice).toContain('«прислушайся к себе»');
    expect(voice).toContain('«позволь себе»');
    expect(voice).toContain('«отпусти контроль»');
    expect(voice).toContain('«повторяющиеся сценарии»');
    expect(voice).toContain('«карта сложилась»');
    expect(voice).toContain('«это про тебя»');
    expect(voice).toContain('псевдопсихологии и эзотерической воды');
  });
});
