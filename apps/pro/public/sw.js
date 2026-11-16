/* Notifications sur le téléphone (Web Push) : affichées même quand le site est fermé. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Depanno Expresse';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || '',
    icon: '/images/push/icone-192.png',
    badge: '/images/push/badge-96.png',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || '/' },
    lang: 'fr',
    vibrate: [120, 60, 120],
  }));
});

// Toucher la notification ouvre la bonne page (ou ramène l'onglet déjà ouvert).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin);
  if (target.origin !== self.location.origin) target.href = self.location.origin + '/';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of windows) {
      if (new URL(w.url).origin === target.origin) {
        await w.focus();
        if ('navigate' in w) return w.navigate(target.href).catch(() => {});
        return;
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
