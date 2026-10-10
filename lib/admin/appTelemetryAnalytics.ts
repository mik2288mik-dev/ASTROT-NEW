import { getPool } from '../db';
import { TRACE_LABELS, TRACE_SCREEN_LABELS, type AppTraceEvent } from '../appTelemetry';
import { percentile } from './journeyAnalytics';
import { operationLabel, productEventLabel, readableLabel } from './telemetryCopy';
import type { AdminActivityRange } from './activityTypes';

export type TraceRow = AppTraceEvent & { visitId: string; userId: string | null; name: string | null; version: string;
  startedAt: string; userCreatedAt: string | null; runtime: string; campaign: string | null; inSegment?:boolean };
export type AppTraceReport = {
  range: AdminActivityRange; generatedAt: string; truncated: boolean; versions: string[];
  summary: { visits: number; users: number; anonymous: number; screens: number; clicks: number; errors: number; questions: number };
  daily: Array<{ day: string; visits: number; users: number; clicks: number; errors: number }>;
  screens: Array<{ key: string; label: string; views: number; users: number; medianMs: number | null; exits: number; depth75: number }>;
  requests: Array<{ operation: string; started: number; completed: number; errors: number; medianMs: number | null; p90Ms: number | null }>;
  clicks: Array<{ screen: string; label: string; count: number; users: number }>;
  outcomes:Array<{key:string;label:string;count:number;visits:number}>;
  controls: Array<{ screen: string; label: string; shown: number; clicked: number; percent: number | null }>;
  content: Array<{ screen: string; block: string; views: number; medianMs: number | null; medianFocusMs:number | null; stops:number }>;
  retention: Array<{ day: number; eligible: number; returned: number }>;
  acquisition: Array<{ source: string; users: number; questions: number; visits: number }>;
  versionsComparison: Array<{ version:string; visits:number; users:number; readVisits:number; stalled:number; errors:number }>;
  weakPoints: Array<{ screen:string; stopped:number; visits:number; percent:number | null }>;
  questionFunnel: Array<{ label:string; count:number }>;
  transitions: Array<{ from: string; to: string; count: number; visits: number }>;
  previous?: { range:AdminActivityRange; summary:AppTraceReport['summary'] };
  visits: Array<{ id: string; userId: string | null; name: string | null; startedAt: string; lastAt: string; version: string; screens: number; actions: number; lastScreen: string;
    screensVisited: string[]; state: 'stopped' | 'recent' | 'continued'; errors: number }>;
  insights: Array<{ title: string; evidence: string; recommendation: string; visitIds?:string[] }>;
};
export type AppTraceDetail = { range: AdminActivityRange; truncated: boolean; questionsTruncated: boolean; canReadText: boolean; events: Array<TraceRow & { label: string }>;
  questions: Array<{ id: number; role: string; text: string; at: string; questionId: number | null }> };
