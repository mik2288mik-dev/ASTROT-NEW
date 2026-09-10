import { NatalChartData, UserProfile } from '../types';
import {
  isCanonicalNatalChartDataComplete,
} from '../lib/natalChartCanonical';
import { birthProfileIdentityMatches } from '../lib/birthProfileIdentity';
import { assertValidUserId } from '../lib/userId';
import { buildNatalChartCacheKey, writeLocalNatalChart } from '../lib/localNatalChartCache';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';
import {
  createDiagnosticTraceId,
  diagnosticErrorCode,
  diagnosticHttpStatus,
  diagnosticTraceHeaders,
  formatDiagnosticFields,
} from '../lib/diagnosticTrace';
import {
  diagnosticLog,
  showRuntimeDiagnosticsForFailure,
} from '../lib/runtimeDiagnostics';

const CHART_FETCH_TIMEOUT_MS=90_000;
const calculationInFlight=new Map<string,Promise<NatalChartData>>();
const log={info:(message:string,data?:any)=>console.log(`[ChartService] ${message}`,data||''),warn:(message:string,data?:any)=>console.warn(`[ChartService] ${message}`,data||''),error:(message:string,error?:any)=>console.error(`[ChartService] ERROR: ${message}`,error||'')};

function chartDiagnostic(
  level:'INFO'|'WARN'|'ERROR',
  traceId:string,
  fields:Omit<Parameters<typeof formatDiagnosticFields>[0],'traceId'|'side'>,
) {
  diagnosticLog(level,'natal_chart',formatDiagnosticFields({traceId,side:'client',...fields}));
}

function chartError(code:string,message:string,status?:number):Error&{code:string;status?:number} {
  const error=new Error(message) as Error&{code:string;status?:number};
  error.code=code;
  if (status!==undefined) error.status=status;
  return error;
}

function diagnosticBirthTimeMode(profile:UserProfile):'exact'|'approximate'|'unknown' {
  return profile.birthTimeMode==='approximate'||profile.birthTimeMode==='unknown'
    ? profile.birthTimeMode
    :'exact';
}

function profileBirthTimeMode(profile:UserProfile):'exact'|'approximate'|'range'|'unknown' {
  const mode=profile.birthTimeMode;
  if (mode==='exact'||mode==='approximate'||mode==='range'||mode==='unknown') return mode;
  return profile.birthTime?.trim()?'exact':'unknown';
}

function sameCoordinate(requested:unknown,stored:unknown):boolean {
  if (requested===null||requested===undefined||String(requested).trim()==='') return true;
  const requestedNumber=Number(requested); const storedNumber=Number(stored);
  return Number.isFinite(requestedNumber)&&Number.isFinite(storedNumber)
    &&Math.abs(requestedNumber-storedNumber)<=0.000001;
}

/** A primary chart can only satisfy the profile that produced its birth input. */
export function natalChartMatchesProfile(chart:NatalChartData,profile:UserProfile):boolean {
  const birth=chart.birth;
  const storedTime=birth?.time;
  const mode=profileBirthTimeMode(profile);
  if (!birth||!storedTime||storedTime.mode!==mode) return false;
  if (!birthProfileIdentityMatches(profile,{
    birthDate:birth.localDate,
    birthTime:storedTime.localTime,
    birthTimeMode:storedTime.mode,
    birthTimeUncertaintyMinutes:storedTime.uncertaintyMinutes,
    birthTimeRangeStart:storedTime.rangeStart,
    birthTimeRangeEnd:storedTime.rangeEnd,
    birthPlace:birth.place,
  })) return false;
  if (!sameCoordinate(profile.birthLatitude,birth.latitude)
    ||!sameCoordinate(profile.birthLongitude,birth.longitude)) return false;
  const requestedTimezone=String(profile.birthTimezone||'').trim();
  return !requestedTimezone||requestedTimezone===String(birth.timezone||'').trim();
}

function selectSelfChart(payload:any):any|null {
  const charts=Array.isArray(payload?.charts)?payload.charts:[];
  return charts.find((row:any)=>row.subject_type==='self')||charts.find((row:any)=>row.is_primary===true)||null;
}
function chartRequest(profile:UserProfile) {
  return {
    name:profile.name,
    birthDate:profile.birthDate,
    birthTime:profile.birthTime,
    birthTimeMode:profile.birthTimeMode,
    birthTimeUncertaintyMinutes:profile.birthTimeUncertaintyMinutes??null,
    birthTimeRangeStart:profile.birthTimeRangeStart??null,
    birthTimeRangeEnd:profile.birthTimeRangeEnd??null,
    birthPlace:profile.birthPlace,
    latitude:profile.birthLatitude??undefined,
    longitude:profile.birthLongitude??undefined,
    timezone:profile.birthTimezone??undefined,
    language:profile.language,
    primary: true,
  };
}
function assertChart(value:any):NatalChartData {
  if (!isCanonicalNatalChartDataComplete(value)) throw new Error('Получены неполные данные натальной карты.');
  return value as NatalChartData;
}

