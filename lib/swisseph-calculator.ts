/** Canonical Swiss Ephemeris calculation. No interpretation and no hidden birth time. */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import tzLookup from 'tz-lookup';
import { lookupCityCoordinates } from './cityGazetteer';
import {
  CANONICAL_NATAL_CALCULATION_VERSION,
  normalizeCoordinateForStorage,
} from './natalChartCanonical';
import {
  buildBirthTimeInterval,
  normalizeBirthTimeInput,
  type BirthTimeInput,
} from './birthTime';
import type {
  NatalAngleKey,
  NatalAngleV2,
  NatalAspectPhase,
  NatalAspectType,
  NatalAspectV2,
  NatalBodyKey,
  NatalChartDataV2,
  NatalHouseV2,
  NatalPositionV2,
  NatalReliability,
  LongitudeRange,
} from './natalChartV2Types';

const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'] as const;
const ASPECT_RULES_VERSION = 'natal-major-aspects-v2';
const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1';

const log = {
  info: (message: string, data?: any) => console.log(`[SwissephCalculator] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[SwissephCalculator] ${message}`, data || ''),
};

type Coordinates = { lat: number; lon: number; timezone: string };
type NatalCalculationOptions = {
  coordinates?: Coordinates;
  birthTime?: BirthTimeInput;
  birthTimeMode?: unknown;
  birthTimeUncertaintyMinutes?: unknown;
  birthTimeRangeStart?: unknown;
  birthTimeRangeEnd?: unknown;
};

export interface PlanetPosition {
  planet: string;
  sign: string;
  degree: number;
  longitude: number;
  house?: number;
  retrograde: boolean;
  speedLongitude: number;
  description?: string;
}

export interface PlanetaryTransitsAtResult {
  source: 'swisseph';
  date: string;
  julianDay: number;
  sun: PlanetPosition;
  moon: PlanetPosition;
  mercury: PlanetPosition;
  venus: PlanetPosition;
  mars: PlanetPosition;
  jupiter: PlanetPosition;
  saturn: PlanetPosition;
  uranus: PlanetPosition;
  neptune: PlanetPosition;
  pluto: PlanetPosition;
}

export type NatalChartResult = NatalChartDataV2;

type RawBody = {
  key: NatalBodyKey;
  object: string;
  kind: 'planet' | 'lunar_node';
  longitude: number;
  sign: string;
  degree: number;
  retrograde: boolean;
  speedLongitude: number;
  house: number | null;
  source: 'swisseph' | 'derived';
};
type RawAngle = { key: NatalAngleKey; object: string; longitude: number; sign: string; degree: number; source: 'swisseph' | 'derived' };
type RawHouse = { house: number; longitude: number; sign: string; degree: number };
type RawAspect = {
  id: string; type: NatalAspectType; exactAngle: number; angularDistance: number; orb: number;
  from: string; to: string; fromKey: NatalBodyKey | NatalAngleKey; toKey: NatalBodyKey | NatalAngleKey; phase: NatalAspectPhase;
};
type Sky = {
  bodies: Record<NatalBodyKey, RawBody>;
  angles: Record<NatalAngleKey, RawAngle> | null;
  houses: RawHouse[];
  houseSystem: 'placidus' | 'whole_sign' | null;
  houseFallbackUsed: boolean;
};
type Sample = Sky & { utc: string; julianDay: number; aspects: RawAspect[] };

type BodyDef = { key: Exclude<NatalBodyKey,'southNode'>; object: string; kind: 'planet'|'lunar_node'; id: (swe:any)=>number };
const BODY_DEFS: BodyDef[] = [
  { key:'sun', object:'Sun', kind:'planet', id:()=>0 },
  { key:'moon', object:'Moon', kind:'planet', id:()=>1 },
  { key:'mercury', object:'Mercury', kind:'planet', id:()=>2 },
  { key:'venus', object:'Venus', kind:'planet', id:()=>3 },
  { key:'mars', object:'Mars', kind:'planet', id:()=>4 },
  { key:'jupiter', object:'Jupiter', kind:'planet', id:()=>5 },
  { key:'saturn', object:'Saturn', kind:'planet', id:()=>6 },
  { key:'uranus', object:'Uranus', kind:'planet', id:()=>7 },
  { key:'neptune', object:'Neptune', kind:'planet', id:()=>8 },
  { key:'pluto', object:'Pluto', kind:'planet', id:()=>9 },
  { key:'chiron', object:'Chiron', kind:'planet', id:(swe)=>swe.SE_CHIRON ?? 15 },
  { key:'northNode', object:'True North Node', kind:'lunar_node', id:(swe)=>swe.SE_TRUE_NODE ?? 11 },
];

