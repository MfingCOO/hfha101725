
declare const firebase: any;
declare const firebaseConfig: any;

// --- 1. IMPORT FIREBASE LIBRARIES & CONFIG ---
importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- 2. INITIALIZE FIREBASE ---
if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

// --- 3. STANDARD PUSH EVENT HANDLER ---
self.addEventListener('push', function(event: any) {
  console.log('[Service Worker] Push Received.');
  if (!event.data) {
    console.log('[Service Worker] Push event but no data');
    return;
  }
  const payload = event.data.json();
  console.log('[Service Worker] Push payload: ', payload);

  const notificationTitle = payload.notification?.title || 'New Message';

  const notificationOptions = {
    body: payload.notification?.body || payload.data?.messageText,
    icon: payload.data?.senderAvatar || '/favicon.ico',
    image: payload.data?.imageUrl,
    data: payload.data
  };

  const notificationPromise = (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(notificationTitle, notificationOptions);
  event.waitUntil(notificationPromise);
});

// --- 4. NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', (event: any) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  const data = notificationEvent.notification.data;

  // Construct a base URL with all data as query parameters.
  // The app's PushNotificationProvider will handle the rest.
  const url = new URL('/', self.location.origin);
  for (const key in data) {
    if (data[key] !== undefined && data[key] !== null) {
      url.searchParams.append(key, String(data[key]));
    }
  }
  const urlToOpen = url.href;

  notificationEvent.waitUntil(
      (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList: readonly any[]) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    // App is open, send a message.
                    client.postMessage({ type: 'notification_clicked', data: data });
                    return client.focus();
                }
            }
            // App is not open, open a new window with the constructed URL.
            return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(urlToOpen);
        })
  );
});


// --- 5. BACKGROUND MESSAGE HANDLER (Firebase specific Fallback) ---
messaging.onBackgroundMessage((payload: any) => {
  console.log('[firebase-messaging-sw.js] Received background message (This is a fallback). ', payload);
});

// --- 6. STANDARD SERVICE WORKER LIFECYCLE --- 
self.addEventListener('install', (event: any) => {
  console.log('[Service Worker] Install');
  (self as unknown as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
  console.log('[Service Worker] Activate');
  event.waitUntil((self as unknown as any).clients.claim());
});
