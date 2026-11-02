import { getPersonalForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';

describe('personal day forecast voice', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  it('asks for plain spoken Russian instead of hedged paper language', () => {
    expect(prompt).toContain('обычным разговорным языком');
    expect(prompt).toContain('без негатива, мистики, поучений и воды');
    expect(prompt).toContain('не используй слово «сегодня»');
  });

  it('does not teach the model generic situations or force a joke', () => {
    expect(prompt).not.toContain('Примеры ниже');
    expect(prompt).not.toMatch(/перестановк|переписк/iu);
    expect(prompt).toContain('Шутка уместна только тогда');
  });
});
