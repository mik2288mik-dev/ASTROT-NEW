import { getPool } from './db';
import { normalizeBirthDateInput, normalizeBirthPlaceInput } from './natalChartCanonical';

function parseJson(value:any):any {
  if(value==null)return value;
  if(typeof value==='string'){try{return JSON.parse(value);}catch{return null;}}
  return value;
}
function mapRow(row:any){
  if(!row)return null;
  const chartData=parseJson(row.chart_data);
  return {
    ...row,
    user_id:String(row.user_id),
    chart_data:chartData,
    sun:chartData?.sun||parseJson(row.sun)||null,
    moon:chartData?.moon||parseJson(row.moon)||null,
    ascendant:chartData?.rising||parseJson(row.ascendant)||null,
    houses:chartData?.houses||parseJson(row.houses)||[],
    aspects:chartData?.aspects||parseJson(row.aspects)||[],
    sun_sign:chartData?.sun?.sign||row.sun_sign||null,
    moon_sign:chartData?.moon?.sign||row.moon_sign||null,
    ascendant_sign:chartData?.rising?.sign||row.ascendant_sign||null,
    calculation_version:chartData?.calculationVersion||row.calculation_version||null,
  };
}
function payload(data:any){
  const chart=data.chartData?.chart_data||data.chartData;
  if(!chart?.schemaVersion||!chart?.positions?.sun||!chart?.positions?.moon)throw new Error('Canonical natal chart v2 data is incomplete.');
  return {
    name:String(data.name||'Моя карта').trim()||'Моя карта',
    chart,
    inputHash:String(data.inputHash||''),
    birthDate:normalizeBirthDateInput(data.birthDate),
    birthTime:data.birthTime||null,
    birthTimeMode:data.birthTimeMode||chart.birth?.time?.mode||null,
    uncertainty:data.birthTimeUncertaintyMinutes??chart.birth?.time?.uncertaintyMinutes??null,
    rangeStart:data.birthTimeRangeStart||chart.birth?.time?.rangeStart||null,
    rangeEnd:data.birthTimeRangeEnd||chart.birth?.time?.rangeEnd||null,
    birthPlace:normalizeBirthPlaceInput(data.birthPlace),
  };
}

const SELECT='SELECT * FROM natal_charts';