export async function getPrimaryChartId(userId:string):Promise<number|null> {
  assertValidUserId(userId);
  const traceId=createDiagnosticTraceId('chart-primary-id'); const startedAt=Date.now();
  chartDiagnostic('INFO',traceId,{stage:'fast_read',status:'start'});
  try {
    const response=await apiFetch('/api/charts?repairPrimary=0',{method:'GET',credentials:'include',headers:{...getTelegramInitDataHeaders(),...diagnosticTraceHeaders(traceId)}},8_000);
    if (!response.ok) {
      chartDiagnostic('WARN',traceId,{stage:'fast_read',status:'error',durationMs:Date.now()-startedAt,httpStatus:response.status,errorCode:`HTTP_${response.status}`});
      return null;
    }
    const id=selectSelfChart(await response.json())?.id;
    chartDiagnostic('INFO',traceId,{stage:'fast_read',status:id?'cache_hit':'cache_miss',durationMs:Date.now()-startedAt,httpStatus:response.status,source:id?'cache':'none'});
    return typeof id==='number'&&Number.isFinite(id)?id:null;
  } catch (error:any) {
    chartDiagnostic('ERROR',traceId,{stage:'fast_read',status:'error',durationMs:Date.now()-startedAt,httpStatus:diagnosticHttpStatus(error),errorCode:diagnosticErrorCode(error,'CHART_PRIMARY_ID_FAILED')});
    log.warn('[getPrimaryChartId] Failed',{code:diagnosticErrorCode(error,'CHART_PRIMARY_ID_FAILED')});
    return null;
  }
}

export async function getChartFromDB(userId:string,traceId=createDiagnosticTraceId('chart-read')):Promise<NatalChartData|null> {
  assertValidUserId(userId);
  const startedAt=Date.now();
  chartDiagnostic('INFO',traceId,{stage:'fast_read',status:'start'});
  let response:Response;
  try { response=await apiFetch('/api/charts?repairPrimary=0',{method:'GET',credentials:'include',headers:{...getTelegramInitDataHeaders(),...diagnosticTraceHeaders(traceId)}},10_000); }
  catch (error) {
    chartDiagnostic('ERROR',traceId,{stage:'fast_read',status:'error',durationMs:Date.now()-startedAt,errorCode:diagnosticErrorCode(error,'CHART_READ_NETWORK_FAILED')});
    throw chartError('CHART_READ_NETWORK_FAILED','Не удалось загрузить сохранённую карту из базы.');
  }
  if (!response.ok) {
    chartDiagnostic('ERROR',traceId,{stage:'fast_read',status:'error',durationMs:Date.now()-startedAt,httpStatus:response.status,errorCode:`HTTP_${response.status}`});
    throw chartError('CHART_READ_FAILED',`Не удалось загрузить карту из базы: ${response.status}`,response.status);
  }
  const self=selectSelfChart(await response.json());
  if (!self) {
    chartDiagnostic('INFO',traceId,{stage:'fast_read',status:'cache_miss',durationMs:Date.now()-startedAt,httpStatus:response.status,source:'none'});
    return null;
  }
  let chart:NatalChartData;
  try {
    if (self.repair_required === true) throw new Error('Saved chart repair required');
    chart=assertChart(self.chart_data||self.chartData);
  } catch {
    chartDiagnostic('WARN',traceId,{stage:'fast_read',status:'error',durationMs:Date.now()-startedAt,httpStatus:409,errorCode:'CHART_REPAIR_REQUIRED',source:'invalid_cache'});
    throw chartError('CHART_REPAIR_REQUIRED','Сохранённая карта требует восстановления.',409);
  }
  chartDiagnostic('INFO',traceId,{stage:'fast_read',status:'cache_hit',durationMs:Date.now()-startedAt,httpStatus:response.status,source:'cache'});
  return chart;
}

