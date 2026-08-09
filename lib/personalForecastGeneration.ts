import { formatInTimeZone } from 'date-fns-tz';
import type { NatalChartData, UserProfile } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { isNatalChartDataV2 } from './natal/canonicalReport';
import { APP_VOICE_VERSION } from './appVoice';
import { buildOpenAIChatParams } from './openaiChat';
import { getContentAiClient } from './contentAiClient';
import {
  PERSONAL_FORECAST_CALCULATION_VERSION,
  PERSONAL_FORECAST_CONTRACT_VERSION,
  PERSONAL_FORECAST_PROMPT_VERSION,
  buildForecastLockedPreview,
  formatPersonalForecastDateLabel,
  getPersonalForecastPackageValidationError,
  isPersonalForecastPackage,
  selectTodayFreeSections,
  stableHash,
  type CrossPeriodLink,
  type ExplanationAnchor,
  type ForecastContentBlock,
  type ForecastEvidenceView,
  type ForecastSection,
  type PersonalForecastPackage,
  type PersonalForecastPeriod,
  type PersonalForecastWindow,
} from './personalForecastContract';
import {
  calculatePersonalForecastEvidence,
  type EvidenceCalculationResult,
} from './personalForecastEvidence';
type ForecastWriterLanguage = 'ru' | 'en';

export const PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS = 2;

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const ru: Record<PersonalForecastPeriod, string> = {
    day: `Ты — прямой и дружелюбный ассистент-прогнозист. Твоя задача — на основе переданных evidence на сегодняшний день дать короткий прикладной прогноз.

Правила:
- Говори на «ты», стиль — спокойный, как друг, без пафоса и запугиваний.
- Никаких «звёзды говорят», «Вселенная приготовила», «космических энергий» или «вселенских вибраций» — только факты и их бытовые следствия.
- Не упоминай конкретных родственников, родителей или партнёров в негативном ключе. Если расчёт указывает на напряжение, говори обобщённо: «возможно недопонимание с близким человеком» или «в общении с окружающими».
- Опирайся строго на предоставленный список транзитов evidence. Не добавляй ничего от себя.
- В прогнозе дай общий эмоциональный фон дня, основную тенденцию, простой совет и то, чего лучше избегать.
- Не драматизируй, не пугай и не строй глобальных выводов по одному дню.
- Ответ — только валидный JSON без Markdown и без обрамляющих блоков.

Верни строго:
{"summary":"3-4 предложения","advice":"1-2 коротких совета","evidence_ids":["существующий evidence id"]}`,
    week: `Ты — прямой и дружелюбный ассистент-прогнозист. Твоя задача — на основе переданных evidence на неделю дать целостный общий прогноз.

Правила:
- Говори на «ты», стиль — спокойный и дружеский, как умный друг.
- Дай единую картину недели: общую тему, что будет даваться легко, где возможно напряжение и какой вывод полезен.
- Не разбивай прогноз по дням. Только если evidence содержит один или два действительно ключевых точных аспекта в конкретную дату, вынеси пиковый момент в key_moment.
- Никакой эзотерики, «космических энергий», «вселенских вибраций» и общих фраз. Всё — только от переданных evidence.
- Не упоминай конкретных родственников или родителей в негативном ключе. О напряжении говори обобщённо: «в общении с окружающими» или «в близких отношениях».
- Не придумывай события, даты или выводы, которых нет в evidence.
- Ответ — только валидный JSON без Markdown и без обрамляющих блоков.

Верни строго:
{"theme":"Главная тема недели — ...","forecast":"3-4 абзаца с \\n\\n","key_moment":"пиковый момент с датой и сутью или null","advice":"короткий итоговый совет","evidence_ids":["существующий evidence id"]}`,
    month: `Ты — прямой и дружелюбный ассистент-прогнозист. Твоя задача — на основе переданных evidence на месяц дать целостный общий прогноз.

Правила:
- Говори на «ты», стиль — спокойный и уверенный, как умный друг.
- Дай картину месяца в целом: основной вектор, затронутые жизненные контексты и то, что потребует внимания.
- Не разбивай основной текст по дням. Выдели 3–5 ключевых периодов, если их подтверждает timing в evidence; не дополняй список выдуманными периодами ради количества.
- Никакой эзотерики, «космических энергий», «вселенских вибраций» и общих фраз. Всё — только от переданных evidence.
- Не упоминай конкретных родственников или родителей в негативном ключе. О напряжении говори обобщённо.
- Не придумывай события, периоды или жизненные сферы, которых нет в evidence.
- Ответ — только валидный JSON без Markdown и без обрамляющих блоков.

Верни строго:
{"theme":"Общая тема месяца — ...","forecast":"5-6 абзацев с \\n\\n","key_periods":[{"date_range":"период из evidence","event":"суть","advice":"что делать"}],"affected_areas":["подтверждённый жизненный контекст"],"general_advice":"итоговый совет","evidence_ids":["существующий evidence id"]}`,
  };
  if (language === 'ru') return ru[period];
  const en: Record<PersonalForecastPeriod, string> = {
    day: `You are a direct and friendly forecast assistant. Use only the supplied evidence for today. Address the reader as “you”, stay calm and practical, and never dramatize a single day. Do not use mysticism, cosmic-energy language, filler, or invented facts. Never single out relatives, parents, or partners negatively; describe interpersonal tension in general terms. Return valid JSON only, without Markdown: {"summary":"3-4 sentences","advice":"1-2 short practical suggestions","evidence_ids":["existing evidence id"]}.`,
    week: `You are a direct and friendly forecast assistant. Use only the supplied weekly evidence and write one coherent weekly forecast, never a day-by-day list. Mention a dated key_moment only when one or two genuinely exact dated factors support it. Cover the overall theme, what may flow easily, where tension may appear, and a concise conclusion. Do not use mysticism, cosmic-energy language, filler, invented facts, or negative references to specific relatives or parents. Return valid JSON only, without Markdown: {"theme":"Main theme of the week — ...","forecast":"3-4 paragraphs separated by \\n\\n","key_moment":"dated peak or null","advice":"short conclusion","evidence_ids":["existing evidence id"]}.`,
    month: `You are a direct and friendly forecast assistant. Use only the supplied monthly evidence and write one coherent monthly forecast, never a day-by-day list. Include 3-5 key periods when their timing exists in evidence; never invent extra periods to reach a count. Name only life contexts supported by evidence. Cover the overall theme, affected contexts, supported key periods, and a concise conclusion. Do not use mysticism, cosmic-energy language, filler, invented facts, or negative references to specific relatives or parents. Return valid JSON only, without Markdown: {"theme":"Overall theme of the month — ...","forecast":"5-6 paragraphs separated by \\n\\n","key_periods":[{"date_range":"supported period","event":"meaning","advice":"practical response"}],"affected_areas":["supported context"],"general_advice":"conclusion","evidence_ids":["existing evidence id"]}.`,
  };
  return en[period];
}

