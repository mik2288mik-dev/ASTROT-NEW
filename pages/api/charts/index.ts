import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { formatValidationErrors, validateNatalChartInput } from '../../../lib/validation';
import { natalChartV2Repository } from '../../../lib/natalChartV2Repository';
import { createOrReuseCanonicalChart, ensureCanonicalPrimaryChart, repairCanonicalChartForUser } from '../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete, normalizeBirthPlaceInput } from '../../../lib/natalChartCanonical';
import { normalizeBirthTimeInput } from '../../../lib/birthTime';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { LockKeys, releaseLock, tryAcquireLock } from '../../../lib/serverLocks';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { assertCanCreateSavedPerson, ChartAccessPolicyError, exposeChartAccess, getActiveCharts, getEffectiveChartLimit, getSelfChart, normalizeRelationLabel } from '../../../lib/chartAccessPolicy';
import { diagnosticErrorCode } from '../../../lib/diagnosticTrace';
import { startServerOperationalDiagnostic } from '../../../lib/serverOperationalDiagnostics';

function missingBirthProfileFields(user:any): string[] {
  return [
    !user?.birth_date && 'birthDate',
    !String(user?.birth_place || '').trim() && 'birthPlace',
  ].filter(Boolean) as string[];
}

async function persistChartIdentity(chart:any,subjectType:'self'|'saved_person',relationLabel:string|null) {
  if (!chart?.id) return chart;
  return (await natalChartV2Repository.setIdentityMetadata(chart.id,subjectType,relationLabel))||{...chart,subject_type:subjectType,relation_label:relationLabel};
}

function chartMatchesPrimaryRequest(chart:any,input:any,coordinates:{lat:number;lon:number;timezone?:string}|null):boolean {
  if (!chart) return false;
  if (String(chart.birth_date||'')!==String(input.birthDate||'')) return false;
  if (String(chart.birth_time||'')!==String(input.birthTime||'')) return false;
  if (String(chart.birth_time_mode||'')!==String(input.birthTimeMode||'')) return false;
  if (String(chart.birth_time_uncertainty_minutes??'')!==String(input.birthTimeUncertaintyMinutes??'')) return false;
  if (String(chart.birth_time_range_start||'')!==String(input.birthTimeRangeStart||'')) return false;
  if (String(chart.birth_time_range_end||'')!==String(input.birthTimeRangeEnd||'')) return false;
  if (normalizeBirthPlaceInput(chart.birth_place)!==normalizeBirthPlaceInput(input.birthPlace)) return false;
  if (!coordinates) return true;
  if (Math.abs(Number(chart.latitude)-coordinates.lat)>0.000001) return false;
  if (Math.abs(Number(chart.longitude)-coordinates.lon)>0.000001) return false;
  return !coordinates.timezone||String(chart.timezone||'')===coordinates.timezone;
}

