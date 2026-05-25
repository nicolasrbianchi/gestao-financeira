/* global self */

// Web Push Service Worker (PWA)

const SHELL_CACHE = 'nicco-shell-v11';

async function cacheShell() {
  const cache = await caches.open(SHELL_CACHE);

  // Index (SPA entry)
  const indexRes = await fetch('/', { cache: 'no-store' });
  await cache.put('/', indexRes.clone());

  let html = '';
  try { html = await indexRes.clone().text(); } catch { html = ''; }

  // Manifest + ícones
  try {
    await cache.addAll([
      '/manifest.webmanifest',
      '/favicon.jpg',
      '/icons/icon-192.png',
      '/icons/icon-512.png',
      '/icons/icon-512-maskable.png',
      '/icons/apple-touch-icon.png',
      '/icons/icon-192.png?v=11',
      '/icons/icon-512.png?v=11',
      '/icons/icon-512-maskable.png?v=11',
      '/icons/apple-touch-icon.png?v=11',
      '/icons/splash/splash-1290x2796.png',
      '/icons/splash/splash-1179x2556.png',
      '/icons/splash/splash-1170x2532.png',
      '/icons/splash/splash-1125x2436.png',
      '/icons/splash/splash-1242x2688.png',
      '/icons/splash/splash-828x1792.png',
      '/icons/splash/splash-1242x2208.png',
      '/icons/splash/splash-750x1334.png',
    ]);
  } catch { /* ignore */ }

  // Cache best-effort dos assets do build (Vite)
  if (html) {
    const assets = new Set();
    const re = /\/(assets\/[^"'\s>]+\.(?:js|css|png|jpg|jpeg|webp|svg|ico))/g;
    let m;
    // eslint-disable-next-line no-cond-assign
    while ((m = re.exec(html))) {
      assets.add(`/${m[1]}`);
    }
    await Promise.all(
      [...assets].map(async (p) => {
        try { await cache.add(p); } catch { /* ignore */ }
      })
    );
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await cacheShell();
      } catch {
        // ignore
      }
      self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((k) => k.startsWith('nicco-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k)));
      } catch {
        // ignore
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegação SPA: cache-first com fallback pra rede
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match('/');
        try {
          const fresh = await fetch(req);
          // Atualiza cache do index (best-effort)
          try { await cache.put('/', fresh.clone()); } catch { /* ignore */ }
          return fresh;
        } catch {
          return cached || new Response('Offline', { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        try { await cache.put(req, res.clone()); } catch { /* ignore */ }
        return res;
      })()
    );
  }
});

self.addEventListener('push', (event) => {
  const fallback = { title: 'Nicco Finance', body: 'Nova notificação', url: '/', tag: 'nicco' };
  let data = fallback;
  try {
    const raw = event?.data?.text?.() || '';
    if (raw) data = { ...fallback, ...JSON.parse(raw) };
  } catch {
    // ignore
  }

  // Atualiza badge no ícone (best-effort)
  try {
    const badge = Number(data?.badge);
    if (Number.isFinite(badge) && badge >= 0) {
      if (self.registration?.setAppBadge) {
        if (badge > 0) self.registration.setAppBadge(badge);
        else self.registration.clearAppBadge?.();
      }
    }
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
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
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
