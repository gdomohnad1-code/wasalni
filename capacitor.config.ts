import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wassalni.app',
  appName: 'Wassalni',
  webDir: 'dist/client',
  server: {
    androidScheme: 'https',
  },
};

export default config;
