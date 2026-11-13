jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn() }));
jest.mock('../lib/personalDayBrief', () => ({ buildPersonalDayBrief: jest.fn(() => ({ moon: {}, main_events: [] })) }));
jest.mock('../lib/personalForecastDateContext', () => ({ buildPersonalForecastDateContext: jest.fn(() => ({ source: 'Swiss Ephemeris', timezone: 'Europe/Moscow', samples: [{ date: '2026-07-26', positions: {}, aspectsToSavedChart: [{ transitPlanet: 'venus', natalPlanet: 'sun', type: 'trine', orb: 1, tone: 'support' }, { transitPlanet: 'mars', natalPlanet: 'sun', type: 'square', orb: 2, tone: 'pressure' }] }] })) }));
import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow, getPersonalForecastPackageValidationError } from '../lib/personalForecastContract';
import samples from './fixtures/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';
const writer = createLunaStructuredResponse as jest.Mock;
const natal = samples.people[0].chart as unknown as NatalChartDataV2;
const input = { profile: { isSetup:true, isPremium:true, theme:'light' as const, name:'Test', birthDate:'1990-03-14', birthTime:'09:41', birthPlace:'Moscow', language:'ru' as const }, natal, period:'day' as const, model:'gpt-5.6-luna', window:resolvePersonalForecastWindow('day','2026-07-26','Europe/Moscow') };
beforeEach(()=>writer.mockReset());
it('keeps the do, avoid and why lists of the day forecast', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'Покупки до вечера',body:'Луна идёт через твою зону денег.',closing:'Реши до вечера.',do:['Сравнить цены перед покупкой.'],dont:['Покупать на эмоциях'],why:[{fact:'Луна в зоне денег',meaning:'Легче считать траты.'}],theme:'money'})});
  const result=await generatePersonalForecastPackage(input);
  expect(result.overview.dayNotes).toEqual({theme:'money',do:['Сравнить цены перед покупкой'],dont:['Покупать на эмоциях'],why:[{fact:'Луна в зоне денег',meaning:'Легче считать траты.'}]});
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it('uses the NEBO Today voice, saved chart, date calculation and complete reading', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'A new offer',body:'An unexpected offer may arrive. Its details may change after a conversation.',closing:'Good luck'})});
  const result=await generatePersonalForecastPackage(input);
  expect(writer).toHaveBeenCalledTimes(1);
  expect(writer.mock.calls[0][0].instructions).toContain('добрый астролог NEBO');
  expect(writer.mock.calls[0][0].instructions).toContain('title, body, closing, do, dont, why и theme');
  const data=JSON.parse(writer.mock.calls[0][0].input);
  expect(data.day_brief.main_events).toEqual([]);
  expect(data.saved_natal_calculation).toBeUndefined();
  expect(data.selected_date.start).toBe('2026-07-26');
  expect(data.recent_history).toEqual([]);
  expect(result.sections).toEqual([]);
  expect(result.overview.text).toBe('An unexpected offer may arrive. Its details may change after a conversation.\n\nGood luck');
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it('keeps a generated body even if it contains astrology wording', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({
    title:'Приятный разговор',
    body:'Твоя карта показывает перемены.',
    closing:'Приятное впечатление останется.',
  })});
  expect((await generatePersonalForecastPackage(input)).overview.text).toContain('Твоя карта показывает перемены.');
});
it.each(['title','closing'] as const)('preserves generated wording in %s', async field=>{
  const body = 'Сегодня разговор может пройти легко. Ты услышишь деталь, которую раньше пропускал.';
  writer.mockResolvedValue({content:JSON.stringify({
    title:'Приятный разговор', body, closing:'Приятное впечатление останется.',
    [field]:'Твоя карта показывает перемены.',
  })});
  const result = await generatePersonalForecastPackage(input);
  expect(result.meta.diagnosticCode).toBeNull();
  expect(result.meta.status).toBe('ready');
  expect(result.meta.validationStatus).toBe('valid');
  expect(result.overview.title).toBe(field === 'title' ? 'Твоя карта показывает перемены.' : 'Приятный разговор');
  expect(result.overview.text).toBe(field === 'closing' ? `${body}\n\nТвоя карта показывает перемены.` : `${body}\n\nПриятное впечатление останется.`);
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it('keeps only finished fields from a max-token response with a cut-off closing', async()=>{
  const body = 'An unexpected offer may arrive. Its details may change after a conversation.';
  writer.mockResolvedValue({
    content: `{"title":"A new offer","body":"${body}","closing":"Unfinished`,
    incompleteReason: 'max_output_tokens',
  });
  const result = await generatePersonalForecastPackage(input);
  expect(writer.mock.calls[0][0].allowIncompleteOutput).toBe(true);
  expect(result.overview.text).toBe(body);
  expect(result.meta.diagnosticCode).toBe('PERSONAL_FORECAST_PARTIAL_RECOVERY');
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it('recovers a readable truncated body or completed body before malformed suffix', async()=>{
  writer.mockResolvedValueOnce({
    content: '{"title":"A new offer","body":"An unfinished',
    incompleteReason: 'max_output_tokens',
  }).mockResolvedValueOnce({
    content: '{"title":"A new offer","body":"A complete sentence.",oops',
    incompleteReason: 'max_output_tokens',
  });
  expect((await generatePersonalForecastPackage(input)).overview.text).toBe('An unfinished');
  expect((await generatePersonalForecastPackage(input)).overview.text).toBe('A complete sentence.');
});
it('uses an earlier reading for the same date and the retry reason to avoid repeating it', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'Приятная встреча',body:'Сегодня разговор может закончиться приятнее, чем начался.',closing:'Скажи прямо.'})});
  const result = await generatePersonalForecastPackage({
    ...input,
    history: [{ period: 'day', periodKey: '2026-07-26', fragments: [
      {kind:'title',text:'Приятная встреча',semanticFingerprint:null},
      {kind:'forecast',text:'Вчера разговор оказался приятным.',semanticFingerprint:null},
    ] }],
    retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:REPEATED_READING',
  });
  expect(result.overview.title).toBe('Приятная встреча');
  expect(result.meta.diagnosticCode).toBeNull();
  const data=JSON.parse(writer.mock.calls[0][0].input);
  expect(data.recent_history[0].title).toBe('Приятная встреча');
  expect(data.retry_feedback).toContain('повторил недавний прогноз');
});
it.each([{title:'Title',body:''},{}])('rejects output with no reading', async output=>{
  writer.mockResolvedValue({content:JSON.stringify(output)});
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
});
it('uses a generic title when the writer returned only a body', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'',body:'Любой полученный прогноз',closing:''})});
  const result = await generatePersonalForecastPackage(input);
  expect(result.overview.title).toBe('Личный прогноз');
  expect(result.overview.text).toBe('Любой полученный прогноз');
  expect(result.meta.diagnosticCode).toBeNull();
});
it('shows a readable closing if the body is missing', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'День',body:'',closing:'Сегодня можно сделать паузу.'})});
  expect((await generatePersonalForecastPackage(input)).overview.text).toBe('Сегодня можно сделать паузу.');
});
it('shows a plain-text response without exposing raw JSON', async()=>{
  writer.mockResolvedValue({content:'Сегодня интерес к музыке вырастет.'});
  expect((await generatePersonalForecastPackage(input)).overview.text).toBe('Сегодня интерес к музыке вырастет.');
});
it('does not mistake broken structured data for a forecast', async()=>{
  writer.mockResolvedValue({content:'[{"body":'});
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:INVALID_JSON');
});
it('does not substitute a canned reading on provider failure',async()=>{
  writer.mockRejectedValue(new Error('provider down'));
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_WRITER_REQUEST_FAILED');
});
