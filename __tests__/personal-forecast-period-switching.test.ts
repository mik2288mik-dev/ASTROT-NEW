import fs from 'fs';
import path from 'path';
import type { PersonalForecastPeriod } from '../lib/personalForecastContract';
import {
  resolveRequestedPersonalForecastPeriod,
  updatePersonalForecastPeriodBucket,
} from '../components/PersonalForecastFeed/periodSelection';

const ROOT = path.resolve(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('personal forecast period switching regressions', () => {
  it('keeps Today selected after Today -> Week -> Today when Week resolves late', async () => {
    let requested: PersonalForecastPeriod = 'day';
    let buckets = { day: 'ready', week: 'loading', month: 'idle' };
    const week = deferred<string>();
    const completion = week.promise.then((next) => {
      buckets = updatePersonalForecastPeriodBucket(buckets, 'week', next);
    });

    requested = 'week';
    requested = 'day';
    week.resolve('ready');
    await completion;

    expect(resolveRequestedPersonalForecastPeriod(requested)).toBe('day');
    expect(buckets).toEqual({ day: 'ready', week: 'ready', month: 'idle' });
  });

  it('keeps Today selected after Week -> Month -> Today when both older requests resolve late', async () => {
    let requested: PersonalForecastPeriod = 'week';
    let buckets = { day: 'ready', week: 'loading', month: 'loading' };
    const week = deferred<string>();
    const month = deferred<string>();
    const weekCompletion = week.promise.then((next) => {
      buckets = updatePersonalForecastPeriodBucket(buckets, 'week', next);
    });
    const monthCompletion = month.promise.then((next) => {
      buckets = updatePersonalForecastPeriodBucket(buckets, 'month', next);
    });

    requested = 'month';
    requested = 'day';
    month.resolve('ready');
    week.resolve('ready');
    await Promise.all([monthCompletion, weekCompletion]);

    expect(resolveRequestedPersonalForecastPeriod(requested)).toBe('day');
    expect(buckets).toEqual({ day: 'ready', week: 'ready', month: 'ready' });
  });

  it('keeps asynchronous readiness out of the selected-period state', () => {
    const dashboard = read('views/Dashboard.tsx');
    const app = read('App.tsx');

    expect(dashboard).toContain(
      'const activePeriod = resolveRequestedPersonalForecastPeriod(requestedPeriod);',
    );
    expect(dashboard).toContain('loadPeriod(activePeriod);');
    expect(dashboard).toContain('updatePersonalForecastPeriodBucket(');
    expect(dashboard).not.toContain('pendingPeriodRef');
    expect(dashboard).not.toContain('setActivePeriod');
    expect(dashboard).not.toContain('onPeriodChange');
    expect(app).toContain('requestedPeriod: dashboardPeriod');
    expect(app).not.toContain('onPeriodChange: setDashboardPeriod');
  });
});
