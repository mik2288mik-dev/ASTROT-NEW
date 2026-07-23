import type { ForecastDailyReading } from '../../types';

export type SignPeriodGenerationErrorCode =
  | 'SIGN_WEEKLY_GENERATION_FAILED'
  | 'SIGN_MONTHLY_GENERATION_FAILED'
  | 'SIGN_YEARLY_GENERATION_FAILED';

export class SignPeriodGenerationError extends Error {
  readonly code: SignPeriodGenerationErrorCode;

  constructor(code: SignPeriodGenerationErrorCode, cause?: unknown) {
    super(code);
    this.name = 'SignPeriodGenerationError';
    this.code = code;
    if (cause !== undefined) (this as Error & { cause?: unknown }).cause = cause;
  }
}

export function isSignPeriodGenerationError(error: unknown): error is SignPeriodGenerationError {
  return error instanceof SignPeriodGenerationError;
}

export function normalizeSignPeriodReading(
  raw: Partial<ForecastDailyReading>,
  periodKey: string,
  errorCode: SignPeriodGenerationErrorCode,
  options?: { context?: string; maxAdvice?: number }
): ForecastDailyReading {
  const clean = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const required = {
    headline: clean(raw.headline),
    summary: clean(raw.summary),
    reading: clean(raw.reading),
    focus: clean(raw.focus),
    chance: clean(raw.chance),
    risk: clean(raw.risk),
    context: clean(options?.context ?? raw.context),
  };
  if (Object.values(required).some((value) => !value)) {
    throw new SignPeriodGenerationError(errorCode);
  }

  const advice = Array.isArray(raw.advice)
    ? [...new Set(raw.advice.map(clean).filter(Boolean))].slice(0, options?.maxAdvice ?? 3)
    : [];
  if (!advice.length) throw new SignPeriodGenerationError(errorCode);

  return {
    date: periodKey,
    ...required,
    advice,
  };
}
