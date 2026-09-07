import fs from 'node:fs';

function read(path){ return fs.readFileSync(path,'utf8'); }
function write(path,text){ fs.writeFileSync(path,text); }
function replaceExact(path, from, to){
  const s=read(path); if(s.includes(to)) return;
  const count=s.split(from).length-1; if(count!==1) throw new Error(`${path}: anchor count ${count} for ${from.slice(0,80)}`);
  write(path,s.replace(from,to));
}
function replaceRange(path,start,end,replacement){
  const s=read(path); const a=s.indexOf(start); if(a<0) throw new Error(`${path}: missing start`); const b=s.indexOf(end,a+start.length); if(b<0) throw new Error(`${path}: missing end`);
  if(s.slice(a,b).includes(replacement.slice(0,80))) return;
  write(path,s.slice(0,a)+replacement+s.slice(b));
}
function appendOnce(path, marker, text){ const s=read(path); if(s.includes(marker)) return; write(path,s+`\n${text}\n`); }

replaceRange('AGENTS.md','## Voice and calculation rules','\n## Verification and file boundaries',`## Voice and personal forecast rules

- Personal forecasts for Today, Week, and Month are AI-written user-facing products. Old forecast wording, old cached copies, and old visual assumptions must not be carried into the new NEBO design.
- Voice: simple conversational Russian on «ты». Clear first, character second. A sharp phrase or dry joke is welcome when it fits, but never required.
- No astrology terminology in user-visible forecast copy. No psychology, therapy, coaching, self-help jargon, mysticism, or corporate/report language.
- Do not use product/astrology abstractions such as «период», «динамика», «напряжение», «сфера», «ресурс», «проработка», «осознанность», «трансформация» when normal spoken wording can say the same thing.
- Do not invent biography, current relationships, profession, purchases, trips, or plans. External events are possibilities, not guarantees.
- Do not pad to a word quota, sentence quota, or fixed number of paragraphs. The reading should be as long as needed to feel complete and easy to read in the approved mobile UI.
- The visible UI must clearly identify Today / Week / Month and place the reading in the approved NEBO render-parity layouts. The forecast itself must remain readable prose, not a dashboard of pseudo-scores.
- Forecast-specific prompt identity must be versioned so old forecast cache never silently reappears after a voice rewrite.
- Safety remains strict: no diagnosis, medical treatment, investment instruction, guaranteed outcomes, or claims about another person’s private thoughts.
`);

replaceExact('lib/personalForecastContract.ts',"'personal-forecast-feed.v47-period-horoscope'","'personal-forecast-feed.v48-nebo-human-voice'");
replaceExact('lib/personalForecastContract.ts',"'personal-forecast-cache-v19-period-horoscope'","'personal-forecast-cache-v20-nebo-human-voice'");
replaceExact('lib/personalForecastContract.ts',"'personal-forecast-feed-v29-period-horoscope'","'personal-forecast-feed-v30-nebo-human-voice'");
replaceExact('services/personalForecastService.ts',"const LOCAL_CACHE_PREFIX = 'tvoi-goroskop:personal-forecast-feed-v21-three-part-human';","const LOCAL_CACHE_PREFIX = 'nebo:personal-forecast:v22-human-voice';");

