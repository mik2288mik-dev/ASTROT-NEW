import type { UserProfile } from '../types';
import type {
  LocalizedPersonalForecastQuestion,
  PersonalForecastQuestionPeriod,
} from '../lib/personalForecastQuestionCatalog';
import type {
  PersonalForecastQuestionUsage,
} from '../lib/personalForecastQuestionStore';
import { APP_VOICE_VERSION } from '../lib/appVoice';
import { PERSONAL_FORECAST_PROMPT_VERSION } from '../lib/personalForecastContract';
import { apiFetch } from './apiClient';
import { getTelegramInitDataHeaders } from './sessionService';

export type PersonalForecastQuestionClientStatus =
  | 'pending'
  | 'approved'
  | 'answered'
  | 'rejected';

export type PersonalForecastQuestionClientRecord = {
  id: number;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  language: 'ru' | 'en';
  source: 'catalog' | 'custom';
  catalogQuestionId: string | null;
  question: string;
  status: PersonalForecastQuestionClientStatus;
  isGenerating: boolean;
  moderationReason: string | null;
  suggestions: LocalizedPersonalForecastQuestion[];
  answer: string | null;
  answerMeta: Record<string, unknown> | null;
  answeredAt: string | null;
  canRetry: boolean;
  notificationUnread: boolean;
  notification: Record<string, unknown> | null;
  createdAt: string;
};

export type PersonalForecastQuestionNotification = {
  questionId: number;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
  question: string;
  payload: Record<string, unknown> | null;
  answeredAt: string | null;
};

export type PersonalForecastQuestionSnapshot = {
  catalog: LocalizedPersonalForecastQuestion[];
  questions: PersonalForecastQuestionClientRecord[];
  usage: PersonalForecastQuestionUsage;
  unreadNotifications: PersonalForecastQuestionNotification[];
  question?: PersonalForecastQuestionClientRecord;
  moderation?: {
    status: 'approved' | 'pending' | 'rejected';
    reason: string;
    normalizedQuestion: string;
    matchedApprovedQuestionId: string | null;
    suggestions: LocalizedPersonalForecastQuestion[];
  };
};

export type PersonalForecastQuestionClientError = Error & {
  status?: number;
  code?: string;
  usage?: PersonalForecastQuestionUsage;
};

type QuestionContext = {
  profile: UserProfile;
  chartId?: number | null;
  chartFingerprint: string;
  period: PersonalForecastQuestionPeriod;
  periodKey: string;
};

const inFlight = new Map<string, Promise<PersonalForecastQuestionSnapshot>>();

function profileId(profile: UserProfile): string {
  return String(profile.id || '').trim();
}

function requestContextKey(input: QuestionContext): string {
  return JSON.stringify([
    profileId(input.profile),
    input.chartId ?? 'primary',
    input.chartFingerprint,
    input.period,
    input.periodKey,
    input.profile.language === 'en' ? 'en' : 'ru',
    PERSONAL_FORECAST_PROMPT_VERSION,
    APP_VOICE_VERSION,
  ]);
}

function endpoint(input: QuestionContext): string {
  const params = new URLSearchParams({
    userId: profileId(input.profile),
    period: input.period,
    periodKey: input.periodKey,
  });
  if (input.chartId != null) params.set('chartId', String(input.chartId));
  return `/api/content/forecast/questions?${params.toString()}`;
}

async function parseQuestionError(
  response: Response,
): Promise<PersonalForecastQuestionClientError> {
  const payload = await response.json().catch(() => ({}));
  const error = new Error(
    payload?.message
      || payload?.error
      || `Personal forecast question failed (${response.status})`,
  ) as PersonalForecastQuestionClientError;
  error.status = response.status;
  error.code = payload?.code;
  error.usage = payload?.usage;
  return error;
}

async function requestSnapshot(
  input: QuestionContext,
  body?: Record<string, unknown>,
): Promise<PersonalForecastQuestionSnapshot> {
  const response = body
    ? await apiFetch('/api/content/forecast/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getTelegramInitDataHeaders(),
        },
        body: JSON.stringify({
          userId: profileId(input.profile),
          chartId: input.chartId,
          period: input.period,
          periodKey: input.periodKey,
          ...body,
        }),
      })
    : await apiFetch(endpoint(input), {
        method: 'GET',
        headers: getTelegramInitDataHeaders(),
      });
  if (!response.ok && response.status !== 202) {
    throw await parseQuestionError(response);
  }
  return response.json() as Promise<PersonalForecastQuestionSnapshot>;
}

function deduped(
  key: string,
  operation: () => Promise<PersonalForecastQuestionSnapshot>,
): Promise<PersonalForecastQuestionSnapshot> {
  const current = inFlight.get(key);
  if (current) return current;
  const request = operation().finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });
  inFlight.set(key, request);
  return request;
}

export function loadPersonalForecastQuestions(
  input: QuestionContext,
): Promise<PersonalForecastQuestionSnapshot> {
  return deduped(
    `get:${requestContextKey(input)}`,
    () => requestSnapshot(input),
  );
}

export function answerApprovedPersonalForecastQuestion(
  input: QuestionContext & { questionId: string },
): Promise<PersonalForecastQuestionSnapshot> {
  return deduped(
    `catalog:${requestContextKey(input)}:${JSON.stringify(input.questionId)}`,
    () => requestSnapshot(input, {
      action: 'answer_catalog',
      questionId: input.questionId,
    }),
  );
}

export function submitCustomPersonalForecastQuestion(
  input: QuestionContext & { question: string },
): Promise<PersonalForecastQuestionSnapshot> {
  const normalized = input.question.normalize('NFKC').trim().toLocaleLowerCase();
  return deduped(
    `custom:${requestContextKey(input)}:${JSON.stringify(normalized)}`,
    () => requestSnapshot(input, {
      action: 'submit_custom',
      question: input.question,
    }),
  );
}

export function retryPersonalForecastQuestion(
  input: QuestionContext & { questionRecordId: number },
): Promise<PersonalForecastQuestionSnapshot> {
  return deduped(
    `retry:${requestContextKey(input)}:${input.questionRecordId}`,
    () => requestSnapshot(input, {
      action: 'retry',
      questionRecordId: input.questionRecordId,
    }),
  );
}

export function markPersonalForecastQuestionAnswerRead(
  input: QuestionContext & { questionRecordId: number },
): Promise<PersonalForecastQuestionSnapshot> {
  return deduped(
    `read:${requestContextKey(input)}:${input.questionRecordId}`,
    () => requestSnapshot(input, {
      action: 'mark_read',
      questionRecordId: input.questionRecordId,
    }),
  );
}

export function clearPersonalForecastQuestionInFlight(): void {
  inFlight.clear();
}
