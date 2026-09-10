import type {
  Language,
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
} from '../../types';
import { ZODIAC_KEYS, type ZodiacKey } from '../zodiacKeys';
import { logForecastDeliveryMetric } from '../forecastDeliveryMetrics';
import {
  generateSignHoroscopeBatch,
  SignHoroscopeGenerationError,
  type SignHoroscopeBatchFailure,
  type SignHoroscopeBatchGenerationResult,
} from './signGeneration';
import { getCachedSignHoroscope, getCachedSignHoroscopes, storeSignHoroscope } from './signCache';
import { buildSignSkyBatchDigest, type SignSkyBatchDigest } from './signSkyDigest';

const digestCache = new Map<string, SignSkyBatchDigest>();

function readOrBuildDigest(period: SignHoroscopePeriod, periodKey: string): SignSkyBatchDigest {
  const key = `${period}:${periodKey}`;
  const cached = digestCache.get(key);
  if (cached) return cached;
  const digest = buildSignSkyBatchDigest(period, periodKey);
  digestCache.set(key, digest);
  while (digestCache.size > 12) {
    const oldest = digestCache.keys().next().value as string | undefined;
    if (!oldest) break;
    digestCache.delete(oldest);
  }
  return digest;
}

export interface SignHoroscopeRuntime {
  readCached: (
    period: SignHoroscopePeriod,
    sign: ZodiacKey,
    periodKey: string,
    language: Language,
  ) => Promise<SignHoroscopeReadingV2 | null>;
  readCachedBatch: (
    period: SignHoroscopePeriod,
    periodKey: string,
    language: Language,
    signs: readonly ZodiacKey[],
  ) => Promise<Partial<Record<ZodiacKey, SignHoroscopeReadingV2>>>;
  buildDigest: (period: SignHoroscopePeriod, periodKey: string) => SignSkyBatchDigest;
  generate: (
    digest: SignSkyBatchDigest,
    signs: readonly ZodiacKey[],
    language: Language,
  ) => Promise<SignHoroscopeBatchGenerationResult>;
  store: (
    period: SignHoroscopePeriod,
    periodKey: string,
    language: Language,
    reading: SignHoroscopeReadingV2,
  ) => Promise<void>;
}

export type SignHoroscopeFillResult = {
  readings: Partial<Record<ZodiacKey, SignHoroscopeReadingV2>>;
  cachedSigns: ZodiacKey[];
  generatedSigns: ZodiacKey[];
  failures: SignHoroscopeBatchFailure[];
};

const DEFAULT_RUNTIME: SignHoroscopeRuntime = {
  readCached: getCachedSignHoroscope,
  readCachedBatch: getCachedSignHoroscopes,
  buildDigest: readOrBuildDigest,
  generate: generateSignHoroscopeBatch,
  store: storeSignHoroscope,
};

export async function fillMissingSignHoroscopes(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  runtime: SignHoroscopeRuntime = DEFAULT_RUNTIME,
): Promise<SignHoroscopeFillResult> {
  const readings = await runtime.readCachedBatch(period, periodKey, language, ZODIAC_KEYS);
  const cachedSigns = ZODIAC_KEYS.filter((sign) => !!readings[sign]);

  const missingSigns = ZODIAC_KEYS.filter((sign) => !readings[sign]);
  if (missingSigns.length === 0) {
    return { readings, cachedSigns, generatedSigns: [], failures: [] };
  }

  const digest = runtime.buildDigest(period, periodKey);
  const generated = await runtime.generate(digest, missingSigns, language);
  logForecastDeliveryMetric({
    domain: 'sign',
    outcome: 'generated',
    period,
    periodKey,
    language,
    signBatchGenerationCount: 1,
  });
  const failures: SignHoroscopeBatchFailure[] = [...generated.failures];
  const failedSigns = new Set(failures.map((failure) => failure.sign));
  const generatedBySign = new Map(
    generated.readings.map((reading) => [reading.sign as ZodiacKey, reading]),
  );

  missingSigns.forEach((sign) => {
    if (!generatedBySign.has(sign) && !failedSigns.has(sign)) {
      failures.push({ sign, issues: ['model response omitted the requested sign'] });
      failedSigns.add(sign);
    }
  });

  const storeResults = await Promise.allSettled(generated.readings.map(async (reading) => {
    await runtime.store(period, periodKey, language, reading);
    return reading;
  }));
  const generatedSigns: ZodiacKey[] = [];
  storeResults.forEach((result, index) => {
    const attempted = generated.readings[index];
    const sign = attempted.sign as ZodiacKey;
    if (result.status === 'fulfilled') {
      readings[sign] = result.value;
      generatedSigns.push(sign);
      return;
    }
    failures.push({
      sign,
      issues: [result.reason instanceof Error ? result.reason.message : String(result.reason)],
    });
  });

  return { readings, cachedSigns, generatedSigns, failures };
}

export async function getOrGenerateSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
  runtime: SignHoroscopeRuntime = DEFAULT_RUNTIME,
): Promise<SignHoroscopeReadingV2> {
  const cached = await runtime.readCached(period, sign, periodKey, language);
  if (cached) return cached;

  const filled = await fillMissingSignHoroscopes(period, periodKey, language, runtime);
  const reading = filled.readings[sign];
  if (reading) return reading;

  const failure = filled.failures.find((item) => item.sign === sign);
  throw new SignHoroscopeGenerationError(
    'SIGN_HOROSCOPE_VALIDATION_FAILED',
    `Sign horoscope is still missing for ${sign}`,
    failure?.issues || ['requested sign was not generated'],
  );
}
