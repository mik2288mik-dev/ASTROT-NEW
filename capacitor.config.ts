import type { CapacitorConfig } from '@capacitor/cli';

const isLiveReload = process.env.CAPACITOR_LIVE_RELOAD === '1';
const liveReloadUrl = isLiveReload
  ? (process.env.CAPACITOR_LIVE_URL?.trim() || 'http://localhost:3000')
  : undefined;

const config: CapacitorConfig = {
  appId: 'ru.tvoygoroskop.app',
  appName: 'NEBO',
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
    // Android WebView 149/150 can stall HTTPS fetches before they reach the
    // server. CapacitorHttp keeps the web API surface but executes requests
    // through the native Android HTTP stack instead of WebView networking.
    CapacitorHttp: {
      enabled: true,
    },
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
