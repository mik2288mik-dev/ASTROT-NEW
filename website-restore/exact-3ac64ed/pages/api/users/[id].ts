import type { NextApiRequest, NextApiResponse } from 'next';
import { db, getPool } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { AdminAuthError, getConfiguredOwnerId, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { hasDatabaseUrl } from '../../../lib/database-url';
import { toDateInputValue } from '../../../lib/date-utils';
import { normalizeBirthClockTime, normalizeBirthTimeInput } from '../../../lib/birthTime';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { getPremiumEntitlementState, publicPremiumEntitlementSnapshot } from '../../../lib/contentArchitecture';
import {
  buildPersonalForecastPrewarmProfile,
  queuePersonalForecastPrewarm,
  queuePersonalForecastPrewarmForUser,
} from '../../../lib/personalForecastPrewarm';

const log={info:(message:string,data?:any)=>console.log(`[API/users/[id]] ${message}`,data||''),error:(message:string,error?:any)=>console.error(`[API/users/[id]] ERROR: ${message}`,error||''),warn:(message:string,error?:any)=>console.warn(`[API/users/[id]] WARN: ${message}`,error||'')};
const NOTIFICATION_FREQUENCIES=new Set(['quiet','important','daily','twice_daily']);

function resolveIsAdmin(userId:string,dbIsAdmin:boolean|undefined):boolean { const ownerId=getConfiguredOwnerId(); return ownerId&&String(userId)===String(ownerId)?true:!!dbIsAdmin; }
function normalizeNullableString(value:unknown):string|null { if(value===undefined||value===null)return null; const normalized=String(value).trim(); return normalized||null; }
function normalizeNotificationFrequency(value:unknown):string|null { const normalized=typeof value==='string'?value.trim():''; return NOTIFICATION_FREQUENCIES.has(normalized)?normalized:null; }
async function getNotificationFrequency(userId:string):Promise<string|null>{if(!hasDatabaseUrl())return null;try{const result=await getPool().query('SELECT notification_frequency FROM users WHERE id = $1 LIMIT 1',[userId]);return normalizeNotificationFrequency(result.rows[0]?.notification_frequency);}catch(error:any){log.warn('notification read failed',error?.message);return null;}}
async function saveNotificationFrequency(userId:string,value:unknown):Promise<void>{const normalized=normalizeNotificationFrequency(value);if(!normalized||!hasDatabaseUrl())return;try{await getPool().query('UPDATE users SET notification_frequency = $1 WHERE id = $2',[normalized,userId]);}catch(error:any){log.warn('notification save failed',error?.message);}}

function publicUser(user:any,userId:string,premiumEntitlement:Awaited<ReturnType<typeof getPremiumEntitlementState>>,notificationFrequency?:string|null,refCode?:string|null){
  const entitlement=publicPremiumEntitlementSnapshot(premiumEntitlement);
  return {
    id:user.id,name:user.name,birthDate:toDateInputValue(user.birth_date)||user.birth_date,birthTime:normalizeBirthClockTime(user.birth_time)||'',birthTimeMode:user.birth_time_mode||undefined,
    birthTimeUncertaintyMinutes:user.birth_time_uncertainty_minutes??null,birthTimeRangeStart:normalizeBirthClockTime(user.birth_time_range_start),birthTimeRangeEnd:normalizeBirthClockTime(user.birth_time_range_end),
    birthPlace:user.birth_place,birthTimezone:user.birth_timezone||null,birthLatitude:user.latitude??null,birthLongitude:user.longitude??null,isSetup:user.is_setup,language:user.language,theme:user.theme,isPremium:entitlement.isPremium,premiumEntitlement:entitlement,
    premiumUntil:entitlement.endsAt,trialStartedAt:user.trial_started_at?new Date(user.trial_started_at).toISOString():null,
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
    await requireAppUser(req,{expectedUserId:userId,allowGuest:true});
    if(req.method==='GET'){
      if(!hasDatabaseUrl())return res.status(404).json({error:'User not found'});
      const user=await db.users.get(userId,{hydratePrimaryChart:false});
      if(!user)return res.status(404).json({error:'User not found'});
      const birthSettings=await birthProfileRepository.get(userId);
      let refCode=normalizeNullableString(user.ref_code)?.toUpperCase()||null;
      if(!refCode){try{refCode=await db.users.ensureReferralCode(userId);}catch(error:any){log.warn('ensureReferralCode failed',error?.message);}}
      const premiumEntitlement=await getPremiumEntitlementState(userId);
      queuePersonalForecastPrewarmForUser({
        userId,accessTier:premiumEntitlement.isPremium?'premium':'free',reason:'app_open',
      });
      return res.status(200).json(publicUser({...user,...birthSettings},userId,premiumEntitlement,normalizeNotificationFrequency(user.notification_frequency),refCode));
    }
    if(req.method!=='POST'&&req.method!=='PUT')return res.status(405).json({error:'Method not allowed'});
    if(!hasDatabaseUrl())return res.status(500).json({error:'Database not configured',message:'DATABASE_URL is not set.'});

    const data=req.body||{};
    let time;
    try{
      time=normalizeBirthTimeInput({mode:data.birthTimeMode,localTime:data.birthTime,uncertaintyMinutes:data.birthTimeUncertaintyMinutes,rangeStart:data.birthTimeRangeStart,rangeEnd:data.birthTimeRangeEnd,legacyBirthTime:data.birthTime});
    }catch(error:any){return res.status(400).json({error:'Invalid birth time',message:error.message});}
    const dbUser:Record<string,any>={
      name:normalizeNullableString(data.name),birth_date:normalizeNullableString(data.birthDate),birth_time:time.localTime,
      birth_place:normalizeNullableString(data.birthPlace),language:data.language||'ru',theme:data.theme||'light',
    };
    if(data.isSetup!==undefined)dbUser.is_setup=data.isSetup===true;
    if(data.selectedZodiacSign!==undefined||data.selected_zodiac_sign!==undefined)dbUser.selected_zodiac_sign=normalizeNullableString(data.selectedZodiacSign??data.selected_zodiac_sign);
    if(data.gender!==undefined){const gender=String(data.gender??'');dbUser.gender=['male','female','unspecified'].includes(gender)?gender:null;}
    const saved=await db.users.updateExisting(userId,dbUser);
    if(!saved)return res.status(401).json({error:'APP_SESSION_REVOKED',message:'This account no longer exists'});
    await birthProfileRepository.set(userId,time);
    await saveNotificationFrequency(userId,data.notificationFrequency);
    const refreshed=await db.users.get(userId);
    const birthSettings=await birthProfileRepository.get(userId);
    let refCode:string|null=null;try{refCode=await db.users.ensureReferralCode(userId);}catch(error:any){log.warn('ensureReferralCode failed',error?.message);}
    const premiumEntitlement=await getPremiumEntitlementState(userId);
    const prewarmProfile=buildPersonalForecastPrewarmProfile(userId,{...refreshed,...saved},birthSettings);
    if(prewarmProfile&&data.isSetup===true){
      const accessTier=premiumEntitlement.isPremium?'premium' as const:'free' as const;
      queuePersonalForecastPrewarm({
        userId,profile:prewarmProfile,accessTier,reason:'birth_profile_completed',maxMissingGenerations:1,
      });
    }
    return res.status(200).json(publicUser({...refreshed,...saved,...birthSettings},userId,premiumEntitlement,await getNotificationFrequency(userId),refCode));
  }catch(error:any){
    if(error instanceof AdminAuthError)return handleAdminError(res,error);
    log.error('Error processing request',{error:error.message,userId});return res.status(500).json({
      error:'Internal server error',
      ...(process.env.NODE_ENV==='production'?{}:{message:error.message}),
    });
  }
}
