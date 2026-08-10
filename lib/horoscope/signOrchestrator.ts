import type {
  Language,
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
} from '../../types';
import type { ZodiacKey } from '../zodiacKeys';
import { generateSignHoroscope } from './signGeneration';
import { getCachedSignHoroscope, storeSignHoroscope } from './signCache';
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
  buildDigest: (period: SignHoroscopePeriod, periodKey: string) => SignSkyBatchDigest;
  generate: (
    digest: SignSkyBatchDigest,
    sign: ZodiacKey,
    language: Language,
  ) => Promise<SignHoroscopeReadingV2>;
  store: (
    period: SignHoroscopePeriod,
    periodKey: string,
    language: Language,
    reading: SignHoroscopeReadingV2,
  ) => Promise<void>;
}

const DEFAULT_RUNTIME: SignHoroscopeRuntime = {
  readCached: getCachedSignHoroscope,
  buildDigest: readOrBuildDigest,
  generate: generateSignHoroscope,
  store: storeSignHoroscope,
};

export async function getOrGenerateSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
  runtime: SignHoroscopeRuntime = DEFAULT_RUNTIME,
): Promise<SignHoroscopeReadingV2> {
  const cached = await runtime.readCached(period, sign, periodKey, language);
  if (cached) return cached;

  const digest = runtime.buildDigest(period, periodKey);
  const reading = await runtime.generate(digest, sign, language);
  await runtime.store(period, periodKey, language, reading);
  return reading;
}

export async function generateAndStoreSignHoroscope(
  period: SignHoroscopePeriod,
  sign: ZodiacKey,
  periodKey: string,
  language: Language,
  runtime: SignHoroscopeRuntime = DEFAULT_RUNTIME,
): Promise<SignHoroscopeReadingV2> {
  const digest = runtime.buildDigest(period, periodKey);
  const reading = await runtime.generate(digest, sign, language);
  await runtime.store(period, periodKey, language, reading);
  return reading;
}
