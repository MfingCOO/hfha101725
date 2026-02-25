import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  // We have removed the webDir property as we are now loading a live URL.
  server: {
    url: 'https://hungerfreeandhappy.app',
    cleartext: true
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-1031680789597179~5170897471',
    },
  },
};

export default config;