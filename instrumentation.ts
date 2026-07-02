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

  // Планировщик стартуем ПЕРВЫМ и гарантированно — его таймеры не должны зависеть от того,
  // как быстро (и успешно ли) отработает синхронизация каталога.
  try {
    const { startNotificationScheduler } = await import('./lib/notificationScheduler');
    startNotificationScheduler();
  } catch (error) {
    console.warn('[instrumentation] failed to start notification scheduler:', error instanceof Error ? error.message : error);
  }

  // Самоисцеление доставки — В ФОНЕ (не блокируем старт): переутверждаем каталог сценариев как
  // enabled, синхронизируем тексты, гасим протухшую очередь. Деплой на Railway — `node server.js`
  // (без `npm run migrate`), поэтому без этого шага каталог в проде мог оставаться выключенным.
  // К моменту первого catch-up прогона планировщика (~25с) фоновая синхронизация уже завершится.
  void (async () => {
    try {
      const { bootstrapNotificationDelivery } = await import('./lib/migrations');
      await bootstrapNotificationDelivery();
    } catch (error) {
      console.warn('[instrumentation] notification bootstrap failed:', error instanceof Error ? error.message : error);
    }
  })();
}