const ASPECTS: Array<{ type:NatalAspectType; angle:number; orb:number }> = [
  { type:'conjunction', angle:0, orb:8 },
  { type:'sextile', angle:60, orb:4 },
  { type:'square', angle:90, orb:6 },
  { type:'trine', angle:120, orb:6 },
  { type:'opposition', angle:180, orb:8 },
];

let sweInstance: any = null;

function codedError(message:string, code:string, cause?:unknown): Error {
  const error:any = new Error(message); error.code = code; if (cause) error.cause = cause; return error;
}
function normalizeLongitude(value:number):number { const v=value%360; return v<0?v+360:v; }
function round(value:number, digits=8):number { return Number(value.toFixed(digits)); }
export function getZodiacSign(longitude:number):string { return SIGNS[Math.floor(normalizeLongitude(longitude)/30)%12]; }
export function getDegreeInSign(longitude:number):number { return round(normalizeLongitude(longitude)%30); }
function angularDistance(a:number,b:number):number { const d=Math.abs(normalizeLongitude(a)-normalizeLongitude(b)); return d>180?360-d:d; }

function findEphemerisPath():string {
  const candidates=[process.env.EPHE_PATH,path.join(process.cwd(),'ephe'),'/app/ephe',path.join(__dirname,'..','ephe'),'/workspace/ephe'].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory() && fs.readdirSync(candidate).some((name)=>name.endsWith('.se1'))) return candidate;
    } catch {}
  }
  throw codedError(`Swiss Ephemeris files not found. Checked: ${candidates.join(', ')}`,'EPHEMERIS_FILES_MISSING');
}
function initSwissEph():any {
  if (sweInstance) return sweInstance;
  let swe:any;
  try { swe=require('swisseph-v2'); } catch (cause) { throw codedError('Swiss Ephemeris module is unavailable.','EPHEMERIS_UNAVAILABLE',cause); }
  const missing=['swe_calc_ut','swe_julday','swe_houses','swe_set_ephe_path'].filter((name)=>typeof swe?.[name]!=='function');
  if (missing.length) throw codedError(`Swiss Ephemeris is missing methods: ${missing.join(', ')}`,'EPHEMERIS_UNAVAILABLE');
  const ephePath=findEphemerisPath(); swe.swe_set_ephe_path(ephePath); sweInstance=swe;
  log.info('Swiss Ephemeris initialized',{ephePath}); return swe;
}
function swissFlag(swe:any):number { return (swe.SEFLG_SWIEPH??2)|(swe.SEFLG_SPEED??256); }
function libraryVersion():string { try { return String(require('swisseph-v2/package.json')?.version||'unknown'); } catch { return 'unknown'; } }

export function getSwissEphemerisHealth():{ok:boolean;code?:string;message?:string} {
  try {
    const swe=initSwissEph(); const jd=swe.swe_julday(2026,1,1,12,1);
    for (const def of [BODY_DEFS[0],BODY_DEFS[10],BODY_DEFS[11]]) {
      const row=swe.swe_calc_ut(jd,def.id(swe),swissFlag(swe));
      if (!Number.isFinite(Number(row?.longitude))) throw codedError(`No ${def.object} result.`,'EPHEMERIS_INCOMPLETE');
    }
    return {ok:true};
  } catch (error:any) { return {ok:false,code:error?.code||'EPHEMERIS_UNAVAILABLE',message:error?.message||String(error)}; }
}

