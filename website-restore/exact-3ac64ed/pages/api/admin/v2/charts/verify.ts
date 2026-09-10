import type { NextApiRequest, NextApiResponse } from 'next';
import { AdminAuthError, handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { normalizeBirthTimeInput } from '../../../../../lib/birthTime';
import { calculateNatalChart, resolveBirthCoordinates } from '../../../../../lib/swisseph-calculator';

/** Calculates a test chart without saving it. */
export default async function handler(req:NextApiRequest,res:NextApiResponse){
  if(req.method!=='POST')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
  try{
    await requireAdminPermission(req,'charts.view');
    const name=String(req.body?.name||'Test').trim()||'Test';
    const birthDate=String(req.body?.birthDate||'').trim();
    const birthPlace=String(req.body?.birthPlace||'').trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(birthDate))throw new AdminAuthError(400,'BAD_DATE','birthDate must be YYYY-MM-DD');
    if(!birthPlace)throw new AdminAuthError(400,'BAD_PLACE','birthPlace is required');

    const time=normalizeBirthTimeInput({
      mode:req.body?.birthTimeMode,
      localTime:req.body?.birthTime,
      uncertaintyMinutes:req.body?.birthTimeUncertaintyMinutes,
      rangeStart:req.body?.birthTimeRangeStart,
      rangeEnd:req.body?.birthTimeRangeEnd,
      legacyBirthTime:req.body?.birthTime,
    });
    const started=Date.now();
    const coordinates=await resolveBirthCoordinates(birthPlace,{lat:Number(req.body?.latitude),lon:Number(req.body?.longitude),timezone:req.body?.timezone});
    const chart=await calculateNatalChart(name,birthDate,time.localTime||'',birthPlace,{coordinates,birthTime:time});
    return res.status(200).json({
      ok:true,
      durationMs:Date.now()-started,
      coordinates:{lat:coordinates.lat,lon:coordinates.lon,timezone:coordinates.timezone},
      result:{
        sun:{sign:chart.sun.sign,degree:Number(chart.sun.degree.toFixed(2))},
        moon:{sign:chart.moon.sign,degree:Number(chart.moon.degree.toFixed(2))},
        ascendant:chart.rising?{sign:chart.rising.sign,degree:Number(chart.rising.degree.toFixed(2))}:null,
        mc:chart.mc?{sign:chart.mc.sign,degree:Number(chart.mc.degree.toFixed(2))}:null,
        houses:chart.houses.length,
        aspects:chart.aspects.length,
        birthTimeMode:chart.birth.time.mode,
        sampleCount:chart.calculationMetadata.sampleCount,
      },
    });
  }catch(error:any){
    if(error instanceof AdminAuthError)return handleAdminError(res,error);
    return res.status(200).json({ok:false,error:String(error?.message||error).slice(0,300),code:error?.code||null});
  }
}
