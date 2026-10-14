import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { getAdminContext, roleHasPermission } from '../../../../../lib/admin/rbac';
import { getPool } from '../../../../../lib/db';

const FUNNEL_STEPS = [
  { key: 'app_opened', label: 'Открытие приложения', types: ['app_opened'] },
  { key: 'signup_completed', label: 'Регистрация / Онбординг', types: ['signup_completed', 'onboarding_completed'] },
  { key: 'birth_data_completed', label: 'Данные рождения', types: ['birth_data_completed'] },
  { key: 'natal_chart_generated', label: 'Построение натальной карты', types: ['natal_chart_generated', 'natal_chart_opened'] },
  { key: 'forecast_viewed', label: 'Просмотр прогноза / ценности', types: ['first_value_viewed', 'first_result_ready', 'forecast_period_selected', 'horoscope_opened'] },
  { key: 'paywall_view', label: 'Открытие Paywall', types: ['paywall_view', 'paywall_viewed', 'paywall_impression'] },
  { key: 'checkout_start', label: 'Начало оплаты', types: ['checkout_start', 'checkout_started', 'plan_selected'] },
  { key: 'purchase_success', label: 'Оплата / Подписка', types: ['purchase_success', 'purchase_succeeded', 'subscription_started', 'purchase'] },
];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const ctx = await getAdminContext(req);
    if (!roleHasPermission(ctx.role, 'analytics.view')) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'analytics.view permission required' });
    }

    const { days = '30' } = req.query;
    const intervalDays = Math.max(1, Math.min(180, Number.parseInt(String(days), 10) || 30));

    const pool = getPool();

    // Query unique users who performed each step in the period
    const queries = FUNNEL_STEPS.map((step) =>
      pool.query(
        `SELECT COUNT(DISTINCT user_id)::int as users
         FROM user_app_events
         WHERE occurred_at >= NOW() - ($1 || ' days')::interval
           AND event_type = ANY($2::text[])`,
        [String(intervalDays), step.types]
      )
    );

    const results = await Promise.all(queries);
    const rawCounts = results.map((r) => r.rows[0]?.users || 0);

    // Fallback guarantee: if step 1 is smaller than users created, count users created
    const createdUsersRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM users WHERE created_at >= NOW() - ($1 || ' days')::interval`,
      [String(intervalDays)]
    );
    const createdCount = createdUsersRes.rows[0]?.count || 0;
    const firstStepUsers = Math.max(rawCounts[0], createdCount);

    const steps = FUNNEL_STEPS.map((step, index) => {
      const users = index === 0 ? firstStepUsers : rawCounts[index];
      const prevUsers = index === 0 ? firstStepUsers : Math.max(1, index === 1 ? firstStepUsers : rawCounts[index - 1]);
      const pctOfStart = firstStepUsers > 0 ? Math.round((users / firstStepUsers) * 1000) / 10 : 0;
      const pctOfPrev = prevUsers > 0 ? Math.round((users / prevUsers) * 1000) / 10 : 0;
      const dropOffPct = Math.max(0, Math.round((100 - pctOfPrev) * 10) / 10);

      return {
        key: step.key,
        label: step.label,
        users,
        pctOfStart,
        pctOfPrev,
        dropOffPct: index === 0 ? 0 : dropOffPct,
      };
    });

    return res.status(200).json({
      periodDays: intervalDays,
      steps,
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
