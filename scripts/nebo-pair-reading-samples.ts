/** Explicit live model check. Fictitious pairs; no accounts or database writes. */
import { loadEnvConfig } from '@next/env';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import type { PairFutureRequest } from '../lib/synastry/pairFutureContract';

loadEnvConfig(process.cwd(), true);
async function main() {
  if (process.env.NEBO_PREVIEW_PYTHON) {
    const require = createRequire(import.meta.url);
    let ephemerisPath = '';
    const call = (method: string, args: unknown[]) => JSON.parse(execFileSync(process.env.NEBO_PREVIEW_PYTHON!, ['-c', `import json,sys,swisseph as s
s.set_ephe_path(sys.argv[1])
m=sys.argv[2]; a=json.loads(sys.argv[3])
if m=='julday': r=s.julday(*a)
elif m=='calc':
 x,f,*warnings=s.calc_ut(*a)
 if not f & s.FLG_SWIEPH: raise RuntimeError('Swiss ephemeris files were not used')
 r={'longitude':x[0],'speedLongitude':x[3]}
elif m=='houses':
 c,x=s.houses(a[0],a[1],a[2],a[3].encode())
 r={'house':list(c),'ascendant':x[0],'mc':x[1]}
print(json.dumps(r))`, ephemerisPath, method, JSON.stringify(args)], { encoding: 'utf8', timeout: 15000 }));
    const bridge = {
      swe_set_ephe_path: (value: string) => { ephemerisPath = value; },
      swe_julday: (...args: unknown[]) => call('julday', args),
      swe_calc_ut: (...args: unknown[]) => call('calc', args),
      swe_houses: (...args: unknown[]) => call('houses', args),
    };
    const modulePath = require.resolve('swisseph-v2');
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: bridge } as NodeModule;
    const packagePath = require.resolve('swisseph-v2/package.json');
    require.cache[packagePath] = { id: packagePath, filename: packagePath, loaded: true, exports: { version: 'pysweph 2.10.3.6 (local Python bridge)' } } as NodeModule;
  }
  const { generatePairFutureText, ensurePairFuture, PairFutureError } = await import('../lib/synastry/pairFutureGeneration');
  const { getMoscowTodayKey } = await import('../lib/date-utils');
  const { getPersonalFutureTimelineStops } = await import('../lib/personalFutureForecastContract');
  const { OPENAI_LUNA_MODEL } = await import('../lib/openai-models');
  const common: PairFutureRequest = { kind: 'question', mode: 'sign', signA: 'Pisces', signB: 'Taurus', relation: 'friendship', language: 'ru', topic: 'communication', date: getMoscowTodayKey(), period: 'day' };
  await assert.rejects(() => ensurePairFuture(common, 'live-check-no-account', false), error => error instanceof PairFutureError && error.status === 403);
  const pair = { signA: common.signA, signB: common.signB, basis: 'signs' as const, first: null, second: null };
  const cases = [
    { id: 'friends-question', input: common, pair },
    { id: 'family-child-question', input: { ...common, mode: 'birth' as const, relation: 'family' as const, topic: 'support' as const }, pair: { ...pair, basis: 'birth-dates' as const, first: { date: '1989-03-14', natal: null }, second: { date: '2017-05-05', natal: null } } },
    { id: 'colleagues-future', input: { ...common, ...getPersonalFutureTimelineStops(getMoscowTodayKey())[0], kind: 'future' as const, relation: 'work' as const, topic: 'agreements' as const }, pair },
  ];
  const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
  const results = await Promise.all(cases.filter(item => !selected || item.id === selected).map(async item => {
    try {
      const answer = await generatePairFutureText(item.input, item.pair, draft => console.log(JSON.stringify({ case: item.id, draft })));
      const result = { id: item.id, input: item.input, context: item.pair, status: 'passed', answer };
      console.log(JSON.stringify(result)); return result;
    } catch (error) {
      const failure = error as { name?: string; code?: string; status?: number; message?: string };
      const result = { id: item.id, status: 'failed', error: failure.code || failure.name || 'Error', detail: (failure.message || '').slice(0, 300) };
      console.log(JSON.stringify(result)); return result;
    }
  }));
  const destination = path.resolve('artifacts/pair-readings/live-samples.json');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const older = selected && fs.existsSync(destination) ? JSON.parse(fs.readFileSync(destination, 'utf8')).results.filter((item: { id: string }) => item.id !== selected) : [];
  fs.writeFileSync(destination, JSON.stringify({ generatedAt: new Date().toISOString(), model: OPENAI_LUNA_MODEL, source: 'Actual production writer and provider; fictitious pairs; no database writes', ephemeris: process.env.NEBO_PREVIEW_PYTHON ? 'Real Swiss Ephemeris through a local-only Python bridge, not the native Node runtime' : 'Native Node runtime', premiumGuard: 'passed: 403 before database/provider access', results: [...older, ...results] }, null, 2) + '\n');
  console.log(`Saved: ${destination}`);
  if (results.some(item => item.status === 'failed')) process.exitCode = 1;
}
main().then(() => process.exit(process.exitCode || 0)).catch(error => { console.error(error instanceof Error ? error.message : 'Sample runner failed'); process.exit(1); });
