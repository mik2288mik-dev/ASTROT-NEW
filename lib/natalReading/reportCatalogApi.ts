import { createHash } from 'crypto';
import type { ContentInterpretation } from '../../types';
import {
  buildContentGenerationLockKey,
  withContentGenerationLock,
} from '../contentGenerationLock';
import {
  getCachedReading,
  saveReading,
  type CachedReadingOptions,
  type ReadingContext,
} from './apiHelper';
import {
  generateNatalReportAnswer,
  generateNatalReportCategoryPack,
} from './reportCatalogGeneration';
import {
  buildNatalReportCatalogContext,
  resolveNatalReportAnswerEvidence,
  resolveNatalReportCategoryEvidence,
} from './reportCatalogEvidence';
import {
  getNatalReportAnswer,
  isNatalReportAnswer,
  isNatalReportAnswerFree,
  isNatalReportCategoryPack,
  localizeNatalReportText,
  NATAL_REPORT_CATALOG_ANSWER_CACHE_KEY,
  NATAL_REPORT_CATALOG_ANSWER_PROMPT_VERSION,
  NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY,
  NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION,
  NATAL_REPORT_CATALOG_CONTRACT_VERSION,
  type NatalReportAnswer,
  type NatalReportAnswerKey,
  type NatalReportCategoryKey,
  type NatalReportCategoryPack,
} from './reportCatalog';
import { buildPermanentNatalChartFingerprint } from './permanentReport';

const CATALOG_WAIT_TIMEOUT_MS = 30_000;

function languageOf(ctx: ReadingContext): 'ru' | 'en' {
  return ctx.profile.language === 'en' ? 'en' : 'ru';
}

function stableHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function mainAnchorForHash(anchor: NatalReportCategoryPack | null | undefined) {
  if (!anchor) return null;
  return {
    contractVersion: anchor.contractVersion,
    summary: anchor.summary,
    observations: anchor.observations,
  };
}

export function natalReportCategoryCacheOptions(
  ctx: ReadingContext,
  categoryKey: NatalReportCategoryKey,
  mainAnchor?: NatalReportCategoryPack | null,
): CachedReadingOptions {
  const language = languageOf(ctx);
  const built = buildNatalReportCatalogContext(ctx.profile, ctx.chartData!);
  const evidence = resolveNatalReportCategoryEvidence(built, categoryKey);
  return {
    accessTier: categoryKey === 'main' ? 'free' : 'premium',
    contentVariant: 'brief',
    cacheKey: `${NATAL_REPORT_CATALOG_CATEGORY_CACHE_KEY}.${categoryKey}.${language}`,
    inputHash: stableHash({
      kind: 'category',
      categoryKey,
      language,
      reader: {
        name: typeof ctx.profile.name === 'string' ? ctx.profile.name.trim() : '',
        gender: ctx.profile.gender === 'male' || ctx.profile.gender === 'female'
          ? ctx.profile.gender
          : 'unspecified',
      },
      chartFingerprint: buildPermanentNatalChartFingerprint(ctx.profile, ctx.chartData!),
      contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
      promptVersion: NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION,
      evidence: evidence.map((plan) => ({
        answerKey: plan.answerKey,
        evidenceIds: plan.evidenceIds,
        requiredEvidenceIds: plan.requiredEvidenceIds,
      })),
      mainAnchor: categoryKey === 'main' ? null : mainAnchorForHash(mainAnchor),
    }),
    promptVersion: NATAL_REPORT_CATALOG_CATEGORY_PROMPT_VERSION,
    modelTier: categoryKey === 'main' ? 'base' : 'premium',
    isPersistent: true,
  };
}

export function natalReportAnswerCacheOptions(
  ctx: ReadingContext,
  answerKey: NatalReportAnswerKey,
  categoryPack: NatalReportCategoryPack,
  mainAnchor?: NatalReportCategoryPack | null,
): CachedReadingOptions {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition) throw new Error('NATAL_REPORT_ANSWER_NOT_FOUND');
  const language = languageOf(ctx);
  const built = buildNatalReportCatalogContext(ctx.profile, ctx.chartData!);
  const evidence = resolveNatalReportAnswerEvidence(built, answerKey);
  const preview = categoryPack.previews.find((item) => item.answerKey === answerKey);
  const accessTier = definition.categoryKey === 'main' ? definition.access : 'premium';
  return {
    accessTier,
    contentVariant: 'full',
    cacheKey: `${NATAL_REPORT_CATALOG_ANSWER_CACHE_KEY}.${answerKey}.${language}`,
    inputHash: stableHash({
      kind: 'answer',
      answerKey,
      language,
      chartFingerprint: buildPermanentNatalChartFingerprint(ctx.profile, ctx.chartData!),
      contractVersion: NATAL_REPORT_CATALOG_CONTRACT_VERSION,
      promptVersion: NATAL_REPORT_CATALOG_ANSWER_PROMPT_VERSION,
      evidence: {
        evidenceIds: evidence.evidenceIds,
        requiredEvidenceIds: evidence.requiredEvidenceIds,
      },
      preview: {
        text: preview?.preview || localizeNatalReportText(definition.title, language),
        evidenceIds: preview?.evidenceIds || evidence.evidenceIds,
      },
      categoryNarrative: categoryPack.summary,
      mainAnchor: mainAnchorForHash(mainAnchor),
    }),
    promptVersion: NATAL_REPORT_CATALOG_ANSWER_PROMPT_VERSION,
    modelTier: accessTier === 'premium' ? 'premium' : 'base',
    isPersistent: true,
  };
}

