/**
 * Next.js instrumentation — runs once when the server process starts.
 * Used to boot the in-process notification scheduler so the /api/cron jobs actually run
 * on Railway (which has no external cron triggering them).
 */
export async function register() {
  if (process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;

  // Next compiles instrumentation for multiple runtimes. Keep the scheduler and all of its
  // Node-only dependencies (pg, crypto, path, swisseph native addon) out of the Edge bundle.
  // /api/health remains the runtime fallback and idempotently starts the scheduler if the
  // hosting environment ever invokes register() without NEXT_RUNTIME='nodejs'.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  try {
    const { ensureNotificationScheduler } = await import('./lib/notificationScheduler');
    ensureNotificationScheduler('instrumentation');
  } catch (error) {
    console.warn('[instrumentation] failed to start notification scheduler:', error instanceof Error ? error.message : error);
  }
}
