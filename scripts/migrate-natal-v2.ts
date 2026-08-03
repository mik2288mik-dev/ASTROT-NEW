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
  const pool=new Pool({connectionString:url});
  const client=await pool.connect();
  try{
    await client.query('SELECT pg_advisory_lock($1)',[LOCK_KEY]);
    await client.query(`CREATE TABLE IF NOT EXISTS migrations(id SERIAL PRIMARY KEY,name VARCHAR(255) UNIQUE NOT NULL,applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    const applied=await client.query('SELECT 1 FROM migrations WHERE name=$1 LIMIT 1',[MIGRATION]);
    if(applied.rowCount){console.log('[natal-v2-migrate] already applied');return;}
    await client.query('BEGIN');

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

      // Every current chart is test data made by the old calculation contract.
      // CASCADE removes only data linked to those charts: old readings, forecasts,
      // history snapshots, synastry and unlock rows. Accounts and payments stay.
      await client.query('TRUNCATE TABLE natal_charts RESTART IDENTITY CASCADE');
    }

    if(await tableExists(client,'users')){
      // Force every test account through the new explicit birth-time screen.
      await client.query(`UPDATE users SET
        birth_date=NULL,
        birth_time=NULL,
        birth_place=NULL,
        birth_time_mode=NULL,
        birth_time_uncertainty_minutes=NULL,
        birth_time_range_start=NULL,
        birth_time_range_end=NULL,
        is_setup=FALSE,
        updated_at=CURRENT_TIMESTAMP`);
    }

    await client.query('INSERT INTO migrations(name) VALUES($1)',[MIGRATION]);
    await client.query('COMMIT');
    console.log('[natal-v2-migrate] applied');
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{
    await client.query('SELECT pg_advisory_unlock($1)',[LOCK_KEY]).catch(()=>{});
    client.release();
    await pool.end();
  }
}

main().catch((error)=>{
  console.error('[natal-v2-migrate] failed',error);
  process.exit(1);
});
