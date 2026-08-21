import {
  hasAppVoiceCliche,
  hasAppVoiceMysticism,
  hasAppVoiceViolation,
  hasPersonalForecastVoiceViolation,
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
    'День твой. Забирай.',
    'Удача вышла на смену.',
    'The main risk is agreeing before you have checked the numbers.',
  ])('accepts direct concrete wording: %s', (text) => {
    expect(hasAppVoiceViolation(text)).toBe(false);
  });

  it.each([
    'Сегодня твоя сила — в спокойном присутствии.',
    'Сохрани внутреннюю ясность.',
    'Ищи опору внутри себя.',
    'Освободи пространство для себя и своих чувств.',
    'Your strength is in calm presence.',
    'Protect your inner clarity and inner support.',
  ])('rejects smooth AI psychology in personal forecasts: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'Космос сегодня на твоей стороне.',
    'Твоя аура притягивает нужных людей.',
    'Это знак свыше и подарок судьбы.',
  ])('rejects cosmic and esoteric language in personal forecasts: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(true);
  });

  it.each([
    'На столе не хватает пространства для ноутбука и чашки.',
    'В разговоре оставь паузу, чтобы человек успел ответить.',
  ])('keeps concrete physical and conversational wording: %s', (text) => {
    expect(hasPersonalForecastVoiceViolation(text)).toBe(false);
  });
});
