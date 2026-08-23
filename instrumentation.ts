/**
 * Next.js instrumentation entrypoint.
 * Runtime-specific Node code lives in instrumentation.node.ts so Edge builds never trace
 * pg, crypto, path or the native Swiss Ephemeris addon.
 */
export async function register() {
  if (process.env.NEXT_PUBLIC_MOBILE_BUILD === '1') return;
  if (
    process.env.MEOU_PUBLIC_SITE === '1'
    || process.env.NEXT_PUBLIC_MEOU_PUBLIC_SITE === '1'
  ) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
