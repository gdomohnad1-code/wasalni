import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wassalni.app',
  appName: 'Wassalni',
  webDir: '.output/public',
  server: {
    androidScheme: 'https',
  },
};

export default config;
