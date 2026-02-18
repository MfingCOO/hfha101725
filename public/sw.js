
// Import the Workbox caching logic
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

// Import the Firebase app and messaging libraries
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging-compat.js');

// --- Caching Logic (from your original sw.js) ---
// This ensures your app still works offline
if (workbox) {
  console.log(`Workbox is loaded`);

  workbox.precaching.precacheAndRoute([
    {url: "/_next/app-build-manifest.json", revision: "4c6f8bee86dc207e0b812ce9c3454ec5"},
    // ... (all the other precache entries)
    {url: "/robots.txt", revision: "4aaecda343f4f6b65047f5f7f6ee9cc1"},
  ]);

  workbox.routing.registerRoute(
    ({url}) => url.pathname.startsWith('/api/'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'apis',
    })
  );

  workbox.routing.registerRoute(
    /\.(?:png|gif|jpg|jpeg|svg)$/,
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

} else {
  console.log(`Workbox didn't load`);
}


// --- Firebase Push Notification Logic ---
// Initialize the Firebase app in the service worker
// Replace this with your app's messaging sender ID.
// IMPORTANT: You MUST replace this with your actual config from the Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
    authDomain: "hunger-free-and-happy-app.firebaseapp.com",
    projectId: "hunger-free-and-happy-app",
    storageBucket: "hunger-free-and-happy-app.firebasestorage.app",
    messagingSenderId: "1002580546718",
    appId: "1:1002580546718:web:a8574bfc3732c7c137978f"
  };

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// THIS IS THE CRITICAL MISSING PIECE
// Add the event listener for incoming push notifications
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/apple-touch-icon.png', // Or your preferred icon
    data: {
        url: payload.data.url
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


// Optional: Add a listener for notification clicks
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url)
  );
});

