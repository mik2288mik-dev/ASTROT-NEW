const getPrimary=jest.fn(),getByUser=jest.fn(),upsertByUser=jest.fn(),request=jest.fn(),query=jest.fn();
jest.mock('../lib/natalChartV2Repository',()=>({natalChartV2Repository:{getPrimary}}));
jest.mock('../lib/db',()=>({db:{content_interpretations:{getByUser,upsertByUser}},getPool:()=>({query})}));
jest.mock('../lib/openaiResponses',()=>({createLunaStructuredResponse:(...args:unknown[])=>request(...args)}));
jest.mock('../lib/personalForecastDateContext',()=>({buildPersonalForecastDateContext:()=>({source:'Swiss Ephemeris',samples:[]})}));
jest.mock('../lib/personalDayBrief',()=>({buildPersonalDayBrief:()=>({moon:{},main_events:[]})}));
jest.mock('../lib/appSettings',()=>({getUnifiedContentModel:async()=> 'gpt-5.6-luna'}));
jest.mock('../lib/forecastDeliveryMetrics',()=>({logForecastDeliveryMetric:jest.fn()}));
jest.mock('../lib/contentGenerationLock',()=>({buildContentGenerationLockKey:()=> 'test',withContentGenerationLock:async({readCached,generate}:any)=>{const cached=await readCached();return {status:'ready',value:cached?cached.value:await generate(),fromCache:!!cached};}}));
import samples from './fixtures/readingSamples.json';
import {ensurePersonalForecast} from '../lib/personalForecastCache';
import {buildCanonicalNatalInputHash} from '../lib/natalChartCanonical';
import {isPersonalForecastPackage, PERSONAL_FORECAST_CONTRACT_VERSION} from '../lib/personalForecastContract';
import type {UserProfile} from '../types';
const person=samples.people[0], profile=person.profile as UserProfile;
const context={userId:profile.id!,profile,accessTier:'premium' as const,period:'day' as const,periodKey:'2026-09-08'};
const inputHash=buildCanonicalNatalInputHash({...profile,latitude:person.chart.birth.latitude,longitude:person.chart.birth.longitude,timezone:person.chart.birth.timezone});
let stored:any;
beforeEach(()=>{jest.clearAllMocks();stored=null;query.mockResolvedValue({rows:[]});getByUser.mockImplementation(async()=>stored);upsertByUser.mockImplementation(async(_:string,value:any)=>{stored=structuredClone(value);});getPrimary.mockResolvedValue({user_id:profile.id,input_hash:inputHash,chart_data:person.chart});request.mockResolvedValue({content:JSON.stringify({title:'A good conversation',body:'Today is a good day to share a laugh with someone.',closing:'A little chat can be lovely.'})});});
it('reads the owner saved chart, writes one complete result and reuses durable cache',async()=>{
 const first=await ensurePersonalForecast(context);expect(first.status).toBe('ready');if(first.status!=='ready')throw Error('Not ready');expect(isPersonalForecastPackage(first.value)).toBe(true);expect(first.value.sections).toEqual([]);expect(request).toHaveBeenCalledTimes(1);expect(upsertByUser).toHaveBeenCalledTimes(1);
 const again=await ensurePersonalForecast(context);expect(again.status).toBe('ready');expect(request).toHaveBeenCalledTimes(1);expect(upsertByUser).toHaveBeenCalledTimes(1);
});
it.each([
 ['negative', 'Сегодня напряжённый день, и всё идёт медленнее. Постарайся выбрать удобный темп.'],
 ['astrology terms', 'Меркурий и Солнце в твоей карте дают ясность и интерес к новым идеям.'],
 ['repeated', 'Сегодня тебе будет легче понять важную деталь и выбрать подходящий вариант.'],
])('saves and reuses a readable %s day reading',async(label,body)=>{
 if(label==='repeated') query.mockResolvedValue({rows:[{user_id:profile.id,content:{
   period:'day',periodKey:'2026-09-07',overview:{title:'Ясный день',text:body},sections:[],
   meta:{contractVersion:PERSONAL_FORECAST_CONTRACT_VERSION},
 }}]});
 request.mockResolvedValue({content:JSON.stringify({title:'Ясный день',body,closing:'Пусть день пройдёт хорошо.'})});
 const first=await ensurePersonalForecast(context);
 expect(first.status).toBe('ready');if(first.status!=='ready')throw Error('Not ready');
 expect(isPersonalForecastPackage(first.value)).toBe(true);
 expect(first.value.overview.text).toBe(`${body}\n\nПусть день пройдёт хорошо.`);
 const expectedRequests=label==='negative'||label==='astrology terms'?2:1;
 expect(request).toHaveBeenCalledTimes(expectedRequests);expect(upsertByUser).toHaveBeenCalledTimes(1);
 const again=await ensurePersonalForecast(context);
 expect(again.status).toBe('ready');if(again.status!=='ready')throw Error('Not ready');
 expect(again.value.overview.text).toBe(first.value.overview.text);
 expect(request).toHaveBeenCalledTimes(expectedRequests);expect(upsertByUser).toHaveBeenCalledTimes(1);
});
it('saves and reuses a month reading even when it contains a negative phrase',async()=>{
 const body='Этот месяц будет непростым. Наступит время разобрать важные вопросы в своём темпе.';
 request.mockResolvedValue({content:JSON.stringify({title:'Месяц перемен',body,action_type:'talk',action_text:''})});
 const month={...context,period:'month' as const,periodKey:'2026-09'};
 const first=await ensurePersonalForecast(month);
 expect(first.status).toBe('ready');if(first.status!=='ready')throw Error('Not ready');
 expect(isPersonalForecastPackage(first.value)).toBe(true);expect(first.value.overview.text).toBe(body);
 const again=await ensurePersonalForecast(month);
 expect(again.status).toBe('ready');if(again.status!=='ready')throw Error('Not ready');
 expect(again.value.overview.text).toBe(body);
 expect(request).toHaveBeenCalledTimes(1);expect(upsertByUser).toHaveBeenCalledTimes(1);
});
it.each([null,{user_id:'other',input_hash:inputHash,chart_data:person.chart}])('refuses missing or foreign saved charts before provider access',async chart=>{getPrimary.mockResolvedValue(chart);await expect(ensurePersonalForecast(context)).rejects.toThrow('PERSONAL_FORECAST_EVIDENCE_EMPTY');expect(request).not.toHaveBeenCalled();});
it('does not silently recalculate an outdated chart',async()=>{getPrimary.mockResolvedValue({user_id:profile.id,input_hash:'outdated',chart_data:person.chart});await expect(ensurePersonalForecast(context)).rejects.toThrow('PERSONAL_FORECAST_CHART_OUTDATED');expect(request).not.toHaveBeenCalled();});
it('does not persist a fabricated fallback after provider failure',async()=>{request.mockRejectedValue(new Error('quota unavailable'));await expect(ensurePersonalForecast(context)).rejects.toThrow('PERSONAL_FORECAST_WRITER_REQUEST_FAILED');expect(upsertByUser).not.toHaveBeenCalled();});
it('reports a failed durable write as failure',async()=>{upsertByUser.mockRejectedValueOnce(new Error('db unavailable'));await expect(ensurePersonalForecast(context)).rejects.toThrow('PERSONAL_FORECAST_CACHE_WRITE_FAILED');});
