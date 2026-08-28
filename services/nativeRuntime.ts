import { Capacitor } from '@capacitor/core';

/**
 * A mobile bundle is compiled specifically for the Capacitor WebView. During
 * cold start some OEM WebViews report `isNativePlatform() === false` before
 * the bridge has finished attaching, so the build marker is part of the
 * runtime contract as well.
 */
export function isNativeAppRuntime(): boolean {
  return process.env.NEXT_PUBLIC_MOBILE_BUILD === '1' || Capacitor.isNativePlatform();
}

export function isNativeAndroidRuntime(): boolean {
  // The APK is Android-only. Keep this build marker independent from the
  // Capacitor bridge because some OEM WebViews briefly report `web` before the
  // bridge finishes attaching; that must not downgrade auth HTTP to WebView
  // fetch or hide the compiled provider buttons.
  return process.env.NEXT_PUBLIC_ANDROID_BUILD === '1'
    || (isNativeAppRuntime() && Capacitor.getPlatform() === 'android');
}
