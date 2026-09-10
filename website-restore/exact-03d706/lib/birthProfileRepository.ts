import { getPool } from './db';
import type { BirthTimeInput } from './birthTime';

export const birthProfileRepository={
  async get(userId:string){
    const result=await getPool().query(`SELECT birth_time_mode,birth_time_uncertainty_minutes,birth_time_range_start,birth_time_range_end FROM users WHERE id=$1 LIMIT 1`,[userId]);
    const row=result.rows[0];
    if(!row)return null;
    return {
      birth_time_mode:row.birth_time_mode||null,
      birth_time_uncertainty_minutes:row.birth_time_uncertainty_minutes??null,
      birth_time_range_start:row.birth_time_range_start?String(row.birth_time_range_start).slice(0,5):null,
      birth_time_range_end:row.birth_time_range_end?String(row.birth_time_range_end).slice(0,5):null,
    };
  },
  async set(userId:string,time:BirthTimeInput){
    await getPool().query(`UPDATE users SET birth_time=$2,birth_time_mode=$3,birth_time_uncertainty_minutes=$4,birth_time_range_start=$5,birth_time_range_end=$6,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,[
      userId,time.localTime,time.mode,time.uncertaintyMinutes,time.rangeStart,time.rangeEnd,
    ]);
    return this.get(userId);
  },
};
