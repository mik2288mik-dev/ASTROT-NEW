#!/usr/bin/env node
import { loadEnvConfig } from '@next/env';
import { Pool, type PoolClient } from 'pg';
import { resolveDatabaseUrl } from '../lib/database-url';

loadEnvConfig(process.cwd());

const MIGRATION='natal_v2_clean_calculation_storage_20260803';
const LOCK_KEY=2026080318;

async function tableExists(client:PoolClient,name:string):Promise<boolean>{
  const result=await client.query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS exists`,[name]);
  return result.rows[0]?.exists===true;
}

async function main(){
  const url=resolveDatabaseUrl();
  if(!url){console.log('[natal-v2-migrate] DATABASE_URL is not configured; skipping');return;}
  const pool=new Pool({
    connectionString:url,
    ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false,
    connectionTimeoutMillis:5000,
  });
  const client=await pool.connect();
  let inTransaction=false;
  try{
    await client.query('SELECT pg_advisory_lock($1)',[LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS migrations(id SERIAL PRIMARY KEY,name VARCHAR(255) UNIQUE NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    const applied=await client.query('SELECT 1 FROM migrations WHERE name=$1 LIMIT 1',[MIGRATION]);
    if(applied.rowCount){console.log('[natal-v2-migrate] already applied');return;}
    await client.query('BEGIN');
    inTransaction=true;

    if(await tableExists(client,'users')){
      await client.query(`ALTER TABLE users
        ADD COLUMN IF NOT EXISTS birth_time_mode TEXT,
        ADD COLUMN IF NOT EXISTS birth_time_uncertainty_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS birth_time_range_start TIME,
        ADD COLUMN IF NOT EXISTS birth_time_range_end TIME`);
    }

    if(await tableExists(client,'natal_charts')){
      await client.query(`ALTER TABLE natal_charts
        ADD COLUMN IF NOT EXISTS birth_time_mode TEXT,
        ADD COLUMN IF NOT EXISTS birth_time_uncertainty_minutes INTEGER,
        ADD COLUMN IF NOT EXISTS birth_time_range_start TIME,
        ADD COLUMN IF NOT EXISTS birth_time_range_end TIME`);

    }

    const chartRows=await tableExists(client,'natal_charts')
      ? await client.query('SELECT COUNT(*)::int AS count FROM natal_charts')
      : {rows:[{count:0}]};
    const profiledUsers=await tableExists(client,'users')
      ? await client.query(`SELECT COUNT(*)::int AS count FROM users
          WHERE birth_date IS NOT NULL OR birth_time IS NOT NULL OR birth_place IS NOT NULL`)
      : {rows:[{count:0}]};
    const chartCount=Number(chartRows.rows[0]?.count||0);
    const profileCount=Number(profiledUsers.rows[0]?.count||0);
    if(chartCount>0||profileCount>0){
      throw new Error(
        `DESTRUCTIVE_NATAL_V2_MIGRATION_BLOCKED: found ${chartCount} natal chart rows and `+
        `${profileCount} users with birth data. Automatic TRUNCATE/profile reset is disabled; `+
        'take a verified backup and run an owner-reviewed one-off migration.'
      );
    }

    await client.query('INSERT INTO migrations(name) VALUES($1)',[MIGRATION]);
    await client.query('COMMIT');
    inTransaction=false;
    console.log('[natal-v2-migrate] applied');
  }catch(error){
    if(inTransaction)await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{
    await client.query('SELECT pg_advisory_unlock($1)',[LOCK_KEY]).catch(()=>{});
    client.release();
    await pool.end();
  }
}

main().catch((error)=>{
  console.error('[natal-v2-migrate] failed',error instanceof Error?error.message:String(error));
  process.exit(1);
});
