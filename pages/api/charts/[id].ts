import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../../lib/db';
import { birthProfileRepository } from '../../../lib/birthProfileRepository';
import { natalChartV2Repository } from '../../../lib/natalChartV2Repository';
import { isCanonicalNatalChartDataComplete } from '../../../lib/natalChartCanonical';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { ensureCanonicalPrimaryChart } from '../../../lib/natalChartPersistence';

const log={error:(message:string,error?:any)=>console.error(`[API/charts] ERROR: ${message}`,error||'')};

export default async function handler(req:NextApiRequest,res:NextApiResponse){
  const rawUserId=Array.isArray(req.query.id)?req.query.id[0]:req.query.id;
  if(!isValidUserId(rawUserId))return res.status(400).json(invalidUserIdPayload('ru'));
  const userId=String(rawUserId).trim();
  try{
    await requireAppUser(req,{expectedUserId:userId,allowGuest:true});
    if(req.method==='GET'){
      const chart=await natalChartV2Repository.getPrimary(userId);
      if(!chart||!isCanonicalNatalChartDataComplete(chart.chart_data))return res.status(404).json({error:'Chart not found'});
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
    return res.status(500).json({error:'Internal server error',message:error.message});
  }
}