type GeneratedFeedPayload = {
  /** @deprecated accepted only for source compatibility with old callers. */
  sections?: unknown;
  summary?: unknown;
  advice?: unknown;
  theme?: unknown;
  forecast?: unknown;
  key_moment?: unknown;
  key_periods?: unknown;
  affected_areas?: unknown;
  general_advice?: unknown;
  evidence_ids?: unknown;
};

type FreeGeneratedBlock = {
  text: string;
};

type FreeGeneratedSection = {
  title: string | null;
  evidenceIds: string[];
  blocks: FreeGeneratedBlock[];
};

type ValidatedFreeWriterResult = {
  sections: FreeGeneratedSection[];
  errors: string[];
};

type GenerationResult = {
  overview: ForecastSection;
  sections: ForecastSection[];
  generationAttempts: 0 | 1 | 2;
  validationStatus: 'valid' | 'deterministic_fallback';
};

type EvidenceCalculatedHookResult = {
  calculationSnapshotId?: number | null;
} | void;

function localForecastTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm');
}

export function buildPersonalForecastFeedPrompt(input: {
  language: ForecastWriterLanguage;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  natalContext?: Record<string, unknown>;
  /** @deprecated accepted for source compatibility; never included in the prompt. */
  canonicalNatalReport?: unknown;
  repairErrors?: string[];
}): string {
  const factTime = (item: EvidenceCalculationResult['evidence'][number]): number => {
    const raw = item.exactAt || item.startsAt || item.endsAt;
    const parsed = raw ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  const evidence = [...input.calculatedEvidence]
    .sort((a, b) => (
      factTime(a) - factTime(b)
      || (a.orb ?? Number.MAX_SAFE_INTEGER) - (b.orb ?? Number.MAX_SAFE_INTEGER)
      || a.id.localeCompare(b.id)
    ))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      transit_planet: item.transitPlanet || null,
      natal_point: item.natalPoint || null,
      aspect: item.aspect || null,
      house: item.house ?? null,
      orb: item.orb ?? null,
      status: item.status,
      starts_at_local: localForecastTimestamp(item.startsAt || null, input.window.timezone),
      exact_at_local: localForecastTimestamp(item.exactAt || null, input.window.timezone),
      ends_at_local: localForecastTimestamp(item.endsAt || null, input.window.timezone),
      motion: item.motion || null,
      ingress: item.ingress || null,
    }));
  const repair = input.repairErrors?.length
    ? `\nPREVIOUS RESPONSE ERRORS (fix these only):\n${input.repairErrors.join('\n')}`
    : '';
  return `Language: ${input.language}.
Period: ${input.period}. Window: ${input.window.periodStart} — ${input.window.periodEnd}. Timezone: ${input.window.timezone}.
Use the JSON contract and rules from the system instruction. Every statement must be grounded in the supplied evidence_ids. Treat natal context only as factual background and do not infer missing time-dependent data.

Factual natal context:
${JSON.stringify(input.natalContext ?? {}, null, 2)}

Calculated evidence:
${JSON.stringify(evidence, null, 2)}${repair}`;
}

