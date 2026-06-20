import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdminAccess, handleAdminError, AdminAuthError } from '../../../../lib/adminAuth';
import { sendTelegramTextMessage, buildRetentionInlineKeyboard, resolveBotUsername } from '../../../../lib/telegramBot';
import { buildMiniAppButtonUrl } from '../../../../lib/notificationDeepLink';
import { buildPersonalizationContext, planRetentionNotifications } from '../../../../services/notificationRetentionService';
import { isWithinQuietHours } from '../../../../lib/notificationEngineRules';
import { sunSignFromDate } from '../../../../lib/synastry/compatScore';
import { getZodiacSign } from '../../../../constants';

/**
 * Админ: форс-отправка реального дневного пуша СЕБЕ прямо сейчас (минуя оконный гейт
 * расписания) + диагностика, почему регулярный планировщик может молчать.
 * Кнопка пуша открывает мини-апп (t.me/<bot>?startapp=...), а не браузер.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' });
  }
  try {
    const access = await requireAdminAccess(req);
    const adminId = String(access.requesterId);
    const now = new Date();

    const ctx = await buildPersonalizationContext(adminId, now).catch(() => null);

    const firstName = String(ctx?.user.name || '').split(/\s+/)[0] || 'привет';
    const sign = ctx?.user.birthDate ? sunSignFromDate(ctx.user.birthDate) : null;
    const signLabel = sign ? getZodiacSign('ru', sign) : null;
    const card = ctx?.preparedDailyCard || null;

    const title = '🌅 Lumia — разбор дня';
    const body = card?.summary
      ? card.summary
      : signLabel
        ? `${firstName}, гороскоп для знака ${signLabel} на сегодня готов. Загляни — это минута.`
        : `${firstName}, твой разбор дня готов. Загляни в Lumia — это минута.`;

    const botUsername = await resolveBotUsername();
    const buttonUrl = buildMiniAppButtonUrl(botUsername, card ? 'daily_card' : 'horoscope');
    const replyMarkup = buttonUrl
      ? buildRetentionInlineKeyboard({ deepLink: buttonUrl, buttonText: card ? 'Открыть карту дня' : 'Открыть гороскоп' })
      : undefined;

    const sendResult = await sendTelegramTextMessage(
      adminId,
      [title, body].join('\n\n'),
      replyMarkup ? { replyMarkup } : undefined,
    );

    const diagnostics = ctx
      ? {
          optInEnabled: !!ctx.preferences?.enabled,
          hasPrimaryChart: !!ctx.hasPrimaryChart,
          hasBirthData: !!ctx.hasBirthDate,
          isPremium: !!ctx.isPremium,
          segments: ctx.segments,
          localTime: ctx.localTime,
          inQuietHours: isWithinQuietHours(ctx.localTime, ctx.quietHoursStart, ctx.quietHoursEnd),
          notificationsSentToday: ctx.notificationsSentToday,
          daysInactive: ctx.daysInactive,
          buttonOpensApp: !!buttonUrl,
        }
      : { error: 'no_context' };

    // Что выбрал бы реальный планировщик прямо сейчас (без отправки) — диагностика «тишины».
    const plannerJobs = ['morning-retention-planner', 'midday-retention-planner', 'evening-retention-planner'] as const;
    const wouldSchedule: Array<{ job: string; status?: string; type?: string; detail?: string }> = [];
    for (const job of plannerJobs) {
      try {
        const r = await planRetentionNotifications(job, now, { userId: adminId, dryRun: true });
        const mine = r.results.find((x) => x.userId === adminId) || r.results[0];
        wouldSchedule.push({ job, status: mine?.status, type: mine?.type, detail: mine?.detail });
      } catch (e: any) {
        wouldSchedule.push({ job, status: 'error', detail: e?.message || 'error' });
      }
    }

    if (!sendResult.ok) {
      return res.status(502).json({ success: false, error: sendResult.error || 'Telegram send failed', diagnostics, wouldSchedule });
    }
    return res.status(200).json({ success: true, diagnostics, wouldSchedule });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return handleAdminError(res, error);
    }
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'error' });
  }
}
