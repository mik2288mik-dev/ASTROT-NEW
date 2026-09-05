jest.mock('../services/nativeRuntime', () => ({
  isNativeAppRuntime: () => false,
  isNativeAndroidRuntime: () => false,
}));
jest.mock('../services/sessionService', () => ({ getTelegramInitDataHeaders: () => ({}) }));
jest.mock('../services/nativeSessionStore', () => ({ nativeSessionStore: {} }));
jest.mock('../services/apiClient', () => {
  const actual = jest.requireActual('../services/apiClient');
  return { ...actual, apiFetch: jest.fn(actual.apiFetch) };
});

import type { UserProfile } from '../types';
import { apiFetch } from '../services/apiClient';
import { calculateExtendedSynastry } from '../services/astrologyService';
import { calculateCompatibility } from '../lib/synastry/compatibilityEngine';
import { buildCompatibilityResult, selectCompatibilityWriterEvidence } from '../lib/synastry/compatibilityNarrative';
import { canonicalNatalChart } from './fixtures/canonicalNatalChart';
import { compatibilityStory } from './fixtures/compatibilityStory';

const originalFetch = globalThis.fetch;
const profile = { id: 'delivery-owner', name: 'Анна', language: 'ru' } as UserProfile;
const calculated = calculateCompatibility({
  subjectChart: canonicalNatalChart(), partnerChart: canonicalNatalChart(),
  calculationLevel: 'full', relationshipContext: 'romance', language: 'ru',
});
const story = buildCompatibilityResult(calculated, compatibilityStory(selectCompatibilityWriterEvidence(calculated)));
const payload = { result: story, fromCache: false, subjectChartId: 1, partnerChartId: 2, calculationLevel: 'full' };

function requestReading() {
  return calculateExtendedSynastry(profile, 'Максим', '1990-08-22', undefined, undefined, 'романтика', 2, 1);
}

describe('extended compatibility client delivery budget', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('passes a 90-second budget to the real transport and delivers a story completed after 45 seconds', async () => {
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      return new Promise<Response>((resolve, reject) => {
        const delivery = setTimeout(() => resolve(new Response(JSON.stringify(payload), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        })), 45_000);
        signal?.addEventListener('abort', () => {
          clearTimeout(delivery);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        }, { once: true });
      });
    }) as typeof fetch;
    let settled = false;
    const outcome = requestReading().then(
      (value) => { settled = true; return { value }; },
      (error) => { settled = true; return { error }; },
    );
    await jest.advanceTimersByTimeAsync(0);
    expect(apiFetch).toHaveBeenCalledWith('/api/content/synastry/extended', expect.objectContaining({ method: 'POST' }), 90_000);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(settled).toBe(false);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(outcome).resolves.toMatchObject({ value: payload });
    expect(story.closing).toBeUndefined();
    expect(story.sections).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(50_000);
    expect(signal?.aborted).toBe(false);
  });

  it('still aborts an unresponsive comparison after the full 90-second budget', async () => {
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
      });
    }) as typeof fetch;
    const outcome = requestReading().catch((error) => error);
    await jest.advanceTimersByTimeAsync(89_999);
    expect(signal?.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await expect(outcome).resolves.toMatchObject({ name: 'AbortError' });
    expect(signal?.aborted).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
