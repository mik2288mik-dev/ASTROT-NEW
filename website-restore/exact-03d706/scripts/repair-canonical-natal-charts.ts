#!/usr/bin/env node

import { loadEnvConfig } from '@next/env';
import { resolveDatabaseUrl } from '../lib/database-url';

loadEnvConfig(process.cwd());

async function main() {
  if (!resolveDatabaseUrl()) {
    console.warn('DATABASE_URL is not set. Repair skipped.');
    process.exit(0);
  }

  let runMigrations: typeof import('../lib/migrations').runMigrations;
  let db: typeof import('../lib/db').db;
  let repairCanonicalChartRecord: typeof import('../lib/natalChartPersistence').repairCanonicalChartRecord;
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  try {
    ({ db } = await import('../lib/db'));
    if (apply) {
      ({ runMigrations } = await import('../lib/migrations'));
      ({ repairCanonicalChartRecord } = await import('../lib/natalChartPersistence'));
      await runMigrations();
    }
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes('swisseph.node') || message.includes('swisseph-v2')) {
      console.error('Swiss Ephemeris native module is unavailable in this environment.');
      console.error('Rebuild/install swisseph-v2 before running repair.');
      process.exit(1);
    }
    throw error;
  }

  const limitArg = Number(args.find((arg) => /^\d+$/.test(arg)) || '200');
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 200;
  const candidates = await db.natal_charts.listRepairCandidates(limit);

  console.log(`Found ${candidates.length} canonical natal repair candidate(s).`);
  if (!apply) {
    console.log('Dry run: no charts calculated or changed. Run with --apply to repair these candidates.');
    return;
  }

  let repaired = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await repairCanonicalChartRecord!(candidate.userId, candidate.chartId);
      if (result?.chart) {
        repaired += 1;
        console.log(`OK ${candidate.userId} -> chart ${result.chart.id} (${result.source})`);
      } else {
        console.log(`SKIP ${candidate.userId} -> missing birth data`);
      }
    } catch (error: any) {
      failed += 1;
      console.error(`FAIL ${candidate.userId}: ${error.message}`);
    }
  }

  console.log(`Repair complete. repaired=${repaired} failed=${failed}`);
}

main().catch((error) => {
  console.error('Canonical natal repair failed:', error);
  process.exit(1);
});
