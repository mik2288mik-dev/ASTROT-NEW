import { getPool } from './db';
import { enqueueNeboOpsEvent } from './neboOps';

export type AiScenario =
  | 'personal_forecast_daily'
  | 'personal_forecast_weekly'
  | 'personal_forecast_monthly'
  | 'natal_reading'
  | 'ask_about_self'
  | 'horoscope_zodiac'
  | 'synastry'
  | 'content_diagnostic';

export type AiDefectCategory =
  | 'transport_error'
  | 'provider_error'
  | 'timeout'
  | 'invalid_response'
  | 'schema_validation'
  | 'business_validation'
  | 'rejected_result'
  | 'missing_required_data'
  | 'low_confidence'
  | 'fallback_used'
  | 'server_exception';

export type RecordAiRequestParams = {
  traceId: string;
  userId?: string | number | null;
  scenario: AiScenario | string;
  model: string;
  provider: 'openai' | 'deepseek' | string;
  status: 'success' | 'error' | 'rejected';
  durationMs: number;
  latencyBreakdown?: {
    queueMs?: number;
    inferenceMs?: number;
    validationMs?: number;
  };
  tokensPrompt?: number;
  tokensCompletion?: number;
  costEstimatedCents?: number;
  inputSafe?: Record<string, unknown> | string;
  outputText?: string;
  errorCode?: string;
  rejectionReason?: string;
  defectCategory?: AiDefectCategory;
};

export function categorizeAiError(error: unknown, status?: number): { category: AiDefectCategory; code: string; message: string } {
  const message = error instanceof Error ? error.message : String(error || 'Unknown AI error');
  const lower = message.toLowerCase();

  if (status === 429 || lower.includes('rate limit') || lower.includes('quota') || lower.includes('429')) {
    return { category: 'provider_error', code: 'RATE_LIMIT', message };
  }
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('etimedout') || lower.includes('esockettimedout')) {
    return { category: 'timeout', code: 'AI_TIMEOUT', message };
  }
  if (lower.includes('econnreset') || lower.includes('econnrefused') || lower.includes('enotfound') || lower.includes('fetch failed')) {
    return { category: 'transport_error', code: 'NETWORK_ERROR', message };
  }
  if (lower.includes('validation') || lower.includes('schema') || lower.includes('parse error') || lower.includes('json')) {
    return { category: 'schema_validation', code: 'INVALID_SCHEMA', message };
  }
  if (lower.includes('rejected') || lower.includes('off_topic') || lower.includes('policy')) {
    return { category: 'rejected_result', code: 'PROMPT_REJECTED', message };
  }
  if (status && status >= 500) {
    return { category: 'provider_error', code: `PROVIDER_HTTP_${status}`, message };
  }

  return { category: 'server_exception', code: 'AI_EXCEPTION', message };
}

export async function recordAiRequest(params: RecordAiRequestParams): Promise<number | null> {
  try {
    const pool = getPool();
    const cleanUserId = params.userId && /^-?\d+$/.test(String(params.userId)) ? String(params.userId) : null;

    const res = await pool.query(
      `INSERT INTO app_ai_requests (
        trace_id, user_id, scenario, model, provider, status, duration_ms,
        latency_breakdown_json, tokens_prompt, tokens_completion,
        cost_estimated_cents, input_safe_json, output_text, error_code, rejection_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id`,
      [
        params.traceId,
        cleanUserId,
        params.scenario,
        params.model,
        params.provider,
        params.status,
        Math.max(0, Math.round(params.durationMs)),
        params.latencyBreakdown ? JSON.stringify(params.latencyBreakdown) : null,
        params.tokensPrompt ?? null,
        params.tokensCompletion ?? null,
        params.costEstimatedCents ?? null,
        params.inputSafe ? (typeof params.inputSafe === 'string' ? JSON.stringify({ prompt: params.inputSafe }) : JSON.stringify(params.inputSafe)) : null,
        params.outputText ? params.outputText.slice(0, 4000) : null,
        params.errorCode ?? null,
        params.rejectionReason ?? null,
      ]
    );

    const insertedId = res.rows[0]?.id ? Number(res.rows[0].id) : null;

    if (params.status === 'error' || params.status === 'rejected') {
      const category = params.defectCategory || (params.status === 'rejected' ? 'rejected_result' : 'server_exception');
      const errorCode = params.errorCode || (params.status === 'rejected' ? 'REJECTED' : 'AI_ERROR');
      const message = params.rejectionReason || params.errorCode || 'AI operation defect';

      await recordAiDefect({
        scenario: params.scenario,
        model: params.model,
        category,
        errorCode,
        message,
        traceId: params.traceId,
        userId: cleanUserId,
        sampleInput: params.inputSafe,
        sampleOutput: params.outputText,
      });
    }

    return insertedId;
  } catch (err: any) {
    console.error('[recordAiRequest] failed to log AI request:', err?.message);
    return null;
  }
}

