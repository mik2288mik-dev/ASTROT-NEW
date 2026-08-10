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
- Прочитай весь массив evidence как единую картину периода. Сам выбери главный вывод; не перечисляй факторы подряд и не повторяй одну мысль разными словами.
- Пиши только о том, что подтверждено переданными evidence и фактическим natal context. Ничего не рассчитывай и не придумывай заново.
- Пиши о периоде простым человеческим языком и не превращай основной текст в перечень астрологических терминов. Точные факты интерфейс покажет отдельно по evidence_ids.
- Выбирай тон по всей совокупности evidence. Спокойные, благоприятные и сложные проявления описывай только в той пропорции, в которой они подтверждены расчётом; ни один тип аспекта не становится главной темой автоматически.
- Заголовок — короткая естественная фраза по главному смыслу периода, не рекламный слоган и не техническая рубрика.
- Напиши цельный разбор не более 150 слов. Разбей его на естественные абзацы только там, где меняется мысль. Не придумывай подзаголовки, обязательные сферы или предупреждение.
- ${ruPeriodRule[period]}
- Каждый абзац обязан вернуть собственные существующие evidence_ids. Не ставь один и тот же список автоматически во все абзацы.
- Совет необязателен. Добавь одно короткое конкретное действие только если оно естественно следует из уже написанного разбора; иначе верни null. Не вводи советом новый запрет, риск или тему.
- Совет, если он есть, должен быть одним предложением не более 18 слов и вернуть только существующие evidence_ids.
- Ответ — только валидный JSON без Markdown.

Верни строго:
{"headline":"естественный заголовок","paragraphs":[{"text":"абзац цельного разбора","evidence_ids":["существующий evidence id"]}],"advice":{"text":"короткое конкретное действие","evidence_ids":["существующий evidence id"]} или null}`;
  }

  return `${getAppSystemVoice('en')}

PERSONAL FORECAST TASK
- Read the entire evidence array as one picture of the period. Choose the main conclusion yourself; do not list factors mechanically or repeat the same point in different words.
- Use only the supplied evidence and factual natal context. Never recalculate or invent astrology, events, biography, or diagnoses.
- Write in ordinary human language and do not turn the main copy into a list of astrology terms. The interface reveals exact facts separately through evidence_ids.
- Let the complete evidence set determine the tone. Present calm, favourable, and difficult manifestations only in the proportion supported by the calculation; no aspect type is automatically the main story.
- The headline is one short natural phrase about the actual period, never an advertising slogan or a technical label.
- Write one coherent reading of no more than 150 words. Split it into natural paragraphs only when the thought changes; do not invent subheadings, mandatory life areas, or a warning.
- ${enPeriodRule[period]}
- Every paragraph must return its own existing evidence_ids. Do not automatically attach the same list to every paragraph.
- Advice is optional. Add one short concrete action only when it follows naturally from the completed reading; otherwise return null. Never introduce a new restriction, risk, or topic through advice.
- If present, advice is one sentence of no more than 18 words and cites only existing evidence_ids.
- Return valid JSON only, with no Markdown.

Return exactly:
{"headline":"natural headline","paragraphs":[{"text":"one paragraph of the coherent reading","evidence_ids":["existing evidence id"]}],"advice":{"text":"short concrete action","evidence_ids":["existing evidence id"]} or null}`;
}

type GeneratedTextBlock = {
  text?: unknown;
  evidence_ids?: unknown;
};

type GeneratedFeedPayload = {
  headline?: unknown;
  paragraphs?: GeneratedTextBlock[];
  advice?: GeneratedTextBlock | null | unknown;
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

type FactualEvidencePayload = {
  id: string;
  kind: EvidenceCalculationResult['evidence'][number]['kind'];
  transit_planet: string | null;
  natal_point: string | null;
  aspect: string | null;
  house: number | null;
  orb: number | null;
  status: EvidenceCalculationResult['evidence'][number]['status'];
  starts_at_local: string | null;
  exact_at_local: string | null;
  ends_at_local: string | null;
  motion: EvidenceCalculationResult['evidence'][number]['motion'] | null;
  ingress: EvidenceCalculationResult['evidence'][number]['ingress'] | null;
};

function localForecastTimestamp(value: string | null, timezone: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm');
}

function factualEvidencePayload(
  calculatedEvidence: EvidenceCalculationResult['evidence'],
  window: PersonalForecastWindow,
): FactualEvidencePayload[] {
  const factTime = (item: EvidenceCalculationResult['evidence'][number]): number => {
    const raw = item.exactAt || item.startsAt || item.endsAt;
    const parsed = raw ? Date.parse(raw) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  return [...calculatedEvidence]
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
      starts_at_local: localForecastTimestamp(item.startsAt || null, window.timezone),
      exact_at_local: localForecastTimestamp(item.exactAt || null, window.timezone),
      ends_at_local: localForecastTimestamp(item.endsAt || null, window.timezone),
      motion: item.motion || null,
      ingress: item.ingress || null,
    }));
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
  const evidence = factualEvidencePayload(input.calculatedEvidence, input.window);
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

export function validateFreeGeneratedForecastFeed(
  raw: GeneratedFeedPayload,
  availableEvidenceIds: ReadonlySet<string> = new Set(),
  period: PersonalForecastPeriod = 'day',
): ValidatedFreeWriterResult {
  const headline = modelText(raw.headline);
  if (!headline || !Array.isArray(raw.paragraphs)) {
    return { sections: [], errors: ['payload requires headline and paragraphs with valid evidence_ids'] };
  }
  const rawParagraphs = raw.paragraphs || [];
  const paragraphs = rawParagraphs.map((paragraph, index) => (
    generatedBlock(paragraph, index === 0 ? 'lead' : 'insight', availableEvidenceIds)
  ));
  if (!paragraphs.length || paragraphs.some((paragraph) => !paragraph)) {
    return { sections: [], errors: ['a paragraph has missing, duplicated, or unknown evidence_ids'] };
  }
  const errors: string[] = [];
  const readingBlocks = paragraphs.filter((paragraph): paragraph is FreeGeneratedBlock => !!paragraph);
  const readingWords = readingBlocks.reduce((sum, block) => sum + wordCount(block.text), 0);
  if (readingWords > 150) {
    errors.push(`reading has ${readingWords} words; maximum for ${period} is 150`);
  }
  let adviceSection: FreeGeneratedSection | null = null;
  if (raw.advice !== null && raw.advice !== undefined) {
    const advice = generatedBlock(raw.advice, 'action', availableEvidenceIds);
    if (!advice) {
      errors.push('advice has missing, duplicated, or unknown evidence_ids');
    } else if (wordCount(advice.text) > 18) {
      errors.push(`advice has ${wordCount(advice.text)} words; maximum is 18`);
    } else {
      adviceSection = {
        title: null,
        evidenceIds: advice.evidenceIds,
        blocks: [advice],
      };
    }
  }
  if (errors.length) return { sections: [], errors };
  const overviewEvidenceIds = [...new Set(readingBlocks.flatMap((block) => block.evidenceIds))];
  return {
    errors: [],
    sections: [{
      title: headline,
      evidenceIds: overviewEvidenceIds,
      blocks: readingBlocks,
    }, ...(adviceSection ? [adviceSection] : [])],
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
        && ['headline', 'paragraphs', 'advice']
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
        .map((item) => item.factor)
        .join(' · ')}`.trim(),
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
        maxTokens: 1_200,
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
      const [rawOverview, rawAdvice] = validation.sections;
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
      input.onMetrics?.({ model: input.model, ...usage, latencyMs: Date.now() - startedAt, validationPassed: true });
      const sections = rawAdvice
        ? [materializeDirectSection({
            section: rawAdvice,
            evidenceViews: input.evidenceViews,
            language: input.language,
            overview: false,
            sectionIndex: 1,
          })]
        : [];
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