function modelText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function paragraphBlocks(value: string): FreeGeneratedBlock[] {
  return value
    .split(/\n\s*\n/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

function validatedEvidenceIds(
  value: unknown,
  availableEvidenceIds: ReadonlySet<string>,
): string[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value
    .filter((id): id is string => typeof id === 'string')
    .map((id) => id.trim())
    .filter(Boolean);
  if (
    !ids.length
    || new Set(ids).size !== ids.length
    || ids.some((id) => !availableEvidenceIds.has(id))
  ) return null;
  return ids;
}

export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
  period: PersonalForecastPeriod = 'day',
): ValidatedFreeWriterResult {
  const evidenceIds = validatedEvidenceIds(raw?.evidence_ids, availableEvidenceIds);
  if (!evidenceIds) {
    return { sections: [], errors: ['evidence_ids are missing, duplicated, or unknown'] };
  }

  if (period === 'day') {
    const summary = modelText(raw.summary);
    const advice = modelText(raw.advice);
    if (!summary || !advice) {
      return { sections: [], errors: ['day payload requires summary and advice'] };
    }
    return {
      errors: [],
      sections: [{
        title: null,
        evidenceIds,
        blocks: [...paragraphBlocks(summary), ...paragraphBlocks(advice)],
      }],
    };
  }

  if (period === 'week') {
    const theme = modelText(raw.theme);
    const forecast = modelText(raw.forecast);
    const advice = modelText(raw.advice);
    const keyMoment = raw.key_moment == null ? null : modelText(raw.key_moment);
    if (!theme || !forecast || !advice || (raw.key_moment != null && !keyMoment)) {
      return { sections: [], errors: ['week payload is incomplete'] };
    }
    return {
      errors: [],
      sections: [{
        title: theme,
        evidenceIds,
        blocks: [
          ...paragraphBlocks(forecast),
          ...(keyMoment ? [{ text: keyMoment }] : []),
          ...paragraphBlocks(advice),
        ],
      }],
    };
  }

  const theme = modelText(raw.theme);
  const forecast = modelText(raw.forecast);
  const generalAdvice = modelText(raw.general_advice);
  const affectedAreas = Array.isArray(raw.affected_areas)
    ? raw.affected_areas.map(modelText).filter((value): value is string => !!value)
    : [];
  const keyPeriods = Array.isArray(raw.key_periods)
    ? raw.key_periods.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const candidate = item as Record<string, unknown>;
        const dateRange = modelText(candidate.date_range);
        const event = modelText(candidate.event);
        const advice = modelText(candidate.advice);
        return dateRange && event && advice ? [{ dateRange, event, advice }] : [];
      })
    : [];
  if (!theme || !forecast || !generalAdvice || !affectedAreas.length || !keyPeriods.length) {
    return { sections: [], errors: ['month payload is incomplete'] };
  }
  return {
    errors: [],
    sections: [
      {
        title: theme,
        evidenceIds,
        blocks: paragraphBlocks(forecast),
      },
      ...keyPeriods.map((item) => ({
        title: item.dateRange,
        evidenceIds,
        blocks: [{ text: item.event }, { text: item.advice }],
      })),
      {
        title: affectedAreas.join(' · '),
        evidenceIds,
        blocks: paragraphBlocks(generalAdvice),
      },
    ],
  };
}

