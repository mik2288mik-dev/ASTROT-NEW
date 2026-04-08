#!/usr/bin/env node

import { loadEnvConfig } from '@next/env';
import { Pool } from 'pg';
import { resolveDatabaseUrl } from '../lib/database-url';

loadEnvConfig(process.cwd());

const DATABASE_URL = resolveDatabaseUrl();

const REPO_EXPECTED_TABLES = [
  'app_settings',
  'astro_questions',
  'content_interpretations',
  'content_unlocks',
  'daily_horoscopes',
  'daily_natal_cards',
  'daily_task_completions',
  'dictionary',
  'interpretations',
  'legacy_notification_templates',
  'lumi_transactions',
  'migrations',
  'natal_charts',
  'notification_assets',
  'notification_campaigns',
  'notification_deliveries',
  'notification_delivery_log',
  'notification_rotation_state',
  'notification_schedules',
  'notification_templates',
  'premium_entitlements',
  'roulette_spins',
  'star_payments',
  'synastry_cache',
  'user_sessions',
  'users',
] as const;

const SUSPICIOUS_TABLES = [
  'cards',
  'purchases',
  'referrals',
  'daily_horoscopes',
  'dictionary',
  'legacy_notification_templates',
  'interpretations',
] as const;

function quoteIdent(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

async function queryRows<T = any>(pool: Pool, sql: string, params: any[] = []): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

async function queryValue<T = any>(pool: Pool, sql: string, params: any[] = []): Promise<T | null> {
  const rows = await queryRows(pool, sql, params);
  if (rows.length === 0) return null;
  const first = rows[0] as Record<string, any>;
  const keys = Object.keys(first);
  if (keys.length === 0) return null;
  return first[keys[0]] as T;
}

async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const exists = await queryValue<boolean>(
    pool,
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     )`,
    [tableName]
  );
  return !!exists;
}

async function safeCount(pool: Pool, tableName: string): Promise<number | null> {
  if (!(await tableExists(pool, tableName))) return null;
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(tableName)}`);
  return Number(result.rows[0]?.count ?? 0);
}

