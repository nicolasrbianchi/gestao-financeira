/* global self */

// Web Push Service Worker (PWA)

self.addEventListener('push', (event) => {
  const fallback = { title: 'Nicco Finance', body: 'Nova notificação', url: '/', tag: 'nicco' };
  let data = fallback;
  try {
    const raw = event?.data?.text?.() || '';
    if (raw) data = { ...fallback, ...JSON.parse(raw) };
  } catch {
    // ignore
  }

  const title = String(data.title || fallback.title);
  const body = String(data.body || fallback.body);
  const url = String(data.url || fallback.url);
  const tag = String(data.tag || fallback.tag);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/favicon.jpg',
      badge: '/favicon.jpg',
      data: { url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event?.notification?.data?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of allClients) {
        if ('focus' in client) {
          try {
            // mesma origem
            const u = new URL(url, self.location.origin);
            if (client.url.startsWith(self.location.origin)) {
              await client.focus();
              if ('navigate' in client) await client.navigate(u.toString());
              return;
            }
          } catch {
            // ignore
          }
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })()
  );
});

