import { getPool } from './db';
import { normalizeBirthDateInput, normalizeBirthPlaceInput } from './natalChartCanonical';

function parseJson(value:any):any{if(value==null)return value;if(typeof value==='string'){try{return JSON.parse(value);}catch{return null;}}return value;}
function mapRow(row:any){
  if(!row)return null;
  const chartData=parseJson(row.chart_data);
  return {...row,user_id:String(row.user_id),chart_data:chartData,sun:chartData?.sun||null,moon:chartData?.moon||null,ascendant:chartData?.rising||null,houses:chartData?.houses||[],aspects:chartData?.aspects||[],sun_sign:chartData?.sun?.sign||null,moon_sign:chartData?.moon?.sign||null,ascendant_sign:chartData?.rising?.sign||null,calculation_version:chartData?.calculationVersion||row.calculation_version||null};
}
function payload(data:any){
  const chart=data.chartData?.chart_data||data.chartData;
  if(!chart?.schemaVersion||!chart?.positions?.sun||!chart?.positions?.moon)throw new Error('Canonical natal chart v2 data is incomplete.');
  return {name:String(data.name||'Моя карта').trim()||'Моя карта',chart,inputHash:String(data.inputHash||''),birthDate:normalizeBirthDateInput(data.birthDate),birthTime:data.birthTime||null,birthTimeMode:data.birthTimeMode||chart.birth?.time?.mode||null,uncertainty:data.birthTimeUncertaintyMinutes??chart.birth?.time?.uncertaintyMinutes??null,rangeStart:data.birthTimeRangeStart||chart.birth?.time?.rangeStart||null,rangeEnd:data.birthTimeRangeEnd||chart.birth?.time?.rangeEnd||null,birthPlace:normalizeBirthPlaceInput(data.birthPlace)};
}
const SELECT='SELECT * FROM natal_charts';