export const natalChartV2Repository={
  async findByInputHash(userId:string,inputHash:string,identity?:{subjectType?:'self'|'saved_person';name?:string}){
    const values:any[]=[userId,inputHash];const where=['user_id=$1','input_hash=$2','archived_at IS NULL'];
    if(identity?.subjectType){values.push(identity.subjectType);where.push(`subject_type=$${values.length}`);}
    if(identity?.name!==undefined){values.push(identity.name.trim().toLowerCase());where.push(`LOWER(BTRIM(name))=$${values.length}`);}
    const result=await getPool().query(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY is_primary DESC,id ASC LIMIT 1`,values);
    return mapRow(result.rows[0]);
  },
  async getPrimary(userId:string){const result=await getPool().query(`${SELECT} WHERE user_id=$1 AND subject_type='self' AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1`,[userId]);return mapRow(result.rows[0]);},
  async getAll(userId:string){const result=await getPool().query(`${SELECT} WHERE user_id=$1 AND archived_at IS NULL ORDER BY is_primary DESC,id ASC`,[userId]);return result.rows.map(mapRow);},
  async getById(chartId:number){const result=await getPool().query(`${SELECT} WHERE id=$1 AND archived_at IS NULL LIMIT 1`,[chartId]);return mapRow(result.rows[0]);},
  async setIdentityMetadata(chartId:number,subjectType:'self'|'saved_person',relationLabel:string|null){
    await getPool().query(`UPDATE natal_charts SET subject_type=$2,relation_label=$3,is_primary=CASE WHEN $2='self' THEN TRUE ELSE is_primary END,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[chartId,subjectType,relationLabel]);
    return this.getById(chartId);
  },
  async persistPrimary(userId:string,data:any){
    const p=payload(data);const pool=getPool();const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const existing=await client.query(`SELECT id FROM natal_charts WHERE user_id=$1 AND subject_type='self' AND archived_at IS NULL ORDER BY is_primary DESC,id ASC LIMIT 1 FOR UPDATE`,[userId]);
      await client.query(`UPDATE natal_charts SET is_primary=FALSE WHERE user_id=$1 AND archived_at IS NULL`,[userId]);
      let result;
      const values=[p.name,JSON.stringify(p.chart.sun),JSON.stringify(p.chart.moon),JSON.stringify(p.chart.rising),JSON.stringify(p.chart.mercury),JSON.stringify(p.chart.venus),JSON.stringify(p.chart.mars),JSON.stringify(p.chart.jupiter),JSON.stringify(p.chart.saturn),JSON.stringify(p.chart.houses),JSON.stringify(p.chart.aspects),JSON.stringify(p.chart),p.chart.latitude,p.chart.longitude,p.chart.timezone,p.chart.sun?.sign,p.chart.moon?.sign,p.chart.rising?.sign||null,p.inputHash,p.chart.calculationVersion,p.birthDate,p.birthTime,p.birthTimeMode,p.uncertainty,p.rangeStart,p.rangeEnd,p.birthPlace];
      if(existing.rows[0]){
        result=await client.query(`UPDATE natal_charts SET name=$1,sun=$2,moon=$3,ascendant=$4,mercury=$5,venus=$6,mars=$7,jupiter=$8,saturn=$9,houses=$10,aspects=$11,chart_data=$12,latitude=$13,longitude=$14,timezone=$15,sun_sign=$16,moon_sign=$17,ascendant_sign=$18,input_hash=$19,calculation_version=$20,birth_date=$21,birth_time=$22,birth_time_mode=$23,birth_time_uncertainty_minutes=$24,birth_time_range_start=$25,birth_time_range_end=$26,birth_place=$27,is_primary=TRUE,subject_type='self',relation_label=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=$28 RETURNING *`,[...values,existing.rows[0].id]);
      }else{
        result=await client.query(`INSERT INTO natal_charts (user_id,name,sun,moon,ascendant,mercury,venus,mars,jupiter,saturn,houses,aspects,chart_data,latitude,longitude,timezone,sun_sign,moon_sign,ascendant_sign,input_hash,calculation_version,birth_date,birth_time,birth_time_mode,birth_time_uncertainty_minutes,birth_time_range_start,birth_time_range_end,birth_place,is_primary,subject_type,relation_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,TRUE,'self',NULL) RETURNING *`,[userId,...values]);
      }
      await client.query('COMMIT');return mapRow(result.rows[0]);
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  },
  async create(userId:string,data:any){
    const p=payload(data);const result=await getPool().query(`INSERT INTO natal_charts (user_id,name,sun,moon,ascendant,mercury,venus,mars,jupiter,saturn,houses,aspects,chart_data,latitude,longitude,timezone,sun_sign,moon_sign,ascendant_sign,input_hash,calculation_version,birth_date,birth_time,birth_time_mode,birth_time_uncertainty_minutes,birth_time_range_start,birth_time_range_end,birth_place,is_primary,subject_type,relation_label) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,FALSE,'saved_person',NULL) RETURNING *`,[userId,p.name,JSON.stringify(p.chart.sun),JSON.stringify(p.chart.moon),JSON.stringify(p.chart.rising),JSON.stringify(p.chart.mercury),JSON.stringify(p.chart.venus),JSON.stringify(p.chart.mars),JSON.stringify(p.chart.jupiter),JSON.stringify(p.chart.saturn),JSON.stringify(p.chart.houses),JSON.stringify(p.chart.aspects),JSON.stringify(p.chart),p.chart.latitude,p.chart.longitude,p.chart.timezone,p.chart.sun?.sign,p.chart.moon?.sign,p.chart.rising?.sign||null,p.inputHash,p.chart.calculationVersion,p.birthDate,p.birthTime,p.birthTimeMode,p.uncertainty,p.rangeStart,p.rangeEnd,p.birthPlace]);
    return mapRow(result.rows[0]);
  },
};
