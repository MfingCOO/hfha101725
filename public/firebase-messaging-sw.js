
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  authDomain: "hunger-free-and-happy-app.firebaseapp.com",
  projectId: "hunger-free-and-happy-app",
  storageBucket: "hunger-free-and-happy-app.appspot.com",
  messagingSenderId: "1002580546718",
  appId: "1:1002580546718:web:a8574bfc3732c7c137978f"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  const notificationTitle = payload.data.title || 'New Message';
  const notificationOptions = {
    body: payload.data.body || '',
    icon: '/icon.png',
    tag: payload.data.chatId || payload.data.entityId || 'new-message',
    // THE FIX: We pass the raw notification data to the app. The app decides what to do with it.
    data: payload.data 
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- THE DEFINITIVE NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // THE FIX: The service worker's ONLY job is to open or focus the application.
  // It does NOT handle routing. The React app handles all routing logic.
  const rootUrl = new URL('/', self.location.origin).href;

  console.log('[firebase-messaging-sw.js] Notification clicked. Focusing or opening app at root.');

  // This promise chain finds an existing app window or opens a new one.
  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    // Check if a window for this app is already open and focus it.
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        return client.focus();
      }
    }
    // If no window is open, open a new one at the root URL.
    return clients.openWindow(rootUrl);
  });

  event.waitUntil(promiseChain);
});
