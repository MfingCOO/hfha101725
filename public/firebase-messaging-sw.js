
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

// THIS IS THE CORE LOGIC FOR HANDLING INCOMING MESSAGES
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );

  // A proper notification payload will have this object.
  // A silent data-only payload will NOT.
  if (payload.notification) {
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
      body: payload.notification.body,
      icon: '/icon.png',
      // This is the critical part for handling clicks.
      // It stores the URL from the backend payload.
      data: { 
        url: payload.fcmOptions?.link || '/' 
      }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  }
});

// THIS IS THE EVENT HANDLER FOR WHEN A USER CLICKS THE NOTIFICATION
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's an already-open tab for your app.
      for (const client of clientList) {
        // If we find an open tab, focus it.
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If we don't find an open tab, create a new one.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
