// DairyDrop Service Worker for Web Push & PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle incoming Web Push notification
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { title: 'DairyDrop', body: event.data.text() };
    }
  }

  const title = data.title || 'DairyDrop Alert';
  const options = {
    body: data.body || 'You have an update on DairyDrop.',
    icon: data.icon || '/image.png',
    badge: data.badge || '/image.png',
    tag: data.tag || 'dairydrop-general',
    renotify: true,
    vibrate: [100, 50, 100],
    data: {
      href: data.href || '/',
      ...data.data,
    },
    actions: [
      { action: 'open', title: 'Open DairyDrop' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Handle notification tap / click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.href) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus and navigate it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new tab/window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