export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  const diagnostic=startServerOperationalDiagnostic(req,res,'natal_chart');
  try {
    const auth=await requireAppUser(req,{allowGuest:true}); const userId=auth.userId;
    if (!isValidUserId(userId)) return res.status(400).json(invalidUserIdPayload('ru'));
    const entitlement=await getPremiumEntitlementState(userId); const chartSlots=getEffectiveChartLimit(entitlement.isPremium);

    if (req.method==='GET') {
      let charts=getActiveCharts(await natalChartV2Repository.getAll(userId));
      const selfChart=getSelfChart(charts);
      const repairPrimary=req.query.repairPrimary!=='0';
      let source=selfChart?'cache':'none';
      if (repairPrimary&&(!selfChart||!isCanonicalNatalChartDataComplete(selfChart.chart_data))) {
        diagnostic.log('repair', 'start', { source:selfChart?'invalid_cache':'missing' });
        const repaired=await repairCanonicalChartForUser(userId);
        if (isCanonicalNatalChartDataComplete(repaired?.chart?.chart_data)) {
          charts=getActiveCharts(await natalChartV2Repository.getAll(userId));
          source='repaired';
        }
      }
      if (!getSelfChart(charts)) {
        const user=await db.users.get(userId);
        const missingFields=missingBirthProfileFields(user);
        if (missingFields.length) {
          diagnostic.log('profile', 'error', { httpStatus:422,errorCode:'BIRTH_PROFILE_INCOMPLETE' });
          return res.status(422).json({
            error:'Birth profile is incomplete',
            code:'BIRTH_PROFILE_INCOMPLETE',
            missingFields,
            message:'Заполни дату и место рождения в профиле, чтобы рассчитать натальную карту.',
          });
        }
      }
      diagnostic.log('fast_read',getSelfChart(charts)?'cache_hit':'cache_miss',{httpStatus:200,source});
      return res.status(200).json({charts:charts.map((chart)=>exposeChartAccess(chart,entitlement.isPremium)),chartSlots,canAddMore:charts.length<chartSlots,canAddSavedPeople:entitlement.isPremium&&charts.length<chartSlots&&!!getSelfChart(charts),isPremium:entitlement.isPremium});
    }

    if (req.method!=='POST') {
      diagnostic.log('request','error',{httpStatus:405,errorCode:'METHOD_NOT_ALLOWED'});
      return res.status(405).json({error:'Method not allowed'});
    }
    const body=req.body||{};
    const rawBirthTime=typeof body.birthTime==='string'?body.birthTime.trim():'';
    const language=body.language==='en'?'en':'ru';
    const validation=validateNatalChartInput({name:body.name||'My Chart',birthDate:body.birthDate,birthTime:rawBirthTime,birthPlace:body.birthPlace,language});
    if (!validation.isValid) {
      diagnostic.log('validation','error',{httpStatus:400,errorCode:'CHART_INPUT_INVALID'});
      return res.status(400).json({error:'Validation failed',message:formatValidationErrors(validation.errors,language),errors:validation.errors});
    }
    if (!body.birthDate||!body.birthPlace) {
      diagnostic.log('validation','error',{httpStatus:400,errorCode:'BIRTH_PROFILE_INCOMPLETE'});
      return res.status(400).json({error:'birthDate and birthPlace are required'});
    }

    let time;
    try {
      time=normalizeBirthTimeInput({mode:body.birthTimeMode,localTime:rawBirthTime,uncertaintyMinutes:body.birthTimeUncertaintyMinutes,rangeStart:body.birthTimeRangeStart,rangeEnd:body.birthTimeRangeEnd,legacyBirthTime:rawBirthTime});
    } catch (error:any) {
      diagnostic.error('validation',error,'INVALID_BIRTH_TIME',{httpStatus:400,errorCode:'INVALID_BIRTH_TIME'});
      return res.status(400).json({error:'Invalid birth time',message:error.message});
    }

    const lat=Number(body.latitude); const lon=Number(body.longitude);
    const coordinates=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0)
      ? {lat,lon,timezone:typeof body.timezone==='string'?body.timezone:undefined}:null;
    const diagnosticTimeMode=time.mode==='range'?'approximate':time.mode;
    diagnostic.log('calculation_request','start',{birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
    const common={userId,name:body.name||'My Chart',birthDate:body.birthDate,birthTime:time.localTime||'',birthTimeMode:time.mode,birthTimeUncertaintyMinutes:time.uncertaintyMinutes,birthTimeRangeStart:time.rangeStart,birthTimeRangeEnd:time.rangeEnd,birthPlace:body.birthPlace,language,coordinates};

    if (body.primary===true||body.forceRecalculate===true) {
      const lockKey=LockKeys.primaryChartCalculation(userId);
      if (!tryAcquireLock(lockKey,'primary-chart-calculation')) {
        for (let attempt=0;attempt<8;attempt+=1) {
          await new Promise((resolve)=>setTimeout(resolve,500));
          const completed=getSelfChart(getActiveCharts(await natalChartV2Repository.getAll(userId)));
          if (isCanonicalNatalChartDataComplete(completed?.chart_data)&&chartMatchesPrimaryRequest(completed,common,coordinates)) {
            res.setHeader('X-Chart-Source','cache-after-wait');
            diagnostic.log('calculation_result','ok',{httpStatus:200,source:'cache_after_wait',birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates,attempt:attempt+1});
            return res.status(200).json(exposeChartAccess(completed!,entitlement.isPremium));
          }
        }
        diagnostic.log('calculation_result','in_progress',{httpStatus:409,errorCode:'CHART_CALCULATION_IN_PROGRESS',birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
        return res.status(409).json({error:'Calculation in progress',code:'CHART_CALCULATION_IN_PROGRESS',message:language==='ru'?'Расчёт уже выполняется. Подожди пару секунд и попробуй ещё раз.':'Calculation is already in progress. Please wait a moment and try again.'});
      }
      try {
        const result=await ensureCanonicalPrimaryChart({...common,forceRecalculate:!!body.forceRecalculate});
        const chart=await persistChartIdentity(result.chart,'self',null); res.setHeader('X-Chart-Source',result.source);
        diagnostic.log('calculation_result','ok',{httpStatus:200,source:result.source,birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
        return res.status(200).json(exposeChartAccess(chart,entitlement.isPremium));
      } finally { releaseLock(lockKey); }
    }

    const lockKey=LockKeys.contentGeneration(`saved-chart-create:${userId}`);
    if (!tryAcquireLock(lockKey,'saved-chart-create')) {
      diagnostic.log('calculation_result','in_progress',{httpStatus:409,errorCode:'CHART_CREATION_IN_PROGRESS',birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
      return res.status(409).json({error:'Chart creation is already in progress',code:'CHART_CREATION_IN_PROGRESS'});
    }
    let result;
    try {
      const active=getActiveCharts(await natalChartV2Repository.getAll(userId)); assertCanCreateSavedPerson(active,entitlement.isPremium);
      result=await createOrReuseCanonicalChart({...common,name:body.name||'Saved person'});
      if (result.reused&&getSelfChart(active)?.id===result.chart.id) return res.status(409).json({error:'This is already your own chart.',code:'SELF_CHART_ALREADY_EXISTS'});
      result.chart=await persistChartIdentity(result.chart,'saved_person',normalizeRelationLabel(body.relationLabel));
    } finally { releaseLock(lockKey); }
    diagnostic.log('calculation_result','ok',{httpStatus:200,source:result.reused?'cache':'calculated',birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
    return res.status(200).json({...exposeChartAccess(result.chart,entitlement.isPremium),reused:result.reused});
  } catch (error:any) {
    if (error instanceof AdminAuthError) {
      diagnostic.error('request',error,error.code,{httpStatus:error.status,errorCode:error.code});
      return handleAdminError(res,error);
    }
    if (error instanceof ChartAccessPolicyError) {
      diagnostic.error('access',error,error.code,{httpStatus:error.status,errorCode:error.code});
      return res.status(error.status).json({error:error.message,code:error.code});
    }
    diagnostic.error('request',error,diagnosticErrorCode(error,'CHART_REQUEST_FAILED'));
    if (error?.code==='EPHEMERIS_UNAVAILABLE') return res.status(503).json({
      error:'Chart calculation service is unavailable',
      code:'EPHEMERIS_UNAVAILABLE',
      message:'Сервис расчёта натальной карты временно недоступен. Попробуй позже.',
    });
    const status=['GEOCODING_FAILED','INVALID_TIMEZONE','TIMEZONE_LOOKUP_FAILED','INVALID_BIRTH_TIME'].includes(error.code)?400:500;
    if(status===500)return res.status(500).json({
      error:'Internal server error',
      code:'CHART_REQUEST_FAILED',
      ...(process.env.NODE_ENV==='production'?{}:{message:error.message}),
    });
    return res.status(status).json({error:error.message,code:error.code});
  }
}
