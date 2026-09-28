import type { NatalQuestionSnapshot } from '../lib/natalReading/natalQuestion';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

const NATAL_QUESTION_GENERATION_TIMEOUT_MS = 90_000;

export type NatalQuestionServiceError = Error & {
  status?: number;
  code?: string;
  premiumAvailable?: boolean;
  retryAfterMs?: number;
};

async function readQuestionError(
  response: Response,
  fallback: string,
): Promise<NatalQuestionServiceError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(payload.message || payload.error || fallback) as NatalQuestionServiceError;
  error.status = response.status;
  error.code = payload.code || payload.error;
  error.premiumAvailable = payload.premiumRequired === true
    || payload.premiumAvailable === true;
  error.retryAfterMs = Number(payload.retryAfterMs) || undefined;
  return error;
}

function buildNatalQuestionsUrl(userId: string, chartId?: number): string {
  const params = new URLSearchParams({ userId });
  if (chartId != null) params.set('chartId', String(chartId));
  return `/api/content/natal/questions?${params.toString()}`;
}

export async function loadNatalQuestionSnapshot(
  userId: string,
  chartId?: number,
): Promise<NatalQuestionSnapshot> {
  const response = await apiFetch(buildNatalQuestionsUrl(userId, chartId), {
    method: 'GET',
    headers: getTelegramInitDataHeaders(),
    cache: 'no-store',
  });
  if (!response.ok) {
    throw await readQuestionError(response, `Failed (${response.status})`);
  }
  return response.json() as Promise<NatalQuestionSnapshot>;
}

export async function askNatalQuestion(
  userId: string,
  question: string,
  chartId?: number,
): Promise<NatalQuestionSnapshot> {
  const startedAt = Date.now();
  const response = await apiFetch(buildNatalQuestionsUrl(userId, chartId), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getTelegramInitDataHeaders(),
    },
    body: JSON.stringify({ userId, chartId, question }),
  }, NATAL_QUESTION_GENERATION_TIMEOUT_MS);

  if (response.status === 202) {
    const pending = await response.json().catch(() => ({}));
    let retryAfterMs = Math.max(
      250,
      Math.min(Number(pending.retryAfterMs) || 1000, 5000),
    );
    while (Date.now() - startedAt < NATAL_QUESTION_GENERATION_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      const current = await loadNatalQuestionSnapshot(userId, chartId);
      const target = [...current.messages].reverse().find((message) => (
        message.role === 'user'
        && message.text.trim().toLocaleLowerCase() === question.trim().toLocaleLowerCase()
      ));
      const answered = target && current.messages.some((message) => (
        message.role === 'assistant'
        && String(message.payload?.questionMessageId || '') === String(target.id)
      ));
      if (answered) return current;
      retryAfterMs = Math.min(Math.round(retryAfterMs * 1.35), 5000);
    }
    const error = new Error(
      'Question generation is still in progress',
    ) as NatalQuestionServiceError;
    error.code = 'CONTENT_GENERATION_TIMEOUT';
    error.status = 504;
    error.retryAfterMs = retryAfterMs;
    throw error;
  }

  if (!response.ok) {
    throw await readQuestionError(response, `Failed (${response.status})`);
  }
  return response.json() as Promise<NatalQuestionSnapshot>;
}
