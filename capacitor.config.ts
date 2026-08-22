import type { CapacitorConfig } from '@capacitor/cli';

const isLiveReload = process.env.CAPACITOR_LIVE_RELOAD === '1';
const liveReloadUrl = isLiveReload
  ? (process.env.CAPACITOR_LIVE_URL?.trim() || 'http://localhost:3000')
  : undefined;

const config: CapacitorConfig = {
  appId: 'ru.tvoygoroskop.app',
  appName: 'Твой гороскоп: натальная карта',
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
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
