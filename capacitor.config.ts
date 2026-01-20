import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.hungerfreeandhappy.mobile',
  appName: 'Hunger Free and Happy',
  webDir: 'out',
  server: {
    url: 'http://192.168.1.248:3000',
    cleartext: true
  }
};

export default config;
