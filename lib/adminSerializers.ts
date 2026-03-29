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
    lastSeenAt: row.last_seen_at ?? row.last_login ?? null,
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
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    assetPublicUrl: row.asset_public_url ?? null,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeScheduledNotificationTemplate(row: any) {
  const vm = String(row.visual_mode || 'none').toLowerCase();
  const visualMode =
    vm === 'uploaded' || vm === 'generated' ? vm : 'none';
  return {
    id: Number(row.id),
    name: row.name || '',
    slot: row.slot || 'custom',
    targetSegment: row.target_segment ?? null,
    messageType: row.message_type === 'photo' ? 'photo' : 'text',
    visualMode,
    text: row.text || '',
    buttonText: row.button_text || '',
    deepLink: row.deep_link || '',
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    assetPublicUrl: row.asset_public_url || null,
    assetMimeType: row.asset_mime_type || null,
    assetFileName: row.asset_file_name || null,
    generatedPreset: row.generated_preset ?? null,
    generatedTitle: row.generated_title ?? null,
    generatedSubtitle: row.generated_subtitle ?? null,
    generatedAccent: row.generated_accent ?? null,
    generatedShowDate: !!row.generated_show_date,
    generatedShowSlotLabel: !!row.generated_show_slot_label,
    generatedZodiacMode: row.generated_zodiac_mode ?? null,
    generatedCustomZodiac: row.generated_custom_zodiac ?? null,
    isActive: !!row.is_active,
    sortOrder: Number(row.sort_order ?? 0),
    rotationGroup: row.rotation_group ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeNotificationAsset(row: any) {
  return {
    id: Number(row.id),
    fileName: row.file_name || '',
    publicUrl: row.public_url || '',
    mimeType: row.mime_type || '',
    fileSize: Number(row.file_size ?? 0),
    refCount: Number(row.ref_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeNotificationSchedule(row: any) {
  const st = row.send_time;
  const sendTime =
    typeof st === 'string'
      ? st.slice(0, 5)
      : st && typeof st.toISOString === 'function'
        ? st.toISOString().slice(11, 16)
        : String(st || '').slice(0, 5);
  return {
    id: Number(row.id),
    templateId: Number(row.template_id),
    sendTime,
    timezone: row.timezone || 'Europe/Moscow',
    repeatMode: row.repeat_mode || 'daily',
    isActive: !!row.is_active,
    lastSentAt: row.last_sent_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    templateName: row.template_name,
    templateSlot: row.template_slot,
  };
}

export function serializeNotificationDeliveryLog(row: any) {
  return {
    id: Number(row.id),
    templateId: row.template_id != null ? Number(row.template_id) : null,
    templateName: row.template_name ?? null,
    scheduledFor: row.scheduled_for ?? null,
    sentAt: row.sent_at ?? null,
    recipientCount: Number(row.recipient_count ?? 0),
    successCount: Number(row.success_count ?? 0),
    failureCount: Number(row.failure_count ?? 0),
    status: row.status || '',
    errorSummary: row.error_summary ?? null,
    visualMode: row.visual_mode ?? null,
    generatedPreset: row.generated_preset ?? null,
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    generatedCacheHit: row.generated_cache_hit === null || row.generated_cache_hit === undefined ? null : !!row.generated_cache_hit,
    createdAt: row.created_at,
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
    bodyRu: row.body_ru || '',
    bodyEn: row.body_en || '',
    assetId: row.asset_id != null ? Number(row.asset_id) : null,
    assetPublicUrl: row.asset_public_url ?? null,
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

export function serializeAdminUsersOverview(row: any) {
  return {
    totalUsers: Number(row.total_users ?? 0),
    activePremiumUsers: Number(row.active_premium_users ?? 0),
    totalLumiBalance: Number(row.total_lumi_balance ?? 0),
    activeUsers7d: Number(row.active_users_7d ?? 0),
    needAttentionUsers: Number(row.need_attention_users ?? 0),
  };
}
