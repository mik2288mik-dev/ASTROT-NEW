export * from './natalCatalogServiceBase';

import type {
  NatalReportAnswer,
  NatalReportAnswerKey,
  NatalReportCategoryKey,
  NatalReportCategoryPack,
} from '../lib/natalReading/reportCatalog';
import {
  dispatchNatalCatalogFailure,
  readStoredNatalReadingVariant,
} from '../lib/natalReading/readingVariant';
import {
  ensureNatalCatalogAnswer as ensureNatalCatalogAnswerBase,
  ensureNatalCatalogCategory as ensureNatalCatalogCategoryBase,
  type NatalCatalogCacheIdentity,
  type NatalCatalogError,
} from './natalCatalogServiceBase';

function disabledByAdminError(): NatalCatalogError {
  const error = new Error('The previous natal reading is selected by the administrator') as NatalCatalogError;
  error.status = 409;
  error.code = 'NATAL_CATALOG_DISABLED_BY_ADMIN';
  return error;
}

export async function ensureNatalCatalogCategory(
  userId: string,
  categoryKey: NatalReportCategoryKey,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): Promise<NatalReportCategoryPack> {
  if (readStoredNatalReadingVariant(userId) === 'legacy') {
    throw disabledByAdminError();
  }
  try {
    return await ensureNatalCatalogCategoryBase(
      userId,
      categoryKey,
      chartId,
      language,
      cacheIdentity,
    );
  } catch (error) {
    dispatchNatalCatalogFailure({
      userId,
      chartId,
      kind: 'category',
      itemKey: categoryKey,
      error,
    });
    throw error;
  }
}

export async function ensureNatalCatalogAnswer(
  userId: string,
  answerKey: NatalReportAnswerKey,
  isPremium: boolean,
  chartId?: number,
  language?: 'ru' | 'en',
  cacheIdentity?: NatalCatalogCacheIdentity,
): Promise<NatalReportAnswer> {
  if (readStoredNatalReadingVariant(userId) === 'legacy') {
    throw disabledByAdminError();
  }
  try {
    return await ensureNatalCatalogAnswerBase(
      userId,
      answerKey,
      isPremium,
      chartId,
      language,
      cacheIdentity,
    );
  } catch (error) {
    dispatchNatalCatalogFailure({
      userId,
      chartId,
      kind: 'answer',
      itemKey: answerKey,
      error,
    });
    throw error;
  }
}
