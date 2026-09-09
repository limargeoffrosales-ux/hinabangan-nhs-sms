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
  const token = await new Promise((resolve) => {
    PushNotifications.addListener('registration', (t) => resolve(t.value));
    setTimeout(() => resolve(null), 5000);
  });
  if (token) {
    try {
      const auth = sessionStorage.getItem('meridianed_token');
      if (auth) {
        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/v1/push/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${auth}`,
            'X-CSRF-Token': sessionStorage.getItem('meridianed_csrf') || '',
          },
          body: JSON.stringify({ token, platform: getPlatform() }),
        });
      }
    } catch (_) { /* best effort */ }
  }
  return token;
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
