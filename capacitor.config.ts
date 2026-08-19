import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  server: {
    url: 'https://hungerfreeandhappy.app',
    cleartext: true
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-1031680789597179~5170897471',
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
      // This will bypass the incorrect TypeScript error.
      ios: {
        useProduction: true
      }
    },
  } as any, // This 'as any' is the fix.
};

export default config;
