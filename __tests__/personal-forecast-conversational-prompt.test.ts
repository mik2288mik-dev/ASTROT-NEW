import { getPersonalForecastSystemPrompt, getPersonalPeriodForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';

it('asks for a kind personal forecast without priming it with negative situations', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  expect(prompt).toContain('добрый астролог NEBO');
  expect(prompt).toContain('по расчёту day_brief');
  expect(prompt).toContain('не выдумывая удачу или события');
  expect(prompt).toContain('Не показывай астрологические термины');
  expect(prompt).toContain('Не своди прогнозы к разговорам');
  expect(prompt).not.toMatch(/что может раздражать|как это обойти|суматошным|нервный день/iu);
  expect(prompt).toContain('без списка дел и обязательных советов');
  expect(prompt).toContain('closing: короткая заключительная фраза');
});

it.each(['week', 'month'] as const)('keeps %s positive without obligatory advice or saccharine copy', (period) => {
  const prompt = getPersonalPeriodForecastSystemPrompt('ru', period);
  expect(prompt).toContain('без слащавости');
  expect(prompt).toContain('не превращай прогноз в список дел или обязательный совет');
  expect(prompt).toContain('не выдумывая удачу');
});
