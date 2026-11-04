import type { UserProfile } from '../types';
import { createLunaStructuredResponse } from './openaiResponses';
import { getPersonalForecastVoiceViolationCodes } from './appVoice';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { buildPersonalForecastDateContext } from './personalForecastDateContext';
import { buildPersonalDayBrief } from './personalDayBrief';
import { FORECAST_DAY_THEMES, type ForecastDayNotes } from './personalForecastContract';
import {
  buildForecastLockedPreview, createUnavailablePersonalForecast,
  getPersonalForecastRawProfile, getPersonalForecastPackageValidationError, stableHash,
  resolvePersonalForecastWindow,
  type PersonalForecastPackage, type PersonalForecastPeriod, type PersonalForecastWindow,
  type PersonalForecastSemanticSignature,
} from './personalForecastContract';

// Only the current reader's own recent texts are passed to the writer and reviewer.
export const PERSONAL_FORECAST_CROSS_USER_REPEAT_FRAGMENT_LIMIT = 256;
export type PersonalForecastRepeatFragment = {
  kind?: 'title' | 'forecast' | 'closing' | 'headline' | 'fragment';
  text: string; mainIdeaKey?: string; lifePlotKey?: string; adviceKey?: string;
  comparisonKey?: string; semanticFingerprint?: string | null;
};
export type PersonalForecastRecentReading = {
  period?: PersonalForecastPeriod; periodKey: string;
  fragments: (PersonalForecastRepeatFragment & { semanticFingerprint: string | null })[];
  semanticSignature?: PersonalForecastSemanticSignature; briefSignature?: string;
};

import { getPersonalForecastSystemPrompt, getPersonalPeriodForecastSystemPrompt } from './voice/contracts/personalForecast';
export { getPersonalForecastSystemPrompt };

export function getDirectHoroscopeVoiceViolationCodes(text: string): string[] {
  // Ordinary words such as 'offer' and 'final answer' are not writing failures.
  // Keep the specific jargon, mysticism and cliche guards, without the former brief's vocabulary bans.
  const legacyVocabularyCodes = new Set(['REPORT_ABSTRACT_NOUN', 'REPORT_BOOKISH_WORD', 'REPORT_MACHINE_LANGUAGE', 'REPORT_VAGUE_PLACEHOLDER']);
  return getPersonalForecastVoiceViolationCodes(text).filter(code => !legacyVocabularyCodes.has(code));
}

export interface PersonalForecastGenerationInput {
  natal: NatalChartDataV2;
  userId?: string;
  profile: UserProfile;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  history?: PersonalForecastRecentReading[];
  retryReason?: string;
}

function recentPeriodReadings(input: PersonalForecastGenerationInput) {
  const targetDate = Date.parse(input.window.periodStart);
  const readingDate = (periodKey: string) => {
    try { return Date.parse(resolvePersonalForecastWindow(input.period, periodKey, input.window.timezone).periodStart); }
    catch { return Number.NaN; }
  };
  return (input.history || [])
    .filter((item) => item.period === input.period)
    .sort((left, right) => Math.abs(readingDate(left.periodKey) - targetDate)
      - Math.abs(readingDate(right.periodKey) - targetDate))
    .slice(0, 8)
    .map((item) => ({
      date: item.periodKey,
      title: item.fragments.find((fragment) => fragment.kind === 'title')?.text.slice(0, 120) || '',
      body: item.fragments.filter((fragment) => fragment.kind === 'forecast')
        .map((fragment) => fragment.text).join(' ').slice(0, 900),
      closing: item.fragments.find((fragment) => fragment.kind === 'closing')?.text.slice(0, 220) || '',
    }));
}

type JsonStringToken =
  | { status: 'complete'; value: string; next: number }
  | { status: 'incomplete' }
  | { status: 'invalid' };

function hasReadableWriterText(fields: Record<string, unknown>): boolean {
  return ['body', 'closing', 'action_text'].some((key) => typeof fields[key] === 'string' && Boolean((fields[key] as string).trim()));
}

function readJsonStringToken(source: string, start: number): JsonStringToken {
  if (source[start] !== '"') return { status: 'invalid' };
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (character === '\\') {
      index += 1;
      if (index >= source.length) return { status: 'incomplete' };
    } else if (character === '"') {
      try {
        const value: unknown = JSON.parse(source.slice(start, index + 1));
        return typeof value === 'string'
          ? { status: 'complete', value, next: index + 1 }
          : { status: 'invalid' };
      } catch {
        return { status: 'invalid' };
      }
    } else if (character.charCodeAt(0) < 32) {
      return { status: 'invalid' };
    }
  }
  return { status: 'incomplete' };
}

