// Native app bridge for Capacitor (Android & iOS) with graceful web fallback.
export function isNative() {
  if (typeof window === 'undefined') return false;
  return Boolean(/** @type {any} */ (window).Capacitor?.isNativePlatform());
}

export function getPlatform() {
  if (typeof window === 'undefined') return 'web';
  const cap = /** @type {any} */ (window).Capacitor;
  if (!cap?.isNativePlatform()) return 'web';
  return cap.getPlatform() || 'android';
}

export async function requestNotificationPermission() {
  if (isNative()) return true;
  return Notification?.permission === 'granted' || (await Notification?.requestPermission()) === 'granted';
}

export async function registerForPushNotifications() {
  if (!isNative()) return null;
  return null;
}

export async function triggerHapticFeedback() {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate(40); } catch {}
  }
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

/**
 * Share via the Web Share API when available. Degrades to no-op on unsupported
 * browsers (desktop Chrome, older Safari).
 * @param {string} title
 * @param {string} text
 * @param {string} url
 */
export async function shareContent(title, text, url) {
  if (navigator.share) await navigator.share({ title, text, url });
}
