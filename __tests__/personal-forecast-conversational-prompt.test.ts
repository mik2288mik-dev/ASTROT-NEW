import { getPersonalForecastSystemPrompt, getPersonalPeriodForecastSystemPrompt } from '../lib/voice/contracts/personalForecast';

it('asks for a personal reading without priming it with conversations', () => {
  const prompt = getPersonalForecastSystemPrompt('ru', 'today');
  expect(prompt).not.toMatch(/переписк|Разговор пойдёт сам/iu);
  expect(prompt).not.toContain('Каждый астрологический факт объясняй тремя слоями');
  expect(prompt).not.toContain('Астрологические термины (трин');
  expect(prompt).toContain('Смысл бери только оттуда и ничего не добавляй от себя');
  expect(prompt).toContain('Тему бери только из day_brief');
  expect(prompt).toContain('В тексте нет астрологии');
  expect(prompt).not.toMatch(/начальнику|прибавку\./u);
  expect(prompt).toContain('closing: одна короткая тёплая фраза');
});

it.each(['week', 'month'] as const)('keeps %s positive without obligatory advice or saccharine copy', (period) => {
  const prompt = getPersonalPeriodForecastSystemPrompt('ru', period);
  expect(prompt).toContain('без слащавости');
  expect(prompt).toContain('не превращай прогноз в список дел или обязательный совет');
  expect(prompt).toContain('не выдумывая удачу');
});
