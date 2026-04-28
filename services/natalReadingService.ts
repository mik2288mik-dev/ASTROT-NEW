import type {
  NatalReadingAspects,
  NatalReadingDeepDive,
  NatalReadingDeepDiveKey,
  NatalReadingPortrait,
  NatalReadingToday,
  NatalReadingWeek,
} from '../lib/natalReading/types';
import type {
  ContentAccessTier,
  InterpretationSection,
  NatalInterpretationReport,
} from '../types';
import type {
  HumanDailySectionKey,
  HumanPaidSectionKey,
} from '../lib/natalHumanShared';

type Endpoint = 'portrait' | 'aspects' | 'week' | 'today' | 'dive';

function buildUrl(endpoint: Endpoint, userId: string, chartId?: number, topic?: string): string {
  const params = new URLSearchParams({ userId });
  if (chartId) params.set('chartId', String(chartId));
  if (topic) params.set('topic', topic);
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

async function fetchOrGenerate<T>(
  endpoint: Endpoint,
  userId: string,
  chartId?: number,
  topic?: string
): Promise<T> {
  const url = buildUrl(endpoint, userId, chartId, topic);
  const tryGet = await fetch(url, { method: 'GET' });
  if (tryGet.ok) {
    const j = await tryGet.json();
    return j.interpretation.content as T;
  }
  if (tryGet.status === 403) {
    const err = await tryGet.json().catch(() => ({}));
    throw new Error(err?.error || 'PREMIUM_REQUIRED');
  }
  // Trigger generation via POST
  const post = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, chartId, topic }),
  });
  if (!post.ok) {
    const err = await post.json().catch(() => ({}));
    throw new Error(err?.error || `Failed (${post.status})`);
  }
  const j = await post.json();
  return j.interpretation.content as T;
}

export function loadPortrait(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingPortrait>('portrait', userId, chartId);
}

export function loadAspects(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingAspects>('aspects', userId, chartId);
}

export function loadWeek(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingWeek>('week', userId, chartId);
}

export function loadToday(userId: string, chartId?: number) {
  return fetchOrGenerate<NatalReadingToday>('today', userId, chartId);
}

export function loadDeepDive(
  userId: string,
  topic: NatalReadingDeepDiveKey,
  chartId?: number
) {
  return fetchOrGenerate<NatalReadingDeepDive>('dive', userId, chartId, topic);
}

type HumanEndpoint = 'human-base' | 'human-section' | 'human-daily';

export type HumanReadingResult<T> = {
  content: T;
  lumiBalance?: number;
  accessTier?: ContentAccessTier;
};

export type HumanReadingError = Error & {
  status?: number;
  code?: string;
  lumiCost?: number;
  lumiBalance?: number;
};

function buildHumanUrl(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
  }
) {
  const params = new URLSearchParams({ userId });
  if (options?.chartId) params.set('chartId', String(options.chartId));
  if (options?.sectionKey) params.set('sectionKey', options.sectionKey);
  if (options?.date) params.set('date', options.date);
  return `/api/content/natal/${endpoint}?${params.toString()}`;
}

async function readHumanError(response: Response, fallback: string): Promise<HumanReadingError> {
  const payload = await response.json().catch(() => ({}));
  const err = new Error(payload.message || payload.error || fallback) as HumanReadingError;
  err.status = response.status;
  err.code = payload.code;
  err.lumiCost = typeof payload.lumiCost === 'number' ? payload.lumiCost : undefined;
  err.lumiBalance = typeof payload.lumiBalance === 'number' ? payload.lumiBalance : undefined;
  return err;
}

async function postHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
    accessTier?: 'premium' | 'lumi';
    allowLumiSpend?: boolean;
  }
): Promise<HumanReadingResult<T>> {
  const response = await fetch(buildHumanUrl(endpoint, userId, options), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      chartId: options?.chartId,
      sectionKey: options?.sectionKey,
      date: options?.date,
      accessTier: options?.accessTier,
      allowLumiSpend: !!options?.allowLumiSpend,
    }),
  });

  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    content: payload.interpretation?.content as T,
    lumiBalance: typeof payload.lumiBalance === 'number' ? payload.lumiBalance : undefined,
    accessTier: payload.accessTier,
  };
}

async function getHuman<T>(
  endpoint: HumanEndpoint,
  userId: string,
  options?: {
    chartId?: number;
    sectionKey?: HumanPaidSectionKey | HumanDailySectionKey;
    date?: string;
  }
): Promise<HumanReadingResult<T> | null> {
  const response = await fetch(buildHumanUrl(endpoint, userId, options), {
    method: 'GET',
    cache: 'no-store',
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw await readHumanError(response, `Failed (${response.status})`);
  }

  const payload = await response.json();
  return {
    content: payload.interpretation?.content as T,
    lumiBalance: typeof payload.lumiBalance === 'number' ? payload.lumiBalance : undefined,
    accessTier: payload.accessTier,
  };
}

export async function loadHumanBaseReport(
  userId: string,
  chartId?: number
): Promise<NatalInterpretationReport> {
  const cached = await getHuman<NatalInterpretationReport>('human-base', userId, { chartId });
  if (cached?.content) return cached.content;
  const generated = await postHuman<NatalInterpretationReport>('human-base', userId, { chartId });
  return generated.content;
}

export async function loadHumanPaidSection(
  userId: string,
  sectionKey: HumanPaidSectionKey,
  chartId?: number,
  options?: {
    accessTier?: 'premium' | 'lumi';
    allowLumiSpend?: boolean;
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  if (options?.allowLumiSpend) {
    return postHuman<InterpretationSection>('human-section', userId, {
      chartId,
      sectionKey,
      accessTier: 'lumi',
      allowLumiSpend: true,
    });
  }

  const cached = await getHuman<InterpretationSection>('human-section', userId, { chartId, sectionKey });
  if (cached?.content) return cached;

  return postHuman<InterpretationSection>('human-section', userId, {
    chartId,
    sectionKey,
    accessTier: options?.accessTier,
  });
}

export async function loadHumanDailySection(
  userId: string,
  sectionKey: HumanDailySectionKey,
  chartId?: number,
  date?: string,
  options?: {
    accessTier?: 'premium' | 'lumi';
    allowLumiSpend?: boolean;
  }
): Promise<HumanReadingResult<InterpretationSection>> {
  if (options?.allowLumiSpend) {
    return postHuman<InterpretationSection>('human-daily', userId, {
      chartId,
      sectionKey,
      date,
      accessTier: 'lumi',
      allowLumiSpend: true,
    });
  }

  const cached = await getHuman<InterpretationSection>('human-daily', userId, { chartId, sectionKey, date });
  if (cached?.content) return cached;
  return postHuman<InterpretationSection>('human-daily', userId, {
    chartId,
    sectionKey,
    date,
    accessTier: options?.accessTier,
  });
}
