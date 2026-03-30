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
    // This is the critical missing piece. 
    // This configuration tells the native Android and iOS operating systems
    // what to do with a push notification when the app is in the background or closed.
    // Without this, the OS has no instruction to show an alert, and silently discards the notification.
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