export async function recordAiDefect(params: {
  scenario: string;
  model: string;
  category: AiDefectCategory | string;
  errorCode: string;
  message: string;
  traceId: string;
  userId?: string | null;
  sampleInput?: unknown;
  sampleOutput?: string | null;
}): Promise<void> {
  try {
    const pool = getPool();
    const groupKey = `${params.scenario}:${params.errorCode}:${params.model}`;
    const cleanUserId = params.userId && /^-?\d+$/.test(String(params.userId)) ? String(params.userId) : null;

    await pool.query(
      `INSERT INTO app_ai_defects (
        group_key, category, error_code, message, scenario, model,
        last_trace_id, last_user_id, occurrences_count, affected_users_count,
        first_seen_at, last_seen_at, sample_input_json, sample_output, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $9, $10, 'new')
      ON CONFLICT (group_key) DO UPDATE SET
        occurrences_count = app_ai_defects.occurrences_count + 1,
        affected_users_count = app_ai_defects.affected_users_count + (CASE WHEN app_ai_defects.last_user_id IS DISTINCT FROM EXCLUDED.last_user_id AND EXCLUDED.last_user_id IS NOT NULL THEN 1 ELSE 0 END),
        last_seen_at = CURRENT_TIMESTAMP,
        last_trace_id = EXCLUDED.last_trace_id,
        last_user_id = COALESCE(EXCLUDED.last_user_id, app_ai_defects.last_user_id),
        message = EXCLUDED.message,
        sample_output = COALESCE(EXCLUDED.sample_output, app_ai_defects.sample_output),
        sample_input_json = COALESCE(EXCLUDED.sample_input_json, app_ai_defects.sample_input_json),
        status = CASE WHEN app_ai_defects.status = 'fixed' THEN 'new' ELSE app_ai_defects.status END`,
      [
        groupKey,
        params.category,
        params.errorCode,
        params.message.slice(0, 500),
        params.scenario,
        params.model,
        params.traceId,
        cleanUserId,
        params.sampleInput ? JSON.stringify(params.sampleInput) : null,
        params.sampleOutput ? params.sampleOutput.slice(0, 1000) : null,
      ]
    );

    // Optional notification alert via nebo_ops_outbox (throttled by hour)
    try {
      await enqueueNeboOpsEvent(pool, {
        eventKey: `ai_defect:${groupKey}:${new Date().toISOString().slice(0, 13)}`,
        eventType: 'ai_error',
        userId: cleanUserId,
        payload: {
          errorCode: params.errorCode,
          operation: params.scenario,
          stage: 'generation',
          traceId: params.traceId,
          model: params.model,
        },
      });
    } catch {
      // NeboOps outbox enqueue error shouldn't crash defect recording
    }
  } catch (err: any) {
    console.error('[recordAiDefect] failed to record AI defect:', err?.message);
  }
}
