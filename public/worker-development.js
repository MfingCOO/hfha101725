/******/ (() => { // webpackBootstrap
// Add this line to inform TypeScript

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
if (!self.define) {
  let registry = {};
  let nextDefineUri;
  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || new Promise(resolve => {
      if ("document" in self) {
        const script = document.createElement("script");
        script.src = uri;
        script.onload = () => resolve();
        script.onerror = () => {
          throw new Error(`Failed to load ${uri}`);
        };
        document.head.appendChild(script);
      } else {
        nextDefineUri = uri;
        importScripts(uri);
        resolve();
      }
    }).then(() => {
      let promise = registry[uri];
      if (!promise) {
        throw new Error(`Module ${uri} didn’t register its module`);
      }
      return promise;
    });
  };
  self.define = (depsNames, factory) => {
    var _document$currentScri;
    const uri = nextDefineUri || ("document" in self ? (_document$currentScri = document.currentScript) === null || _document$currentScri === void 0 ? void 0 : _document$currentScri.src : "") || location.href;
    if (registry[uri]) {
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: {
        uri
      },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(depName => specialDeps[depName] || require(depName))).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
self.define(['./workbox-e43f5367'], function (workbox) {
  'use strict';

  self.skipWaiting();
  if (workbox && workbox.clientsClaim) {
    workbox.clientsClaim();
    workbox.registerRoute("/", new workbox.NetworkFirst({
      cacheName: "start-url",
      plugins: []
    }), 'GET');
    workbox.registerRoute(/.*/i, new workbox.NetworkOnly({
      cacheName: "dev",
      plugins: []
    }), 'GET');
  }
});

// --- 4. CUSTOM PUSH & NOTIFICATION CLICK HANDLERS ---
messaging.onBackgroundMessage(payload => {
  var _payload$notification, _payload$notification2, _payload$data, _payload$data2, _payload$data3;
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.data.senderName ? `${payload.data.senderName} in ${payload.data.chatName}` : ((_payload$notification = payload.notification) === null || _payload$notification === void 0 ? void 0 : _payload$notification.title) || 'New Message';
  const notificationOptions = {
    body: ((_payload$notification2 = payload.notification) === null || _payload$notification2 === void 0 ? void 0 : _payload$notification2.body) || ((_payload$data = payload.data) === null || _payload$data === void 0 ? void 0 : _payload$data.messageText),
    icon: ((_payload$data2 = payload.data) === null || _payload$data2 === void 0 ? void 0 : _payload$data2.senderAvatar) || '/favicon.ico',
    image: (_payload$data3 = payload.data) === null || _payload$data3 === void 0 ? void 0 : _payload$data3.imageUrl,
    data: payload.data
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});
self.addEventListener('notificationclick', event => {
  const notificationEvent = event;
  notificationEvent.notification.close();
  const urlToOpen = new URL(notificationEvent.notification.data.link, self.location.origin).href;
  notificationEvent.waitUntil(self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then(clientList => {
    for (const client of clientList) {
      if (client.url.includes(self.location.origin) && 'focus' in client) {
        client.postMessage({
          type: 'notification_clicked',
          data: notificationEvent.notification.data
        });
        return client.focus();
      }
    }
    return self.clients.openWindow(urlToOpen);
  }));
});
/******/ })()
;