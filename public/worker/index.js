/**
 * Hunger Free & Happy - Service Worker Source
 * This file is processed by next-pwa to generate the final public/sw.js
 */

// 1. WORKBOX LOADER & REGISTRY (Boilerplate)
if (!self.define) {
  let registry = {};
  let nextDefineUri;
  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      new Promise(resolve => {
        if ("document" in self) {
          const script = document.createElement("script");
          script.src = uri;
          script.onload = resolve;
          document.head.appendChild(script);
        } else {
          nextDefineUri = uri;
          importScripts(uri);
          resolve();
        }
      })
      .then(() => {
        let promise = registry[uri];
        if (!promise) throw new Error(`Module ${uri} didn’t register its module`);
        return promise;
      })
    );
  };
  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) return;
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = { module: { uri }, exports, require };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}

// 2. WORKBOX ROUTING & CACHING
define(['./workbox-e43f5367'], (function (workbox) {
  'use strict';
  importScripts("worker-development.js");
  self.skipWaiting();
  workbox.clientsClaim();
  workbox.registerRoute("/", new workbox.NetworkFirst({ "cacheName": "start-url", plugins: [{ cacheWillUpdate: async ({ response }) => { if (response && response.type === 'opaqueredirect') { return new Response(response.body, { status: 200, statusText: 'OK', headers: response.headers }); } return response; } }] }), 'GET');
  workbox.registerRoute(/.*/i, new workbox.NetworkOnly({ "cacheName": "dev", plugins: [] }), 'GET');
}));

// 3. FIREBASE MESSAGING (BACKGROUND HANDLERS)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f",
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

// The onBackgroundMessage handler has been removed to prevent OS-level notifications on the PWA.

self.addEventListener('notificationclick', (event) => {
  console.log('[Worker] Notification clicked:', event.notification);
  event.notification.close();

  const data = event.notification.data || {};
  
  // Use the pre-constructed URL from the backend if it exists.
  const targetUrl = data.url || data.ctaUrl;

  if (targetUrl) {
      console.log(`[Worker] Found targetUrl: ${targetUrl}. Opening new window.`);
      event.waitUntil(clients.openWindow(targetUrl));
      return;
  }

  // Fallback if `url` or `ctaUrl` is not provided
  console.log('[Worker] No targetUrl found, constructing from pieces.');
  const isCoach = data.isCoach === 'true';
  const baseUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';
  const urlParams = new URLSearchParams();
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      urlParams.set(key, data[key]);
    }
  }

  const finalUrl = `${baseUrl}?${urlParams.toString()}`;
  console.log(`[Worker] Constructed fallback URL for click event: ${finalUrl}`);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          console.log('[Worker] Found an open client. Focusing and posting message.');
          client.focus();
          client.postMessage({ type: 'notification_clicked', data: data });
          return; 
        }
      }
      console.log(`[Worker] No open client found. Opening new window to: ${finalUrl}`);
      if (clients.openWindow) {
        return clients.openWindow(finalUrl);
      }
    })
  );
});
