import { PERSONAL_FORECAST_RESPONSE_SCHEMA, getPersonalForecastResponseSchema, getPersonalForecastSystemPrompt, parseGeneratedFeedPayload, validateFreeGeneratedForecastFeed } from '../lib/personalForecastGeneration';
import { PERSONAL_FORECAST_CACHE_VERSION, PERSONAL_FORECAST_CONTRACT_VERSION, PERSONAL_FORECAST_PROMPT_VERSION } from '../lib/personalForecastContract';
const valid={title:'Без лишнего шума',forecast:'Сегодня одна обычная вещь может решиться проще, чем казалось вчера. Не обязательно устраивать из неё отдельный сериал — достаточно заметить, где ответ уже почти готов.',closing:'Редкий случай: меньше суеты действительно помогает.'};
const check=(x={})=>validateFreeGeneratedForecastFeed({...valid,...x},new Set(),'day',{language:'ru',periodKey:'2026-09-08'});
describe('NEBO personal forecast human voice',()=>{
 test('keeps strict JSON fields',()=>{expect(PERSONAL_FORECAST_RESPONSE_SCHEMA.required).toEqual(['title','forecast','closing']);expect(getPersonalForecastResponseSchema('week')).toBe(PERSONAL_FORECAST_RESPONSE_SCHEMA);});
 test('removes quotas and visible astrology/coaching',()=>{const p=getPersonalForecastSystemPrompt('ru','day');expect(p).toContain('не добивай текст до заданного объёма');expect(p).toContain('никакой астрологии');expect(p).not.toContain('3–4 предложений');});
 test('invalidates old forecast caches',()=>{expect(PERSONAL_FORECAST_PROMPT_VERSION).toContain('v48-nebo-human-voice');expect(PERSONAL_FORECAST_CACHE_VERSION).toContain('v20-nebo-human-voice');expect(PERSONAL_FORECAST_CONTRACT_VERSION).toContain('v30-nebo-human-voice');});
 test('accepts natural concise copy',()=>expect(check().errors).toEqual([]));
 test('keeps hard safety',()=>{expect(check({forecast:'Марс в транзите обещает отличный день.'}).errors).toContain('visible forecast copy contains a forbidden astrology term');expect(check({forecast:'Ты точно получишь деньги сегодня.'}).errors).toContain('visible forecast copy contains an unsupported event guarantee');});
 test('parses provider JSON',()=>expect(parseGeneratedFeedPayload(JSON.stringify(valid))).toEqual(valid));
});
