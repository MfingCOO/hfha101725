
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  webDir: 'out',
  server: {
    url: 'https://hungerfreeandhappy.app',
    cleartext: true
  }
};

export default config;
