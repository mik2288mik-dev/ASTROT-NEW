import { NatalChartData, UserProfile } from '../types';
import { isCanonicalNatalChartDataComplete } from '../lib/natalChartCanonical';
import { assertValidUserId } from '../lib/userId';
import { writeLocalNatalChart } from '../lib/localNatalChartCache';
import { getTelegramInitDataHeaders } from './sessionService';
import { apiFetch } from './apiClient';

const CHART_FETCH_TIMEOUT_MS=90_000;
const calculationInFlight=new Map<string,Promise<NatalChartData>>();
const log={info:(message:string,data?:any)=>console.log(`[ChartService] ${message}`,data||''),warn:(message:string,data?:any)=>console.warn(`[ChartService] ${message}`,data||''),error:(message:string,error?:any)=>console.error(`[ChartService] ERROR: ${message}`,error||'')};

function selectSelfChart(payload:any):any|null {
  const charts=Array.isArray(payload?.charts)?payload.charts:[];
  return charts.find((row:any)=>row.subject_type==='self')||charts.find((row:any)=>row.is_primary===true)||null;
}
function chartRequest(profile:UserProfile,forceRecalculate=false) {
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
    primary:true,
    forceRecalculate,
  };
}
function assertChart(value:any):NatalChartData {
  if (!isCanonicalNatalChartDataComplete(value)) throw new Error('Получены неполные данные натальной карты.');
  return value as NatalChartData;
}

export async function getPrimaryChartId(userId:string):Promise<number|null> {
  assertValidUserId(userId);
  try {
    const response=await apiFetch('/api/charts',{method:'GET',credentials:'include',headers:{...getTelegramInitDataHeaders()}},8_000);
    if (!response.ok) return null;
    const id=selectSelfChart(await response.json())?.id;
    return typeof id==='number'&&Number.isFinite(id)?id:null;
  } catch (error:any) { log.warn('[getPrimaryChartId] Failed',{error:error?.message||error}); return null; }
}

export async function getChartFromDB(userId:string):Promise<NatalChartData|null> {
  assertValidUserId(userId);
  let response:Response;
  try { response=await apiFetch('/api/charts',{method:'GET',credentials:'include',headers:{...getTelegramInitDataHeaders()}},CHART_FETCH_TIMEOUT_MS); }
  catch { throw new Error('Не удалось загрузить сохранённую карту из базы.'); }
  if (!response.ok) throw new Error(`Не удалось загрузить карту из базы: ${response.status}`);
  const self=selectSelfChart(await response.json());
  if (!self) return null;
  return assertChart(self.chart_data||self.chartData);
}

async function calculateChart(profile:UserProfile,forceRecalculate=false):Promise<NatalChartData> {
  assertValidUserId(profile.id);
  let response:Response;
  try {
    response=await apiFetch('/api/charts',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',...getTelegramInitDataHeaders()},body:JSON.stringify(chartRequest(profile,forceRecalculate))},CHART_FETCH_TIMEOUT_MS);
  } catch { throw new Error('Ошибка сети. Проверь интернет и попробуй снова.'); }
  if (!response.ok) {
    const error=await response.json().catch(()=>({}));
    throw new Error(error.message||error.error||`Ошибка сервера: ${response.status}`);
  }
  const payload=await response.json();
  return assertChart(payload?.chart_data||payload?.chartData||payload);
}

export async function getOrCalculateChart(profile:UserProfile):Promise<NatalChartData> {
  const userId=assertValidUserId(profile.id);
  const active=calculationInFlight.get(userId); if (active) return active;
  const stored=await getChartFromDB(userId);
  if (stored) { writeLocalNatalChart(profile,stored); return stored; }
  const promise=Promise.race([
    calculateChart(profile),
    new Promise<NatalChartData>((_,reject)=>setTimeout(()=>reject(new Error('Превышено время ожидания расчёта карты.')),120_000)),
  ]).finally(()=>calculationInFlight.delete(userId));
  calculationInFlight.set(userId,promise);
  const chart=await promise; writeLocalNatalChart(profile,chart); return chart;
}

export async function forceRecalculateChart(profile:UserProfile):Promise<NatalChartData> {
  const chart=await calculateChart(profile,true); writeLocalNatalChart(profile,chart); return chart;
}

export function birthDataChanged(oldProfile:UserProfile|null,newProfile:UserProfile):boolean {
  if (!oldProfile) return true;
  return oldProfile.birthDate!==newProfile.birthDate
    ||oldProfile.birthTime!==newProfile.birthTime
    ||oldProfile.birthTimeMode!==newProfile.birthTimeMode
    ||oldProfile.birthTimeUncertaintyMinutes!==newProfile.birthTimeUncertaintyMinutes
    ||oldProfile.birthTimeRangeStart!==newProfile.birthTimeRangeStart
    ||oldProfile.birthTimeRangeEnd!==newProfile.birthTimeRangeEnd
    ||oldProfile.birthPlace!==newProfile.birthPlace;
}
