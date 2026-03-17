import { toDateInputValue } from './date-utils';

export function serializeAdminUserSummary(row: any) {
  return {
    id: String(row.id),
    name: row.name || 'Unnamed user',
    isPremium: !!row.is_premium,
    premiumUntil: row.premium_until ?? null,
    lumiBalance: row.lumi_balance ?? 0,
    loginStreak: row.login_streak ?? 0,
    chartSlots: row.chart_slots ?? 1,
    savedChartsCount: row.saved_charts_count ?? 0,
    isAdmin: !!row.is_admin,
    createdAt: row.created_at ?? null,
    lastLogin: row.last_login ?? null,
  };
}

export function serializeAdminUserDetail(row: any) {
  return {
    id: String(row.id),
    name: row.name || 'Unnamed user',
    birthDate: toDateInputValue(row.birth_date) || row.birth_date || '',
    birthTime: row.birth_time || '',
    birthPlace: row.birth_place || '',
    isPremium: !!row.is_premium,
    premiumUntil: row.premium_until ?? null,
    lumiBalance: row.lumi_balance ?? 0,
    loginStreak: row.login_streak ?? 0,
    chartSlots: row.chart_slots ?? 1,
    savedChartsCount: row.saved_charts_count ?? 0,
    isAdmin: !!row.is_admin,
    createdAt: row.created_at ?? null,
    lastLogin: row.last_login ?? null,
    primaryChart: row.primary_chart
      ? {
          id: row.primary_chart.id,
          name: row.primary_chart.name,
          birthDate: toDateInputValue(row.primary_chart.birth_date) || row.primary_chart.birth_date || '',
          birthTime: row.primary_chart.birth_time || '',
          birthPlace: row.primary_chart.birth_place || '',
        }
      : null,
    recentLumiTransactions: (row.recent_lumi_transactions || []).map((transaction: any) => ({
      amount: transaction.amount,
      reason: transaction.reason,
      created_at: transaction.created_at,
    })),
    latestStarsPayment: row.latest_stars_payment
      ? {
          starsAmount: row.latest_stars_payment.stars_amount,
          createdAt: row.latest_stars_payment.created_at,
        }
      : null,
  };
}
