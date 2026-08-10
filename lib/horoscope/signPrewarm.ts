import type { Language, SignHoroscopePeriod } from '../../types';
import { withContentGenerationLock } from '../contentGenerationLock';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../date-utils';
import { getCachedSignHoroscope } from './signCache';
import { generateAndStoreSignHoroscope } from './signOrchestrator';
import { buildSignHoroscopeLockKey } from './signGenerationLock';
import { ZODIAC_KEYS, type ZodiacKey } from '../zodiacKeys';

export interface SignPrewarmTarget {
  period: SignHoroscopePeriod;
  periodKey: string;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function nextDateKey(key: string): string {
  const value = parseDateKey(key);
  value.setUTCDate(value.getUTCDate() + 1);
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
}

function nextMonthKey(key: string): string {
  const [year, month] = key.split('-').map(Number);
  const value = new Date(Date.UTC(year, month, 1, 12));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
}

function moscowHour(now: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    hour12: false,
  }).format(now)) % 24;
}

function moscowWeekday(now: Date): number {
  const value = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Moscow',
    weekday: 'short',
  }).format(now);
  return ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[value] ?? 0;
}

export function getSignPrewarmTargets(now: Date): SignPrewarmTarget[] {
  const today = getMoscowTodayKey(now);
  const targets: SignPrewarmTarget[] = [
    { period: 'day', periodKey: today },
    { period: 'week', periodKey: getMoscowIsoWeekKey(now) },
    { period: 'month', periodKey: getMoscowMonthKey(now) },
  ];
  if (moscowHour(now) >= 18) {
    targets.push({ period: 'day', periodKey: nextDateKey(today) });
  }
  if (moscowWeekday(now) === 0) {
    const nextWeekDate = new Date(now.getTime() + 7 * 86_400_000);
    targets.push({ period: 'week', periodKey: getMoscowIsoWeekKey(nextWeekDate) });
  }
  const tomorrow = parseDateKey(nextDateKey(today));
  if (getMoscowMonthKey(tomorrow) !== getMoscowMonthKey(now)) {
    targets.push({ period: 'month', periodKey: nextMonthKey(getMoscowMonthKey(now)) });
  }
  return targets;
}

export async function prewarmSignHoroscopeTarget(
  target: SignPrewarmTarget,
  language: Language,
  sign: ZodiacKey,
): Promise<'cached' | 'generated' | 'in_progress'> {
  if (await getCachedSignHoroscope(target.period, sign, target.periodKey, language)) return 'cached';
  const result = await withContentGenerationLock({
    lockKey: buildSignHoroscopeLockKey(target.period, target.periodKey, language, sign),
    operation: `sign-prewarm-${target.period}-${target.periodKey}-${language}-${sign}`,
    readCached: async () => {
      const cached = await getCachedSignHoroscope(target.period, sign, target.periodKey, language);
      return cached ? { value: cached, source: 'cache' } : null;
    },
    generate: async () => {
      return generateAndStoreSignHoroscope(target.period, sign, target.periodKey, language);
    },
  });
  if (result.status === 'in_progress') {
    if (await getCachedSignHoroscope(target.period, sign, target.periodKey, language)) return 'cached';
    throw new Error(`SIGN_HOROSCOPE_PREWARM_IN_PROGRESS:${target.period}:${target.periodKey}:${language}:${sign}`);
  }
  return result.fromCache ? 'cached' : 'generated';
}

export async function prewarmUpcomingSignHoroscopes(now = new Date()): Promise<{
  targets: SignPrewarmTarget[];
  results: Array<{ period: SignHoroscopePeriod; periodKey: string; language: Language; sign: ZodiacKey; status: string }>;
}> {
  const targets = getSignPrewarmTargets(now);
  const jobs = targets.flatMap((target) =>
    (['ru', 'en'] as const).flatMap((language) =>
      ZODIAC_KEYS.map((sign) => ({ target, language, sign }))));
  const results: Array<{
    period: SignHoroscopePeriod;
    periodKey: string;
    language: Language;
    sign: ZodiacKey;
    status: string;
  }> = new Array(jobs.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const { target, language, sign } = jobs[index];
      try {
        results[index] = {
          period: target.period,
          periodKey: target.periodKey,
          language,
          sign,
          status: await prewarmSignHoroscopeTarget(target, language, sign),
        };
      } catch (error) {
        results[index] = {
          period: target.period,
          periodKey: target.periodKey,
          language,
          sign,
          status: `failed:${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, () => worker()));
  const failures = results.filter((result) => result.status.startsWith('failed:'));
  if (failures.length > 0) {
    throw new Error(`SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE:${failures
      .map((failure) => `${failure.period}:${failure.periodKey}:${failure.language}:${failure.sign}`)
      .join(',')}`);
  }
  return { targets, results };
}
