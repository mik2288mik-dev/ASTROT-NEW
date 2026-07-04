/**
 * Next.js instrumentation — runs once when the server process starts.
 * Used to boot the in-process notification scheduler so the /api/cron jobs actually run
 * on Railway (which had no external cron triggering them).
 */
export async function register() {
  // Пропускаем ТОЛЬКО edge-рантайм. Раньше стоял `!== 'nodejs'`, но в standalone-сервере на буте
  // NEXT_RUNTIME может быть не выставлен (undefined) → строгая проверка молча выходила и планировщик
  // не стартовал при запуске контейнера вовсе. Теперь стартуем и при nodejs, и при undefined.
  if (process.env.NEXT_RUNTIME === 'edge') return;

  // Гарантированный идемпотентный старт планировщика + фоновое самоисцеление каталога. Условие
  // запуска и bootstrap теперь внутри ensureNotificationScheduler (одна точка правды), а не жёсткое
  // NODE_ENV==='production' здесь — иначе переопределение NODE_ENV хостингом тихо гасило все пуши.
  // Тот же ensureNotificationScheduler дёргается из /api/health как страховка, если register()
  // почему-то не выполнится в standalone-рантайме.
  try {
    const { ensureNotificationScheduler } = await import('./lib/notificationScheduler');
    ensureNotificationScheduler('instrumentation');
  } catch (error) {
    console.warn('[instrumentation] failed to start notification scheduler:', error instanceof Error ? error.message : error);
  }
}
