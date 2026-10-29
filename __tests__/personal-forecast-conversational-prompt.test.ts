import { getPersonalForecastSystemPrompt, getPersonalPeriodForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';

it('uses the approved everyday example without asking the model to copy it', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  expect(prompt).toContain('Разговор пойдёт сам');
  expect(prompt).toContain('Начнёшь переписку с обычного «как ты?», а через полчаса уже обсуждаете какую-нибудь ерунду и смеётесь.');
  expect(prompt).toContain('Хороший день для разговоров без повода');
  expect(prompt).toContain('Их ситуации и фразы нельзя копировать');
  expect(prompt).toContain('не своди каждый день к переписке или делам');
});

it.each(['week', 'month'] as const)('keeps %s positive without obligatory advice or saccharine copy', (period) => {
  const prompt = getPersonalPeriodForecastSystemPrompt('ru', period);
  expect(prompt).toContain('без слащавости');
  expect(prompt).toContain('не превращай прогноз в список дел или обязательный совет');
  expect(prompt).toContain('не выдумывая удачу');
});
