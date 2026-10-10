import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminPermission } from '../../../../lib/admin/rbac';
import { AdminAuthError, handleAdminError } from '../../../../lib/adminAuth';
import { parseActivityRange } from '../../../../lib/admin/activityAnalytics';
import { buildAppTraceReport, loadAppTrace, traceLabel } from '../../../../lib/admin/appTelemetryAnalytics';
import { getPool } from '../../../../lib/db';
import { activityId } from '../../../../lib/productActivity';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control','private, no-store');
  if (req.method !== 'GET') return res.status(405).json({ error:'METHOD_NOT_ALLOWED' });
  try {
    const admin = await requireAdminPermission(req,'analytics.view');
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;
    const visitId = typeof req.query.visitId === 'string' ? req.query.visitId : undefined;
    if ((userId || visitId) && !admin.permissions.includes('users.view')) throw new AdminAuthError(403,'FORBIDDEN','Нужно право просмотра пользователей');
    if ((userId && !/^-?\d{1,19}$/.test(userId)) || (visitId && !activityId(visitId))) throw new AdminAuthError(400,'INVALID_ID','Неверный ID');
    const version = typeof req.query.version === 'string' ? req.query.version : undefined;
    const segment = typeof req.query.segment === 'string' ? req.query.segment : undefined;
    if (version && version !== 'unknown' && !/^\d[\d.]{0,30}$/.test(version)) throw new AdminAuthError(400,'INVALID_VERSION','Неверная версия');
    if (segment && !['new','returning','anonymous'].includes(segment)) throw new AdminAuthError(400,'INVALID_SEGMENT','Неверный сегмент');
    const range = parseActivityRange(req.query);
    const { rows, truncated } = await loadAppTrace(range,{userId,visitId,version,segment});
    const canReadText = admin.permissions.includes('user.pii.view');
    const safeRows = rows.map(e => ({ ...e, name: admin.permissions.includes('users.view') ? e.name : null,
      payload: Object.fromEntries(Object.entries(e.payload).filter(([key]) => canReadText || !['text','label','block'].includes(key))) }));
    if (!userId && !visitId) {
      const report = buildAppTraceReport(safeRows,range,Date.now(),truncated);
      if(req.query.compare==='1') {
        const length=Math.round((Date.parse(range.to)-Date.parse(range.from))/86_400_000)+1;
        const date=(value:string,offset:number)=>new Date(Date.parse(`${value}T12:00:00Z`)+offset*86_400_000).toISOString().slice(0,10);
        const previousRange={...range,from:date(range.from,-length),to:date(range.from,-1)};
        const previous=await loadAppTrace(previousRange,{version,segment});
        const previousReport=buildAppTraceReport(previous.rows,previousRange);
        report.previous={range:previousRange,summary:previousReport.summary};
        report.truncated ||= previous.truncated;
      }
      report.visits = admin.permissions.includes('users.view') ? report.visits.slice(0,200) : [];
      if(!admin.permissions.includes('users.view')) report.insights=report.insights.map(({visitIds:_,...insight})=>insight);
      return res.status(200).json(report);
    }
    const events = safeRows.filter(e => { const day = new Intl.DateTimeFormat('en-CA',{timeZone:range.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(e.at)); return e.inSegment!==false && day>=range.from && day<=range.to; });
    const identities = [...new Set(events.map(e => e.userId).filter(Boolean))];
    const references = [...new Set(events.flatMap(e => [e.payload.question_id,e.payload.answer_id,
      typeof e.payload.block==='string' ? /^Ответ на вопрос #(\d+)$/.exec(e.payload.block)?.[1] : undefined])
      .filter(value=>value!=null && /^\d{1,19}$/.test(String(value))).map(String))];
    const questions = canReadText && identities.length ? await getPool().query(`SELECT m.id,m.role,m.content_text,m.created_at,
      m.content_payload->>'questionMessageId' question_id FROM astrology_messages m
      JOIN astrology_threads t ON t.id=m.thread_id WHERE m.user_id::text=ANY($1::text[]) AND t.thread_kind='natal-question-v1'
      AND ((NOT $6::boolean AND m.created_at>=($2::date::timestamp AT TIME ZONE $4 AT TIME ZONE 'UTC')
        AND m.created_at<(($3::date+1)::timestamp AT TIME ZONE $4 AT TIME ZONE 'UTC'))
        OR m.id::text=ANY($5::text[]) OR m.content_payload->>'questionMessageId'=ANY($5::text[]))
      ORDER BY m.created_at DESC,m.id DESC LIMIT 501`,[identities,range.from,range.to,range.timezone,references,Boolean(visitId)]) : {rows:[]};
    return res.status(200).json({range,truncated,questionsTruncated:questions.rows.length>500,canReadText,events:events.map(e => ({...e,label:traceLabel(e)})),questions:questions.rows.slice(0,500).reverse().map(q => ({id:Number(q.id),role:q.role,text:q.content_text,at:new Date(q.created_at).toISOString(),questionId:q.question_id ? Number(q.question_id) : null}))});
  } catch(error) { return handleAdminError(res,error); }
}
