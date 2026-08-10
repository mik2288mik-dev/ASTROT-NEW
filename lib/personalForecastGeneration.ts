import { formatInTimeZone } from 'date-fns-tz';
import type { NatalChartData, UserProfile } from '../types';
import type { NatalChartDataV2 } from './natalChartV2Types';
import { isNatalChartDataV2 } from './natal/canonicalReport';
import { APP_VOICE_VERSION, getAppSystemVoice } from './appVoice';
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
const USER_COPY_ASTROLOGY_TERMS = /(?:солнц|лун[аыеуой]|меркур|венер|марс|юпитер|сатурн|уран|нептун|плутон|квадратур|оппозиц|секстил|трин\b|транзит|орбис|ретроград|асцендент|натальн)|\b(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|square|opposition|sextile|trine|transit|orb|retrograde|ascendant|natal)\b/iu;

export function getPersonalForecastSystemPrompt(
  language: ForecastWriterLanguage,
  period: PersonalForecastPeriod = 'day',
): string {
  const ruPeriodRule: Record<PersonalForecastPeriod, string> = {
    day: 'Опиши только этот день: его общий ход и наиболее заметное проявление. Не делай глобальных выводов по одному дню.',
    week: 'Дай цельную картину ближайших семи дней. Не раскладывай неделю по дням.',
    month: 'Дай цельную картину месяца. Не превращай текст в календарь или перечень обязательных сфер.',
  };
  const enPeriodRule: Record<PersonalForecastPeriod, string> = {
    day: 'Describe this day only: its overall course and most noticeable manifestation. Do not draw global conclusions from one day.',
    week: 'Give one coherent picture of the next seven days. Never split the week into a day-by-day list.',
    month: 'Give one coherent picture of the month. Never turn it into a calendar or a checklist of required life areas.',
  };

  if (language === 'ru') {
    return `${getAppSystemVoice('ru')}

ЗАДАЧА ДЛЯ ЛИЧНОГО ПРОГНОЗА
- Сам выбери главный вывод из evidence. Не перечисляй факторы подряд и не повторяй одну мысль разными словами.
- Пиши только о том, что подтверждено переданными evidence и фактическим natal context. Ничего не рассчитывай и не придумывай заново.
- Основной текст — про узнаваемые события, решения, реакции и поведение человека. Не употребляй в headline, paragraphs и advice названия планет, знаков, домов, аспектов, транзитов, орбисов и другие астрологические термины: они раскрываются интерфейсом отдельно по evidence_ids.
- Заголовок — короткая естественная фраза по главному смыслу периода, не рекламный слоган и не техническая рубрика.
- Напиши цельный разбор объёмом от 95 до 130 слов. Разбей его на естественные абзацы только там, где меняется мысль; не придумывай подзаголовки и обязательные жизненные сферы.
- Совет — одна короткая практическая фраза до 18 слов, прямо следующая из разбора; без поучения и повторения текста.
- ${ruPeriodRule[period]}
- Каждый абзац и совет обязаны вернуть собственные существующие evidence_ids. Не ставь один и тот же список автоматически во все блоки.
- Ответ — только валидный JSON без Markdown.

Верни строго:
{"headline":"короткий честный заголовок","paragraphs":[{"text":"абзац цельного разбора","evidence_ids":["существующий evidence id"]}],"advice":{"text":"короткий совет","evidence_ids":["существующий evidence id"]}}`;
  }

  return `${getAppSystemVoice('en')}

PERSONAL FORECAST TASK
- Choose the main conclusion from the evidence yourself. Do not list factors mechanically or repeat the same point in different words.
- Use only the supplied evidence and factual natal context. Never recalculate or invent astrology, events, biography, or diagnoses.
- Write the user-facing headline, paragraphs, and advice only in ordinary language about recognisable events, decisions, reactions, and behaviour. Do not use names of planets, signs, houses, aspects, transits, orbs, or other astrology terminology there; the interface reveals those facts separately through evidence_ids.
- The headline is one short natural phrase about the actual period, never an advertising slogan or a technical label.
- Write one coherent reading of 95–130 words. Split it into natural paragraphs only when the thought changes; do not invent subheadings or mandatory life areas.
- Advice is one practical sentence of no more than 18 words, derived directly from the reading, never a detached lesson or a repetition.
- ${enPeriodRule[period]}
- Every paragraph and the advice must return their own existing evidence_ids. Do not automatically attach the same list to every block.
- Return valid JSON only, with no Markdown.

Return exactly:
{"headline":"short honest headline","paragraphs":[{"text":"one paragraph of the coherent reading","evidence_ids":["existing evidence id"]}],"advice":{"text":"short practical suggestion","evidence_ids":["existing evidence id"]}}`;
}