export function parseGeneratedFeedPayload(content: string): GeneratedFeedPayload | null {
  const unwrapped = content
    .trim()
    .replace(/^```(?:json)?\s*/iu, '')
    .replace(/\s*```$/u, '')
    .trim();
  const candidates = [unwrapped];
  const firstObject = unwrapped.indexOf('{');
  const lastObject = unwrapped.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) {
    candidates.push(unwrapped.slice(firstObject, lastObject + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const payload = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : null;
      if (!payload) continue;
      const nested = [payload, payload.data, payload.result, payload.output, payload.response]
        .find((value) => value && typeof value === 'object' && !Array.isArray(value));
      if (nested && typeof nested === 'object') return nested as GeneratedFeedPayload;
    } catch {
      // Try the next safe JSON representation.
    }
  }
  return null;
}

function evidenceForIds(
  evidenceIds: readonly string[],
  evidenceViews: Record<string, ForecastEvidenceView>,
): ForecastEvidenceView[] {
  return evidenceIds
    .map((id) => evidenceViews[id])
    .filter((item): item is ForecastEvidenceView => !!item);
}

function materializeDirectSection(input: {
  section: FreeGeneratedSection;
  evidenceViews: Record<string, ForecastEvidenceView>;
  language: ForecastWriterLanguage;
  overview: boolean;
  sectionIndex: number;
}): ForecastSection {
  const evidence = evidenceForIds(input.section.evidenceIds, input.evidenceViews);
  const title = input.section.title || undefined;
  const sectionId = input.overview
    ? 'overview'
    : `semantic:direct-${input.sectionIndex}-${stableHash(`${title || ''}:${input.section.evidenceIds.join(':')}`).toString(36)}`;
  const evidenceLabel = evidence.map((item) => item.factor).join(' · ') || null;
  const blocks: ForecastContentBlock[] = input.section.blocks.map((block, index) => ({
    id: `${sectionId}:generated:${index + 1}`,
    role: input.overview && index === 0 ? 'lead' : 'insight',
    text: block.text,
    semanticFactId: input.section.evidenceIds[0],
    atomId: `generated:${sectionId}:${index + 1}`,
    astro_evidence: evidenceLabel,
    explanationAnchorId: index === 0 ? `anchor:${sectionId}` : null,
  }));
  const text = blocks.map((block) => block.text).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'В полном разборе этого периода раскрыты конкретные проявления рассчитанных факторов.'
    : 'The full reading of this period explains the concrete manifestations of its calculated factors.';
  const factualAnchorPrefix = input.language === 'ru'
    ? 'Расчётные факты этой секции: '
    : 'Calculated facts cited by this section: ';
  const anchorExplanation = `${factualAnchorPrefix}${evidence
    .map((item) => `${item.factor}: ${item.meaning}`)
    .join(' ')}`
    .trim();
  const anchors: ExplanationAnchor[] = evidence.length && blocks.length
    ? [{
        id: `anchor:${sectionId}`,
        conclusion: blocks[0].text,
        explanation: anchorExplanation,
        evidenceIds: evidence.map((item) => item.id),
      }]
    : [];
  return {
    id: sectionId,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready', diagnosticCode: null,
    title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text, contentBlocks: blocks,
    semanticFactIds: input.section.evidenceIds,
    semanticFingerprint: `direct:${stableHash(`${input.section.evidenceIds.join(':')}:${input.sectionIndex}`).toString(36)}`,
    importance: Math.max(1, 100 - input.sectionIndex),
    visualTag: 'calculated',
    premiumTeaser: teaser,
    lockedPreview: buildForecastLockedPreview(text, teaser),
    explanationAnchors: anchors,
    inlineAstroAccent: null,
  };
}

