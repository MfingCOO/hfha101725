declare const firebase: any;
declare const firebaseConfig: any; // Add this line to inform TypeScript

// --- 1. IMPORT FIREBASE LIBRARIES & CONFIG ---
importScripts('/firebase-config.js'); // Load the configuration
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// --- 2. INITIALIZE FIREBASE ---
// The firebaseConfig object is now available from the imported script.
if (firebaseConfig) {
  firebase.initializeApp(firebaseConfig);
}

// Get a reference to the Firebase Messaging service
const messaging = firebase.messaging();

// --- 3. WORKBOX & PWA CACHING ---
if (!((self as any).define)) {
  let registry = {};
  let nextDefineUri: string;

  const singleRequire = (uri: string, parentUri: string) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
        new Promise<void>(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = () => resolve();
            script.onerror = () => { throw new Error(`Failed to load ${uri}`) };
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  (self as any).define = (depsNames: string[], factory: (...args: any[]) => any) => {
    const uri = nextDefineUri || ("document" in self ? (document.currentScript as HTMLScriptElement)?.src : "") || location.href;
    if (registry[uri]) { return; }
    let exports = {};
    const require = (depUri: string) => singleRequire(depUri, uri);
    const specialDeps = { module: { uri }, exports, require };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}

(self as any).define(['./workbox-e43f5367'], (function (workbox: any) { 'use strict';
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
  if(workbox && workbox.clientsClaim) {
    workbox.clientsClaim();
    workbox.registerRoute("/", new workbox.NetworkFirst({ cacheName: "start-url", plugins: [] }), 'GET');
    workbox.registerRoute(/.*/i, new workbox.NetworkOnly({ cacheName: "dev", plugins: [] }), 'GET');
  }
}));

// --- 4. CUSTOM PUSH & NOTIFICATION CLICK HANDLERS ---
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.data.senderName ? `${payload.data.senderName} in ${payload.data.chatName}` : (payload.notification?.title || 'New Message');
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.messageText,
    icon: payload.data?.senderAvatar || '/favicon.ico',
    image: payload.data?.imageUrl,
    data: payload.data
  };

  return (self as unknown as ServiceWorkerGlobalScope).registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event: Event) => {
  const notificationEvent = event as NotificationEvent;
  notificationEvent.notification.close();
  const urlToOpen = new URL(notificationEvent.notification.data.link, self.location.origin).href;

  notificationEvent.waitUntil(
      (self as unknown as ServiceWorkerGlobalScope).clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList: readonly WindowClient[]) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.postMessage({ type: 'notification_clicked', data: notificationEvent.notification.data });
                    return client.focus();
                }
            }
            return (self as unknown as ServiceWorkerGlobalScope).clients.openWindow(urlToOpen);
        })
  );
});
