#!/usr/bin/env node

async function main() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL is not set. Repair skipped.');
    process.exit(0);
  }

  let runMigrations: typeof import('../lib/migrations').runMigrations;
  let db: typeof import('../lib/db').db;
  let repairCanonicalChartRecord: typeof import('../lib/natalChartPersistence').repairCanonicalChartRecord;

  try {
    ({ runMigrations } = await import('../lib/migrations'));
    ({ db } = await import('../lib/db'));
    ({ repairCanonicalChartRecord } = await import('../lib/natalChartPersistence'));
  } catch (error: any) {
    const message = String(error?.message || error);
    if (message.includes('swisseph.node') || message.includes('swisseph-v2')) {
      console.error('Swiss Ephemeris native module is unavailable in this environment.');
      console.error('Rebuild/install swisseph-v2 before running repair.');
      process.exit(1);
    }
    throw error;
  }

  await runMigrations();

  const limitArg = Number(process.argv[2] || '200');
  const limit = Number.isFinite(limitArg) && limitArg > 0 ? Math.floor(limitArg) : 200;
  const candidates = await db.natal_charts.listRepairCandidates(limit);

  console.log(`Found ${candidates.length} canonical natal repair candidate(s).`);

  let repaired = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const result = await repairCanonicalChartRecord(candidate.userId, candidate.chartId);
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
