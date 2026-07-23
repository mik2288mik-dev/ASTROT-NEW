import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourhoroscope.app',
  appName: 'Твой Гороскоп',
  webDir: 'out',
  loggingBehavior: 'debug',
  backgroundColor: '#ffffff',
  android: {
    backgroundColor: '#ffffff',
    useLegacyBridge: false,
  },
  server: {
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
    },
  },
};

export default config;