type GeneratedTextBlock = {
  text?: unknown;
  evidence_ids?: unknown;
};

type GeneratedFeedPayload = {
  headline?: unknown;
  paragraphs?: GeneratedTextBlock[];
  /** Previous structured contract accepted only as a resilience fallback. */
  lead?: GeneratedTextBlock;
  sections?: Array<GeneratedTextBlock & { title?: unknown }>;
  advice?: GeneratedTextBlock | unknown;
  /** Previous compact contract accepted only as a resilience fallback. */
  forecast?: unknown;
  evidence_ids?: unknown;
};

type FreeGeneratedBlock = {
  text: string;
  role: 'lead' | 'insight' | 'action';
  evidenceIds: string[];
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

function wordCount(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
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

function generatedBlock(
  value: unknown,
  role: FreeGeneratedBlock['role'],
  availableEvidenceIds: ReadonlySet<string>,
): FreeGeneratedBlock | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as GeneratedTextBlock;
  const text = modelText(candidate.text);
  const evidenceIds = validatedEvidenceIds(candidate.evidence_ids, availableEvidenceIds);
  return text && evidenceIds ? { text, role, evidenceIds } : null;
}

function legacyGeneratedBlocks(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string>,
): FreeGeneratedSection[] | null {
  const evidenceIds = validatedEvidenceIds(raw.evidence_ids, availableEvidenceIds);
  const headline = modelText(raw.headline);
  const forecast = modelText(raw.forecast);
  const advice = modelText(raw.advice);
  if (!evidenceIds || !headline || !forecast || !advice) return null;
  const paragraphs = forecast
    .split(/\n\s*\n/u)
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, index) => ({
      text,
      role: index === 0 ? 'lead' as const : 'insight' as const,
      evidenceIds,
    }));
  return [{
    title: headline,
    evidenceIds,
    blocks: [...paragraphs, { text: advice, role: 'action', evidenceIds }],
  }];
}