const generator=read('lib/personalForecastGeneration.ts');
let g=generator.replace('  renderPersonalForecastReferenceExamples,\n','');
const promptStart=g.indexOf('export function getPersonalForecastSystemPrompt(');
const promptEnd=g.indexOf('\ntype GeneratedFeedPayload',promptStart);
if(promptStart<0||promptEnd<0) throw new Error('forecast prompt anchors missing');
const newPrompt=`export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const ru = language === 'ru';
  const periodLabel = period === 'day' ? (ru ? 'сегодня' : 'today') : period === 'week' ? (ru ? 'неделю' : 'the week') : (ru ? 'месяц' : 'the month');
  return ru ? \`Ты пишешь личный прогноз NEBO на \${periodLabel}.\n\nПиши так, как нормальный знакомый сказал бы человеку пару точных вещей про ближайший период. Коротко, живо, конкретно. Где уместно — лёгкая дерзость, сухая шутка или неожиданная бытовая формулировка. Не пытайся шутить в каждом ответе.\n\nГлавное:\n- обычный русский язык, обращение на «ты»;\n- никакой астрологии в видимом тексте: без планет, аспектов, транзитов, домов и «энергий»;\n- никакой психологии, коучинга и канцелярита: не пиши «ресурс», «проработка», «осознанность», «внутренняя опора», «период трансформации», «сфера», «активируется»;\n- не придумывай человеку работу, отношения, покупки, поездки или прошлые события, которых нет во входных данных;\n- не обещай точное внешнее событие;\n- не давай медицинских, финансовых или юридических указаний;\n- не превращай прогноз в инструкцию «как правильно жить»;\n- не пиши воду и не добивай текст до заданного объёма;\n- не повторяй прошлые прогнозы из anti_repeat_context.\n\nВерни только strict JSON: title — короткий живой заголовок; forecast — основной прогноз, с естественными абзацами когда это помогает чтению; closing — короткая человеческая финальная строка. Смысл бери из приватного astrologer_brief, но не повторяй его служебный язык.\`
    : \`Write a personal NEBO forecast for \${periodLabel}. Use plain conversational language, concise and specific. A dry joke or sharp line is fine when it fits, never as a quota. Do not expose astrology terminology, coaching or therapy language, invented biography, guaranteed external events, or medical/financial/legal advice. Do not pad to a word count. Do not repeat anti_repeat_context. Return strict JSON only: title, forecast, closing.\`;
}
`;
g=g.slice(0,promptStart)+newPrompt+g.slice(promptEnd);
const valStart=g.indexOf('export function validateFreeGeneratedForecastFeed(');
const valEnd=g.indexOf('\nexport function parseGeneratedFeedPayload',valStart);
if(valStart<0||valEnd<0) throw new Error('forecast validator anchors missing');
const newValidator=`export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  _availableEvidenceIds: ReadonlySet<string> = new Set(),
  _period: PersonalForecastPeriod = 'day',
  options: PersonalForecastValidationOptions = {},
): ValidatedFreeWriterResult {
  const titleText = modelText(raw.title);
  const forecastText = modelText(raw.forecast);
  const closingText = modelText(raw.closing);
  const errors: string[] = [];
  const editorialWarnings: string[] = [];
  const unexpectedFields = Object.keys(raw).filter((key) => !['title', 'forecast', 'closing'].includes(key));
  if (unexpectedFields.length) errors.push(\`payload contains unexpected fields: \${unexpectedFields.join(', ')}\`);
  if (!titleText) errors.push('title requires text');
  if (!forecastText) errors.push('forecast requires text');
  if (!closingText) errors.push('closing requires text');
  if (forecastText && !hasCompleteSentenceEnding(forecastText)) errors.push('forecast must end with a complete sentence');
  if (closingText && !hasCompleteSentenceEnding(closingText)) errors.push('closing must end with a complete sentence');
  const visibleCopy = [titleText, forecastText, closingText].filter((value): value is string => !!value);
  if (visibleCopy.some(containsForbiddenAstrologyTerm)) errors.push('visible forecast copy contains a forbidden astrology term');
  if (visibleCopy.some(containsFormalRussianAddress)) errors.push('visible forecast copy contains polite Вы; address the reader as ты');
  if (visibleCopy.some(containsUnsupportedEventGuarantee)) errors.push('visible forecast copy contains an unsupported event guarantee');
  if (visibleCopy.some((value) => matchesAny(value, INVENTED_BIOGRAPHY_PATTERNS)) || visibleCopy.some(hasEstablishedBackstory)) errors.push('visible forecast copy invents biography or established backstory');
  if (visibleCopy.some((value) => matchesAny(value, MEDICAL_CLAIM_PATTERNS))) errors.push('visible forecast copy contains a medical claim');
  if (visibleCopy.some((value) => matchesAny(value, FINANCIAL_CLAIM_PATTERNS))) errors.push('visible forecast copy contains a financial claim');
  if (options.language === 'ru' && visibleCopy.some((value) => !isPredominantlyRussian(value))) errors.push('Russian forecast must be predominantly Russian');
  const blockingVoiceCodes = [...new Set(visibleCopy.flatMap(getPersonalForecastVoiceViolationCodes))].filter((code) => ['APP_MYSTICISM','PERSONAL_21','PERSONAL_23'].includes(code));
  if (blockingVoiceCodes.length) errors.push(\`forecast voice codes: \${blockingVoiceCodes.join(',')}\`);
  const repeatFragments: PersonalForecastRepeatFragment[] = [
    ...(titleText ? [{ kind: 'title' as const, text: titleText }] : []),
    ...(forecastText ? [{ kind: 'forecast' as const, text: forecastText }] : []),
    ...(closingText ? [{ kind: 'closing' as const, text: closingText }] : []),
  ];
  errors.push(...findPersonalForecastRepeatViolations(repeatFragments,[...(options.recentFragments || []), ...(options.rejectedDraftFragments || [])]));
  if (errors.length || !titleText || !forecastText || !closingText) return { sections: [], errors: errors.length ? errors : ['payload is incomplete'], editorialWarnings };
  const evidenceIds = [PERSONAL_FORECAST_PROFILE_EVIDENCE_ID];
  const directSection = (blocks: Array<{ text: string; role: ForecastContentBlock['role'] }>, title: string | null = null): FreeGeneratedSection => ({ title, evidenceIds, blocks: blocks.map((block) => ({ ...block, evidenceIds })), mainIdeaKey: \`server:\${Math.abs(stableHash(normalizePersonalForecastText(blocks.map((block) => block.text).join('\\n')))).toString(36)}\`, lifePlotKey: '', adviceKey: '', comparisonKey: '' });
  return { errors: [], editorialWarnings, sections: [directSection([{ text: forecastText, role: 'detail' }], titleText), directSection([{ text: closingText, role: 'lead' }])] };
}
`;
g=g.slice(0,valStart)+newValidator+g.slice(valEnd);
const unused=['VISIBLE_CATEGORY_LABEL_PATTERN','PERIOD_MISMATCH_PATTERNS','VISIBLE_CLOSING_LABEL_PATTERN','GENERIC_FORECAST_TITLE_PATTERN','STRAINED_FORECAST_TITLE_PATTERN','PERSONAL_FORECAST_VOICE_REPAIR_HINTS','FORECAST_INSTRUCTION_PATTERN','FORECAST_UNCERTAINTY_PATTERN','EMPTY_FORECAST_RESULT_PATTERN','VAGUE_FORECAST_NOUN_PATTERN','PERSONAL_FORECAST_MAX_SENTENCE_WORDS','HARD_STIFF_REPORT_PATTERNS','SOFT_STIFF_REPORT_PATTERNS'];
for(const name of unused) g=g.replace(`const ${name}`,`const _${name}`);
g=g.replace('function closingDuplicatesBody(','function _closingDuplicatesBody(');
write('lib/personalForecastGeneration.ts',g);

