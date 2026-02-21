
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// Initialize Firebase
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

// --- ROBUST BACKGROUND MESSAGE HANDLER ---
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  // Extract notification data from the main `data` payload for consistency
  const notificationTitle = payload.data.title || 'New Message';
  const notificationOptions = {
    body: payload.data.body || '',
    icon: '/icon.png',
    // Use a unique tag to prevent duplicate notifications from stacking
    tag: payload.data.entityId || notificationTitle,
    // Store the critical URL for the click event
    data: { 
      url: payload.data.ctaUrl || '/' 
    }
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- ROBUST NOTIFICATION CLICK HANDLER ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

  console.log('[firebase-messaging-sw.js] Notification clicked. URL to open:', urlToOpen);

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    // Check if a window for this app is already open.
    if (clientList.length > 0) {
      let client = clientList[0];
      // Find the most recently focused client.
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].focused) {
          client = clientList[i];
        }
      }
      // Focus the client and navigate it to the correct URL.
      return client.focus().then(cli => cli.navigate(urlToOpen));
    }
    // If no window is open, open a new one.
    return clients.openWindow(urlToOpen);
  });

  event.waitUntil(promiseChain);
});
