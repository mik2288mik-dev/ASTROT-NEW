/**
 * Next.js instrumentation entrypoint.
 * Runtime-specific Node code lives in instrumentation.node.ts so Edge builds never trace
 * pg, crypto, path or the native Swiss Ephemeris addon.
 */
export async function register() {
  if (process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      await import('./instrumentation.node');
    } catch (error) {
      // Background workers must never prevent the HTTP server from becoming live.
      console.warn(
        '[instrumentation] optional Node bootstrap failed; HTTP startup continues:',
        error instanceof Error ? error.message : error,
      );
    }
  }
}