const countUsers = (rows: TraceRow[]) => new Set(rows.map(e => e.userId || `anonymous:${e.visitId}`)).size;
const group = (rows: TraceRow[], key: (e: TraceRow) => string) => {
  const result = new Map<string, TraceRow[]>();
  for (const e of rows) { const k = key(e); const list = result.get(k) || []; list.push(e); result.set(k, list); } return result;
};
const dayKey = (date: number, timezone: string) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(date));
const val = (e: TraceRow, key: string) => typeof e.payload[key] === 'number' ? Number(e.payload[key]) : null;
export function buildAppTraceReport(input: TraceRow[], range: AdminActivityRange, now = Date.now(), truncated = false): AppTraceReport {
  const formatter = new Intl.DateTimeFormat('en-CA', {timeZone:range.timezone,year:'numeric',month:'2-digit',day:'2-digit'});
  const dateKey = (at:number) => formatter.format(new Date(at));
  const rows = input.filter(e => { const day = dateKey(e.at); return e.inSegment!==false && day >= range.from && day <= range.to; });
  const latest = new Map<string, number>();
  for (const event of input) latest.set(event.visitId, Math.max(latest.get(event.visitId) || 0, event.at));
  const links = new Map<string, { from: string; to: string; count: number; ids: Set<string> }>();
  const visits = [...group(rows, e => e.visitId)].map(([id, events]) => {
    const sorted = [...events].sort((a, b) => a.sequence - b.sequence || a.at - b.at);
    const first = sorted[0]; const last = sorted.at(-1)!;
    const opened = sorted.filter(e => e.type === 'screen_view');
    for (let i = 1; i < opened.length; i++) {
      const from = opened[i - 1].screen; const to = opened[i].screen;
      if (from === to) continue;
      const key = `${from}:${to}`;
      const link = links.get(key) || { from, to, count: 0, ids: new Set<string>() };
      link.count++; link.ids.add(id); links.set(key, link);
    }
    const state: AppTraceReport['visits'][number]['state'] = (latest.get(id) || 0) > last.at ? 'continued'
      : now - last.at >= 30 * 60_000 ? 'stopped' : 'recent';
    return { id, userId: first.userId, name: first.name, startedAt: first.startedAt, lastAt: new Date(last.at).toISOString(), version: first.version,
      screens: opened.length, actions: sorted.filter(e => e.type === 'ui_click').length, lastScreen: last.screen,
      screensVisited: [...new Set(opened.map(e => e.screen))], state,
      errors: sorted.filter(e => e.type === 'client_error' || ['failed', 'http_error', 'network_error'].includes(String(e.payload.outcome))).length };
  }).sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
  const screens = [...group(rows.filter(e => ['screen_view','screen_exit','screen_progress','scroll_depth'].includes(e.type)), e => e.screen)].map(([key, events]) => {
    const views = events.filter(e => e.type === 'screen_view');
    const durations = [...group(events.filter(e => ['screen_exit','screen_progress'].includes(e.type) && val(e,'visible_ms') != null), e => `${e.visitId}:${e.payload.view_id}`)].map(([, list]) => Math.max(...list.map(e => val(e, 'visible_ms')!)));
    return { key, label: TRACE_SCREEN_LABELS[key] || key, views: views.length, users: countUsers(views), medianMs: percentile(durations, .5),
      exits: events.filter(e => e.type === 'screen_exit').length,
      depth75: new Set(events.filter(e => Number(e.payload.depth) >= 75).map(e => `${e.visitId}:${e.payload.view_id}`)).size };
  }).sort((a,b) => b.views - a.views);
  const requests = [...group(rows.filter(e => e.type === 'request_started' || e.type === 'request_finished'), e => String(e.payload.operation || 'unknown'))].map(([operation, events]) => {
    const completed = events.filter(e => e.type === 'request_finished');
    const durations = completed.filter(e => e.payload.outcome === 'success').map(e => val(e,'duration_ms')).filter((v): v is number => v != null);
    return { operation, started: events.filter(e => e.type === 'request_started').length, completed: completed.length,
      errors: completed.filter(e => ['http_error','network_error'].includes(String(e.payload.outcome))).length, medianMs: percentile(durations,.5), p90Ms: percentile(durations,.9) };
  }).sort((a,b) => b.errors - a.errors || (b.p90Ms || 0) - (a.p90Ms || 0));
  const clicks = [...group(rows.filter(e => e.type === 'ui_click'), e => `${e.screen}:${e.payload.label || e.payload.control}`)].map(([, events]) => ({
    screen: TRACE_SCREEN_LABELS[events[0].screen] || 'Другой экран', label: readableLabel(events[0].payload.label, 'Кнопка без названия'), count: events.length, users: countUsers(events),
  })).sort((a,b) => b.count - a.count).slice(0,100);
  const controls = [...group(rows.filter(e => e.type === 'control_view' || e.type === 'ui_click'), e => `${e.screen}:${e.payload.control}:${e.payload.label || ''}`)].map(([,events]) => {
    const shown = new Map<string,number>();
    for (const e of events.filter(e=>e.type==='control_view')) {
      const id=`${e.visitId}:${e.payload.view_id}`;
      shown.set(id,Math.min(shown.get(id) ?? Infinity,e.sequence));
    }
    const clickedAfterShow = new Set(events.filter(e => e.type === 'ui_click' && e.sequence>(shown.get(`${e.visitId}:${e.payload.view_id}`) ?? Infinity))
      .map(e=>`${e.visitId}:${e.payload.view_id}`)).size;
    return { screen:TRACE_SCREEN_LABELS[events[0].screen] || 'Другой экран',label:readableLabel(events[0].payload.label, 'Кнопка без названия'),
      shown:shown.size,clicked:clickedAfterShow,percent:shown.size ? Math.round(clickedAfterShow/shown.size*100) : null };
  }).sort((a,b) => b.shown-a.shown).slice(0,100);
  const outcomes=[...group(rows.filter(e=>e.type==='product_event'),e=>String(e.payload.event_name || 'unknown'))].map(([key,events])=>({
    key,label:productEventLabel(key,events[0].payload.label),count:events.length,visits:new Set(events.map(e=>e.visitId)).size,
  })).sort((a,b)=>b.count-a.count);
  const content = [...group(rows.filter(e => e.type === 'content_view'), e => `${e.screen}:${e.payload.block}`)].map(([, events]) => {
    const views = [...group(events, e => `${e.visitId}:${e.payload.view_id}`)].map(([, list]) => Math.max(...list.map(e => Number(e.payload.visible_ms || 0))));
    const focus=[...group(events.filter(e=>val(e,'focus_ms')!=null),e=>`${e.visitId}:${e.payload.view_id}`)].map(([,list])=>Math.max(...list.map(e=>val(e,'focus_ms')!)));
    return { screen: TRACE_SCREEN_LABELS[events[0].screen] || events[0].screen, block: String(events[0].payload.block), views: views.length, medianMs: percentile(views,.5),medianFocusMs:percentile(focus,.5),
      stops:rows.filter(e=>e.type==='feed_position' && e.payload.state==='scroll_stop' && e.screen===events[0].screen && e.payload.block===events[0].payload.block).length };
  }).sort((a,b) => (b.medianFocusMs || 0)-(a.medianFocusMs || 0) || b.views-a.views).slice(0,100);
  const daily = [...group(rows,e => dateKey(e.at))].map(([day, events]) => ({ day,
    visits: new Set(events.map(e => e.visitId)).size, users: new Set(events.map(e => e.userId).filter(Boolean)).size,
    clicks: events.filter(e => e.type === 'ui_click').length,
    errors: events.filter(e => e.type === 'client_error' || e.payload.outcome === 'http_error' || e.payload.outcome === 'network_error').length,
  })).sort((a,b) => a.day.localeCompare(b.day));
  const firstSeen = new Map<string,number>();
  for (const e of rows.filter(e => e.userId)) firstSeen.set(e.userId!, Math.min(firstSeen.get(e.userId!) ?? Infinity, e.at));
  const returnsByUser=group(input.filter(e=>e.userId && ['screen_view','ui_click','question_submit'].includes(e.type)),e=>e.userId!);
  const retention = [1,7].map(day => {
    const eligible = [...firstSeen].filter(([,at]) => now >= at + (day+1)*86_400_000);
    return { day, eligible: eligible.length, returned: eligible.filter(([id, first]) => (returnsByUser.get(id) || []).some(e => e.at >= first + day*86_400_000 && e.at < first + (day+1)*86_400_000)).length };
  });
  const latestByVisit=new Map<string,number>();
  for(const e of input) latestByVisit.set(e.visitId,Math.max(latestByVisit.get(e.visitId) || 0,e.at));
  const weakPoints=[...group(rows,e=>e.visitId)].flatMap(([,events]) => {
    const last=[...events].sort((a,b)=>a.at-b.at || a.sequence-b.sequence).at(-1)!;
    return now-last.at>=30*60_000 && last.at===latestByVisit.get(last.visitId) ? [{screen:last.screen,events}] : [];
  });
  const weakness=[...group(rows,e=>e.screen)].map(([screen,events]) => {
    const total=new Set(events.map(e=>e.visitId)).size;
    const stopped=weakPoints.filter(e=>e.screen===screen).length;
    return {screen:TRACE_SCREEN_LABELS[screen] || screen,stopped,visits:total,percent:total ? Math.round(stopped/total*100) : null};
  }).sort((a,b)=>b.stopped-a.stopped);
  const versionsComparison=[...group(rows,e=>e.version)].map(([version,events])=> ({version,
    visits:new Set(events.map(e=>e.visitId)).size,users:new Set(events.map(e=>e.userId).filter(Boolean)).size,
    readVisits:new Set(events.filter(e=>e.type==='content_view').map(e=>e.visitId)).size,
    stalled:weakPoints.filter(e=>e.events[0].version===version).length,
    errors:events.filter(e=>e.type==='client_error' || ['failed','network_error','http_error'].includes(String(e.payload.outcome))).length,
  }));
  const submitted=rows.filter(e=>e.type==='question_submit');
  const questionResults=group(rows.filter(e=>e.type==='question_result'),e=>`${e.visitId}:${e.payload.request_id}`);
  const answersViewed=group(rows.filter(e=>e.type==='content_view'),e=>`${e.visitId}:${e.payload.block}`);
  const results=submitted.map(e=>(questionResults.get(`${e.visitId}:${e.payload.request_id}`) || []).find(x=>x.sequence>e.sequence));
  const success=results.filter(e=>e?.payload.outcome==='success') as TraceRow[];
  const viewed=success.filter(e=>(answersViewed.get(`${e.visitId}:Ответ на вопрос #${e.payload.answer_id}`) || []).some(x=>x.at>=e.at));
  const questionFunnel=[{label:'Отправили вопрос',count:submitted.length},{label:'Получили ответ',count:success.length},{label:'Ответ был на экране хотя бы секунду',count:viewed.length}];
  const insights: AppTraceReport['insights'] = [];
  const examples=(events:TraceRow[])=>[...new Set(events.map(e=>e.visitId))].slice(0,3);
  const acquisition = [...group(rows,e => e.campaign || 'Источник не определён')].map(([source,events]) => ({source,
    users:new Set(events.map(e => e.userId).filter(Boolean)).size,visits:new Set(events.map(e => e.visitId)).size,
    questions:events.filter(e => e.type==='question_submit').length})).sort((a,b) => b.visits-a.visits);
  if (visits.length < 30) insights.push({ title: 'Пока рано оценивать всё приложение', evidence: `Записано посещений: ${visits.length}. Пока их мало для уверенных выводов.`, recommendation: 'Собери данные за неделю. Уже сейчас можно искать ошибки в историях отдельных людей. Общие проценты лучше оценивать, когда посещений станет больше.' });
  const slow = requests.find(e => e.completed >= 5 && e.p90Ms != null && e.p90Ms > 10_000);
  if (slow) insights.push({ title: `Долгая загрузка: ${operationLabel(slow.operation)}`, evidence: `Обычно загрузка занимает ${Math.round(slow.medianMs! / 1000)} с. В медленных случаях — ${Math.round(slow.p90Ms! / 1000)} с. Завершённых загрузок: ${slow.completed}.`, recommendation: 'Открой примеры ниже. Посмотри, ждал ли человек на этом экране и дождался ли результата. Если загрузка шла незаметно в фоне, она могла ему не мешать.', visitIds:examples(rows.filter(e=>e.type==='request_finished' && e.payload.operation===slow.operation && e.payload.outcome==='success').sort((a,b)=>Number(b.payload.duration_ms)-Number(a.payload.duration_ms))) });
  const broken = requests.find(e => e.errors > 0);
  if (broken) insights.push({ title: `Есть ошибки: ${operationLabel(broken.operation)}`, evidence: `Загрузок с ошибкой: ${broken.errors}. Всего завершённых загрузок: ${broken.completed}.`, recommendation: 'Открой примеры ниже. Проверь, удалось ли повторить действие и получить результат. Если человек застрял, сначала исправь эту ошибку. Некоторые отказы бывают ожидаемыми — например, когда нужно войти.',visitIds:examples(rows.filter(e=>e.type==='request_finished' && e.payload.operation===broken.operation && ['http_error','network_error'].includes(String(e.payload.outcome)))) });
  const strong = screens.find(e => e.users >= 5);
  if (strong) insights.push({ title: `Популярный раздел: ${strong.label}`, evidence: `Посетителей: ${strong.users}. Открытий: ${strong.views}.`, recommendation: 'Посмотри, что здесь делают и получают ли нужный результат. Если люди пользуются функцией и возвращаются к ней, её стоит развивать. Повторные открытия из-за ошибки тоже возможны — проверь примеры.',visitIds:examples(rows.filter(e=>e.screen===strong.key && e.type==='ui_click')) });
  if (weakness[0]?.stopped) insights.push({title:`Здесь часто заканчивают посещение: ${weakness[0].screen}`,evidence:`Посещений этого раздела: ${weakness[0].visits}. В ${weakness[0].stopped} из них дальше не было действий больше 30 минут.`,recommendation:'Открой примеры и посмотри последнее действие. Человек мог прочитать всё нужное и уйти, а мог столкнуться с проблемой. Если многие уходят перед получением результата, проверь этот шаг.',visitIds:weakPoints.filter(e=>(TRACE_SCREEN_LABELS[e.screen] || e.screen)===weakness[0].screen).slice(0,3).map(e=>e.events[0].visitId)});
  const unseen=controls.find(c=>c.shown>=20 && c.clicked===0);
  if(unseen) insights.push({title:'Кнопку показываем, а нажатий нет',evidence:`«${unseen.label}» в разделе «${unseen.screen}»: показов ${unseen.shown}, нажатий после показа — 0.`,recommendation:'Проверь, понятно ли по кнопке, что произойдёт, и можно ли ей воспользоваться. Посмотри примеры ниже. Если решишь менять, начни с одной вещи: текста кнопки или её места.',visitIds:examples(rows.filter(e=>e.type==='control_view' && (TRACE_SCREEN_LABELS[e.screen] || e.screen)===unseen.screen && readableLabel(e.payload.label,'Кнопка без названия')===unseen.label))});
  return { range, generatedAt: new Date(now).toISOString(), truncated, versions: [...new Set(rows.map(e => e.version))].sort(),
    summary: { visits: visits.length, users: new Set(visits.map(e => e.userId).filter(Boolean)).size, anonymous: visits.filter(e => !e.userId).length,
      screens: rows.filter(e => e.type === 'screen_view').length, clicks: rows.filter(e => e.type === 'ui_click').length,
      errors: rows.filter(e => e.type === 'client_error' || ['http_error','network_error','failed'].includes(String(e.payload.outcome))).length,
      questions: rows.filter(e => e.type === 'question_submit').length }, daily,screens,requests,clicks,outcomes,controls,content,retention,acquisition,versionsComparison,weakPoints:weakness,questionFunnel,
    transitions: [...links.values()].map(({ ids, ...link }) => ({ ...link, visits: ids.size })).sort((a, b) => b.visits - a.visits || b.count - a.count), visits,insights };
}