export function isValidIanaTimezone(value:unknown):value is string {
  if (typeof value!=='string'||!value.trim()) return false;
  try { new Intl.DateTimeFormat('en-US',{timeZone:value.trim()}).format(); return true; } catch { return false; }
}
function resolveTimezone(lat:number,lon:number):string {
  try { const zone=tzLookup(lat,lon); if (!isValidIanaTimezone(zone)) throw new Error(zone); return zone; }
  catch (cause) { throw codedError('Could not determine birth timezone.','TIMEZONE_LOOKUP_FAILED',cause); }
}
async function openMeteo(place:string):Promise<Coordinates|null> {
  try {
    const response=await axios.get('https://geocoding-api.open-meteo.com/v1/search',{params:{name:place,count:1,language:'ru',format:'json'},headers:{Accept:'application/json','User-Agent':BROWSER_UA},timeout:15000});
    const row=response.data?.results?.[0]; const lat=Number(row?.latitude); const lon=Number(row?.longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon,timezone:resolveTimezone(lat,lon)}:null;
  } catch { return null; }
}
async function nominatim(place:string):Promise<Coordinates> {
  try {
    const response=await axios.get('https://nominatim.openstreetmap.org/search',{params:{q:place,format:'json',limit:1},headers:{'User-Agent':'YourHoroscope/2.0',Accept:'application/json'},timeout:20000});
    const row=response.data?.[0]; const lat=Number(row?.lat); const lon=Number(row?.lon);
    if (!Number.isFinite(lat)||!Number.isFinite(lon)) throw new Error('not found');
    return {lat,lon,timezone:resolveTimezone(lat,lon)};
  } catch (cause) { throw codedError(`Birth place "${place}" was not found.`,'GEOCODING_FAILED',cause); }
}
export async function getCoordinates(placeName:string):Promise<Coordinates> {
  const place=String(placeName||'').trim(); if (!place) throw codedError('Birth place is required.','GEOCODING_FAILED');
  const offline=lookupCityCoordinates(place); if (offline) return {lat:offline.lat,lon:offline.lon,timezone:resolveTimezone(offline.lat,offline.lon)};
  return (await openMeteo(place))||nominatim(place);
}
export async function resolveBirthCoordinates(placeName:string,provided?:{lat?:number|null;lon?:number|null;timezone?:string|null}|null):Promise<Coordinates> {
  const lat=Number(provided?.lat); const lon=Number(provided?.lon);
  const valid=Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180&&!(lat===0&&lon===0);
  if (!valid) return getCoordinates(placeName);
  const supplied=String(provided?.timezone||'').trim(); if (supplied&&!isValidIanaTimezone(supplied)) throw codedError(`Invalid timezone: ${supplied}`,'INVALID_TIMEZONE');
  return {lat,lon,timezone:supplied||resolveTimezone(lat,lon)};
}