async function requestGeneratedFeed(input: {
  language: ForecastWriterLanguage;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  calculatedEvidence: EvidenceCalculationResult['evidence'];
  evidenceViews: Record<string, ForecastEvidenceView>;
  natalContext: Record<string, unknown>;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
}): Promise<GenerationResult> {
  const availableEvidenceIds = new Set(input.calculatedEvidence.map((item) => item.id));
  if (!availableEvidenceIds.size) throw new Error('PERSONAL_FORECAST_EVIDENCE_EMPTY');
  const openai = getContentAiClient(input.model);
  if (!openai) throw new Error('PERSONAL_FORECAST_MODEL_UNAVAILABLE');

  let errors: string[] = [];
  for (
    let attempt = 1;
    attempt <= PERSONAL_FORECAST_MAX_WRITER_ATTEMPTS;
    attempt += 1
  ) {
    let content = '';
    const startedAt = Date.now();
    let usage = { inputTokens: 0, outputTokens: 0 };
    try {
      const response = await openai.chat.completions.create(buildOpenAIChatParams(input.model, {
        messages: [
          { role: 'system', content: getPersonalForecastSystemPrompt(input.language, input.period) },
          {
            role: 'user',
            content: buildPersonalForecastFeedPrompt({
              language: input.language,
              period: input.period,
              window: input.window,
              calculatedEvidence: input.calculatedEvidence,
              natalContext: input.natalContext,
              repairErrors: attempt === 2 ? errors : undefined,
            }),
          },
        ],
        maxTokens: 3_800,
        temperature: 1.1,
        jsonMode: true,
      }));
      content = response.choices[0]?.message?.content?.trim() || '';
      usage = { inputTokens: response.usage?.prompt_tokens || 0, outputTokens: response.usage?.completion_tokens || 0 };
    } catch (error) {
      errors = [`writer request failed: ${error instanceof Error ? error.message : String(error)}`];
      continue;
    }
    const raw = parseGeneratedFeedPayload(content);
    if (!raw) {
      errors = ['response is not valid JSON'];
      continue;
    }
    const validation = validateFreeGeneratedForecastFeed(
      raw,
      availableEvidenceIds,
      input.period,
    );
    if (!validation.errors.length) {
      const [rawOverview, ...rawSections] = validation.sections;
      if (!rawOverview) {
        errors = ['overview section is missing after validation'];
        continue;
      }
      const overview = materializeDirectSection({
        section: rawOverview,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: true,
        sectionIndex: 0,
      });
      const sections = rawSections.map((section, index) => materializeDirectSection({
        section,
        evidenceViews: input.evidenceViews,
        language: input.language,
        overview: false,
        sectionIndex: index + 1,
      }));
      input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: true });
      return {
        overview,
        sections,
        generationAttempts: attempt as 1 | 2,
        validationStatus: 'valid',
      };
    }
    input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: false });
    errors = validation.errors;
  }

  throw new Error(`PERSONAL_FORECAST_GENERATION_INVALID:${errors.join(' | ')}`);
}

export function buildCrossPeriodLinks(_input?: unknown): CrossPeriodLink[] {
  return [];
}

