import { toDateInputValue } from '../date-utils';
import type { AppUserContext } from './appAuth';

export function toPublicAppProfile(user:any,auth:AppUserContext){
  return {
    id:String(user.id),name:user.name||(auth.isGuest?'Гость':''),
    birthDate:toDateInputValue(user.birth_date)||user.birth_date||'',
    birthTime:user.birth_time||'',
    birthTimeMode:user.birth_time_mode||undefined,
    birthTimeUncertaintyMinutes:user.birth_time_uncertainty_minutes??null,
    birthTimeRangeStart:user.birth_time_range_start||null,
    birthTimeRangeEnd:user.birth_time_range_end||null,
    birthPlace:user.birth_place||'',
    isSetup:!!user.is_setup,language:user.language||'ru',theme:user.theme||'dark',
    isPremium:auth.isGuest?false:!!user.is_premium,premiumUntil:auth.isGuest?null:user.premium_until||null,
    trialStartedAt:auth.isGuest?null:user.trial_started_at||null,selectedZodiacSign:user.selected_zodiac_sign||null,
    isAdmin:auth.isGuest?false:!!user.is_admin,loginStreak:user.login_streak??0,chartSlots:user.chart_slots??1,
    authProvider:auth.provider,isGuest:auth.isGuest,
  };
}