async function readCategoryWithKnownAnchor(
  ctx: ReadingContext,
  categoryKey: NatalReportCategoryKey,
  mainAnchor?: NatalReportCategoryPack | null,
): Promise<ContentInterpretation<NatalReportCategoryPack> | null> {
  const cached = await getCachedReading<NatalReportCategoryPack>(
    ctx,
    natalReportCategoryCacheOptions(ctx, categoryKey, mainAnchor),
  );
  return cached && isNatalReportCategoryPack(cached.content) ? cached : null;
}

export async function getCachedNatalReportCategory(
  ctx: ReadingContext,
  categoryKey: NatalReportCategoryKey,
): Promise<ContentInterpretation<NatalReportCategoryPack> | null> {
  if (categoryKey === 'main') return readCategoryWithKnownAnchor(ctx, categoryKey, null);
  const main = await readCategoryWithKnownAnchor(ctx, 'main', null);
  if (!main?.content) return null;
  return readCategoryWithKnownAnchor(ctx, categoryKey, main.content);
}

export async function waitForNatalReportCategory(input: {
  ctx: ReadingContext;
  categoryKey: NatalReportCategoryKey;
  timeoutMs?: number;
}): Promise<NatalReportCategoryPack | null> {
  const timeoutMs = Math.max(500, Math.min(input.timeoutMs || CATALOG_WAIT_TIMEOUT_MS, 30_000));
  const deadline = Date.now() + timeoutMs;
  let delayMs = 300;
  while (Date.now() < deadline) {
    const cached = await getCachedNatalReportCategory(input.ctx, input.categoryKey);
    if (cached?.content) return cached.content;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.4), 1500);
  }
  return null;
}

async function ensureMainAnchor(input: {
  userId: string;
  ctx: ReadingContext;
}): Promise<NatalReportCategoryPack> {
  const cached = await getCachedNatalReportCategory(input.ctx, 'main');
  if (cached?.content) return cached.content;
  const generated = await generateNatalReportCategoryWithLock({
    ...input,
    categoryKey: 'main',
  });
  if (generated.status === 'ready') return generated.value.content;
  const waited = await waitForNatalReportCategory({ ctx: input.ctx, categoryKey: 'main' });
  if (waited) return waited;
  throw new Error('NATAL_REPORT_MAIN_ANCHOR_NOT_READY');
}

export async function generateNatalReportCategoryWithLock(input: {
  userId: string;
  ctx: ReadingContext;
  categoryKey: NatalReportCategoryKey;
}) {
  const mainAnchor = input.categoryKey === 'main'
    ? null
    : await ensureMainAnchor({ userId: input.userId, ctx: input.ctx });
  const cacheOptions = natalReportCategoryCacheOptions(
    input.ctx,
    input.categoryKey,
    mainAnchor,
  );
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: input.userId,
      chartId: input.ctx.chartId,
      accessTier: cacheOptions.accessTier,
      contentSurface: 'natal',
      contentVariant: 'brief',
      cacheKey: cacheOptions.cacheKey,
      promptVersion: cacheOptions.promptVersion,
    }),
    operation: `natal-report-category-${input.categoryKey}-generation`,
    readCached: async () => {
      const cached = await readCategoryWithKnownAnchor(
        input.ctx,
        input.categoryKey,
        mainAnchor,
      );
      return cached
        ? { value: cached, source: 'natal_report_catalog_v1' }
        : null;
    },
    generate: async () => {
      const report = await generateNatalReportCategoryPack({
        profile: input.ctx.profile,
        chart: input.ctx.chartData!,
        categoryKey: input.categoryKey,
        mainAnchor,
      });
      return saveReading(input.ctx, cacheOptions, report);
    },
  });
}

