import type {
  Language,
  SignHoroscopePeriod,
  SignHoroscopeReadingV2,
} from '../../types';
import { ZODIAC_KEYS, type ZodiacKey } from '../zodiacKeys';
import { generateSignHoroscopeBatch } from './signBatchGeneration';
import {
  getCachedSignHoroscope,
  storeSignHoroscopeBatch,
} from './signCache';
import {
  buildSignSkyBatchDigest,
  type SignSkyBatchDigest,
} from './signSkyDigest';

export type SignHoroscopeBatch = Record<ZodiacKey, SignHoroscopeReadingV2>;

export interface SignHoroscopeRuntime {
  readCached: (
    period: SignHoroscopePeriod,
    sign: ZodiacKey,
    periodKey: string,
    language: Language,
  ) => Promise<SignHoroscopeReadingV2 | null>;
  buildDigest: (period: SignHoroscopePeriod, periodKey: string) => SignSkyBatchDigest;
  generateBatch: (digest: SignSkyBatchDigest, language: Language) => Promise<SignHoroscopeBatch>;
  storeBatch: (
    period: SignHoroscopePeriod,
    periodKey: string,
    language: Language,
    readings: SignHoroscopeBatch,
  ) => Promise<void>;
}

const DEFAULT_RUNTIME: SignHoroscopeRuntime = {
  readCached: getCachedSignHoroscope,
  buildDigest: buildSignSkyBatchDigest,
  generateBatch: generateSignHoroscopeBatch,
  storeBatch: storeSignHoroscopeBatch,
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
  const batch = await runtime.generateBatch(digest, language);
  for (const expectedSign of ZODIAC_KEYS) {
    if (!batch[expectedSign]) throw new Error(`Generated sign batch is missing ${expectedSign}`);
  }

  // Shared content is ready only after all twelve readings are persisted.
  // Otherwise sequential requests could repeat a paid batch during a DB incident.
  await runtime.storeBatch(period, periodKey, language, batch);
  return batch[sign];
}

export async function generateAndStoreSignHoroscopeBatch(
  period: SignHoroscopePeriod,
  periodKey: string,
  language: Language,
  runtime: SignHoroscopeRuntime = DEFAULT_RUNTIME,
): Promise<SignHoroscopeBatch> {
  const digest = runtime.buildDigest(period, periodKey);
  const batch = await runtime.generateBatch(digest, language);
  await runtime.storeBatch(period, periodKey, language, batch);
  return batch;
}
