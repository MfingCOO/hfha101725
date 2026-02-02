
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  webDir: 'out',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#212121",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    "Assets": {
      // Temporarily removing the logo to solve the error.
      // We will only generate the splash screen for now.
      "splash": {
        "src": "assets/splash.png",
        "width": 2732,
        "height": 2732
      }
    }
  }
};

export default config;
