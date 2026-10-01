import { getPersonalForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';
import { hasCoreVoiceViolation } from '../lib/voice/validators';

describe('personal day forecast voice', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  const examples = prompt.slice(prompt.indexOf('Примеры ниже'));

  it('asks for plain spoken Russian instead of hedged paper language', () => {
    expect(prompt).toContain('КАК ЗВУЧАТЬ');
    expect(prompt).toContain('«Сегодня легко договориться», а не «сегодня может быть проще договариваться»');
    expect(prompt).toContain('Не начинай с «Сегодня проще»');
  });

  it('keeps the examples free of banned clichés and of the hedges it forbids', () => {
    expect(hasCoreVoiceViolation(examples)).toBe(false);
    for (const paperWord of ['обстоятельства', 'необходимость', 'ограничения', 'может быть проще', 'будет проще']) {
      expect(examples).not.toContain(paperWord);
    }
  });
});
