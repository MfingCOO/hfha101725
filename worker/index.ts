declare const firebase: any;
declare const firebaseConfig: any;

importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload: any) => {
    console.log('[Service Worker] Firebase background message (deprecated): ', payload);
  });
}

self.addEventListener('push', function(event: any) {
  console.log('[Service Worker] Push Received.');
  if (!event.data) {
    console.warn('[Service Worker] Push event contained no data.');
    return;
  }

  try {
    const payload = event.data.json();
    console.log('[Service Worker] Push payload: ', payload);

    const notificationTitle = payload.data?.title || payload.notification?.title || 'New Notification';
    
    // Construct notification options from the richer data payload
    const notificationOptions = {
      body: payload.data?.body || payload.notification?.body,
      icon: payload.data?.icon || '/icon-192x192.png', // Default icon
      badge: payload.data?.badge || '/icon-192x192.png', // Solves the badge 404 issue
      image: payload.data?.image || payload.notification?.image,
      data: payload.data, // Crucial: Pass all data to the click handler
    };

    const notificationPromise = (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(notificationTitle, notificationOptions);
    event.waitUntil(notificationPromise);

  } catch (e) {
    console.error('[Service Worker] Error processing push event:', e);
  }
});

self.addEventListener('notificationclick', (event: any) => {
  const notification = event.notification;
  const data = notification.data;
  notification.close();

  console.log('[Service Worker] Notification click received.', data);

  // --- THIS IS THE CRITICAL FIX ---
  // Prioritize the `url` field sent from our server.
  const urlToOpen = data?.url;

  if (!urlToOpen) {
    console.error('[Service Worker] No URL found in notification data. Cannot open window.');
    return;
  }

  console.log(`[Service Worker] Attempting to open or focus URL: ${urlToOpen}`);

  event.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList: readonly any[]) => {
      // Check if a window with the app's origin is already open.
      for (const client of clientList) {
        // Use new URL() to easily compare origins, ignoring paths.
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && 'focus' in client) {
          console.log('[Service Worker] App window is already open. Posting message and focusing.');
          // If the app is open, we don't navigate. We post a message so the in-app
          // NotificationActionHandler can decide what to do (e.g., smoothly navigate).
          client.postMessage({ type: 'notification_clicked', data: data });
          return client.focus();
        }
      }
      
      // If the app is not open, open a new window to the specified URL.
      if ((self as unknown as ServiceWorkerGlobalScope).clients.openWindow) {
        console.log('[Service Worker] App not open. Opening new window.');
        return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('install', (event: any) => {
  console.log('[Service Worker] Install');
  (self as unknown as any).skipWaiting(); // Force the new service worker to activate immediately
});

self.addEventListener('activate', (event: any) => {
  console.log('[Service Worker] Activate');
  event.waitUntil((self as unknown as any).clients.claim()); // Take control of all open pages
});