/** Read only finished top-level JSON strings from an output-token-limited response. */
function readIncompleteDayFields(source: string): Record<string, string> | null {
  const skipSpace = (at: number) => {
    let index = at;
    while (index < source.length && /[\x20\t\r\n]/u.test(source[index])) index += 1;
    return index;
  };
  let index = skipSpace(0);
  if (source[index] !== '{') return null;
  index += 1;
  const fields: Record<string, string> = {};
  let afterComma = false;
  while (true) {
    index = skipSpace(index);
    if (index >= source.length) return fields;
    if (source[index] === '}') return !afterComma && skipSpace(index + 1) === source.length ? fields : (hasReadableWriterText(fields) ? fields : null);
    const key = readJsonStringToken(source, index);
    if (key.status === 'incomplete') return fields;
    if (key.status === 'invalid') return hasReadableWriterText(fields) ? fields : null;
    if (!['title', 'body', 'closing', 'action_type', 'action_text'].includes(key.value) || key.value in fields) return hasReadableWriterText(fields) ? fields : null;
    afterComma = false;
    index = skipSpace(key.next);
    if (index >= source.length) return fields;
    if (source[index] !== ':') return hasReadableWriterText(fields) ? fields : null;
    index = skipSpace(index + 1);
    if (index >= source.length) return fields;
    const value = readJsonStringToken(source, index);
    if (value.status === 'incomplete') {
      if (key.value === 'body' && source[index] === '"') {
        try { fields.body = JSON.parse(`${source.slice(index)}"`) as string; } catch { /* No readable partial body. */ }
      }
      return fields;
    }
    if (value.status === 'invalid') return hasReadableWriterText(fields) ? fields : null;
    fields[key.value] = value.value;
    index = skipSpace(value.next);
    if (index >= source.length) return fields;
    if (source[index] === '}') return skipSpace(index + 1) === source.length ? fields : (hasReadableWriterText(fields) ? fields : null);
    if (source[index] !== ',') return hasReadableWriterText(fields) ? fields : null;
    index += 1;
    afterComma = true;
  }
}