export const natalChartV2Repository={
  async findByInputHash(userId:string,inputHash:string,identity?:{subjectType?:'self'|'saved_person';name?:string}){
    const values:any[]=[userId,inputHash];const where=['user_id=$1','input_hash=$2','archived_at IS NULL'];
    if(identity?.subjectType){values.push(identity.subjectType);where.push(`subject_type=$${values.length}`);}
    if(identity?.name!==undefined){values.push(identity.name.trim().toLowerCase());where.push(`LOWER(BTRIM(name))=$${values.length}`);}
    const result=await getPool().query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY is_primary DESC,id ASC LIMIT 1`,values);return mapRow(result.rows[0]);
  },
  async getPrimary(userId:string){const result=await getPool().query(`${SELECT} WHERE user_id=$1 AND subject_type='self' AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1`,[userId]);return mapRow(result.rows[0]);},
  async getAll(userId:string){const result=await getPool().query(`${SELECT} WHERE user_id=$1 AND archived_at IS NULL ORDER BY is_primary DESC,id ASC`,[userId]);return result.rows.map(mapRow);},
  async getById(chartId:number){const result=await getPool().query(`${SELECT} WHERE id=$1 AND archived_at IS NULL LIMIT 1`,[chartId]);return mapRow(result.rows[0]);},
  async setIdentityMetadata(chartId:number,subjectType:'self'|'saved_person',relationLabel:string|null){await getPool().query(`UPDATE natal_charts SET subject_type=$2,relation_label=$3,is_primary=CASE WHEN $2='self' THEN TRUE ELSE is_primary END,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[chartId,subjectType,relationLabel]);return this.getById(chartId);},
  async persistPrimary(userId:string,data:any){
    const p=payload(data);const client=await getPool().connect();
    try{
      await client.query('BEGIN');
      const existing=await client.query(`SELECT id FROM natal_charts WHERE user_id=$1 AND subject_type='self' AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1 FOR UPDATE`,[userId]);
      await client.query(`UPDATE natal_charts SET is_primary=FALSE WHERE user_id=$1 AND archived_at IS NULL`,[userId]);
      const values=[p.name,JSON.stringify(p.chart),p.chart.latitude,p.chart.longitude,p.chart.timezone,p.inputHash,p.chart.calculationVersion,p.birthDate,p.birthTime,p.birthTimeMode,p.uncertainty,p.rangeStart,p.rangeEnd,p.birthPlace];
      let result;
      if(existing.rows[0]){
        result=await client.query(`UPDATE natal_charts SET name=$1,chart_data=$2,latitude=$3,longitude=$4,timezone=$5,input_hash=$6,calculation_version=$7,birth_date=$8,birth_time=$9,birth_time_mode=$10,birth_time_uncertainty_minutes=$11,birth_time_range_start=$12,birth_time_range_end=$13,birth_place=$14,is_primary=TRUE,subject_type='self',relation_label=NULL,sun=NULL,moon=NULL,ascendant=NULL,mercury=NULL,venus=NULL,mars=NULL,jupiter=NULL,saturn=NULL,houses=NULL,aspects=NULL,sun_sign=NULL,moon_sign=NULL,ascendant_sign=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$15 RETURNING *`,[...values,existing.rows[0].id]);
      }else{
        result=await client.query(`INSERT INTO natal_charts (user_id,name,chart_data,latitude,longitude,timezone,input_hash,calculation_version,birth_date,birth_time,birth_time_mode,birth_time_uncertainty_minutes,birth_time_range_start,birth_time_range_end,birth_place,is_primary,subject_type,relation_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE,'self',NULL) RETURNING *`,[userId,...values]);
      }
      await client.query('COMMIT');return mapRow(result.rows[0]);
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  },
  async create(userId:string,data:any){
    const p=payload(data);const values=[p.name,JSON.stringify(p.chart),p.chart.latitude,p.chart.longitude,p.chart.timezone,p.inputHash,p.chart.calculationVersion,p.birthDate,p.birthTime,p.birthTimeMode,p.uncertainty,p.rangeStart,p.rangeEnd,p.birthPlace];
    const result=await getPool().query(`INSERT INTO natal_charts (user_id,name,chart_data,latitude,longitude,timezone,input_hash,calculation_version,birth_date,birth_time,birth_time_mode,birth_time_uncertainty_minutes,birth_time_range_start,birth_time_range_end,birth_place,is_primary,subject_type,relation_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,FALSE,'saved_person',NULL) RETURNING *`,[userId,...values]);return mapRow(result.rows[0]);
  },
  async repairSaved(userId:string,chartId:number,data:any){
    const p=payload(data);const client=await getPool().connect();
    try{
      await client.query('BEGIN');
      const existing=await client.query(`SELECT id,subject_type,is_primary FROM natal_charts WHERE id=$1 AND user_id=$2 AND archived_at IS NULL FOR UPDATE`,[chartId,userId]);
      if(!existing.rows[0])throw new Error('Chart not found');
      if(existing.rows[0].subject_type!=='saved_person'||existing.rows[0].is_primary===true)throw new Error('Only a saved-person chart can be repaired in place');
      const values=[p.name,JSON.stringify(p.chart),p.chart.latitude,p.chart.longitude,p.chart.timezone,p.inputHash,p.chart.calculationVersion,p.birthDate,p.birthTime,p.birthTimeMode,p.uncertainty,p.rangeStart,p.rangeEnd,p.birthPlace,chartId,userId];
      const result=await client.query(`UPDATE natal_charts SET name=$1,chart_data=$2,latitude=$3,longitude=$4,timezone=$5,input_hash=$6,calculation_version=$7,birth_date=$8,birth_time=$9,birth_time_mode=$10,birth_time_uncertainty_minutes=$11,birth_time_range_start=$12,birth_time_range_end=$13,birth_place=$14,is_primary=FALSE,subject_type='saved_person',sun=NULL,moon=NULL,ascendant=NULL,mercury=NULL,venus=NULL,mars=NULL,jupiter=NULL,saturn=NULL,houses=NULL,aspects=NULL,sun_sign=NULL,moon_sign=NULL,ascendant_sign=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$15 AND user_id=$16 AND archived_at IS NULL RETURNING *`,values);
      if(!result.rows[0])throw new Error('Chart not found');
      await client.query('COMMIT');return mapRow(result.rows[0]);
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  },
};
