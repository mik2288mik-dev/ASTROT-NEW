import type { Language, SignHoroscopePeriod } from '../../types';
import { withContentGenerationLock } from '../contentGenerationLock';
import {
  getMoscowIsoWeekKey,
  getMoscowMonthKey,
  getMoscowTodayKey,
} from '../date-utils';
import { ZODIAC_KEYS } from '../zodiacKeys';
import { logForecastDeliveryMetric } from '../forecastDeliveryMetrics';
import { getCachedSignHoroscopes } from './signCache';
import { fillMissingSignHoroscopes } from './signOrchestrator';
import { buildSignHoroscopeLockKey } from './signGenerationLock';

export interface SignPrewarmTarget {
  period: SignHoroscopePeriod;
  periodKey: string;
}

const PREWARM_LANGUAGES = ['ru'] as const;
export const SIGN_MONTH_PREWARM_WORK_LIMIT = 1;

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

export function buildSignMonthPrewarmTargets(targetMonthKey: string): SignPrewarmTarget[] {
  const match = /^(\d{4})-(\d{2})$/.exec(targetMonthKey);
  if (!match) throw new Error('SIGN_HOROSCOPE_MONTH_KEY_INVALID');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('SIGN_HOROSCOPE_MONTH_KEY_INVALID');
  const dayCount = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
  const dayKeys = Array.from({ length: dayCount }, (_, index) => (
    `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
  ));
  const weekKeys = [...new Set(dayKeys.map((key) => getMoscowIsoWeekKey(parseDateKey(key))))];
  return [
    ...dayKeys.map((periodKey) => ({ period: 'day' as const, periodKey })),
    ...weekKeys.map((periodKey) => ({ period: 'week' as const, periodKey })),
    { period: 'month', periodKey: targetMonthKey },
  ];
}

export function getNextSignMonthPrewarmTargets(now = new Date()): SignPrewarmTarget[] {
  return buildSignMonthPrewarmTargets(nextMonthKey(getMoscowMonthKey(now)));
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

async function isTargetComplete(target: SignPrewarmTarget, language: Language): Promise<boolean> {
  const readings = await getCachedSignHoroscopes(
    target.period,
    target.periodKey,
    language,
    ZODIAC_KEYS,
  );
  return ZODIAC_KEYS.every((sign) => !!readings[sign]);
}

export async function prewarmSignHoroscopeTarget(
  target: SignPrewarmTarget,
  language: Language,
): Promise<'cached' | 'generated' | 'in_progress'> {
  try {
    if (await isTargetComplete(target, language)) {
      logForecastDeliveryMetric({ domain: 'sign', outcome: 'skipped_already_cached', period: target.period, periodKey: target.periodKey, language });
      return 'cached';
    }
    const result = await withContentGenerationLock<'cached' | 'generated'>({
      lockKey: buildSignHoroscopeLockKey(target.period, target.periodKey, language),
      operation: `sign-prewarm-batch-${target.period}-${target.periodKey}-${language}`,
      readCached: async () => (
        await isTargetComplete(target, language)
          ? { value: 'cached', source: 'cache' }
          : null
      ),
      generate: async () => {
        const filled = await fillMissingSignHoroscopes(target.period, target.periodKey, language);
        if (filled.failures.length > 0) {
          throw new Error(`SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE:${filled.failures
            .map((failure) => failure.sign)
            .join(',')}`);
        }
        return filled.generatedSigns.length > 0 ? 'generated' : 'cached';
      },
    });
    if (result.status === 'in_progress') {
      if (await isTargetComplete(target, language)) return 'cached';
      logForecastDeliveryMetric({ domain: 'sign', outcome: 'generation_in_progress', period: target.period, periodKey: target.periodKey, language });
      return 'in_progress';
    }
    logForecastDeliveryMetric({
      domain: 'sign',
      outcome: result.value === 'generated' ? 'prewarmed' : 'skipped_already_cached',
      period: target.period,
      periodKey: target.periodKey,
      language,
    });
    return result.value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logForecastDeliveryMetric({ domain: 'sign', outcome: 'failed', period: target.period, periodKey: target.periodKey, language, errorCode: message.split(':', 1)[0] });
    throw error;
  }
}

export async function prewarmNextSignMonthIncrement(input: {
  now?: Date;
  workLimit?: number;
  language?: Language;
  prewarmTarget?: typeof prewarmSignHoroscopeTarget;
} = {}): Promise<{
  targetMonthKey: string;
  totalTargets: number;
  scannedTargets: number;
  workUsed: number;
  cached: number;
  generated: number;
  inProgress: number;
  failed: number;
}> {
  const now = input.now || new Date();
  const targetMonthKey = nextMonthKey(getMoscowMonthKey(now));
  const targets = buildSignMonthPrewarmTargets(targetMonthKey);
  const language = input.language || 'ru';
  const prewarmTarget = input.prewarmTarget || prewarmSignHoroscopeTarget;
  const workLimit = Math.max(0, Math.floor(input.workLimit ?? SIGN_MONTH_PREWARM_WORK_LIMIT));
  const result = {
    targetMonthKey,
    totalTargets: targets.length,
    scannedTargets: 0,
    workUsed: 0,
    cached: 0,
    generated: 0,
    inProgress: 0,
    failed: 0,
  };
  for (const target of targets) {
    if (result.workUsed >= workLimit) break;
    result.scannedTargets += 1;
    try {
      const status = await prewarmTarget(target, language);
      if (status === 'cached') {
        result.cached += 1;
        continue;
      }
      result.workUsed += 1;
      if (status === 'generated') result.generated += 1;
      else result.inProgress += 1;
    } catch {
      result.workUsed += 1;
      result.failed += 1;
    }
  }
  return result;
}

export async function prewarmUpcomingSignHoroscopes(now = new Date()): Promise<{
  targets: SignPrewarmTarget[];
  results: Array<{ period: SignHoroscopePeriod; periodKey: string; language: Language; status: string }>;
}> {
  const targets = getSignPrewarmTargets(now);
  const jobs = targets.flatMap((target) => (
    PREWARM_LANGUAGES.map((language) => ({ target, language }))
  ));
  const results: Array<{
    period: SignHoroscopePeriod;
    periodKey: string;
    language: Language;
    status: string;
  }> = new Array(jobs.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const index = cursor;
      cursor += 1;
      const { target, language } = jobs[index];
      try {
        results[index] = {
          period: target.period,
          periodKey: target.periodKey,
          language,
          status: await prewarmSignHoroscopeTarget(target, language),
        };
      } catch (error) {
        results[index] = {
          period: target.period,
          periodKey: target.periodKey,
          language,
          status: `failed:${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, jobs.length) }, () => worker()));
  const failures = results.filter((result) => result.status.startsWith('failed:'));
  if (failures.length > 0) {
    throw new Error(`SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE:${failures
      .map((failure) => `${failure.period}:${failure.periodKey}:${failure.language}`)
      .join(',')}`);
  }
  return { targets, results };
}
