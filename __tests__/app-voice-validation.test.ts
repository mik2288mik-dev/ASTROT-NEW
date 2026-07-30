import {
  hasAppVoiceCliche,
  hasAppVoiceMysticism,
  hasAppVoiceViolation,
} from '../lib/appVoice';

describe('app voice validation', () => {
  it.each([
    'Сегодня лучше замедлиться и прислушаться к себе.',
    'Позволь себе отпустить контроль.',
    'Побереги внутренний ресурс.',
    'Сегодня активная тема отношений проявляется сильнее.',
    'Мы нашли повторяющиеся сценарии.',
    'Карта сложилась. Это про тебя.',
    'The active theme is your inner pattern.',
    'Allow yourself to let go of control.',
  ])('rejects empty or artificial wording: %s', (text) => {
    expect(hasAppVoiceCliche(text)).toBe(true);
    expect(hasAppVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Вселенная подсказывает, куда двигаться.',
    'Это часть твоего духовного пути.',
    'Trust the universe and its vibrations.',
  ])('rejects mystical wording: %s', (text) => {
    expect(hasAppVoiceMysticism(text)).toBe(true);
    expect(hasAppVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Сегодня намёки не сработают. Нужен конкретный вопрос и такой же конкретный ответ.',
    'С деньгами слабое место — решения на эмоциях. Проверь цену и условия до оплаты.',
    'Ты долго терпишь, а потом резко обрываешь разговор.',
    'The main risk is agreeing before you have checked the numbers.',
  ])('accepts direct concrete wording: %s', (text) => {
    expect(hasAppVoiceViolation(text)).toBe(false);
  });
});
