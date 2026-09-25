import type { UserProfile } from '../types';
import { createLunaStructuredResponse } from './openaiResponses';
import { getPersonalForecastVoiceViolationCodes } from './appVoice';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { buildPersonalForecastDateContext } from './personalForecastDateContext';
import {
  buildForecastLockedPreview, createUnavailablePersonalForecast,
  getPersonalForecastRawProfile, getPersonalForecastPackageValidationError, stableHash,
  type PersonalForecastPackage, type PersonalForecastPeriod, type PersonalForecastWindow,
  type PersonalForecastSemanticSignature,
} from './personalForecastContract';

// Only the current reader's recent Today texts are passed to the Today writer.
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

import { getPersonalForecastSystemPrompt } from './voice/contracts/personalForecast';
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

function recentDayReadings(input: PersonalForecastGenerationInput) {
  const targetDate = Date.parse(input.window.periodKey);
  return (input.history || [])
    .filter((item) => item.period === 'day')
    .sort((left, right) => Math.abs(Date.parse(left.periodKey) - targetDate)
      - Math.abs(Date.parse(right.periodKey) - targetDate))
    .slice(0, 8)
    .map((item) => ({
      date: item.periodKey,
      title: item.fragments.find((fragment) => fragment.kind === 'title')?.text.slice(0, 120) || '',
      body: item.fragments.filter((fragment) => fragment.kind === 'forecast')
        .map((fragment) => fragment.text).join(' ').slice(0, 900),
      closing: item.fragments.find((fragment) => fragment.kind === 'closing')?.text.slice(0, 220) || '',
    }));
}

function repeatsRecentReading(title: string, body: string, history: ReturnType<typeof recentDayReadings>): boolean {
  const normalize = (value: string) => value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const words = (value: string) => new Set(normalize(value).split(' ').filter((word) => word.length >= 5));
  const currentTitle = normalize(title);
  const currentWords = words(body);
  return history.some((item) => {
    if (currentTitle && currentTitle === normalize(item.title)) return true;
    if (body && normalize(body) === normalize(item.body)) return true;
    const previousWords = words(item.body);
    if (currentWords.size < 8 || previousWords.size < 8) return false;
    const shared = [...currentWords].filter((word) => previousWords.has(word)).length;
    return shared >= 8 && shared / Math.min(currentWords.size, previousWords.size) >= 0.6;
  });
}

function hasUnsafeClaim(text: string): boolean {
  return /(?:гарантирован\p{L}*|точно\s+произойд\p{L}*|диагноз\p{L}*|лечени\p{L}*|лекарств\p{L}*|guaranteed|buy\s+(?:stocks|crypto))/iu.test(text);
}

type JsonStringToken =
  | { status: 'complete'; value: string; next: number }
  | { status: 'incomplete' | 'invalid' };

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
    if (source[index] === '}') return !afterComma && skipSpace(index + 1) === source.length ? fields : null;
    const key = readJsonStringToken(source, index);
    if (key.status === 'incomplete') return fields;
    if (key.status === 'invalid') return null;
    if (!['title', 'body', 'closing'].includes(key.value) || key.value in fields) return null;
    afterComma = false;
    index = skipSpace(key.next);
    if (index >= source.length) return fields;
    if (source[index] !== ':') return null;
    index = skipSpace(index + 1);
    if (index >= source.length) return fields;
    const value = readJsonStringToken(source, index);
    if (value.status === 'incomplete') return fields;
    if (value.status === 'invalid') return null;
    fields[key.value] = value.value;
    index = skipSpace(value.next);
    if (index >= source.length) return fields;
    if (source[index] === '}') return skipSpace(index + 1) === source.length ? fields : null;
    if (source[index] !== ',') return null;
    index += 1;
    afterComma = true;
  }
}

function readDayWriterFields(source: string, incomplete: boolean): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    if (!incomplete) throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:INVALID_JSON');
    parsed = readIncompleteDayFields(source);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:INVALID_JSON');
  }
  return parsed as Record<string, unknown>;
}