async function tableTimestampSummary(pool: Pool, tableName: string) {
  if (!(await tableExists(pool, tableName))) return null;

  const columns = await queryRows<{ column_name: string }>(
    pool,
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1`,
    [tableName]
  );
  const available = new Set(columns.map((row) => row.column_name));

  const parts: string[] = [];
  if (available.has('created_at')) {
    parts.push('MIN(created_at) AS first_created_at');
    parts.push('MAX(created_at) AS last_created_at');
  }
  if (available.has('updated_at')) {
    parts.push('MAX(updated_at) AS last_updated_at');
  }
  if (available.has('sent_at')) {
    parts.push('MAX(sent_at) AS last_sent_at');
  }
  if (available.has('unlocked_at')) {
    parts.push('MAX(unlocked_at) AS last_unlocked_at');
  }
  if (available.has('completed_at')) {
    parts.push('MAX(completed_at) AS last_completed_at');
  }
  if (available.has('spin_at')) {
    parts.push('MAX(spin_at) AS last_spin_at');
  }

  if (parts.length === 0) return null;

  const rows = await queryRows<Record<string, string | null>>(
    pool,
    `SELECT ${parts.join(', ')} FROM ${quoteIdent(tableName)}`
  );
  return rows[0] || null;
}

async function main() {
  if (!DATABASE_URL) {
    console.error('DATABASE_URL is not configured. The audit script is read-only, but it still needs a DB connection.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    const tables = await queryRows<{
      table_name: string;
      table_type: string;
    }>(
      pool,
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );

    const columns = await queryRows<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      pool,
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`
    );

    const indexes = await queryRows<{
      table_name: string;
      index_name: string;
      index_def: string;
    }>(
      pool,
      `SELECT tablename AS table_name, indexname AS index_name, indexdef AS index_def
       FROM pg_indexes
       WHERE schemaname = 'public'
       ORDER BY tablename, indexname`
    );

    const constraints = await queryRows<{
      table_name: string;
      constraint_name: string;
      constraint_type: string;
      columns: string[] | null;
      foreign_table_name: string | null;
    }>(
      pool,
      `SELECT
         tc.table_name,
         tc.constraint_name,
         tc.constraint_type,
         ARRAY_REMOVE(ARRAY_AGG(DISTINCT kcu.column_name), NULL) AS columns,
         MAX(ccu.table_name) AS foreign_table_name
       FROM information_schema.table_constraints tc
       LEFT JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
        AND tc.table_name = kcu.table_name
       LEFT JOIN information_schema.constraint_column_usage ccu
         ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
       WHERE tc.table_schema = 'public'
       GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
       ORDER BY tc.table_name, tc.constraint_name`
    );

    const enums = await queryRows<{
      type_name: string;
      values: string[];
    }>(
      pool,
      `SELECT
         t.typname AS type_name,
         ARRAY_AGG(e.enumlabel ORDER BY e.enumsortorder) AS values
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
       GROUP BY t.typname
       ORDER BY t.typname`
    );

    const rowCounts: Record<string, number | null> = {};
    for (const table of tables) {
      rowCounts[table.table_name] = await safeCount(pool, table.table_name);
    }

    const suspiciousTables: Record<string, any> = {};
    for (const tableName of SUSPICIOUS_TABLES) {
      suspiciousTables[tableName] = {
        exists: await tableExists(pool, tableName),
        rowCount: await safeCount(pool, tableName),
        timestamps: await tableTimestampSummary(pool, tableName),
      };
    }

    const liveTables = tables.map((table) => table.table_name);
    const expectedTables = [...REPO_EXPECTED_TABLES].sort();
    const unknownTables = liveTables.filter((name) => !REPO_EXPECTED_TABLES.includes(name as any));
    const missingExpectedTables = expectedTables.filter((name) => !liveTables.includes(name));

    const migrationRows = await tableExists(pool, 'migrations')
      ? await queryRows<{ name: string; applied_at: string | null }>(
          pool,
          `SELECT name, applied_at::text
           FROM migrations
           ORDER BY applied_at NULLS LAST, name`
        )
      : [];

    const integrity = {
      usersWithBirthDataButNoPrimaryChart: await queryValue<number>(
        pool,
        `SELECT COUNT(*)::int
         FROM users u
         WHERE u.birth_date IS NOT NULL
           AND NULLIF(TRIM(COALESCE(u.birth_place, '')), '') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM natal_charts nc
             WHERE nc.user_id = u.id
           )`
      ),
      primaryChartsMissingCanonicalFields: await queryValue<number>(
        pool,
        `SELECT COUNT(*)::int
         FROM natal_charts
         WHERE is_primary = TRUE
           AND (
             latitude IS NULL OR
             longitude IS NULL OR
             timezone IS NULL OR
             sun_sign IS NULL OR
             moon_sign IS NULL OR
             ascendant_sign IS NULL
           )`
      ),
      duplicatePrimaryCharts: await queryRows<{
        user_id: string;
        primary_count: number;
      }>(
        pool,
        `SELECT user_id::text, COUNT(*)::int AS primary_count
         FROM natal_charts
         WHERE is_primary = TRUE
         GROUP BY user_id
         HAVING COUNT(*) > 1
         ORDER BY primary_count DESC, user_id
         LIMIT 100`
      ),
      orphanReferredBy: await queryValue<number>(
        pool,
        `SELECT COUNT(*)::int
         FROM users u
         LEFT JOIN users inviter ON inviter.id = u.referred_by
         WHERE u.referred_by IS NOT NULL
           AND inviter.id IS NULL`
      ),
      legacyUserNatalNullsWithPrimaryChart: await queryValue<number>(
        pool,
        `SELECT COUNT(*)::int
         FROM users u
         WHERE EXISTS (
           SELECT 1
           FROM natal_charts nc
           WHERE nc.user_id = u.id
         )
           AND (
             u.latitude IS NULL OR
             u.longitude IS NULL OR
             u.sun_sign IS NULL OR
             u.moon_sign IS NULL OR
             u.ascendant IS NULL
           )`
      ),
      dailyNatalCardOwnerMismatches: (await tableExists(pool, 'daily_natal_cards'))
        ? await queryValue<number>(
            pool,
            `SELECT COUNT(*)::int
             FROM daily_natal_cards d
             JOIN natal_charts nc ON nc.id = d.chart_id
             WHERE d.chart_id IS NOT NULL
               AND d.user_id IS NOT NULL
               AND nc.user_id::text <> d.user_id::text`
          )
        : null,
      duplicateContentUnlocks: (await tableExists(pool, 'content_unlocks'))
        ? await queryRows<{
            user_id: string;
            chart_id: string | null;
            access_tier: string;
            content_surface: string;
            content_variant: string;
            cache_key: string;
            duplicate_count: number;
          }>(
            pool,
            `SELECT
               user_id::text,
               chart_id::text,
               access_tier,
               content_surface,
               content_variant,
               cache_key,
               COUNT(*)::int AS duplicate_count
             FROM content_unlocks
             WHERE revoked_at IS NULL
             GROUP BY user_id, chart_id, access_tier, content_surface, content_variant, cache_key
             HAVING COUNT(*) > 1
             ORDER BY duplicate_count DESC, user_id
             LIMIT 100`
          )
        : [],
    };

    const report = {
      generatedAt: new Date().toISOString(),
      inventory: {
        tables,
        columns,
        indexes,
        constraints,
        enums,
        rowCounts,
        migrations: migrationRows,
      },
      schemaDrift: {
        expectedTables,
        liveTables,
        unknownTables,
        missingExpectedTables,
      },
      suspiciousTables,
      integrity,
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((error: any) => {
  console.error('[audit-db] Failed:', error?.message || error);
  if (error?.stack) {
    console.error(error.stack);
  }
  process.exit(1);
});
