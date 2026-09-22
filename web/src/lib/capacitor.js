// Native app bridge (Capacitor shell removed). Every helper here degrades to
// the plain-web implementation; isNative() is always false in the browser.
export function isNative() {
  return false;
}

export function getPlatform() {
  return 'web';
}

export async function requestNotificationPermission() {
  return Notification?.permission === 'granted';
}

export async function registerForPushNotifications() {
  return null;
}

export async function pickImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}

export async function shareContent(title, text, url) {
  if (navigator.share) await navigator.share({ title, text, url });
}