function normalizeNatalPointKey(value: string | null | undefined): string | null {
  const normalized = String(value || '').trim().replace(/[\s_-]/gu, '').toLowerCase();
  const aliases: Record<string, string> = {
    asc: 'ascendant',
    rising: 'ascendant',
    midheaven: 'mc',
    northnode: 'northNode',
    southnode: 'southNode',
  };
  return normalized ? aliases[normalized] || normalized : null;
}

export function buildPersonalForecastNatalContext(
  chart: NatalChartData,
  evidence: EvidenceCalculationResult['evidence'],
): Record<string, unknown> {
  const touchedPointKeys = new Set(
    evidence
      .map((item) => normalizeNatalPointKey(item.natalPoint))
      .filter((key): key is string => !!key),
  );
  if (isNatalChartDataV2(chart)) {
    const v2 = chart as unknown as NatalChartDataV2;
    const housesReliable = v2.chartQuality.housesReliable;
    const ascendantReliable = v2.chartQuality.ascendantReliable;
    const positions = Object.values(v2.positions)
      .filter((position) => touchedPointKeys.has(normalizeNatalPointKey(position.key) || ''))
      .map((position) => ({
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
      v2.angles.mc?.reliability !== 'variable_in_range' ? v2.angles.mc : null,
    ].filter((angle): angle is NonNullable<typeof angle> => !!angle)
      .filter((angle) => touchedPointKeys.has(normalizeNatalPointKey(angle.key) || ''))
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
    positions: rawPositions.flatMap(([key, position]) => (
      position && touchedPointKeys.has(normalizeNatalPointKey(key) || '') ? [{
      key,
      sign: position.sign,
      degree: position.degree ?? null,
      longitude: position.longitude ?? null,
      retrograde: position.retrograde ?? null,
      speed_longitude: position.speedLongitude ?? null,
      house: housesReliable ? position.house ?? null : null,
    }] : [])),
    angles: ascendantReliable
      && chart.rising
      && touchedPointKeys.has('ascendant') ? [{
      key: 'ascendant',
      sign: chart.rising.sign,
      degree: chart.rising.degree ?? null,
      longitude: chart.rising.longitude ?? null,
    }] : [],
  };
}

export async function generatePersonalForecastPackage(input: {
  profile: UserProfile;
  chartData: NatalChartData;
  model: string;
  period: PersonalForecastPeriod;
  window: PersonalForecastWindow;
  onMetrics?: (metrics: { model: string; inputTokens: number; outputTokens: number; latencyMs: number; validationPassed: boolean }) => void;
  onEvidenceCalculated?: (payload: {
    calculated: EvidenceCalculationResult;
    /** Semantic compiler is intentionally bypassed; snapshots receive no derived facts. */
    semanticFacts: [];
  }) => Promise<EvidenceCalculatedHookResult>;
}): Promise<PersonalForecastPackage> {
  const language: ForecastWriterLanguage = input.profile.language === 'en' ? 'en' : 'ru';
  const calculated = await calculatePersonalForecastEvidence({
    chartData: input.chartData,
    period: input.period,
    window: input.window,
    language,
  });
  if (input.onEvidenceCalculated) {
    await input.onEvidenceCalculated({ calculated, semanticFacts: [] });
  }
  const natalContext = buildPersonalForecastNatalContext(
    input.chartData,
    calculated.evidence,
  );
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
