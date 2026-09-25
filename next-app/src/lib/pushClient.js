const DEFAULT_VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZfIjSPOQVZVt0Tzx5426Q1HTINWzz6F_joBp-0';

function urlBase64ToUint8Array(base64String) {
  if (!base64String || typeof base64String !== 'string') {
    return new Uint8Array(0);
  }
  const clean = base64String.replace(/['"]/g, '').trim();
  const padding = '='.repeat((4 - (clean.length % 4)) % 4);
  const base64 = (clean + padding).replace(/-/g, '+').replace(/_/g, '/');
  try {
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (e) {
    console.warn('[pushClient] Failed to decode VAPID public key:', e);
    return new Uint8Array(0);
  }
}

/** Check if Web Push is supported by the current browser */
export function isPushNotificationSupported() {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** Register the service worker */
export async function registerServiceWorker() {
  if (!isPushNotificationSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
}

/** Get current permission state: 'default' | 'granted' | 'denied' | 'unsupported' */
export function getPushPermissionState() {
  if (!isPushNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission and subscribe device with VAPID key
 */
export async function subscribeUserToPush() {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser.');
  }

  const rawKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPublicKey =
    rawKey && rawKey.trim().length > 30 ? rawKey.trim().replace(/['"]/g, '') : DEFAULT_VAPID_PUBLIC_KEY;

  // 1. Request permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  // 2. Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    throw new Error('Failed to register service worker.');
  }

  // Wait for service worker to be ready
  await navigator.serviceWorker.ready;

  // 3. Subscribe with push manager
  const convertedKey = urlBase64ToUint8Array(vapidPublicKey);
  if (!convertedKey || convertedKey.length === 0) {
    throw new Error('Invalid VAPID public key format.');
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: convertedKey,
  });

  // 4. Send subscription to server
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription }),
  });

  if (!response.ok) {
    throw new Error('Failed to save push subscription on server.');
  }

  return subscription;
}

/**
 * Unsubscribe user from push notifications
 */
export async function unsubscribeUserFromPush() {
  if (!isPushNotificationSupported()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // 1. Delete on server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      // 2. Unsubscribe browser
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error('Error during push unsubscription:', err);
  }
}
