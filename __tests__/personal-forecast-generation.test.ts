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
it('sends the saved chart and selected date to one writer and keeps the complete reading', async()=>{
  writer.mockResolvedValue({content:JSON.stringify({title:'A new offer',forecast:'An unexpected offer may arrive. Its details may change after a conversation.'})});
  const result=await generatePersonalForecastPackage(input);
  expect(writer).toHaveBeenCalledTimes(1);
  const data=JSON.parse(writer.mock.calls[0][0].input);
  expect(data.saved_natal_calculation.positions).toEqual(natal.positions);
  expect(data.selected_date.start).toBe('2026-07-26');
  expect(data.selected_date_calculation.source).toBe('Swiss Ephemeris');
  expect(data).not.toHaveProperty('astrologer_brief');
  expect(result.sections).toEqual([]);
  expect(result.overview.text).toBe('An unexpected offer may arrive. Its details may change after a conversation.');
  expect(getPersonalForecastPackageValidationError(result)).toBeNull();
});
it.each([{title:'',forecast:'text'},{title:'Title',forecast:''},{title:'Guaranteed',forecast:'guaranteed'}])('rejects empty or unsafe writer output', async output=>{
  writer.mockResolvedValue({content:JSON.stringify(output)});
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_GENERATION_INVALID');
});
it('does not substitute a canned reading on provider failure',async()=>{
  writer.mockRejectedValue(new Error('provider down'));
  await expect(generatePersonalForecastPackage(input)).rejects.toThrow('PERSONAL_FORECAST_WRITER_REQUEST_FAILED');
});
