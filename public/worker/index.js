/**
 * Hunger Free & Happy - Service Worker Source
 * This file is processed by next-pwa to generate the final public/sw.js
 */

// 1. WORKBOX LOADER & REGISTRY
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
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) return;
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}

// 2. WORKBOX ROUTING & CACHING
// Note: next-pwa will resolve the workbox hash automatically
define(['./workbox-e43f5367'], (function (workbox) { 
  'use strict';

  importScripts("worker-development.js");

  self.skipWaiting();
  workbox.clientsClaim();

  // Cache the start URL
  workbox.registerRoute("/", new workbox.NetworkFirst({ 
    "cacheName": "start-url", 
    plugins: [{ 
      cacheWillUpdate: async ({ response }) => { 
        if (response && response.type === 'opaqueredirect') { 
          return new Response(response.body, { status: 200, statusText: 'OK', headers: response.headers }); 
        } 
        return response; 
      } 
    }] 
  }), 'GET');

  // NetworkOnly for everything else in development to prevent stale builds
  workbox.registerRoute(/.*/i, new workbox.NetworkOnly({ "cacheName": "dev", plugins: [] }), 'GET');
}));

// 3. FIREBASE MESSAGING (BACKGROUND HANDLERS)
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f",
});

const messaging = firebase.messaging();

// Display notification when app is in background/closed
messaging.onBackgroundMessage((payload) => {
  console.log('[Worker] Background message received:', payload);
  const notificationTitle = payload.notification.title || 'Hunger Free & Happy';
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icons/icon-192x192.png',
    data: payload.data, // Contains chatId, workoutId, etc.
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to open app and trigger Provider logic
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and send the data
      if (clientList.length > 0) {
        let client = clientList[0];
        client.focus();
        return client.postMessage({
          type: 'notification_clicked',
          data: event.notification.data
        });
      }
      // Otherwise open a new window
      return clients.openWindow('/');
    })
  );
});