async function ensureCategoryPack(input: {
  userId: string;
  ctx: ReadingContext;
  categoryKey: NatalReportCategoryKey;
}): Promise<NatalReportCategoryPack> {
  const cached = await getCachedNatalReportCategory(input.ctx, input.categoryKey);
  if (cached?.content) return cached.content;
  const generated = await generateNatalReportCategoryWithLock(input);
  if (generated.status === 'ready') return generated.value.content;
  const waited = await waitForNatalReportCategory({
    ctx: input.ctx,
    categoryKey: input.categoryKey,
  });
  if (waited) return waited;
  throw new Error('NATAL_REPORT_CATEGORY_NOT_READY');
}

async function answerDependencies(
  ctx: ReadingContext,
  answerKey: NatalReportAnswerKey,
): Promise<{
  categoryPack: NatalReportCategoryPack;
  mainAnchor: NatalReportCategoryPack;
} | null> {
  const definition = getNatalReportAnswer(answerKey);
  if (!definition) return null;
  const main = await getCachedNatalReportCategory(ctx, 'main');
  if (!main?.content) return null;
  const category = definition.categoryKey === 'main'
    ? main
    : await getCachedNatalReportCategory(ctx, definition.categoryKey);
  if (!category?.content) return null;
  return { categoryPack: category.content, mainAnchor: main.content };
}

export async function getCachedNatalReportAnswer(
  ctx: ReadingContext,
  answerKey: NatalReportAnswerKey,
): Promise<ContentInterpretation<NatalReportAnswer> | null> {
  const dependencies = await answerDependencies(ctx, answerKey);
  if (!dependencies) return null;
  const cached = await getCachedReading<NatalReportAnswer>(
    ctx,
    natalReportAnswerCacheOptions(
      ctx,
      answerKey,
      dependencies.categoryPack,
      dependencies.mainAnchor,
    ),
  );
  return cached && isNatalReportAnswer(cached.content) ? cached : null;
}

export async function generateNatalReportAnswerWithLock(input: {
  userId: string;
  ctx: ReadingContext;
  answerKey: NatalReportAnswerKey;
}) {
  const definition = getNatalReportAnswer(input.answerKey);
  if (!definition) throw new Error('NATAL_REPORT_ANSWER_NOT_FOUND');
  const mainAnchor = await ensureMainAnchor({ userId: input.userId, ctx: input.ctx });
  const categoryPack = definition.categoryKey === 'main'
    ? mainAnchor
    : await ensureCategoryPack({
        userId: input.userId,
        ctx: input.ctx,
        categoryKey: definition.categoryKey,
      });
  const preview = categoryPack.previews.find((item) => item.answerKey === input.answerKey);
  const cacheOptions = natalReportAnswerCacheOptions(
    input.ctx,
    input.answerKey,
    categoryPack,
    mainAnchor,
  );
  return withContentGenerationLock({
    lockKey: buildContentGenerationLockKey({
      userId: input.userId,
      chartId: input.ctx.chartId,
      accessTier: cacheOptions.accessTier,
      contentSurface: 'natal',
      contentVariant: 'full',
      cacheKey: cacheOptions.cacheKey,
      promptVersion: cacheOptions.promptVersion,
    }),
    operation: `natal-report-answer-${input.answerKey}-generation`,
    readCached: async () => {
      const cached = await getCachedReading<NatalReportAnswer>(input.ctx, cacheOptions);
      return cached && isNatalReportAnswer(cached.content)
        ? { value: cached, source: 'natal_report_catalog_answer_v1' }
        : null;
    },
    generate: async () => {
      const embeddedFreeAnswer = isNatalReportAnswerFree(input.answerKey)
        ? categoryPack.freeAnswers.find((answer) => answer.answerKey === input.answerKey)
        : null;
      const report = embeddedFreeAnswer || await generateNatalReportAnswer({
        profile: input.ctx.profile,
        chart: input.ctx.chartData!,
        answerKey: input.answerKey,
        preview: preview?.preview || localizeNatalReportText(definition.title, languageOf(input.ctx)),
        mainAnchor,
      });
      return saveReading(input.ctx, cacheOptions, report);
    },
  });
}

export async function waitForNatalReportAnswer(input: {
  ctx: ReadingContext;
  answerKey: NatalReportAnswerKey;
  timeoutMs?: number;
}): Promise<NatalReportAnswer | null> {
  const timeoutMs = Math.max(500, Math.min(input.timeoutMs || CATALOG_WAIT_TIMEOUT_MS, 30_000));
  const deadline = Date.now() + timeoutMs;
  let delayMs = 300;
  while (Date.now() < deadline) {
    const cached = await getCachedNatalReportAnswer(input.ctx, input.answerKey);
    if (cached?.content) return cached.content;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    delayMs = Math.min(Math.round(delayMs * 1.4), 1500);
  }
  return null;
}
