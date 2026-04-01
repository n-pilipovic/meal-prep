// Custom service worker wrapper that extends Angular's ngsw-worker.js
// with notification click handling for Android deep-linking.
importScripts('./ngsw-worker.js');

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || '/meal-prep/today';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes('/meal-prep/') && 'focus' in client) {
            return client.focus().then((c) => c.navigate(targetUrl));
          }
        }
        return clients.openWindow(targetUrl);
      }),
  );
});
