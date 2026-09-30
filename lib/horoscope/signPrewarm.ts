import type { Language, SignHoroscopePeriod } from '../../types';
import { withContentGenerationLock } from '../contentGenerationLock';
import { getMoscowIsoWeekKey, getMoscowMonthKey } from '../date-utils';
import { ZODIAC_KEYS } from '../zodiacKeys';
import { logForecastDeliveryMetric } from '../forecastDeliveryMetrics';
import { getCachedSignHoroscopes } from './signCache';
import { fillMissingSignHoroscopes } from './signOrchestrator';
import { buildSignHoroscopeLockKey } from './signGenerationLock';

export interface SignPrewarmTarget {
  period: SignHoroscopePeriod;
  periodKey: string;
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
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

/** Explicit monthly job. Ordinary cron and app requests never call this. */
export async function prewarmSignMonth(input: {
  targetMonthKey?: string;
  now?: Date;
  prewarmTarget?: typeof prewarmSignHoroscopeTarget;
} = {}): Promise<{
  targetMonthKey: string;
  totalTargets: number;
  scannedTargets: number;
  cached: number;
  generated: number;
  inProgress: number;
  failed: number;
}> {
  const targetMonthKey = input.targetMonthKey || nextMonthKey(getMoscowMonthKey(input.now || new Date()));
  const targets = buildSignMonthPrewarmTargets(targetMonthKey);
  const prewarmTarget = input.prewarmTarget || prewarmSignHoroscopeTarget;
  const result = {
    targetMonthKey,
    totalTargets: targets.length,
    scannedTargets: 0,
    cached: 0,
    generated: 0,
    inProgress: 0,
    failed: 0,
  };
  for (const target of targets) {
    result.scannedTargets += 1;
    try {
      const status = await prewarmTarget(target, 'ru');
      if (status === 'cached') result.cached += 1;
      else if (status === 'generated') result.generated += 1;
      else {
        result.inProgress += 1;
        break;
      }
    } catch (error) {
      result.failed += 1;
      console.warn('[sign-month-prewarm] target failed:', target.period, target.periodKey,
        error instanceof Error ? error.message : String(error));
      break;
    }
  }
  return result;
}
