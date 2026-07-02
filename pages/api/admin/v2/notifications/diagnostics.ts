import type { NextApiRequest, NextApiResponse } from 'next';
import { handleAdminError } from '../../../../../lib/adminAuth';
import { requireAdminPermission } from '../../../../../lib/admin/rbac';
import { getNotificationDeliveryHealth, probeOwnerNotifications } from '../../../../../services/notificationRetentionService';
import { getSchedulerStatus } from '../../../../../lib/notificationScheduler';
import { resolveBotUsername } from '../../../../../lib/telegramBot';
import { getTelegramBotTokenEnvKey, hasTelegramBotToken } from '../../../../../lib/telegramEnv';

/**
 * Здоровье системы уведомлений: окружение (токен/вебхук/URL мини-аппа), статус in-process
 * планировщика (жив ли, когда последний раз флашил очередь) и состояние очереди/каталога.
 * Это то, что отвечает на вопрос «почему не приходят пуши» одним экраном.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  try {
    const ctx = await requireAdminPermission(req, 'push.send');

    const botTokenEnvKey = getTelegramBotTokenEnvKey();
    const botTokenPresent = hasTelegramBotToken();
    const dryRun = !botTokenPresent || process.env.NOTIFICATION_DRY_RUN === '1';
    const miniAppUrl = (
      process.env.TELEGRAM_MINI_APP_URL ||
      process.env.NEXT_PUBLIC_TELEGRAM_APP_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      ''
    ).trim();

    const [health, botUsername, ownerProbe] = await Promise.all([
      getNotificationDeliveryHealth(),
      resolveBotUsername().catch(() => ''),
      probeOwnerNotifications(ctx.userId).catch(() => null),
    ]);

    const env = {
      botTokenPresent,
      botTokenEnvKey,
      dryRun,
      webhookSecretPresent: !!process.env.WEBHOOK_SECRET_TOKEN,
      cronSecretPresent: !!process.env.CRON_SECRET,
      miniAppUrlPresent: !!miniAppUrl,
      botUsername: botUsername || null,
      inProcessCronDisabled: process.env.DISABLE_INPROCESS_CRON === '1',
    };

    const scheduler = getSchedulerStatus();

    // Сводный диагноз: что мешает доставке прямо сейчас (по убыванию критичности).
    const problems: string[] = [];
    if (!botTokenPresent) problems.push('BOT_TOKEN не задан — реальная отправка отключена (dry-run).');
    if (process.env.NOTIFICATION_DRY_RUN === '1') problems.push('NOTIFICATION_DRY_RUN=1 — отправка отключена.');
    if (!scheduler.started) problems.push('In-process планировщик не запущен (NODE_ENV != production или DISABLE_INPROCESS_CRON=1, и нет внешнего cron).');
    if (health.scenarios.enabled === 0) problems.push('Нет ни одного включённого сценария — планировщик не создаёт кандидатов.');
    if (health.templates.active === 0) problems.push('Нет активных шаблонов.');
    if (botTokenPresent && !miniAppUrl) problems.push('Не задан URL мини-аппа — кнопка пуша откатится на web-deep-link.');

    return res.status(200).json({
      ok: true,
      healthy: problems.length === 0,
      problems,
      env,
      scheduler,
      health,
      ownerProbe,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return handleAdminError(res, error);
  }
}
