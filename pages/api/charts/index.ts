import type { NextApiRequest, NextApiResponse } from 'next';
import { formatValidationErrors, validateNatalChartInput } from '../../../lib/validation';
import { db } from '../../../lib/db';
import {
  createOrReuseCanonicalChart,
  ensureCanonicalPrimaryChart,
  repairCanonicalChartForUser,
} from '../../../lib/natalChartPersistence';
import { invalidUserIdPayload, isValidUserId } from '../../../lib/userId';
import { AdminAuthError, handleAdminError } from '../../../lib/adminAuth';
import { requireAppUser } from '../../../lib/auth/appAuth';
import { LockKeys, releaseLock, tryAcquireLock } from '../../../lib/serverLocks';
import { getPremiumEntitlementState } from '../../../lib/contentArchitecture';
import {
  assertCanCreateSavedPerson,
  ChartAccessPolicyError,
  exposeChartAccess,
  getActiveCharts,
  getEffectiveChartLimit,
  getSelfChart,
  normalizeRelationLabel,
} from '../../../lib/chartAccessPolicy';

const log = {
  info: (msg: string, data?: any) => console.log(`[API/charts] ${msg}`, data || ''),
  error: (msg: string, err?: any) => console.error(`[API/charts] ERROR: ${msg}`, err || ''),
};

async function persistChartIdentity(
  chart: any,
  subjectType: 'self' | 'saved_person',
  relationLabel: string | null,
) {
  if (!chart?.id) return chart;
  const setIdentityMetadata = (db.natal_charts as any).setIdentityMetadata;
  if (typeof setIdentityMetadata !== 'function') return chart;
  await setIdentityMetadata.call(db.natal_charts, chart.id, subjectType, relationLabel);
  return (await db.natal_charts.getById(chart.id)) || {
    ...chart,
    subject_type: subjectType,
    relation_label: relationLabel,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const auth = await requireAppUser(req, { allowGuest: true });
    const userId = auth.userId;
    if (!isValidUserId(userId)) {
      return res.status(400).json(invalidUserIdPayload('ru'));
    }
    const entitlement = await getPremiumEntitlementState(userId);
    const chartSlots = getEffectiveChartLimit(entitlement.isPremium);

    if (req.method === 'GET') {
      const charts = getActiveCharts(await db.natal_charts.getAll(userId));

      return res.status(200).json({
        charts: charts.map((chart) => exposeChartAccess(chart, entitlement.isPremium)),
        chartSlots,
        canAddMore: charts.length < chartSlots,
        canAddSavedPeople: entitlement.isPremium && charts.length < chartSlots && !!getSelfChart(charts),
        isPremium: entitlement.isPremium,
      });
    }

    if (req.method === 'POST') {
      const {
        name,
        birthDate,
        birthTime,
        birthPlace,
        language,
        latitude,
        longitude,
        timezone,
        forceRecalculate,
        primary,
        relationLabel,
      } = req.body || {};

      const rawBirthTime = typeof birthTime === 'string' ? birthTime.trim() : '';
      const userLanguage = language === 'en' ? 'en' : 'ru';
      const validation = validateNatalChartInput({
        name: name || 'My Chart',
        birthDate,
        birthTime: rawBirthTime,
        birthPlace,
        language: userLanguage,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          error: 'Validation failed',
          message: formatValidationErrors(validation.errors, userLanguage),
          errors: validation.errors,
        });
      }

      if (!birthDate || !birthPlace) {
        return res.status(400).json({
          error: 'birthDate and birthPlace are required',
        });
      }

      const lat = Number(latitude);
      const lon = Number(longitude);
      const clientCoordinates =
        Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)
          ? { lat, lon, timezone: typeof timezone === 'string' ? timezone : undefined }
          : null;

      if (primary === true || forceRecalculate === true) {
        const lockKey = LockKeys.primaryChartCalculation(userId);

        if (!tryAcquireLock(lockKey, 'primary-chart-calculation')) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const repaired = await repairCanonicalChartForUser(userId);
          if (repaired?.chart?.chart_data?.sun && repaired.chart.chart_data?.moon && repaired.chart.chart_data?.rising) {
            res.setHeader('X-Chart-Source', 'cache-after-wait');
            return res.status(200).json(repaired.chart);
          }

          return res.status(409).json({
            error: 'Calculation in progress',
            message: userLanguage === 'ru'
              ? 'Расчёт уже выполняется. Подожди пару секунд и попробуй ещё раз.'
              : 'Calculation is already in progress. Please wait a moment and try again.',
          });
        }

        try {
          const result = await ensureCanonicalPrimaryChart({
            userId,
            name: name || 'My Chart',
            birthDate,
            birthTime: rawBirthTime,
            birthPlace,
            language: userLanguage,
            forceRecalculate: !!forceRecalculate,
            coordinates: clientCoordinates,
          });

          const selfChart = await persistChartIdentity(result.chart, 'self', null);
          res.setHeader('X-Chart-Source', result.source);
          return res.status(200).json(exposeChartAccess(selfChart, entitlement.isPremium));
        } finally {
          releaseLock(lockKey);
        }
      }

      const createLockKey = LockKeys.contentGeneration(`saved-chart-create:${userId}`);
      if (!tryAcquireLock(createLockKey, 'saved-chart-create')) {
        return res.status(409).json({
          error: 'Chart creation is already in progress',
          code: 'CHART_CREATION_IN_PROGRESS',
        });
      }

      let result: Awaited<ReturnType<typeof createOrReuseCanonicalChart>>;
      try {
        const activeCharts = getActiveCharts(await db.natal_charts.getAll(userId));
        assertCanCreateSavedPerson(activeCharts, entitlement.isPremium);

        result = await createOrReuseCanonicalChart({
          userId,
          name: name || 'Saved person',
          birthDate,
          birthTime: rawBirthTime,
          birthPlace,
          language: userLanguage,
          coordinates: clientCoordinates,
        });

        if (result.reused && getSelfChart(activeCharts)?.id === result.chart.id) {
          return res.status(409).json({
            error: 'This is already your own chart.',
            code: 'SELF_CHART_ALREADY_EXISTS',
          });
        }

        result.chart = await persistChartIdentity(
          result.chart,
          'saved_person',
          normalizeRelationLabel(relationLabel),
        );
      } finally {
        releaseLock(createLockKey);
      }

      log.info(result.reused ? 'Chart reused' : 'Chart created', {
        userId,
        chartId: result.chart.id,
        reused: result.reused,
      });

      return res.status(200).json({
        ...exposeChartAccess(result.chart, entitlement.isPremium),
        reused: result.reused,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    if (error instanceof ChartAccessPolicyError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    log.error('Error', { error: error.message });
    if (error.message?.includes('Chart slots limit')) {
      return res.status(403).json({ error: error.message, code: 'SLOTS_LIMIT' });
    }
    return res.status(500).json({ error: error.message });
  }
}
