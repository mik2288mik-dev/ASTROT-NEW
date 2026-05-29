/**
 * Privacy-safe structured logger for server-side observability.
 * No external dependencies; compatible with console-based runtimes.
 */

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export type LogEvent = {
  scope?: string;
  event?: string;
  userId?: string;
  chartId?: number | null;
  surface?: string;
  variant?: string;
  accessTier?: string;
  source?: string;
  calculationVersion?: string;
  durationMs?: number;
  status?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};

const SENSITIVE_KEYS = new Set([
  'question',
  'normalizedquestion',
  'answer',
  'message',
  'birthdate',
  'birthtime',
  'birthplace',
  'chartcontext',
  'personalizationcontext',
  'partnerbirthdate',
  'partnerbirthtime',
  'partnerbirthplace',
  'partnername',
  'partnerdata',
  'fullanalysis',
  'recentquestions',
  'relationshipcontext',
  'profile',
  'chartdata',
  'content',
  'history',
]);

const ALLOWED_FLAG_KEYS = new Set([
  'hasbirthdate',
  'hasbirthtime',
  'hasbirthplace',
  'haschart',
  'hastodaypulse',
  'hascheckins',
  'hasrecentquestions',
  'hasrelationshipcontext',
  'birthtimequality',
  'chartquality',
  'source',
  'calculationversion',
  'questionlength',
  'counts',
  'date',
  'time',
  'datekey',
  'pointcount',
  'approximatefallbackallowed',
  'nodeenv',
  'blocks',
  'tier',
  'requestedtier',
  'resolvedtier',
  'modeltier',
  'lumispent',
  'reusedrecent',
  'error',
  'code',
  'sunsign',
  'moonsign',
  'moonphase',
  'swisseph',
  'algorithmic',
  'mixed',
  'unavailable',
]);

function normalizeKey(key: string) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    if (value.length > 200) return `[string:${value.length}]`;
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeKey(key);
      if (SENSITIVE_KEYS.has(normalized)) {
        result[key] = '[redacted]';
        continue;
      }
      if (depth > 0 && !ALLOWED_FLAG_KEYS.has(normalized)) {
        result[key] = '[redacted]';
        continue;
      }
      result[key] = sanitizeValue(nested, depth + 1);
    }
    return result;
  }
  return String(value);
}

export function sanitizeLogEvent(payload: LogEvent): LogEvent {
  const sanitized: LogEvent = { ...payload };
  if (payload.metadata) {
    sanitized.metadata = sanitizeValue(payload.metadata, 0) as Record<string, unknown>;
  }
  return sanitized;
}

function emit(level: LogLevel, payload: LogEvent) {
  const entry = {
    level,
    ts: new Date().toISOString(),
    ...sanitizeLogEvent(payload),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  if (level === 'debug') {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info: (payload: LogEvent) => emit('info', payload),
  warn: (payload: LogEvent) => emit('warn', payload),
  error: (payload: LogEvent) => emit('error', payload),
  debug: (payload: LogEvent) => emit('debug', payload),
};

export type PersonalizationPrivacyFlags = {
  hasBirthDate: boolean;
  hasBirthTime: boolean;
  hasBirthPlace: boolean;
  hasChart: boolean;
  hasTodayPulse: boolean;
  hasCheckIns: boolean;
  hasRecentQuestions: boolean;
  hasRelationshipContext: boolean;
  birthTimeQuality?: string;
  chartQuality?: unknown;
  source?: string;
  calculationVersion?: string;
};

export function extractPersonalizationPrivacyFlags(context: {
  user?: { birthDate?: string; birthTime?: string; birthPlace?: string };
  chartData?: unknown | null;
  chartQuality?: { birthTimeQuality?: string };
  todayPulse?: { source?: string; calculationVersion?: string } | null;
  recentCheckIns?: unknown[];
  recentQuestions?: unknown[];
  relationshipContext?: unknown[];
} | null | undefined): PersonalizationPrivacyFlags {
  if (!context) {
    return {
      hasBirthDate: false,
      hasBirthTime: false,
      hasBirthPlace: false,
      hasChart: false,
      hasTodayPulse: false,
      hasCheckIns: false,
      hasRecentQuestions: false,
      hasRelationshipContext: false,
    };
  }

  return {
    hasBirthDate: !!String(context.user?.birthDate || '').trim(),
    hasBirthTime: !!String(context.user?.birthTime || '').trim(),
    hasBirthPlace: !!String(context.user?.birthPlace || '').trim(),
    hasChart: !!context.chartData,
    hasTodayPulse: !!context.todayPulse,
    hasCheckIns: (context.recentCheckIns?.length || 0) > 0,
    hasRecentQuestions: (context.recentQuestions?.length || 0) > 0,
    hasRelationshipContext: (context.relationshipContext?.length || 0) > 0,
    birthTimeQuality: context.chartQuality?.birthTimeQuality,
    chartQuality: context.chartQuality,
    source: context.todayPulse?.source,
    calculationVersion: context.todayPulse?.calculationVersion,
  };
}
