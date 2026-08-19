import { Capacitor } from '@capacitor/core';

export function isNative() {
  return Capacitor.isNativePlatform();
}

export function getPlatform() {
  return Capacitor.getPlatform();
}

export async function requestNotificationPermission() {
  if (!isNative()) return Notification?.permission === 'granted';
  const { PushNotifications } = await import('@capacitor/push-notifications');
  const perm = await PushNotifications.requestPermissions();
  return perm.receive === 'granted';
}

export async function registerForPushNotifications() {
  if (!isNative()) return null;
  const { PushNotifications } = await import('@capacitor/push-notifications');
  await PushNotifications.register();
  return new Promise((resolve) => {
    PushNotifications.addListener('registration', (token) => {
      resolve(token.value);
    });
    setTimeout(() => resolve(null), 5000);
  });
}

export async function pickImage() {
  if (!isNative()) {
    // Fallback to file input on web
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => resolve(input.files?.[0] || null);
      input.click();
    });
  }
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: true,
    resultType: CameraResultType.Base64,
    source: CameraSource.Prompt,
  });
  return photo.base64String;
}

export async function shareContent(title, text, url) {
  if (!isNative()) {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    }
    return;
  }
  const { Share } = await import('@capacitor/share');
  await Share.share({ title, text, url });
}
