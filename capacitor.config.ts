import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.easypay.palooza',
  appName: 'pay-palooza-go',
  webDir: 'dist',
  server: {
    url: 'https://904c7dc7-c257-43d9-b104-05d6719732a4.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