export async function loadAppTrace(range: AdminActivityRange, filters: { userId?: string; visitId?: string; version?: string; segment?: string } = {}) {
  const result = await getPool().query(`WITH bounds AS (SELECT
    ($1::date::timestamp AT TIME ZONE $3) start_at,(($2::date+1)::timestamp AT TIME ZONE $3) end_at),
    selected AS (SELECT e.id,v.user_id FROM product_trace_events e JOIN product_trace_visits v ON v.id=e.visit_id
      LEFT JOIN users u ON u.id=v.user_id CROSS JOIN bounds b
      WHERE e.occurred_at>=b.start_at AND e.occurred_at<b.end_at
        AND ($4::text IS NULL OR v.user_id::text=$4) AND ($5::uuid IS NULL OR v.id=$5)
        AND ($6::text IS NULL OR COALESCE(v.metadata->>'appVersion','unknown')=$6)
        AND ($7::text IS NULL OR ($7='anonymous' AND v.user_id IS NULL)
          OR ($7='new' AND u.created_at >= (v.started_at AT TIME ZONE 'UTC') - INTERVAL '1 day')
          OR ($7='returning' AND u.created_at < (v.started_at AT TIME ZONE 'UTC') - INTERVAL '1 day'))),
    cohort AS (SELECT DISTINCT user_id FROM selected WHERE user_id IS NOT NULL)
    SELECT e.*,v.user_id::text,u.name,v.started_at,v.metadata,u.created_at user_created_at,(s.id IS NOT NULL) in_segment,
      a.traffic_source attribution_source,a.campaign_title attribution_campaign
    FROM product_trace_events e JOIN product_trace_visits v ON v.id=e.visit_id LEFT JOIN users u ON u.id=v.user_id
    LEFT JOIN mytracker_users a ON a.user_id=v.user_id
    LEFT JOIN selected s ON s.id=e.id
    CROSS JOIN bounds b WHERE e.occurred_at>=b.start_at AND e.occurred_at<LEAST(b.end_at+INTERVAL '8 days',NOW())
      AND (s.id IS NOT NULL OR ($5::uuid IS NULL AND v.user_id IN (SELECT user_id FROM cohort)))
    ORDER BY e.occurred_at,e.sequence LIMIT 75001`, [range.from,range.to,range.timezone,filters.userId || null,filters.visitId || null,filters.version || null,filters.segment || null]);
  const rows: TraceRow[] = result.rows.slice(0,75000).map(row => ({ id: row.id, visitId: row.visit_id,userId:row.user_id,name:row.name,
    version:String(row.metadata?.appVersion || 'unknown'),runtime:String(row.metadata?.runtime || 'unknown'), campaign: row.attribution_campaign || row.attribution_source || null,
    userCreatedAt:row.user_created_at ? new Date(row.user_created_at).toISOString() : null,startedAt:new Date(row.started_at).toISOString(),
    type:row.event_type,screen:row.screen,at:new Date(row.occurred_at).getTime(),sequence:row.sequence,payload:row.payload_json || {},inSegment:row.in_segment }));
  return { rows, truncated:result.rows.length>75000 };
}
export const traceLabel = (e: TraceRow) => e.type==='product_event' ? productEventLabel(String(e.payload.event_name),e.payload.label) : TRACE_LABELS[e.type] || 'Действие в приложении';
