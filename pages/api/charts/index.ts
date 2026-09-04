import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { formatValidationErrors, validateNatalChartInput } from '../../../lib/validation';
import { natalChartV2Repository } from '../../../lib/natalChartV2Repository';
import { createOrReuseCanonicalChart, ensureCanonicalPrimaryChart, updateCanonicalSavedChart } from '../../../lib/natalChartPersistence';
import { isCanonicalNatalChartDataComplete, normalizeBirthTimeInput as normalizeBirthClock } from '../../../lib/natalChartCanonical';
import { normalizeBirthTimeInput } from '../../../lib/birthTime';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import { ChartAccessPolicyError, exposeChartAccess, getActiveCharts, getEffectiveChartLimit, getSelfChart, normalizeRelationLabel } from '../../../lib/chartAccessPolicy';
import { diagnosticErrorCode } from '../../../lib/diagnosticTrace';
import { startServerOperationalDiagnostic } from '../../../lib/serverOperationalDiagnostics';

function missingBirthProfileFields(user:any): string[] {
  return [
    !user?.birth_date && 'birthDate',
    !String(user?.birth_place || '').trim() && 'birthPlace',
  ].filter(Boolean) as string[];
}

export default async function handler(req:NextApiRequest,res:NextApiResponse) {
  const diagnostic=startServerOperationalDiagnostic(req,res,'natal_chart');
  try {
    const auth=await requireAppUser(req,{allowGuest:true}); const userId=auth.userId;
    if (!isValidUserId(userId)) return res.status(400).json(invalidUserIdPayload('ru'));
    const entitlement=await getPremiumEntitlementState(userId); const chartSlots=getEffectiveChartLimit(entitlement.isPremium);

    if (req.method==='GET') {
      const charts=getActiveCharts(await natalChartV2Repository.getAll(userId));
      const selfChart=getSelfChart(charts);
      const source=selfChart?'cache':'none';
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
      return res.status(200).json({charts:charts.map((chart)=>({...exposeChartAccess(chart,entitlement.isPremium,charts),repair_required:!chart.input_hash||!isCanonicalNatalChartDataComplete(chart.chart_data)})),chartSlots,canAddMore:charts.length<chartSlots,canAddSavedPeople:charts.length<chartSlots&&!!getSelfChart(charts),isPremium:entitlement.isPremium});
    }

    if (req.method!=='POST'&&req.method!=='PUT') {
      diagnostic.log('request','error',{httpStatus:405,errorCode:'METHOD_NOT_ALLOWED'});
      return res.status(405).json({error:'Method not allowed'});
    }
    const body=req.body||{};
    const rawBirthTime=normalizeBirthClock(typeof body.birthTime==='string'?body.birthTime:'');
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

    const lat=body.latitude==null?NaN:Number(body.latitude); const lon=body.longitude==null?NaN:Number(body.longitude);
    const coordinates=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180
      ? {lat,lon,timezone:typeof body.timezone==='string'?body.timezone:undefined}
      : typeof body.timezone==='string'?{timezone:body.timezone}:null;
    const diagnosticTimeMode=time.mode==='range'?'approximate':time.mode;
    diagnostic.log('calculation_request','start',{birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
    const common={userId,name:body.name||'My Chart',birthDate:body.birthDate,birthTime:time.localTime||'',birthTimeMode:time.mode,birthTimeUncertaintyMinutes:time.uncertaintyMinutes,birthTimeRangeStart:time.rangeStart,birthTimeRangeEnd:time.rangeEnd,birthPlace:body.birthPlace,language,coordinates};

    let result;
    if (body.primary===true) {
      result=await ensureCanonicalPrimaryChart(common);
    } else if (body.chartId != null) {
      const chartId=Number(body.chartId);
      if (!Number.isSafeInteger(chartId)||chartId<=0) return res.status(400).json({code:'INVALID_CHART_ID'});
      result=await updateCanonicalSavedChart(userId,chartId,{...common,relationLabel:normalizeRelationLabel(body.relationLabel)});
    } else {
      result=await createOrReuseCanonicalChart({...common,relationLabel:normalizeRelationLabel(body.relationLabel)});
    }
    const active=getActiveCharts(await natalChartV2Repository.getAll(userId));
    res.setHeader('X-Chart-Source',result.source);
    diagnostic.log('calculation_result','ok',{httpStatus:200,source:result.source,birthTimeMode:diagnosticTimeMode,hasCoordinates:!!coordinates});
    return res.status(200).json({...exposeChartAccess(result.chart,entitlement.isPremium,active),reused:result.reused});
  } catch (error:any) {
    if (error instanceof AdminAuthError) {
      diagnostic.error('request',error,error.code,{httpStatus:error.status,errorCode:error.code});
      return handleAdminError(res,error);
    }
    if (error instanceof ChartAccessPolicyError) {
      diagnostic.error('access',error,error.code,{httpStatus:error.status,errorCode:error.code});
      return res.status(error.status).json({error:error.message,code:error.code});
    }
    if(error?.code==='CHART_REPAIR_REQUIRED'||error?.code==='CHART_NOT_FOUND') return res.status(error.code==='CHART_NOT_FOUND'?404:409).json({error:error.message,code:error.code});
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
