import type { CapacitorConfig } from '@capacitor/cli';

const isLiveReload = process.env.CAPACITOR_LIVE_RELOAD === '1';
const liveReloadUrl = isLiveReload
  ? (process.env.CAPACITOR_LIVE_URL?.trim() || 'http://localhost:3000')
  : undefined;

const config: CapacitorConfig = {
  appId: 'ru.tvoygoroskop.app',
  appName: 'NEBO гороскоп натальная карта',
  webDir: 'out',
  loggingBehavior: process.env.STORE_RELEASE === '1' || process.env.NODE_ENV === 'production' ? 'none' : 'debug',
  backgroundColor: '#ffffff',
  android: {
    backgroundColor: '#ffffff',
    useLegacyBridge: false,
  },
  server: {
    androidScheme: 'https',
    // The development emulator uses adb reverse to reach the local Next server.
    // Release builds keep cleartext traffic disabled.
    cleartext: isLiveReload,
    ...(liveReloadUrl ? { url: liveReloadUrl } : {}),
  },
  plugins: {
    // Use the Android HTTP stack for browser-style fetch/XHR as well. Some OEM
    // WebViews report a false offline state or fail cross-origin HTTPS before
    // the request leaves the handset; the app's API client still adds bounded
    // timeouts for its own calls.
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
