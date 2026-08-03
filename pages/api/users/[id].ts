import type { NextApiRequest, NextApiResponse } from 'next';
import { db, getPool } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { AdminAuthError, getConfiguredOwnerId, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { hasDatabaseUrl } from '../../../lib/database-url';
import { toDateInputValue } from '../../../lib/date-utils';
import { normalizeBirthTimeInput } from '../../../lib/birthTime';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';

const log={info:(message:string,data?:any)=>console.log(`[API/users/[id]] ${message}`,data||''),error:(message:string,error?:any)=>console.error(`[API/users/[id]] ERROR: ${message}`,error||''),warn:(message:string,error?:any)=>console.warn(`[API/users/[id]] WARN: ${message}`,error||'')};
const NOTIFICATION_FREQUENCIES=new Set(['quiet','important','daily','twice_daily']);
const NEW_USER_TRIAL_DAYS=14;

function resolveIsAdmin(userId:string,dbIsAdmin:boolean|undefined):boolean { const ownerId=getConfiguredOwnerId(); return ownerId&&String(userId)===String(ownerId)?true:!!dbIsAdmin; }
function normalizeNullableString(value:unknown):string|null { if(value===undefined||value===null)return null; const normalized=String(value).trim(); return normalized||null; }
function normalizeNotificationFrequency(value:unknown):string|null { const normalized=typeof value==='string'?value.trim():''; return NOTIFICATION_FREQUENCIES.has(normalized)?normalized:null; }
function trialWindow(){const started=Date.now();return{trialStartedAt:new Date(started).toISOString(),premiumUntil:new Date(started+NEW_USER_TRIAL_DAYS*86400000).toISOString()};}
async function getNotificationFrequency(userId:string):Promise<string|null>{if(!hasDatabaseUrl())return null;try{const result=await getPool().query('SELECT notification_frequency FROM users WHERE id = $1 LIMIT 1',[userId]);return normalizeNotificationFrequency(result.rows[0]?.notification_frequency);}catch(error:any){log.warn('notification read failed',error?.message);return null;}}
async function saveNotificationFrequency(userId:string,value:unknown):Promise<void>{const normalized=normalizeNotificationFrequency(value);if(!normalized||!hasDatabaseUrl())return;try{await getPool().query('UPDATE users SET notification_frequency = $1 WHERE id = $2',[normalized,userId]);}catch(error:any){log.warn('notification save failed',error?.message);}}

function publicUser(user:any,userId:string,notificationFrequency?:string|null,refCode?:string|null){
  return {
    id:user.id,name:user.name,birthDate:toDateInputValue(user.birth_date)||user.birth_date,birthTime:user.birth_time||'',birthTimeMode:user.birth_time_mode||undefined,
    birthTimeUncertaintyMinutes:user.birth_time_uncertainty_minutes??null,birthTimeRangeStart:user.birth_time_range_start||null,birthTimeRangeEnd:user.birth_time_range_end||null,
    birthPlace:user.birth_place,isSetup:user.is_setup,language:user.language,theme:user.theme,isPremium:user.is_premium,
    premiumUntil:user.premium_until?new Date(user.premium_until).toISOString():null,trialStartedAt:user.trial_started_at?new Date(user.trial_started_at).toISOString():null,
    selectedZodiacSign:user.selected_zodiac_sign||null,gender:user.gender||null,createdAt:user.created_at?new Date(user.created_at).toISOString():null,
    updatedAt:user.updated_at?new Date(user.updated_at).toISOString():null,isAdmin:resolveIsAdmin(userId,user.is_admin),evolution:null,
    loginStreak:user.login_streak??0,chartSlots:user.chart_slots??1,notificationFrequency:notificationFrequency||undefined,
    refCode:refCode||undefined,referralApplied:user.referred_by!=null,
  };
}

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const rawId=Array.isArray(req.query.id)?req.query.id[0]:req.query.id;
  if(!isValidUserId(rawId))return res.status(400).json(invalidUserIdPayload('ru'));
  const userId=String(rawId).trim();
  try{
    const appUser=await requireAppUser(req,{expectedUserId:userId,allowGuest:true});
    if(req.method==='GET'){
      if(!hasDatabaseUrl())return res.status(404).json({error:'User not found'});
      const user=await db.users.get(userId,{hydratePrimaryChart:false});
      if(!user)return res.status(404).json({error:'User not found'});
      const birthSettings=await birthProfileRepository.get(userId);
      let refCode=normalizeNullableString(user.ref_code)?.toUpperCase()||null;
      if(!refCode){try{refCode=await db.users.ensureReferralCode(userId);}catch(error:any){log.warn('ensureReferralCode failed',error?.message);}}
      return res.status(200).json(publicUser({...user,...birthSettings},userId,normalizeNotificationFrequency(user.notification_frequency),refCode));
    }
    if(req.method!=='POST'&&req.method!=='PUT')return res.status(405).json({error:'Method not allowed'});
    if(!hasDatabaseUrl())return res.status(500).json({error:'Database not configured',message:'DATABASE_URL is not set.'});

    const data=req.body||{}; const existing=await db.users.get(userId);
    let time;
    try{
      time=normalizeBirthTimeInput({mode:data.birthTimeMode,localTime:data.birthTime,uncertaintyMinutes:data.birthTimeUncertaintyMinutes,rangeStart:data.birthTimeRangeStart,rangeEnd:data.birthTimeRangeEnd,legacyBirthTime:data.birthTime});
    }catch(error:any){return res.status(400).json({error:'Invalid birth time',message:error.message});}
    const dbUser:Record<string,any>={
      name:normalizeNullableString(data.name),birth_date:normalizeNullableString(data.birthDate),birth_time:time.localTime,
      birth_place:normalizeNullableString(data.birthPlace),is_setup:!!data.isSetup,language:data.language||'ru',theme:data.theme||'light',
    };
    if(data.selectedZodiacSign!==undefined||data.selected_zodiac_sign!==undefined)dbUser.selected_zodiac_sign=normalizeNullableString(data.selectedZodiacSign??data.selected_zodiac_sign);
    if(data.gender!==undefined){const gender=String(data.gender??'');dbUser.gender=['male','female','unspecified'].includes(gender)?gender:null;}
    if(!existing&&!appUser.isGuest){const trial=trialWindow();dbUser.trial_started_at=trial.trialStartedAt;dbUser.premium_until=trial.premiumUntil;}
    const saved=await db.users.set(userId,dbUser);
    await birthProfileRepository.set(userId,time);
    await saveNotificationFrequency(userId,data.notificationFrequency);
    const refreshed=await db.users.get(userId);
    const birthSettings=await birthProfileRepository.get(userId);
    let refCode:string|null=null;try{refCode=await db.users.ensureReferralCode(userId);}catch(error:any){log.warn('ensureReferralCode failed',error?.message);}
    return res.status(200).json(publicUser({...refreshed,...saved,...birthSettings},userId,await getNotificationFrequency(userId),refCode));
  }catch(error:any){
    if(error instanceof AdminAuthError)return handleAdminError(res,error);
    log.error('Error processing request',{error:error.message,userId});return res.status(500).json({error:'Internal server error',message:error.message});
  }
}
