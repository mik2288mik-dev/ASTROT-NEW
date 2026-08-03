import type { NextApiRequest, NextApiResponse } from 'next';
import { formatValidationErrors, validateNatalChartInput } from '../../../lib/validation';
import { db } from '../../../lib/db';
import { createOrReuseCanonicalChart, ensureCanonicalPrimaryChart, repairCanonicalChartForUser } from '../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { normalizeBirthTimeInput } from '../../../lib/birthTime';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { LockKeys, releaseLock, tryAcquireLock } from '../../../lib/serverLocks';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { assertCanCreateSavedPerson, ChartAccessPolicyError, exposeChartAccess, getActiveCharts, getEffectiveChartLimit, getSelfChart, normalizeRelationLabel } from '../../../lib/chartAccessPolicy';

const log={info:(msg:string,data?:any)=>console.log(`[API/charts] ${msg}`,data||''),error:(msg:string,err?:any)=>console.error(`[API/charts] ERROR: ${msg}`,err||'')};

async function persistChartIdentity(chart:any,subjectType:'self'|'saved_person',relationLabel:string|null) {
  if (!chart?.id) return chart;
  const setter=(db.natal_charts as any).setIdentityMetadata;
  if (typeof setter!=='function') return chart;
  await setter.call(db.natal_charts,chart.id,subjectType,relationLabel);
  return (await db.natal_charts.getById(chart.id))||{...chart,subject_type:subjectType,relation_label:relationLabel};
}

export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  try {
    const auth=await requireAppUser(req,{allowGuest:true}); const userId=auth.userId;
    if (!isValidUserId(userId)) return res.status(400).json(invalidUserIdPayload('ru'));
    const entitlement=await getPremiumEntitlementState(userId); const chartSlots=getEffectiveChartLimit(entitlement.isPremium);

    if (req.method==='GET') {
      const charts=getActiveCharts(await db.natal_charts.getAll(userId));
      return res.status(200).json({charts:charts.map((chart)=>exposeChartAccess(chart,entitlement.isPremium)),chartSlots,canAddMore:charts.length<chartSlots,canAddSavedPeople:entitlement.isPremium&&charts.length<chartSlots&&!!getSelfChart(charts),isPremium:entitlement.isPremium});
    }

    if (req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
    const body=req.body||{};
    const rawBirthTime=typeof body.birthTime==='string'?body.birthTime.trim():'';
    const language=body.language==='en'?'en':'ru';
    const validation=validateNatalChartInput({name:body.name||'My Chart',birthDate:body.birthDate,birthTime:rawBirthTime,birthPlace:body.birthPlace,language});
    if (!validation.isValid) return res.status(400).json({error:'Validation failed',message:formatValidationErrors(validation.errors,language),errors:validation.errors});
    if (!body.birthDate||!body.birthPlace) return res.status(400).json({error:'birthDate and birthPlace are required'});

    let time;
    try {
      time=normalizeBirthTimeInput({mode:body.birthTimeMode,localTime:rawBirthTime,uncertaintyMinutes:body.birthTimeUncertaintyMinutes,rangeStart:body.birthTimeRangeStart,rangeEnd:body.birthTimeRangeEnd,legacyBirthTime:rawBirthTime});
    } catch (error:any) {
      return res.status(400).json({error:'Invalid birth time',message:error.message});
    }

    const lat=Number(body.latitude); const lon=Number(body.longitude);
    const coordinates=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)
      ? {lat,lon,timezone:typeof body.timezone==='string'?body.timezone:undefined}:null;
    const common={userId,name:body.name||'My Chart',birthDate:body.birthDate,birthTime:time.localTime||'',birthTimeMode:time.mode,birthTimeUncertaintyMinutes:time.uncertaintyMinutes,birthTimeRangeStart:time.rangeStart,birthTimeRangeEnd:time.rangeEnd,birthPlace:body.birthPlace,language,coordinates};

    if (body.primary===true||body.forceRecalculate===true) {
      const lockKey=LockKeys.primaryChartCalculation(userId);
      if (!tryAcquireLock(lockKey,'primary-chart-calculation')) {
        await new Promise((resolve)=>setTimeout(resolve,1500));
        const repaired=await repairCanonicalChartForUser(userId);
        if (isCanonicalNatalChartDataComplete(repaired?.chart?.chart_data)) { res.setHeader('X-Chart-Source','cache-after-wait'); return res.status(200).json(repaired!.chart); }
        return res.status(409).json({error:'Calculation in progress',message:language==='ru'?'Расчёт уже выполняется. Подожди пару секунд и попробуй ещё раз.':'Calculation is already in progress. Please wait a moment and try again.'});
      }
      try {
        const result=await ensureCanonicalPrimaryChart({...common,forceRecalculate:!!body.forceRecalculate});
        const chart=await persistChartIdentity(result.chart,'self',null); res.setHeader('X-Chart-Source',result.source);
        return res.status(200).json(exposeChartAccess(chart,entitlement.isPremium));
      } finally { releaseLock(lockKey); }
    }

    const lockKey=LockKeys.contentGeneration(`saved-chart-create:${userId}`);
    if (!tryAcquireLock(lockKey,'saved-chart-create')) return res.status(409).json({error:'Chart creation is already in progress',code:'CHART_CREATION_IN_PROGRESS'});
    let result;
    try {
      const active=getActiveCharts(await db.natal_charts.getAll(userId)); assertCanCreateSavedPerson(active,entitlement.isPremium);
      result=await createOrReuseCanonicalChart({...common,name:body.name||'Saved person'});
      if (result.reused&&getSelfChart(active)?.id===result.chart.id) return res.status(409).json({error:'This is already your own chart.',code:'SELF_CHART_ALREADY_EXISTS'});
      result.chart=await persistChartIdentity(result.chart,'saved_person',normalizeRelationLabel(body.relationLabel));
    } finally { releaseLock(lockKey); }
    log.info(result.reused?'Chart reused':'Chart created',{userId,chartId:result.chart.id,reused:result.reused});
    return res.status(200).json({...exposeChartAccess(result.chart,entitlement.isPremium),reused:result.reused});
  } catch (error:any) {
    if (error instanceof AdminAuthError) return handleAdminError(res,error);
    if (error instanceof ChartAccessPolicyError) return res.status(error.status).json({error:error.message,code:error.code});
    log.error('Error',{error:error.message,code:error.code});
    const status=['GEOCODING_FAILED','INVALID_TIMEZONE','TIMEZONE_LOOKUP_FAILED'].includes(error.code)?400:500;
    return res.status(status).json({error:error.message,code:error.code});
  }
}