function julianDay(swe:any,date:Date):number {
  const hours=date.getUTCHours()+date.getUTCMinutes()/60+date.getUTCSeconds()/3600+date.getUTCMilliseconds()/3600000;
  const jd=Number(swe.swe_julday(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate(),hours,1));
  if (!Number.isFinite(jd)) throw codedError('Invalid Julian day.','EPHEMERIS_INCOMPLETE'); return jd;
}
function calculateBody(swe:any,jd:number,def:BodyDef):RawBody {
  let row:any; try { row=swe.swe_calc_ut(jd,def.id(swe),swissFlag(swe)); } catch (cause) { throw codedError(`Failed to calculate ${def.object}.`,'EPHEMERIS_INCOMPLETE',cause); }
  const longitude=Number(row?.longitude); const speed=Number(row?.speedLongitude??row?.speedLong??row?.longitudeSpeed);
  if (!Number.isFinite(longitude)||!Number.isFinite(speed)) throw codedError(`Incomplete ${def.object} result.`,'EPHEMERIS_INCOMPLETE');
  const normalized=normalizeLongitude(longitude);
  return {key:def.key,object:def.object,kind:def.kind,longitude:round(normalized),sign:getZodiacSign(normalized),degree:getDegreeInSign(normalized),retrograde:speed<0,speedLongitude:round(speed),house:null,source:'swisseph'};
}
function calculateBodies(swe:any,jd:number):Record<NatalBodyKey,RawBody> {
  const result={} as Record<NatalBodyKey,RawBody>;
  for (const def of BODY_DEFS) result[def.key]=calculateBody(swe,jd,def);
  const north=result.northNode; const southLongitude=normalizeLongitude(north.longitude+180);
  result.southNode={...north,key:'southNode',object:'South Node',longitude:round(southLongitude),sign:getZodiacSign(southLongitude),degree:getDegreeInSign(southLongitude),source:'derived'};
  return result;
}
function houseResult(swe:any,jd:number,lat:number,lon:number,system:'P'|'W'):any|null {
  try { const row=swe.swe_houses(jd,lat,lon,system); return Number.isFinite(Number(row?.ascendant))?row:null; } catch { return null; }
}
function calculateHouses(swe:any,jd:number,lat:number,lon:number):Omit<Sky,'bodies'> {
  let row=houseResult(swe,jd,lat,lon,'P'); let system:'placidus'|'whole_sign'='placidus'; let fallback=false;
  if (!row) { row=houseResult(swe,jd,lat,lon,'W'); system='whole_sign'; fallback=true; }
  if (!row) throw codedError('Could not calculate houses for this location.','HOUSES_UNAVAILABLE');
  const asc=normalizeLongitude(Number(row.ascendant));
  const mcValue=Number(row.mc??row.midheaven??row.ascmc?.[1]);
  if (!Number.isFinite(mcValue)) throw codedError('Swiss Ephemeris did not return MC.','HOUSES_INCOMPLETE');
  const mc=normalizeLongitude(mcValue);
  const angle=(key:NatalAngleKey,object:string,longitude:number,source:'swisseph'|'derived'):RawAngle=>({key,object,longitude:round(longitude),sign:getZodiacSign(longitude),degree:getDegreeInSign(longitude),source});
  const angles={
    ascendant:angle('ascendant','Ascendant',asc,'swisseph'),
    mc:angle('mc','MC',mc,'swisseph'),
    descendant:angle('descendant','Descendant',normalizeLongitude(asc+180),'derived'),
    ic:angle('ic','IC',normalizeLongitude(mc+180),'derived'),
  };
  const houseArray=Array.isArray(row.house)?row.house.slice(0,12):[];
  if (houseArray.length!==12) throw codedError('Swiss Ephemeris did not return 12 houses.','HOUSES_INCOMPLETE');
  const houses=houseArray.map((value:number,index:number)=>{const longitude=normalizeLongitude(Number(value));return{house:index+1,longitude:round(longitude),sign:getZodiacSign(longitude),degree:getDegreeInSign(longitude)};});
  return {angles,houses,houseSystem:system,houseFallbackUsed:fallback};
}
function houseForLongitude(longitude:number,houses:RawHouse[]):number|null {
  if (houses.length!==12) return null; const value=normalizeLongitude(longitude);
  for (let i=0;i<12;i++) { const start=normalizeLongitude(houses[i].longitude); const end=normalizeLongitude(houses[(i+1)%12].longitude); const wraps=start>end;
    if ((!wraps&&value>=start&&value<end)||(wraps&&(value>=start||value<end))) return i+1;
  }
  return null;
}
function calculateSky(swe:any,date:Date,coords:Coordinates,includeHouses:boolean):Sky {
  const jd=julianDay(swe,date); const bodies=calculateBodies(swe,jd);
  if (!includeHouses) return {bodies,angles:null,houses:[],houseSystem:null,houseFallbackUsed:false};
  const houseData=calculateHouses(swe,jd,coords.lat,coords.lon);
  for (const key of Object.keys(bodies) as NatalBodyKey[]) bodies[key].house=houseForLongitude(bodies[key].longitude,houseData.houses);
  return {bodies,...houseData};
}
function aspectObjects(sky:Sky):Array<{key:NatalBodyKey|NatalAngleKey;object:string;longitude:number}> {
  const objects=Object.values(sky.bodies).map((row)=>({key:row.key,object:row.object,longitude:row.longitude}));
  if (sky.angles) objects.push(...Object.values(sky.angles).map((row)=>({key:row.key,object:row.object,longitude:row.longitude})));
  return objects;
}
function aspectPhase(current:number,probe:number):NatalAspectPhase { if (current<=0.01) return'exact'; if (probe<current) return'applying'; if (probe>current) return'separating'; return'exact'; }
function calculateAspects(current:Sky,probe:Sky):RawAspect[] {
  const now=aspectObjects(current); const later=new Map(aspectObjects(probe).map((row)=>[row.key,row])); const result:RawAspect[]=[];
  for (let i=0;i<now.length;i++) for (let j=i+1;j<now.length;j++) {
    const from=now[i]; const to=now[j]; const distance=angularDistance(from.longitude,to.longitude);
    const rule=ASPECTS.find((item)=>Math.abs(distance-item.angle)<=item.orb); if (!rule) continue;
    const fromLater=later.get(from.key); const toLater=later.get(to.key); const probeDistance=fromLater&&toLater?angularDistance(fromLater.longitude,toLater.longitude):distance;
    const orb=Math.abs(distance-rule.angle); const laterOrb=Math.abs(probeDistance-rule.angle);
    const keys=[String(from.key),String(to.key)].sort();
    result.push({id:`aspect:${keys[0]}:${rule.type}:${keys[1]}`,type:rule.type,exactAngle:rule.angle,angularDistance:round(distance),orb:round(orb),from:from.object,to:to.object,fromKey:from.key,toKey:to.key,phase:aspectPhase(orb,laterOrb)});
  }
  return result;
}
function sampleAt(swe:any,utc:string,coords:Coordinates,includeHouses:boolean):Sample {
  const date=new Date(utc); const sky=calculateSky(swe,date,coords,includeHouses); const probe=calculateSky(swe,new Date(date.getTime()+10*60_000),coords,includeHouses);
  return {...sky,utc:date.toISOString(),julianDay:julianDay(swe,date),aspects:calculateAspects(sky,probe)};
}

