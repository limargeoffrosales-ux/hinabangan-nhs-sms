import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hinabangan.meridianed',
  appName: 'MeridianEd',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    url: 'https://hinabangan-nhs.onrender.com',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1e3a5f',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#1e3a5f',
  },
};

export default config;