function buildFactualNatalContext(chart: NatalChartData): Record<string, unknown> {
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const housesReliable = v2.chartQuality.housesReliable;
    const ascendantReliable = v2.chartQuality.ascendantReliable;
    const positions = Object.values(v2.positions).map((position) => ({
      key: position.key,
      object: position.object,
      kind: position.kind,
      sign: position.sign,
      degree: position.degree,
      longitude: position.longitude,
      retrograde: position.retrograde,
      speed_longitude: position.speedLongitude,
      house: housesReliable && position.stable.house ? position.house : null,
      reliability: position.reliability,
    }));
    const angles = [
      ascendantReliable ? v2.angles.ascendant : null,
      v2.chartQuality.anglesAvailable ? v2.angles.mc : null,
    ].filter((angle): angle is NonNullable<typeof angle> => !!angle)
      .map((angle) => ({
        key: angle.key,
        sign: angle.sign,
        degree: angle.degree,
        longitude: angle.longitude,
        reliability: angle.reliability,
      }));
    return {
      schema_version: v2.schemaVersion,
      birth_time_quality: v2.birthTimeQuality,
      positions,
      angles,
      houses: housesReliable
        ? v2.houses.map((house) => ({
            house: house.house,
            sign: house.sign,
            degree: house.degree,
            longitude: house.longitude,
            reliability: house.reliability,
          }))
        : [],
      aspects: v2.aspects
        .filter((aspect) => aspect.reliable)
        .map((aspect) => ({
          id: aspect.id,
          type: aspect.type,
          from: aspect.fromKey,
          to: aspect.toKey,
          angle: aspect.angle,
          exact_angle: aspect.exactAngle,
          orb: aspect.orb,
          phase: aspect.phase,
        })),
    };
  }

  const quality = chart.chartQuality;
  const birthTimeQuality = chart.birthTimeQuality || quality?.birthTimeQuality || 'unknown';
  const housesReliable = birthTimeQuality === 'exact' && quality?.housesReliable !== false;
  const ascendantReliable = birthTimeQuality === 'exact' && quality?.ascendantReliable !== false;
  const rawPositions = [
    ['sun', chart.sun], ['moon', chart.moon], ['mercury', chart.mercury],
    ['venus', chart.venus], ['mars', chart.mars], ['jupiter', chart.jupiter],
    ['saturn', chart.saturn], ['uranus', chart.uranus], ['neptune', chart.neptune],
    ['pluto', chart.pluto], ['chiron', chart.chiron],
  ] as const;
  return {
    schema_version: 'legacy',
    birth_time_quality: birthTimeQuality,
    positions: rawPositions.flatMap(([key, position]) => position ? [{
      key,
      sign: position.sign,
      degree: position.degree ?? null,
      longitude: position.longitude ?? null,
      retrograde: position.retrograde ?? null,
      speed_longitude: position.speedLongitude ?? null,
      house: housesReliable ? position.house ?? null : null,
    }] : []),
    angles: ascendantReliable && chart.rising ? [{
      key: 'ascendant',
      sign: chart.rising.sign,
      degree: chart.rising.degree ?? null,
      longitude: chart.rising.longitude ?? null,
    }] : [],
    houses: housesReliable ? chart.houses || [] : [],
    aspects: (chart.aspects || []).map((aspect) => ({
      type: aspect.type,
      from: aspect.from,
      to: aspect.to,
      angle: aspect.angle,
      orb: aspect.orb,
    })),
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  previousForecast?: PersonalForecastPackage | null;
  historyContext?: unknown;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
  onEvidenceCalculated?: (payload: {
    calculated: EvidenceCalculationResult;
    /** Semantic compiler is intentionally bypassed; snapshots receive no derived facts. */
    semanticFacts: [];
  }) => Promise<EvidenceCalculatedHookResult>;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const natalContext = buildFactualNatalContext(input.chartData);
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
  });
  if (input.onEvidenceCalculated) {
    await input.onEvidenceCalculated({ calculated, semanticFacts: [] });
  }
  const generated = await requestGeneratedFeed({
    language,
    model: input.model,
    period: input.period,
    window: input.window,
    calculatedEvidence: calculated.evidence,
    evidenceViews: calculated.evidenceViews,
    natalContext,
    onMetrics: input.onMetrics,
  });
  const materializePackage = (
    result: GenerationResult,
    diagnosticCode: string | null,
  ): PersonalForecastPackage => {
    const referencedEvidenceIds = new Set(
      [result.overview, ...result.sections]
        .flatMap((section) => section.explanationAnchors)
        .flatMap((anchor) => anchor.evidenceIds),
    );
    const evidence = Object.fromEntries(
      [...referencedEvidenceIds]
        .map((id) => [id, calculated.evidenceViews[id]] as const)
        .filter((entry): entry is readonly [string, ForecastEvidenceView] => !!entry[1]),
    );
    const freeSelection = input.period === 'day'
      ? selectTodayFreeSections({
          sections: result.sections,
          userId: String(input.profile.id || 'guest'),
          periodKey: input.window.periodKey,
          previousSectionIds: input.previousForecast?.meta.freeSelection.sectionIds,
        })
      : {
          strongestSectionId: null,
          rotatedSectionId: null,
          sectionIds: [],
        };
    return {
      period: input.period,
      periodKey: input.window.periodKey,
      periodStart: input.window.periodStart,
      periodEnd: input.window.periodEnd,
      dateLabel: formatPersonalForecastDateLabel(input.window, language),
      timezone: input.window.timezone,
      overview: result.overview,
      sections: result.sections,
      suggestedCrossPeriodLinks: [],
      evidence,
      visual: {
        sectionAssetIds: Object.fromEntries(
          [result.overview, ...result.sections].map((section) => [section.id, null]),
        ),
      },
      meta: {
        model: input.model,
        promptVersion: PERSONAL_FORECAST_PROMPT_VERSION,
        voiceVersion: APP_VOICE_VERSION,
        calculationVersion: PERSONAL_FORECAST_CALCULATION_VERSION,
        semanticVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
        contractVersion: PERSONAL_FORECAST_CONTRACT_VERSION,
        generationAttempts: result.generationAttempts,
        validationStatus: result.validationStatus,
        generatedAt: new Date().toISOString(),
        status: 'ready',
        diagnosticCode,
        freeSelection,
      },
    };
  };

  const primary = materializePackage(generated, null);
  if (isPersonalForecastPackage(primary)) return primary;
  const primaryValidationError = getPersonalForecastPackageValidationError(primary)
    || 'PACKAGE_UNKNOWN_INVALID';
  throw new Error(`PERSONAL_FORECAST_PACKAGE_INVALID:${primaryValidationError}`);
}
