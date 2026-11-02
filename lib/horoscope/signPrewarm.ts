import type { Language, SignHoroscopePeriod } from '../../types';
import { withContentGenerationLock } from '../contentGenerationLock';
import { getMoscowIsoWeekKey, getMoscowMonthKey, getMoscowTodayKey } from '../date-utils';
import { ZODIAC_KEYS } from '../zodiacKeys';
import { logForecastDeliveryMetric } from '../forecastDeliveryMetrics';
import { getCachedSignHoroscopes } from './signCache';
import { fillMissingSignHoroscopes } from './signOrchestrator';
import { SignHoroscopeGenerationError, type SignHoroscopeBatchFailure } from './signGeneration';
import { buildSignHoroscopeLockKey } from './signGenerationLock';
import { recordTechnicalError } from '../errorLogger';

export interface SignPrewarmTarget {
  period: SignHoroscopePeriod;
  periodKey: string;
}

const MONTH_TARGET_ATTEMPTS = 3;
const MONTH_TARGET_RETRY_DELAY_MS = 10_000;
const MAX_CONSECUTIVE_INCOMPLETE_TARGETS = 3;

const SAFE_FAILURE_KINDS = new Set<string>([
  'invalid_response', 'missing_sign', 'duplicate_sign', 'invalid_reading', 'provider_error', 'storage_error',
]);

class SignHoroscopePartialFailure extends Error {
  readonly safeDetail: string;

  constructor(failures: readonly SignHoroscopeBatchFailure[]) {
    const details = failures.map(({ sign, kind }) => {
      const safeSign = ZODIAC_KEYS.find((candidate) => candidate === sign) || 'unknown';
      const safeKind = typeof kind === 'string' && SAFE_FAILURE_KINDS.has(kind) ? kind : 'unknown';
      return `${safeSign}=${safeKind}`;
    }).join(',');
    const safeDetail = `SIGN_HOROSCOPE_PREWARM_PARTIAL_FAILURE:${details}`;
    super(safeDetail);
    this.safeDetail = safeDetail;
  }
}

function safePrewarmFailure(error: unknown): string {
  if (error instanceof SignHoroscopePartialFailure) return error.safeDetail;
  if (error instanceof SignHoroscopeGenerationError && [
    'SIGN_HOROSCOPE_GENERATION_UNAVAILABLE', 'SIGN_HOROSCOPE_GENERATION_FAILED', 'SIGN_HOROSCOPE_VALIDATION_FAILED',
  ].includes(error.code)) return error.code;
  return 'SIGN_HOROSCOPE_PREWARM_ERROR';
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
          throw new SignHoroscopePartialFailure(filled.failures);
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
    const errorCode = safePrewarmFailure(error).split(':', 1)[0];
    logForecastDeliveryMetric({ domain: 'sign', outcome: 'failed', period: target.period, periodKey: target.periodKey, language, errorCode });
    throw error;
  }
}

/** Explicit monthly job. Ordinary cron and app requests never call this. */
export async function prewarmSignMonth(input: {
  targetMonthKey?: string;
  now?: Date;
  prewarmTarget?: typeof prewarmSignHoroscopeTarget;
  wait?: (ms: number) => Promise<void>;
} = {}): Promise<{
  targetMonthKey: string;
  totalTargets: number;
  scannedTargets: number;
  cached: number;
  generated: number;
  inProgress: number;
  failed: number;
}> {
  const now = input.now || new Date();
  const targetMonthKey = input.targetMonthKey || nextMonthKey(getMoscowMonthKey(now));
  const targets = buildSignMonthPrewarmTargets(targetMonthKey);
  // During catch-up, serve the current day, week and month before later dates.
  const todayKey = getMoscowTodayKey(now);
  const todayIndex = targets.findIndex((target) => target.period === 'day' && target.periodKey === todayKey);
  if (todayIndex >= 0) {
    const priorities: SignPrewarmTarget[] = [
      { period: 'day', periodKey: todayKey },
      { period: 'week', periodKey: getMoscowIsoWeekKey(now) },
      { period: 'month', periodKey: targetMonthKey },
    ];
    for (const priority of priorities.reverse()) {
      const index = targets.findIndex((target) => target.period === priority.period && target.periodKey === priority.periodKey);
      if (index >= 0) targets.unshift(...targets.splice(index, 1));
    }
  }
  const prewarmTarget = input.prewarmTarget || prewarmSignHoroscopeTarget;
  const wait = input.wait || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const result = {
    targetMonthKey,
    totalTargets: targets.length,
    scannedTargets: 0,
    cached: 0,
    generated: 0,
    inProgress: 0,
    failed: 0,
  };
  let consecutiveIncomplete = 0;
  for (const target of targets) {
    result.scannedTargets += 1;
    let status: 'cached' | 'generated' | 'in_progress' | undefined;
    let lastError: unknown;
    let didFail = false;
    for (let attempt = 1; attempt <= MONTH_TARGET_ATTEMPTS; attempt += 1) {
      try {
        status = await prewarmTarget(target, 'ru');
        didFail = false;
      } catch (error) {
        status = undefined;
        lastError = error;
        didFail = true;
      }
      if (status === 'cached' || status === 'generated') break;
      if (attempt < MONTH_TARGET_ATTEMPTS) await wait(MONTH_TARGET_RETRY_DELAY_MS);
    }
    if (status === 'cached') {
      result.cached += 1;
      consecutiveIncomplete = 0;
    } else if (status === 'generated') {
      result.generated += 1;
      consecutiveIncomplete = 0;
    }
    else if (status === 'in_progress') {
      result.inProgress += 1;
      void recordTechnicalError({
        endpoint: 'job:sign-month',
        errorCode: 'SIGN_MONTH_TARGET_BUSY',
        message: `${target.period} ${target.periodKey} remained in progress; month ${targetMonthKey} is incomplete`,
      });
      consecutiveIncomplete += 1;
    } else if (didFail) {
      result.failed += 1;
      const safeFailure = safePrewarmFailure(lastError);
      console.warn('[sign-month-prewarm] target failed:', target.period, target.periodKey,
        safeFailure);
      // Visible in admin «Ошибки», even when later dates are generated successfully.
      void recordTechnicalError({
        endpoint: 'job:sign-month',
        errorCode: 'SIGN_MONTH_TARGET_FAILED',
        message: `${target.period} ${target.periodKey} failed for month ${targetMonthKey}: ${safeFailure}`,
      });
      consecutiveIncomplete += 1;
    }
    // Do not hammer the provider for the entire month during a sustained outage.
    if (consecutiveIncomplete >= MAX_CONSECUTIVE_INCOMPLETE_TARGETS) break;
  }
  return result;
}
