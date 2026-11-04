import { getPersonalForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';

describe('personal day forecast voice', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  it('asks for plain spoken Russian instead of hedged paper language', () => {
    expect(prompt).toContain('Цепочки из «возможно», «может быть», «вероятно»');
    expect(prompt).toContain('Мистику, судьбу, космос, поучения');
    expect(prompt).toContain('Воду, под которую подходит любой день и любой человек');
  });

  it('does not teach the model generic situations', () => {
    expect(prompt).not.toContain('Примеры ниже');
    expect(prompt).not.toMatch(/перестановк|переписк/iu);
  });
});
