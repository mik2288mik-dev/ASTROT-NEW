import { toDateInputValue } from './date-utils';
import { getConfiguredOwnerId } from './adminAuth';

function isEffectiveAdmin(userId: string | number, dbIsAdmin: boolean | undefined) {
  const ownerId = getConfiguredOwnerId();
  if (ownerId && String(userId) === String(ownerId)) {
    return true;
  }
  return !!dbIsAdmin;
}

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
    isAdmin: isEffectiveAdmin(row.id, row.is_admin),
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
    isAdmin: isEffectiveAdmin(row.id, row.is_admin),
    createdAt: row.created_at ?? null,
    lastLogin: row.last_login ?? null,
    lastSeenAt: row.last_seen_at ?? null,
    currentDeviceLabel: row.current_device_label ?? null,
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
    recentSessions: (row.recent_sessions || []).map((session: any) => ({
      sessionId: session.session_id,
      telegramPlatform: session.telegram_platform ?? null,
      deviceLabel: session.device_label ?? null,
      userAgent: session.user_agent ?? null,
      startedAt: session.started_at,
      lastSeenAt: session.last_seen_at,
    })),
    recentOracleQuestions: (row.recent_oracle_questions || []).map((question: any) => ({
      question: question.question,
      answer: question.answer,
      createdAt: question.created_at,
    })),
    latestStarsPayment: row.latest_stars_payment
      ? {
          starsAmount: row.latest_stars_payment.stars_amount,
          createdAt: row.latest_stars_payment.created_at,
        }
      : null,
  };
}

export function serializeNotificationTemplate(row: any) {
  return {
    id: Number(row.id),
    title: row.title || '',
    bodyRu: row.body_ru || '',
    bodyEn: row.body_en || '',
    kind: row.kind || 'both',
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeNotificationHistoryItem(row: any) {
  return {
    id: Number(row.id),
    mode: row.mode,
    targetSegment: row.target_segment ?? null,
    targetUserId: row.target_user_id ? String(row.target_user_id) : null,
    targetUserName: row.target_user_name || null,
    templateId: row.template_id != null ? Number(row.template_id) : null,
    title: row.title || '',
    totalRecipients: row.total_recipients ?? 0,
    successCount: row.success_count ?? 0,
    failedCount: row.failed_count ?? 0,
    createdAt: row.created_at,
    sentAt: row.sent_at ?? null,
    recentFailures: (row.recent_failures || []).map((failure: any) => ({
      userId: String(failure.user_id),
      userName: failure.user_name || 'Unnamed user',
      error: failure.error_text || 'Unknown error',
      createdAt: failure.created_at,
    })),
  };
}
