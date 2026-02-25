import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  webDir: '.next', // <--- MODIFIED THIS LINE to point to the default Next.js build output
  server: {
    url: 'https://hungerfreeandhappy.app',
    cleartext: true
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-1031680789597179~5170897471',
    },
  },
  android: {
    path: 'android/android',
  },
};

export default config;