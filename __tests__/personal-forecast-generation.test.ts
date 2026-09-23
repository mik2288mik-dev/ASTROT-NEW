jest.mock('../lib/openaiResponses', () => ({ createLunaStructuredResponse: jest.fn() }));
jest.mock('../lib/personalForecastDateContext', () => ({ buildPersonalForecastDateContext: jest.fn(() => ({ source: 'Swiss Ephemeris', samples: [{ date: '2026-07-26' }] })) }));
import { createLunaStructuredResponse } from '../lib/openaiResponses';
import { generatePersonalForecastPackage } from '../lib/personalForecastGeneration';
import { resolvePersonalForecastWindow, getPersonalForecastPackageValidationError } from '../lib/personalForecastContract';
import samples from '../components/ui-preview/readingSamples.json';
import type { NatalChartDataV2 } from '../lib/natalChartV2Types';
const writer = createLunaStructuredResponse as jest.Mock;
const natal = samples.people[0].chart as unknown as NatalChartDataV2;
const input = { profile: { isSetup:true, isPremium:true, theme:'light' as const, name:'Test', birthDate:'1990-03-14', birthTime:'09:41', birthPlace:'Moscow', language:'ru' as const }, natal, period:'day' as const, model:'gpt-5.6-luna', window:resolvePersonalForecastWindow('day','2026-07-26','Europe/Moscow') };
beforeEach(()=>writer.mockReset());
it('uses the NEBO Today voice, saved chart, date calculation and complete reading', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'A new offer',body:'An unexpected offer may arrive. Its details may change after a conversation.',closing:'Good luck'})});
  const result=await generatePersonalForecastPackage(input);
  expect(writer).toHaveBeenCalledTimes(1);
  expect(writer.mock.calls[0][0].instructions).toContain('NEBO VOICE');
  expect(writer.mock.calls[0][0].instructions).toContain('title, body и closing');
  const data=JSON.parse(writer.mock.calls[0][0].input);
  expect(data.birth.name).toBe('Test');
  expect(data.selected_date.start).toBe('2026-07-26');
  expect(data.saved_natal_calculation.positions).toEqual(natal.positions);
  expect(data.selected_date_calculation.samples[0].date).toBe('2026-07-26');
  expect(data.recent_history).toEqual([]);
  expect(result.sections).toEqual([]);
  expect(result.overview.text).toBe('An unexpected offer may arrive. Its details may change after a conversation.\n\nGood luck');
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it.each(['title','body','closing'] as const)('rejects banned wording in %s before it reaches the cache', async field=>{
  writer.mockResolvedValue({content:JSON.stringify({
    title:'Приятный разговор',
    body:'Сегодня общение может порадовать тебя.',
    closing:'Приятное впечатление останется.',
    [field]:'Не распыляйся.',
  })});
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:VOICE');
});
it('uses an earlier reading for the same date and the retry reason to avoid repeating it', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'Приятная встреча',body:'Сегодня разговор может закончиться приятнее, чем начался.',closing:'Скажи прямо.'})});
  await expect(generatePersonalForecastPackage({
    ...input,
    history: [{ period: 'day', periodKey: '2026-07-26', fragments: [
      {kind:'title',text:'Приятная встреча',semanticFingerprint:null},
      {kind:'forecast',text:'Вчера разговор оказался приятным.',semanticFingerprint:null},
    ] }],
    retryReason: 'PERSONAL_FORECAST_GENERATION_INVALID:REPEATED_READING',
  })).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID:REPEATED_READING');
  const data=JSON.parse(writer.mock.calls[0][0].input);
  expect(data.recent_history[0].title).toBe('Приятная встреча');
  expect(data.retry_feedback).toContain('повторил недавний прогноз');
});
it.each([{title:'',body:'text'},{title:'Title',body:''},{title:'Guaranteed',body:'guaranteed'}])('rejects empty or unsafe writer output', async output=>{
  writer.mockResolvedValue({content:JSON.stringify(output)});
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
});
it('does not substitute a canned reading on provider failure',async()=>{
  writer.mockRejectedValue(new Error('provider down'));
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_WRITER_REQUEST_FAILED');
});