appendOnce('styles/neboV2.css','Render parity: zodiac / compatibility / matrix',`/* Render parity: zodiac / compatibility / matrix */
.nebo-v2 .fresh-page{background:var(--nebo-bg)!important;color:var(--nebo-ink)!important}
.nebo-v2 .app-top-bar{background:color-mix(in srgb,var(--nebo-bg) 94%,transparent)!important;border-bottom:0!important;backdrop-filter:blur(18px)}
.nebo-v2 .fresh-btn-primary{min-height:52px!important;border-radius:20px!important;background:var(--nebo-primary)!important;color:var(--nebo-primary-ink)!important;box-shadow:none!important}
.nebo-v2 .fresh-input,.nebo-v2 .compat-air-input{min-height:52px!important;border-radius:17px!important;background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important;color:var(--nebo-ink)!important;box-shadow:none!important}
.nebo-v2 .horo-reader-controls{padding:6px 16px 0!important}.nebo-v2 .horo-period-tabs{background:var(--nebo-soft)!important;border-radius:17px!important;padding:4px!important}.nebo-v2 .horo-reader-heading{padding:16px 18px 8px!important}.nebo-v2 .horo-reader-sign-trigger{font-size:26px!important;font-weight:760!important;color:var(--nebo-ink)!important}.nebo-v2 .horo-reader-sign-range{color:var(--nebo-muted)!important}.nebo-v2 .horo-reader-curve{display:none!important}.nebo-v2 .horo-uni-wrap{padding:0 14px 24px!important}.nebo-v2 .horo-reader-article{border:0!important;background:transparent!important;box-shadow:none!important;padding:0!important}.nebo-v2 .horo-reader-symbol-stage{width:100%!important;min-height:184px!important;border:0!important;border-radius:27px!important;background:linear-gradient(135deg,#6559e9 0%,#8f64ee 58%,#5b57dc 100%)!important;overflow:hidden!important;display:flex!important;justify-content:flex-end!important;align-items:center!important;padding:10px 18px!important;box-shadow:none!important}.nebo-v2 .horo-reader-selected-illustration{width:170px!important;height:170px!important}.nebo-v2 .horo-uni-hero{margin:-174px 0 0!important;min-height:174px!important;padding:25px 48% 22px 20px!important;position:relative!important;z-index:2!important;color:#fff!important;pointer-events:none!important}.nebo-v2 .horo-reader-headline{color:#fff!important;font-size:26px!important}.nebo-v2 .horo-reader-reading{margin-top:14px!important;padding:19px!important;border-radius:24px!important;background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important}.nebo-v2 .horo-sign-story p{font-size:16px!important;line-height:1.62!important;color:var(--nebo-ink)!important}
.nebo-v2 .compat-editorial-page{padding:0 14px 26px!important;background:var(--nebo-bg)!important}.nebo-v2 .compat-entry-form,.nebo-v2 .compat-history-panel,.nebo-v2 .compat-result-summary,.nebo-v2 .compat-read-block{background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important;border-radius:24px!important;box-shadow:none!important}.nebo-v2 .compat-entry-who-title,.nebo-v2 .compat-result-heading{font-size:27px!important;color:var(--nebo-ink)!important}.nebo-v2 .compat-air-person{padding:17px!important;border-radius:22px!important;background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important;box-shadow:none!important}.nebo-v2 .compat-choice-tabs{background:var(--nebo-soft)!important;border-radius:17px!important;padding:4px!important}.nebo-v2 .compat-choice-tab{min-height:44px!important;border-radius:14px!important}.nebo-v2 .compat-choice-tab.is-active,.nebo-v2 .compat-choice-tab.is-on{background:var(--nebo-accent)!important;color:#fff!important;box-shadow:none!important}.nebo-v2 .compat-result-ring-people,.nebo-v2 .compat-story-cover{border-radius:27px!important;background:linear-gradient(135deg,var(--nebo-lilac),var(--nebo-pink))!important;border:0!important;box-shadow:none!important}.nebo-v2 .compat-read-text{font-size:16px!important;line-height:1.65!important;color:var(--nebo-ink)!important}
.nebo-v2 .matrix-editorial-page{padding:0 14px 30px!important;background:var(--nebo-bg)!important}.nebo-v2 .product-screen-cover--matrix{min-height:180px!important;border-radius:27px!important;border:0!important;background:linear-gradient(135deg,#d9eeff,#e4d7ff 52%,#dfffd2)!important;color:#11152f!important;box-shadow:none!important}.nebo-v2 .mtx-form{padding:14px!important;border-radius:22px!important;background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important}.nebo-v2 .mtx-hero,.nebo-v2 .mtx-card,.nebo-v2 .mtx-note{border-radius:22px!important;background:var(--nebo-surface)!important;border:1px solid var(--nebo-line)!important;box-shadow:none!important;color:var(--nebo-ink)!important}.nebo-v2 .mtx-card-essence,.nebo-v2 .mtx-hero-essence{font-size:15px!important;line-height:1.62!important;color:var(--nebo-ink)!important}
@media(max-width:380px){.nebo-v2 .horo-reader-symbol-stage{min-height:164px!important}.nebo-v2 .horo-reader-selected-illustration{width:148px!important;height:148px!important}.nebo-v2 .horo-uni-hero{margin-top:-154px!important;min-height:154px!important;padding-right:45%!important}.nebo-v2 .horo-reader-headline{font-size:23px!important}.nebo-v2 .compat-editorial-page,.nebo-v2 .matrix-editorial-page{padding-left:10px!important;padding-right:10px!important}}
`);

write('__tests__/personal-forecast-generation.test.ts',`import { PERSONAL_FORECAST_RESPONSE_SCHEMA, getPersonalForecastResponseSchema, getPersonalForecastSystemPrompt, parseGeneratedFeedPayload, validateFreeGeneratedForecastFeed } from '../lib/personalForecastGeneration';
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
`);
console.log('NEBO next parity patch applied');
