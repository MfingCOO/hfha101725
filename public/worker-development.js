/******/ (() => { // webpackBootstrap
importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');
if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage(payload => {
    console.log('[Service Worker] Firebase background message (deprecated): ', payload);
  });
}
self.addEventListener('push', function (event) {
  console.log('[Service Worker] Push Received.');
  if (!event.data) {
    console.warn('[Service Worker] Push event contained no data.');
    return;
  }
  try {
    var _payload$data, _payload$notification, _payload$data2, _payload$notification2, _payload$data3, _payload$data4, _payload$data5, _payload$notification3;
    const payload = event.data.json();
    console.log('[Service Worker] Push payload: ', payload);
    const notificationTitle = ((_payload$data = payload.data) === null || _payload$data === void 0 ? void 0 : _payload$data.title) || ((_payload$notification = payload.notification) === null || _payload$notification === void 0 ? void 0 : _payload$notification.title) || 'New Notification';

    // Construct notification options from the richer data payload
    const notificationOptions = {
      body: ((_payload$data2 = payload.data) === null || _payload$data2 === void 0 ? void 0 : _payload$data2.body) || ((_payload$notification2 = payload.notification) === null || _payload$notification2 === void 0 ? void 0 : _payload$notification2.body),
      icon: ((_payload$data3 = payload.data) === null || _payload$data3 === void 0 ? void 0 : _payload$data3.icon) || '/icon-192x192.png',
      // Default icon
      badge: ((_payload$data4 = payload.data) === null || _payload$data4 === void 0 ? void 0 : _payload$data4.badge) || '/icon-192x192.png',
      // Solves the badge 404 issue
      image: ((_payload$data5 = payload.data) === null || _payload$data5 === void 0 ? void 0 : _payload$data5.image) || ((_payload$notification3 = payload.notification) === null || _payload$notification3 === void 0 ? void 0 : _payload$notification3.image),
      data: payload.data // Crucial: Pass all data to the click handler
    };
    const notificationPromise = self.registration.showNotification(notificationTitle, notificationOptions);
    event.waitUntil(notificationPromise);
  } catch (e) {
    console.error('[Service Worker] Error processing push event:', e);
  }
});
self.addEventListener('notificationclick', event => {
  const notification = event.notification;
  const data = notification.data;
  notification.close();
  console.log('[Service Worker] Notification click received.', data);

  // --- THIS IS THE CRITICAL FIX ---
  // Prioritize the `url` field sent from our server.
  const urlToOpen = data === null || data === void 0 ? void 0 : data.url;
  if (!urlToOpen) {
    console.error('[Service Worker] No URL found in notification data. Cannot open window.');
    return;
  }
  console.log(`[Service Worker] Attempting to open or focus URL: ${urlToOpen}`);
  event.waitUntil(self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clientList => {
    // Check if a window with the app's origin is already open.
    for (const client of clientList) {
      // Use new URL() to easily compare origins, ignoring paths.
      const clientUrl = new URL(client.url);
      if (clientUrl.origin === self.location.origin && 'focus' in client) {
        console.log('[Service Worker] App window is already open. Posting message and focusing.');
        // If the app is open, we don't navigate. We post a message so the in-app
        // NotificationActionHandler can decide what to do (e.g., smoothly navigate).
        client.postMessage({
          type: 'notification_clicked',
          data: data
        });
        return client.focus();
      }
    }

    // If the app is not open, open a new window to the specified URL.
    if (self.clients.openWindow) {
      console.log('[Service Worker] App not open. Opening new window.');
      return self.clients.openWindow(urlToOpen);
    }
  }));
});
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  self.skipWaiting(); // Force the new service worker to activate immediately
});
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(self.clients.claim()); // Take control of all open pages
});
/******/ })()
;