export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
  period: PersonalForecastPeriod = 'day',
): ValidatedFreeWriterResult {
  const headline = modelText(raw.headline);
  const legacy = legacyGeneratedBlocks(raw, availableEvidenceIds);
  if (!headline || !Array.isArray(raw.paragraphs) || !raw.advice) {
    const previousParagraphs = raw.lead && Array.isArray(raw.sections)
      ? [raw.lead, ...raw.sections]
      : null;
    if (headline && previousParagraphs && raw.advice) {
      raw = { ...raw, paragraphs: previousParagraphs };
    } else {
      if (!legacy) return { sections: [], errors: ['payload requires headline, paragraphs, and advice with valid evidence_ids'] };
      const legacyBlocks = legacy.flatMap((section) => section.blocks);
      const legacyReading = legacyBlocks.filter((block) => block.role !== 'action');
      const legacyAdvice = legacyBlocks.filter((block) => block.role === 'action');
      const legacyErrors = [
        legacyReading.reduce((sum, block) => sum + wordCount(block.text), 0) > 130
          ? `reading has more than 130 words for ${period}`
          : null,
        legacyAdvice.some((block) => wordCount(block.text) > 18)
          ? 'advice has more than 18 words'
          : null,
        [headline || '', ...legacyBlocks.map((block) => block.text)]
          .some((text) => USER_COPY_ASTROLOGY_TERMS.test(text))
          ? 'user-facing copy contains astrology terminology'
          : null,
      ].filter((error): error is string => !!error);
      if (legacyErrors.length) return { sections: [], errors: legacyErrors };
      return { sections: legacy, errors: [] };
    }
  }
  const advice = generatedBlock(raw.advice, 'action', availableEvidenceIds);
  const rawParagraphs = raw.paragraphs || [];
  const paragraphs = rawParagraphs.map((paragraph, index) => (
    generatedBlock(paragraph, index === 0 ? 'lead' : 'insight', availableEvidenceIds)
  ));
  if (!advice || !paragraphs.length || paragraphs.some((paragraph) => !paragraph)) {
    return { sections: [], errors: ['a paragraph or advice has missing, duplicated, or unknown evidence_ids'] };
  }
  const errors: string[] = [];
  if (headline.length > 72) errors.push(`headline has ${headline.length} characters; maximum is 72`);
  if (USER_COPY_ASTROLOGY_TERMS.test(headline)) errors.push('headline contains astrology terminology');
  if (wordCount(advice.text) > 18) errors.push('advice has more than 18 words');
  if (USER_COPY_ASTROLOGY_TERMS.test(advice.text)) errors.push('advice contains astrology terminology');
  const readingBlocks = paragraphs.filter((paragraph): paragraph is FreeGeneratedBlock => !!paragraph);
  if (readingBlocks.some((block) => USER_COPY_ASTROLOGY_TERMS.test(block.text))) {
    errors.push('reading contains astrology terminology');
  }
  const readingWords = readingBlocks.reduce((sum, block) => sum + wordCount(block.text), 0);
  if (readingWords > 130) {
    errors.push(`reading has ${readingWords} words; maximum for ${period} is 130`);
  }
  if (errors.length) return { sections: [], errors };
  const overviewEvidenceIds = [...new Set(readingBlocks.flatMap((block) => block.evidenceIds))];
  return {
    errors: [],
    sections: [{
      title: headline,
      evidenceIds: overviewEvidenceIds,
      blocks: readingBlocks,
    }, {
      title: null,
      evidenceIds: advice.evidenceIds,
      blocks: [advice],
    }],
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
      const isGeneratedPayload = (value: unknown): value is Record<string, unknown> => (
        !!value
        && typeof value === 'object'
        && !Array.isArray(value)
        && ['headline', 'paragraphs', 'lead', 'sections', 'forecast', 'advice', 'evidence_ids']
          .some((key) => Object.prototype.hasOwnProperty.call(value, key))
      );
      const nested = [payload, payload.data, payload.result, payload.output, payload.response]
        .find(isGeneratedPayload);
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
  const title = input.section.title || undefined;
  const sectionId = input.overview
    ? 'overview'
    : `semantic:direct-${input.sectionIndex}-${stableHash(`${title || ''}:${input.section.evidenceIds.join(':')}`).toString(36)}`;
  const blocks: ForecastContentBlock[] = input.section.blocks.map((block, index) => {
    const blockEvidence = evidenceForIds(block.evidenceIds, input.evidenceViews);
    return {
      id: `${sectionId}:generated:${index + 1}`,
      role: block.role,
      text: block.text,
      semanticFactId: block.evidenceIds[0],
      atomId: `generated:${sectionId}:${index + 1}`,
      evidenceIds: block.evidenceIds,
      astro_evidence: blockEvidence.map((item) => item.factor).join(' · ') || null,
      explanationAnchorId: `anchor:${sectionId}:${index + 1}`,
    };
  });
  const text = blocks.map((block) => block.text).join('\n\n');
  const teaser = input.language === 'ru'
    ? 'В полном разборе этого периода раскрыты конкретные проявления рассчитанных факторов.'
    : 'The full reading of this period explains the concrete manifestations of its calculated factors.';
  const factualAnchorPrefix = input.language === 'ru'
    ? 'Расчётные факты этой секции: '
    : 'Calculated facts cited by this section: ';
  const anchors: ExplanationAnchor[] = input.section.blocks.flatMap((block, index) => {
    const evidence = evidenceForIds(block.evidenceIds, input.evidenceViews);
    if (!evidence.length) return [];
    return [{
      id: `anchor:${sectionId}:${index + 1}`,
      conclusion: block.text,
      explanation: `${factualAnchorPrefix}${evidence
        .map((item) => `${item.factor}: ${item.meaning}`)
        .join(' ')}`.trim(),
      evidenceIds: evidence.map((item) => item.id),
    }];
  });
  return {
    id: sectionId,
    kind: input.overview ? 'overview' : 'dynamic',
    status: 'ready', diagnosticCode: null,
    title,
    sourceTopicKey: input.overview ? 'overview' : undefined,
    text, contentBlocks: blocks,
    semanticFactIds: [...new Set(input.section.blocks.flatMap((block) => block.evidenceIds))],
    semanticFingerprint: `direct:${stableHash(`${input.section.blocks.flatMap((block) => block.evidenceIds).join(':')}:${input.sectionIndex}`).toString(36)}`,
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