function circularMean(values:number[]):number {
  const x=values.reduce((sum,v)=>sum+Math.cos(v*Math.PI/180),0)/values.length; const y=values.reduce((sum,v)=>sum+Math.sin(v*Math.PI/180),0)/values.length;
  return normalizeLongitude(Math.atan2(y,x)*180/Math.PI);
}
function longitudeRange(values:number[]):LongitudeRange {
  const sorted=values.map(normalizeLongitude).sort((a,b)=>a-b); if (sorted.length===1) return {startLongitude:round(sorted[0]),endLongitude:round(sorted[0]),spanDegrees:0,signs:[getZodiacSign(sorted[0])]};
  let largest=-1; let index=0;
  for (let i=0;i<sorted.length;i++) { const next=i===sorted.length-1?sorted[0]+360:sorted[i+1]; const gap=next-sorted[i]; if (gap>largest){largest=gap;index=i;} }
  const start=sorted[(index+1)%sorted.length]; const span=360-largest; const end=normalizeLongitude(start+span);
  return {startLongitude:round(start),endLongitude:round(end),spanDegrees:round(span),signs:[...new Set(sorted.map(getZodiacSign))]};
}
function reliability(exact:boolean,stable:boolean):NatalReliability { return exact?'exact':stable?'stable_in_range':'variable_in_range'; }
function aggregatePosition(key:NatalBodyKey,samples:Sample[]):NatalPositionV2 {
  const rows=samples.map((sample)=>sample.bodies[key]); const exact=samples.length===1; const signStable=new Set(rows.map((row)=>row.sign)).size===1; const retroStable=new Set(rows.map((row)=>row.retrograde)).size===1;
  const houses=rows.map((row)=>row.house); const houseStable=houses.every((value)=>value!==null)&&new Set(houses).size===1; const longitude=circularMean(rows.map((row)=>row.longitude));
  return {object:rows[0].object,planet:rows[0].object,key,kind:rows[0].kind,longitude:round(longitude),sign:getZodiacSign(longitude),degree:getDegreeInSign(longitude),retrograde:retroStable?rows[0].retrograde:null,speedLongitude:round(rows.reduce((sum,row)=>sum+row.speedLongitude,0)/rows.length),house:houseStable?rows[0].house:null,source:rows[0].source,reliability:reliability(exact,signStable&&retroStable),stable:{sign:signStable,retrograde:retroStable,house:houseStable},range:exact?undefined:longitudeRange(rows.map((row)=>row.longitude))};
}
function aggregateAngle(key:NatalAngleKey,samples:Sample[]):NatalAngleV2|null {
  const rows=samples.map((sample)=>sample.angles?.[key]).filter(Boolean) as RawAngle[]; if (rows.length!==samples.length||rows.length===0) return null;
  const exact=samples.length===1; const stableSign=new Set(rows.map((row)=>row.sign)).size===1; const longitude=circularMean(rows.map((row)=>row.longitude));
  return {key,object:rows[0].object,planet:rows[0].object,longitude:round(longitude),sign:getZodiacSign(longitude),degree:getDegreeInSign(longitude),source:rows[0].source,reliability:reliability(exact,stableSign),stableSign,range:exact?undefined:longitudeRange(rows.map((row)=>row.longitude))};
}
function aggregateHouses(samples:Sample[]):NatalHouseV2[] {
  if (samples.some((sample)=>sample.houses.length!==12)) return [];
  return Array.from({length:12},(_,index)=>{const rows=samples.map((sample)=>sample.houses[index]); const exact=samples.length===1; const stableSign=new Set(rows.map((row)=>row.sign)).size===1; const longitude=circularMean(rows.map((row)=>row.longitude)); return {house:index+1,longitude:round(longitude),sign:getZodiacSign(longitude),degree:getDegreeInSign(longitude),reliability:reliability(exact,stableSign),stableSign,range:exact?undefined:longitudeRange(rows.map((row)=>row.longitude))};});
}
function aggregateAspects(samples:Sample[]):NatalAspectV2[] {
  const ids=new Set(samples.flatMap((sample)=>sample.aspects.map((aspect)=>aspect.id))); const result:NatalAspectV2[]=[];
  for (const id of ids) { const rows=samples.map((sample)=>sample.aspects.find((aspect)=>aspect.id===id)).filter(Boolean) as RawAspect[]; const first=rows[0]; const phases=[...new Set(rows.map((row)=>row.phase))]; const reliableAspect=rows.length===samples.length;
    result.push({id,type:first.type,exactAngle:first.exactAngle,angle:first.exactAngle,angularDistance:round(rows.reduce((sum,row)=>sum+row.angularDistance,0)/rows.length),orb:round(rows.reduce((sum,row)=>sum+row.orb,0)/rows.length),orbRange:{min:round(Math.min(...rows.map((row)=>row.orb))),max:round(Math.max(...rows.map((row)=>row.orb)))},from:first.from,to:first.to,fromKey:first.fromKey,toKey:first.toKey,phase:phases.length===1?phases[0]:'mixed',reliable:reliableAspect,sampleCoverage:round(rows.length/samples.length,6)});
  }
  return result.sort((a,b)=>(a.orbRange.min-b.orbRange.min)||a.id.localeCompare(b.id));
}

