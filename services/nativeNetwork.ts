/**
 * Native connectivity plugins are advisory on cold OEM WebViews and may report
 * an offline state before the bridge is ready. Every request already has a
 * bounded HTTPS transport, which is the only reliable connectivity check.
 */
export async function assertNativeNetworkAvailable(): Promise<void> {
  // Kept as a compatibility seam for callers. Do not preflight or reject a
  // request here: an actual transport failure is handled at the request site.
}