function readWriterFields(source: string): { fields: Record<string, unknown>; recovered: boolean } {
  const trimmed = source.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  const content = fenced ? fenced[1].trim() : trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = content.startsWith('{')
      ? readIncompleteDayFields(content)
      : /^[\[`]/u.test(content) ? null : { body: content };
    if (!parsed || typeof parsed !== 'object' || !hasReadableWriterText(parsed as Record<string, unknown>)) {
      throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:INVALID_JSON');
    }
    return { fields: parsed as Record<string, unknown>, recovered: true };
  }
  if (typeof parsed === 'string') return { fields: { body: parsed }, recovered: true };
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:INVALID_JSON');
  }
  return { fields: parsed as Record<string, unknown>, recovered: Boolean(fenced) };
}

function dayRetryFeedback(reason: string | undefined, language: 'ru' | 'en'): string | undefined {
  if (!reason?.startsWith('PERSONAL_FORECAST_GENERATION_INVALID:')) return undefined;
  if (reason.includes(':VOICE:')) {
    return language === 'ru'
      ? 'Предыдущий текст отклонён из-за запрещённого штампа, канцелярита, коучинга или мистики. Напиши новый текст обычным разговорным языком.'
      : 'The previous draft used banned cliches, report language, coaching, or mysticism. Write a new reading in ordinary language.';
  }
  if (reason.endsWith(':REPEATED_READING')) {
    return language === 'ru'
      ? 'Предыдущий текст повторил недавний прогноз. Найди другое подтверждённое наблюдение в расчёте и напиши новый сюжет и заголовок.'
      : 'The previous draft repeated a recent reading. Find another supported observation in the calculation and write a new story and title.';
  }
  if (reason.includes(':TONE:ASTROLOGY_JARGON')) {
    return language === 'ru'
      ? 'Предыдущий текст показал астрологические термины. Напиши приятный прогноз обычными словами, не называя планеты, аспекты, транзиты или натальную карту.'
      : 'The previous reading exposed astrology terminology. Rewrite it in ordinary language without planets, aspects, transits or birth charts.';
  }
  if (reason.includes(':TONE:')) {
    return language === 'ru'
      ? 'Предыдущий текст получился тревожным, проблемным или повторил недавний сюжет. Напиши новый приятный и спокойный прогноз на другую подходящую тему, без предупреждений и обязательных советов.'
      : 'The previous reading was negative or repeated a recent story. Write a pleasant, calm reading on a different supported theme, without warnings or obligatory advice.';
  }
  return language === 'ru'
    ? 'Предыдущий текст не прошёл проверку. Напиши новый цельный прогноз и короткий финал по переданному расчёту.'
    : 'The previous draft failed validation. Write a new coherent reading and short closing grounded in the calculation.';
}

/** One provider request using the saved chart and the selected date calculation. */
export async function generatePersonalForecastPackage(
  input: PersonalForecastGenerationInput,
): Promise<PersonalForecastPackage> {
  const language = input.profile.language || 'ru';
  let systemPrompt: string;
  let writerInput: any;
  let schema: any;
  const recentReadings = recentPeriodReadings(input);

  if (input.period === 'day') {
    const formattedDate = input.window.periodStart.substring(0, 10);
    systemPrompt = getPersonalForecastSystemPrompt(language, 'today');

    const retryFeedback = dayRetryFeedback(input.retryReason, language);
    writerInput = {
      gender: getPersonalForecastRawProfile(input.profile).gender,
      day_brief: buildPersonalDayBrief(input.natal, input.window),
      selected_date: { start: formattedDate, timezone: input.window.timezone },
      recent_history: recentReadings,
      ...(retryFeedback ? { retry_feedback: retryFeedback } : {}),
    };

    schema = {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'body', 'closing', 'do', 'dont', 'why', 'theme'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        closing: { type: 'string' },
        do: { type: 'array', items: { type: 'string' } },
        dont: { type: 'array', items: { type: 'string' } },
        why: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['fact', 'meaning'],
            properties: { fact: { type: 'string' }, meaning: { type: 'string' } },
          },
        },
        theme: { type: 'string', enum: [...FORECAST_DAY_THEMES] },
      }
    };
  } else {
    systemPrompt = getPersonalPeriodForecastSystemPrompt(language, input.period);

    const dateCalculation = buildPersonalForecastDateContext(input.natal, input.window);
    const retryFeedback = dayRetryFeedback(input.retryReason, language);
    writerInput = {
      birth: getPersonalForecastRawProfile(input.profile),
      saved_natal_calculation: { positions: input.natal.positions, houses: input.natal.houses, aspects: input.natal.aspects, quality: input.natal.chartQuality },
      selected_date_calculation: dateCalculation,
      selected_date: { period: input.period, start: input.window.periodStart, end: input.window.periodEnd, timezone: input.window.timezone },
      recent_history: recentReadings,
      ...(retryFeedback ? { retry_feedback: retryFeedback } : {}),
    };

    schema = {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'body', 'action_type', 'action_text'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        action_type: { type: 'string', enum: ['buy', 'talk', 'move', 'stop'] },
        action_text: { type: 'string' }
      }
    };
  }

  let content: string;
  let incompleteOutput = false;
  try {
    const response = await createLunaStructuredResponse({
      instructions: systemPrompt,
      input: JSON.stringify(writerInput),
      maxOutputTokens: 2400,
      reasoningEffort: 'medium',
      verbosity: 'low',
      store: false,
      schemaName: 'nebo_direct_horoscope',
      schema,
      allowIncompleteOutput: true,
    });
    content = response.content;
    incompleteOutput = response.incompleteReason === 'max_output_tokens';
  } catch (error) {
    throw new Error(`PERSONAL_FORECAST_WRITER_REQUEST_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  }

  const parsed = readWriterFields(content);
  const raw = parsed.fields;
  const body = typeof raw.body === 'string' ? raw.body.trim() : '';
  const secondary = input.period === 'day' ? raw.closing : raw.action_text;
  const secondaryText = typeof secondary === 'string' ? secondary.trim() : '';
  if (!body && !secondaryText) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
  }

  const text = body || secondaryText;
  const fallbackTitles = language === 'ru'
    ? { day: 'Личный прогноз', week: 'На этой неделе', month: 'В этом месяце' }
    : { day: 'Personal forecast', week: 'This week', month: 'This month' };
  const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim() : fallbackTitles[input.period];
  const closing = body ? secondaryText : '';
  const closingText = closing || 'none';
  const partiallyRecovered = incompleteOutput || parsed.recovered;
  const actionType = null;
  const actionText = null;

  const result = createUnavailablePersonalForecast(input.period, input.window.periodKey,
    input.window.timezone, language, 'generating', 'DIRECT_GENERATION');
  const fingerprint = `direct:${Math.abs(stableHash(text)).toString(36)}`;
  const teaser = language === 'ru' ? 'Разблокировать прогноз' : 'Read your horoscope';
  
  const visibleText = closing ? `${text}\n\n${closing}` : text;
  
  const contentBlocks: any[] = [{ id: 'overview:reading', role: 'detail', text: visibleText, semanticFactId: 'birth-profile', atomId: 'forecast_body' }];

  const stringList = (value: unknown, limit: number): string[] => (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && !!item.trim())
    .map((item) => item.trim().replace(/[.!]+$/u, ''))
    .slice(0, limit);
  const dayNotes: ForecastDayNotes | undefined = input.period === 'day' ? {
    theme: FORECAST_DAY_THEMES.find((theme) => theme === raw.theme) ?? null,
    do: stringList(raw.do, 3),
    dont: stringList(raw.dont, 2),
    why: (Array.isArray(raw.why) ? raw.why : [])
      .filter((item): item is { fact: string; meaning: string } => !!item && typeof item.fact === 'string' && typeof item.meaning === 'string' && !!item.fact.trim() && !!item.meaning.trim())
      .slice(0, 3)
      .map((item) => ({ fact: item.fact.trim(), meaning: item.meaning.trim() })),
  } : undefined;

  result.overview = { ...result.overview, status: 'ready', diagnosticCode: null, ...(dayNotes ? { dayNotes } : {}),
    title, text: visibleText, actionType: actionType as 'buy' | 'talk' | 'move' | 'stop' | null, actionText, importance: 100, visualTag: 'personal-story',
    semanticFactIds: ['birth-profile'], semanticFingerprint: fingerprint,
    contentBlocks: contentBlocks as any,
    explanationAnchors: [], premiumTeaser: teaser, lockedPreview: buildForecastLockedPreview(visibleText, teaser) };
  result.visual.sectionAssetIds = { overview: null };
  result.meta = { ...result.meta, model: input.model, generationAttempts: input.retryReason ? 2 : 1,
    validationStatus: 'valid', status: 'ready',
    diagnosticCode: partiallyRecovered ? 'PERSONAL_FORECAST_PARTIAL_RECOVERY' : null,
    astrologerBrief: { tone: 'mixed', observations: [], briefSignature: 'direct-v1' },
    semanticSignature: { situation: fingerprint, turn: fingerprint, outcome: fingerprint,
      title, forecast: text, closing: closingText } };
  const error = getPersonalForecastPackageValidationError(result);
  if (error) throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:${error}`);
  return result;
}

export type PersonalForecastGenerationDiagnosticCode =
  | 'PERSONAL_FORECAST_CACHE_WRITE_FAILED'
  | 'PERSONAL_FORECAST_EVIDENCE_EMPTY'
  | 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED'
  | 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT'
  | 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
  | 'PERSONAL_FORECAST_WRITER_REFUSED'
  | 'PERSONAL_FORECAST_WRITER_UNAVAILABLE'
  | 'PERSONAL_FORECAST_GENERATION_FAILED';

/** Do not expose provider errors to clients; map them to stable UI states. */
export function getPersonalForecastGenerationDiagnosticCode(
  error: unknown,
): PersonalForecastGenerationDiagnosticCode {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('PERSONAL_FORECAST_CACHE_WRITE_FAILED')) {
    return 'PERSONAL_FORECAST_CACHE_WRITE_FAILED';
  }
  if (message.startsWith('PERSONAL_FORECAST_EVIDENCE_EMPTY')) {
    return 'PERSONAL_FORECAST_EVIDENCE_EMPTY';
  }
  if (message.startsWith('PERSONAL_FORECAST_GENERATION_INVALID')) {
    return 'PERSONAL_FORECAST_WRITER_VALIDATION_FAILED';
  }
  if (message.startsWith('PERSONAL_FORECAST_WRITER_REQUEST_FAILED')) {
    if (message.includes('OPENAI_RESPONSE_REFUSAL')) {
      return 'PERSONAL_FORECAST_WRITER_REFUSED';
    }
    if (message.includes('OPENAI_RESPONSE_INCOMPLETE:max_output_tokens')) {
      return 'PERSONAL_FORECAST_WRITER_OUTPUT_LIMIT';
    }
    return message.includes('OPENAI_RESPONSE_INCOMPLETE')
      ? 'PERSONAL_FORECAST_WRITER_INCOMPLETE'
      : 'PERSONAL_FORECAST_WRITER_UNAVAILABLE';
  }
  return 'PERSONAL_FORECAST_GENERATION_FAILED';
}