function hasCompleteSentenceEnding(text: string): boolean {
  return /[.!?…][»”"']*$/u.test(text);
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
  const recentReadings = input.period === 'day' ? recentDayReadings(input) : [];

  if (input.period === 'day') {
    const formattedDate = input.window.periodStart.substring(0, 10);
    systemPrompt = getPersonalForecastSystemPrompt(language, 'today');

    const dateCalculation = buildPersonalForecastDateContext(input.natal, input.window);
    const retryFeedback = dayRetryFeedback(input.retryReason, language);
    writerInput = {
      birth: getPersonalForecastRawProfile(input.profile),
      saved_natal_calculation: {
        positions: input.natal.positions, houses: input.natal.houses,
        aspects: input.natal.aspects, quality: input.natal.chartQuality,
      },
      selected_date_calculation: dateCalculation,
      selected_date: {
        period: input.period, start: formattedDate,
        end: input.window.periodEnd, timezone: input.window.timezone,
      },
      recent_history: recentReadings,
      ...(retryFeedback ? { retry_feedback: retryFeedback } : {}),
    };

    schema = {
      type: 'object',
      additionalProperties: false,
      required: ['title', 'body', 'closing'],
      properties: {
        title: { type: 'string' },
        body: { type: 'string' },
        closing: { type: 'string' }
      }
    };
  } else {
    const periodName = input.period === 'week' ? 'эту неделю' : 'этот месяц';
    const partsName = input.period === 'week' ? 'дни недели, выходные' : 'начало месяца, его середина и конец';
    systemPrompt = `Твоя роль — астролог. Ты обращаешься к читателю на «ты».\n\nГенерируй прогноз понятным языком, без астрологических терминов,\nобщих водных фраз и психологического коучинга.\n\nТы подготавливаешь цельный прогноз на ${periodName}.\n\nНе дели прогноз на искусственные части (${partsName}).\nПиши сплошным текстом, разделяя абзацы.\n\nПридумай заголовок для гороскопа.\n\nВ конце дай четкий призыв к действию (одно слово) и короткий совет (action_text).`;

    const dateCalculation = buildPersonalForecastDateContext(input.natal, input.window);
    writerInput = {
      birth: getPersonalForecastRawProfile(input.profile),
      saved_natal_calculation: { positions: input.natal.positions, houses: input.natal.houses, aspects: input.natal.aspects, quality: input.natal.chartQuality },
      selected_date_calculation: dateCalculation,
      selected_date: { period: input.period, start: input.window.periodStart, end: input.window.periodEnd, timezone: input.window.timezone }
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
      allowIncompleteOutput: input.period === 'day',
    });
    content = response.content;
    incompleteOutput = response.incompleteReason === 'max_output_tokens';
  } catch (error) {
    throw new Error(`PERSONAL_FORECAST_WRITER_REQUEST_FAILED:${error instanceof Error ? error.message : 'UNKNOWN'}`);
  }

  const raw = input.period === 'day'
    ? readDayWriterFields(content, incompleteOutput)
    : JSON.parse(content) as Record<string, unknown>;
  if (typeof raw.body !== 'string' || !raw.body.trim()) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
  }

  const text = raw.body.trim();
  let title = typeof raw.title === 'string' ? raw.title.trim() : '';
  let partiallyRecovered = incompleteOutput;
  
  let actionType: string | null = null;
  let actionText: string | null = null;
  let closingText: string = 'none';

  if (input.period === 'day') {
    const bodyVoiceViolations = getPersonalForecastVoiceViolationCodes(text);
    if (bodyVoiceViolations.length) {
      throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:VOICE:${bodyVoiceViolations.join(',')}`);
    }
    if (hasUnsafeClaim(text)) {
      throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:UNSAFE_CLAIM');
    }
    if (repeatsRecentReading('', text, recentReadings)) {
      throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:REPEATED_READING');
    }
    if (!title || getPersonalForecastVoiceViolationCodes(title).length
      || hasUnsafeClaim(title) || repeatsRecentReading(title, '', recentReadings)) {
      title = language === 'ru' ? 'Сегодня' : 'Today';
      partiallyRecovered = true;
    }
    const closing = typeof raw.closing === 'string' ? raw.closing.trim() : '';
    if (closing && !getPersonalForecastVoiceViolationCodes(closing).length && !hasUnsafeClaim(closing)) {
      closingText = closing;
    } else {
      partiallyRecovered = true;
    }
    if (partiallyRecovered && !hasCompleteSentenceEnding(text)) {
      throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:INCOMPLETE_BODY');
    }
  } else {
    if (!title) throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:EMPTY_READING');
    actionType = (raw.action_type === 'buy' || raw.action_type === 'talk' || raw.action_type === 'move' || raw.action_type === 'stop') ? raw.action_type as string : null;
    actionText = typeof raw.action_text === 'string' ? raw.action_text.trim() : null;
  }

  if (hasUnsafeClaim(`${title} ${text} ${closingText}`)) {
    throw new Error('PERSONAL_FORECAST_GENERATION_INVALID:UNSAFE_CLAIM');
  }

  const result = createUnavailablePersonalForecast(input.period, input.window.periodKey,
    input.window.timezone, language, 'generating', 'DIRECT_GENERATION');
  const fingerprint = `direct:${Math.abs(stableHash(text)).toString(36)}`;
  const teaser = language === 'ru' ? 'Разблокировать прогноз' : 'Read your horoscope';
  
  const visibleText = (input.period === 'day' && closingText !== 'none') ? `${text}\n\n${closingText}` : text;
  
  const contentBlocks: any[] = [{ id: 'overview:reading', role: 'detail', text: visibleText, semanticFactId: 'birth-profile', atomId: 'forecast_body' }];

  result.overview = { ...result.overview, status: 'ready', diagnosticCode: null,
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
