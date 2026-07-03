/**
 * Next.js instrumentation — runs once when the server process starts.
 * Used to boot the in-process notification scheduler so the /api/cron jobs actually run
 * on Railway (which had no external cron triggering them).
 */
export async function register() {
  // Только серверный Node-рантайм (не edge, не сборка).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

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
