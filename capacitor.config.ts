import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_ANDROID_SERVER_URL || 'https://yajaasistencia.com/driver-app';

const config: CapacitorConfig = {
  appId: 'com.yajaasistencia.driver',
  appName: 'YAJA Conductor',
  webDir: 'capacitor-shell',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
  },
};

export default config;
