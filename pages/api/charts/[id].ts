import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { natalChartV2Repository } from '../../../lib/natalChartV2Repository';
import { isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import {
  ensureCanonicalPrimaryChart,
  repairCanonicalChartForUser,
} from '../../../lib/natalChartPersistence';

const log={error:(message:string,error?:any)=>console.error(`[API/charts] ERROR: ${message}`,error||'')};

function missingBirthProfileFields(user:any): string[] {
  return [
    !user?.birth_date && 'birthDate',
    !String(user?.birth_place || '').trim() && 'birthPlace',
  ].filter(Boolean) as string[];
}

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const requestedUserId=Array.isArray(req.query.id)?req.query.id[0]:req.query.id;
  let userId='';
  try{
    const auth=await requireAppUser(req,{allowGuest:true});
    userId=auth.userId;
    if(!isValidUserId(userId))return res.status(400).json(invalidUserIdPayload('ru'));
    if (isValidUserId(requestedUserId) && String(requestedUserId).trim()!==userId) {
      console.info('[API/charts] ignoring legacy URL user id in favor of authenticated session', {
        requestedUserId:String(requestedUserId).trim(),
        sessionUserId:userId,
      });
    }
    if(req.method==='GET'){
      let chart=await natalChartV2Repository.getPrimary(userId);
      if(!chart||!isCanonicalNatalChartDataComplete(chart.chart_data)){
        console.info('[API/charts] restoring primary V2 chart from birth profile',{
          userId,
          reason:chart?'invalid_chart_data':'primary_chart_missing',
        });
        const repaired=await repairCanonicalChartForUser(userId);
        chart=repaired?.chart||null;
      }
      if(!chart||!isCanonicalNatalChartDataComplete(chart.chart_data)){
        const user=await db.users.get(userId);
        const missingFields=missingBirthProfileFields(user);
        if (missingFields.length) {
          console.warn('[API/charts] primary chart unavailable: birth profile is incomplete', { userId, missingFields });
          return res.status(422).json({
            error:'Birth profile is incomplete',
            code:'BIRTH_PROFILE_INCOMPLETE',
            missingFields,
            message:'Заполни дату и место рождения в профиле, чтобы рассчитать натальную карту.',
          });
        }
        return res.status(409).json({
          error:'Chart recalculation required',
          code:'CHART_RECALCULATION_REQUIRED',
        });
      }
      res.setHeader('X-Chart-Source','database');
      res.setHeader('X-Chart-Calculated-At',chart.updated_at||chart.created_at||'unknown');
      return res.status(200).json(chart.chart_data);
    }
    if(req.method==='POST'||req.method==='PUT'){
      const user=await db.users.get(userId);
      const time=await birthProfileRepository.get(userId);
      if(!user?.birth_date||!user?.birth_place)return res.status(400).json({error:'Missing birth data',message:'Дата и место рождения обязательны.'});
      const result=await ensureCanonicalPrimaryChart({
        userId,name:user.name||'My Chart',birthDate:user.birth_date,birthTime:user.birth_time||'',
        birthTimeMode:time?.birth_time_mode||undefined,
        birthTimeUncertaintyMinutes:time?.birth_time_uncertainty_minutes??null,
        birthTimeRangeStart:time?.birth_time_range_start||null,
        birthTimeRangeEnd:time?.birth_time_range_end||null,
        birthPlace:user.birth_place,language:user.language||'ru',forceRecalculate:false,
      });
      return res.status(200).json(result.chart.chart_data);
    }
    return res.status(405).json({error:'Method not allowed'});
  }catch(error:any){
    if(error instanceof AdminAuthError)return handleAdminError(res,error);
    log.error('Error processing request',{error:error.message,userId});
    if (error?.code==='EPHEMERIS_UNAVAILABLE') return res.status(503).json({
      error:'Chart calculation service is unavailable',
      code:'EPHEMERIS_UNAVAILABLE',
      message:'Сервис расчёта натальной карты временно недоступен. Попробуй позже.',
    });
    return res.status(500).json({error:'Internal server error',message:error.message});
  }
}