export function calculatePlanetaryTransitsAt(date:Date):PlanetaryTransitsAtResult {
  if (!(date instanceof Date)||Number.isNaN(date.getTime())) throw codedError('Invalid transit date.','INVALID_TRANSIT_DATE');
  const swe=initSwissEph(); const jd=julianDay(swe,date); const bodies=calculateBodies(swe,jd);
  const pick=(key:NatalBodyKey):PlanetPosition=>{const row=bodies[key];return{planet:row.object,sign:row.sign,degree:row.degree,longitude:row.longitude,retrograde:row.retrograde,speedLongitude:row.speedLongitude};};
  return {source:'swisseph',date:date.toISOString(),julianDay:jd,sun:pick('sun'),moon:pick('moon'),mercury:pick('mercury'),venus:pick('venus'),mars:pick('mars'),jupiter:pick('jupiter'),saturn:pick('saturn'),uranus:pick('uranus'),neptune:pick('neptune'),pluto:pick('pluto')};
}

export async function calculateNatalChart(name:string,birthDate:string,birthTime:string,birthPlace:string,options?:NatalCalculationOptions):Promise<NatalChartResult> {
  if (!name?.trim()) throw new Error('Name is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) throw new Error('Birth date must be YYYY-MM-DD.');
  if (!birthPlace?.trim()) throw new Error('Birth place is required.');
  const coords=options?.coordinates||await getCoordinates(birthPlace);
  const time=options?.birthTime||normalizeBirthTimeInput({mode:options?.birthTimeMode,localTime:birthTime,uncertaintyMinutes:options?.birthTimeUncertaintyMinutes,rangeStart:options?.birthTimeRangeStart,rangeEnd:options?.birthTimeRangeEnd,legacyBirthTime:birthTime});
  const interval=buildBirthTimeInterval(birthDate,coords.timezone,time); const swe=initSwissEph(); const includeHouses=time.mode!=='unknown';
  const samples=interval.sampleUtc.map((utc)=>sampleAt(swe,utc,coords,includeHouses));
  const positions={} as Record<NatalBodyKey,NatalPositionV2>; for (const key of Object.keys(samples[0].bodies) as NatalBodyKey[]) positions[key]=aggregatePosition(key,samples);
  const angles={ascendant:includeHouses?aggregateAngle('ascendant',samples):null,mc:includeHouses?aggregateAngle('mc',samples):null,descendant:includeHouses?aggregateAngle('descendant',samples):null,ic:includeHouses?aggregateAngle('ic',samples):null};
  const houses=includeHouses?aggregateHouses(samples):[]; const aspects=aggregateAspects(samples); const exact=time.mode==='exact';
  const variableBodies=(Object.keys(positions) as NatalBodyKey[]).filter((key)=>positions[key].reliability==='variable_in_range');
  const variableAngles=(Object.keys(angles) as NatalAngleKey[]).filter((key)=>angles[key]?.reliability==='variable_in_range');
  const variableHouses=houses.filter((house)=>house.reliability==='variable_in_range').map((house)=>house.house);
  const variableAspectIds=aspects.filter((aspect)=>!aspect.reliable).map((aspect)=>aspect.id);
  const houseSystems=[...new Set(samples.map((sample)=>sample.houseSystem).filter(Boolean))] as Array<'placidus'|'whole_sign'>;
  const houseSystem=houseSystems.length===1?houseSystems[0]:null;
  const birthTimeQuality=time.mode==='exact'?'exact':time.mode==='unknown'?'unknown':'approximate';
  const chart:NatalChartDataV2={
    schemaVersion:'natal-chart-data-v2',
    birth:{localDate:birthDate,localTime:time.localTime,place:birthPlace.trim(),latitude:normalizeCoordinateForStorage(coords.lat),longitude:normalizeCoordinateForStorage(coords.lon),timezone:coords.timezone,time,interval},
    positions,angles,houses,aspects,
    chartQuality:{birthTimeMode:time.mode,birthTimeQuality,exactTime:exact,anglesAvailable:!!angles.ascendant&&!!angles.mc,housesAvailable:houses.length===12,ascendantReliable:angles.ascendant?.reliability!=='variable_in_range'&&!!angles.ascendant,housesReliable:houses.length===12&&variableHouses.length===0,houseBasedPersonalization:houses.length===12&&variableHouses.length===0,stableHousePlacements:(Object.keys(positions) as NatalBodyKey[]).filter((key)=>positions[key].stable.house),variableBodies,variableAngles,variableHouses,variableAspectIds,notes:time.mode==='unknown'?['Birth time is unknown. Angles and houses were not calculated.']:variableBodies.length||variableAngles.length||variableHouses.length||variableAspectIds.length?['Only facts stable across the entered birth-time interval are reliable.']:[]},
    calculationMetadata:{ephemerisEngine:'Swiss Ephemeris',ephemerisMode:'swisseph',ephemerisLibraryVersion:libraryVersion(),zodiac:'tropical',coordinateCenter:'geocentric',houseSystem,houseFallbackUsed:samples.some((sample)=>sample.houseFallbackUsed),housesComputedFrom:time.mode==='exact'?'exact_time':time.mode==='unknown'?'not_computed':'time_range',aspectRulesVersion:ASPECT_RULES_VERSION,calculationVersion:CANONICAL_NATAL_CALCULATION_VERSION,calculatedAt:new Date().toISOString(),sampleCount:samples.length},
    calculationVersion:CANONICAL_NATAL_CALCULATION_VERSION,
    sun:positions.sun,moon:positions.moon,mercury:positions.mercury,venus:positions.venus,mars:positions.mars,jupiter:positions.jupiter,saturn:positions.saturn,uranus:positions.uranus,neptune:positions.neptune,pluto:positions.pluto,chiron:positions.chiron,northNode:positions.northNode,southNode:positions.southNode,rising:angles.ascendant,mc:angles.mc,latitude:normalizeCoordinateForStorage(coords.lat),longitude:normalizeCoordinateForStorage(coords.lon),timezone:coords.timezone,birthTimeQuality,
  };
  log.info('Natal chart calculated',{timeMode:time.mode,samples:samples.length,aspects:aspects.length,houses:houses.length});
  return chart;
}
