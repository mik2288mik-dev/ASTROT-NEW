/**
 * Next.js instrumentation — runs once when the server process starts.
 * Used to boot the in-process notification scheduler so the /api/cron jobs actually run
 * on Railway (which had no external cron triggering them).
 */
export async function register() {
  // Только серверный Node-рантайм (не edge, не сборка).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // По умолчанию работает в проде; локально — только если явно включено.
  const enabled = process.env.DISABLE_INPROCESS_CRON !== '1'
    && (process.env.NODE_ENV === 'production' || process.env.ENABLE_INPROCESS_CRON === '1');
  if (!enabled) return;

  // Самоисцеление доставки уведомлений на старте: переутверждаем каталог сценариев как
  // enabled, синхронизируем тексты и гасим протухшую очередь. Деплой на Railway —
  // `node server.js` (без `npm run migrate`), поэтому без этого шага каталог в проде мог
  // оставаться рассинхронизированным/выключенным → планировщик слал 0 пушей.
  // Не блокируем запуск планировщика, если шаг упал.
  try {
    const { bootstrapNotificationDelivery } = await import('./lib/migrations');
    await bootstrapNotificationDelivery();
  } catch (error) {
    console.warn('[instrumentation] notification bootstrap failed:', error instanceof Error ? error.message : error);
  }

  try {
    const { startNotificationScheduler } = await import('./lib/notificationScheduler');
    startNotificationScheduler();
  } catch (error) {
    console.warn('[instrumentation] failed to start notification scheduler:', error instanceof Error ? error.message : error);
  }
}