async function calculateChart(profile:UserProfile,traceId=createDiagnosticTraceId('chart-calculate')):Promise<NatalChartData> {
  assertValidUserId(profile.id);
  const startedAt=Date.now();
  const url = '/api/charts';
  chartDiagnostic('INFO',traceId,{stage:'calculation_request',status:'start',birthTimeMode:diagnosticBirthTimeMode(profile),hasCoordinates:Number.isFinite(profile.birthLatitude)&&Number.isFinite(profile.birthLongitude)});
  let response:Response;
  try {
    response=await apiFetch(url,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...getTelegramInitDataHeaders(),...diagnosticTraceHeaders(traceId)},body:JSON.stringify(chartRequest(profile))},CHART_FETCH_TIMEOUT_MS);
  } catch (error) {
    chartDiagnostic('ERROR',traceId,{stage:'calculation_request',status:'error',durationMs:Date.now()-startedAt,errorCode:diagnosticErrorCode(error,'CHART_CALCULATION_NETWORK_FAILED'),birthTimeMode:diagnosticBirthTimeMode(profile)});
    throw chartError('CHART_CALCULATION_NETWORK_FAILED','Ошибка сети. Проверь интернет и попробуй снова.');
  }
  if (!response.ok) {
    const error=await response.json().catch(()=>({}));
    const code=String(error.code||error.error||`HTTP_${response.status}`);
    chartDiagnostic('ERROR',traceId,{stage:'calculation_result',status:'error',durationMs:Date.now()-startedAt,httpStatus:response.status,errorCode:code,birthTimeMode:diagnosticBirthTimeMode(profile)});
    throw chartError(code,error.message||error.error||`Ошибка сервера: ${response.status}`,response.status);
  }
  const payload=await response.json();
  const chart=assertChart(payload?.chart_data||payload?.chartData||payload);
  chartDiagnostic('INFO',traceId,{stage:'calculation_result',status:'ok',durationMs:Date.now()-startedAt,httpStatus:response.status,source:'calculated',birthTimeMode:diagnosticBirthTimeMode(profile)});
  return chart;
}

export async function getOrCalculateChart(
  profile:UserProfile,
  shouldCommitLocalCache:()=>boolean=()=>true,
):Promise<NatalChartData> {
  const userId=assertValidUserId(profile.id);
  const requestKey=buildNatalChartCacheKey(profile);
  const active=calculationInFlight.get(requestKey); if (active) return active;
  const traceId=createDiagnosticTraceId('chart-load'); const startedAt=Date.now();
  chartDiagnostic('INFO',traceId,{stage:'load',status:'start',birthTimeMode:diagnosticBirthTimeMode(profile)});
  const request=(async()=>{
    try {
      const stored=await getChartFromDB(userId,traceId);
      if (stored&&natalChartMatchesProfile(stored,profile)) {
        if (shouldCommitLocalCache()) writeLocalNatalChart(profile,stored);
        chartDiagnostic('INFO',traceId,{stage:'finished',status:'ok',durationMs:Date.now()-startedAt,source:'cache',birthTimeMode:diagnosticBirthTimeMode(profile)});
        return stored;
      }
      if (stored) {
        chartDiagnostic('INFO',traceId,{stage:'profile_match',status:'cache_miss',durationMs:Date.now()-startedAt,source:'stale_cache',birthTimeMode:diagnosticBirthTimeMode(profile)});
      }
      const chart=await calculateChart(profile,traceId);
      if (shouldCommitLocalCache()) writeLocalNatalChart(profile, chart);
      chartDiagnostic('INFO',traceId,{stage:'finished',status:'ok',durationMs:Date.now()-startedAt,source:'calculated',birthTimeMode:diagnosticBirthTimeMode(profile)});
      return chart;
    } catch (error) {
      chartDiagnostic('ERROR',traceId,{stage:'finished',status:diagnosticErrorCode(error)==='CHART_CALCULATION_TIMEOUT'?'timeout':'error',durationMs:Date.now()-startedAt,httpStatus:diagnosticHttpStatus(error),errorCode:diagnosticErrorCode(error,'NATAL_CHART_FAILED'),birthTimeMode:diagnosticBirthTimeMode(profile)});
      showRuntimeDiagnosticsForFailure('natal chart failed',error);
      throw error;
    }
  })().finally(()=>calculationInFlight.delete(requestKey));
  calculationInFlight.set(requestKey,request);
  return request;
}

export async function forceRecalculateChart(profile:UserProfile):Promise<NatalChartData> {
  return getOrCalculateChart(profile);
}

export function birthDataChanged(oldProfile:UserProfile|null,newProfile:UserProfile):boolean {
  if (!oldProfile) return true;
  return oldProfile.birthDate!==newProfile.birthDate
    ||oldProfile.birthTime!==newProfile.birthTime
    ||oldProfile.birthTimeMode!==newProfile.birthTimeMode
    ||oldProfile.birthTimeUncertaintyMinutes!==newProfile.birthTimeUncertaintyMinutes
    ||oldProfile.birthTimeRangeStart!==newProfile.birthTimeRangeStart
    ||oldProfile.birthTimeRangeEnd!==newProfile.birthTimeRangeEnd
    ||oldProfile.birthPlace!==newProfile.birthPlace
    ||oldProfile.birthTimezone!==newProfile.birthTimezone
    ||oldProfile.birthLatitude!==newProfile.birthLatitude
    ||oldProfile.birthLongitude!==newProfile.birthLongitude;
}
