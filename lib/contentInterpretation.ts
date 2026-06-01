export const EMPTY_INTERPRETATION = 'EMPTY_INTERPRETATION' as const;
export const GENERATION_IN_PROGRESS = 'GENERATION_IN_PROGRESS' as const;

export type ContentLayerPayload<T = unknown> = {
  interpretation?: { content?: T } | null;
  code?: string;
  retryAfterMs?: number;
};

export function hasInterpretationContent<T>(payload: ContentLayerPayload<T> | null | undefined): payload is ContentLayerPayload<T> & {
  interpretation: { content: T };
} {
  const content = payload?.interpretation?.content;
  if (content == null) return false;
  if (typeof content === 'string') return content.trim().length > 0;
  if (typeof content === 'object') return Object.keys(content as object).length > 0;
  return true;
}

export function assertInterpretationContent<T>(
  payload: ContentLayerPayload<T> | null | undefined,
  label = 'content'
): T {
  if (payload?.code === GENERATION_IN_PROGRESS) {
    const err = new Error(`${label} is still generating`) as Error & {
      code?: string;
      status?: number;
      retryAfterMs?: number;
    };
    err.code = GENERATION_IN_PROGRESS;
    err.status = 202;
    err.retryAfterMs = Number(payload.retryAfterMs || 1500);
    throw err;
  }

  if (!hasInterpretationContent(payload)) {
    const err = new Error(`${label} is empty`) as Error & { code?: string; status?: number };
    err.code = EMPTY_INTERPRETATION;
    err.status = 502;
    throw err;
  }

  return payload.interpretation.content as T;
}

export function isGenerationInProgressError(error: unknown): boolean {
  const err = error as { code?: string; status?: number };
  return err?.code === GENERATION_IN_PROGRESS || err?.status === 202;
}

export function getRetryAfterMs(error: unknown, fallback = 1500): number {
  const err = error as { retryAfterMs?: number; details?: { retryAfterMs?: number } };
  const fromDetails = err?.details?.retryAfterMs;
  if (Number.isFinite(fromDetails)) return Number(fromDetails);
  if (Number.isFinite(err?.retryAfterMs)) return Number(err.retryAfterMs);
  return fallback;
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
