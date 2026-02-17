
// Import the Firebase scripts that are needed
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// This is the same Firebase configuration object from the rest of your app
const firebaseConfig = {
  "projectId": "hunger-free-and-happy-app",
  "appId": "1:1002580546718:web:a8574bfc3732c7c137978f",
  "storageBucket": "hunger-free-and-happy-app.appspot.com",
  "apiKey": "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  "authDomain": "hunger-free-and-happy-app.firebaseapp.com",
  "messagingSenderId": "1002580546718"
};

// Initialize the Firebase app in the service worker
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const messaging = firebase.messaging();

/**
 * =========================================================================================
 *                        BACKGROUND NOTIFICATION HANDLER
 * =========================================================================================
 * This is the entry point for all push notifications when the PWA is not open.
 * It reads the data-only payload from the server and displays a visible notification.
 */
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  // Extract the notification details from the `data` object.
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/apple-touch-icon.png',
    // Pass all the data from the server to the notification
    // This is crucial for the click handler
    data: payload.data 
  };

  // Display the notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

/**
 * =========================================================================================
 *                             NOTIFICATION CLICK HANDLER
 * =========================================================================================
 * This function is triggered when a user clicks on the notification that was displayed.
 * It constructs the deep-link URL and opens the app to that URL.
 */
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event.notification);

  // Close the notification pop-up
  event.notification.close();

  // **THE NEW LOGIC**: Get the deep-link data from the notification payload
  const { notificationType, entityId } = event.notification.data;

  // If we have the necessary data, build the URL with query params.
  if (notificationType && entityId) {
      const targetUrl = `/client/dashboard?notificationType=${notificationType}&entityId=${entityId}`;
      console.log('[firebase-messaging-sw.js] Opening URL:', targetUrl);
      event.waitUntil(clients.openWindow(targetUrl));
  } else {
      // Fallback to just opening the dashboard if data is missing.
      console.log('[firebase-messaging-sw.js] No deep-link data, opening dashboard.');
      event.waitUntil(clients.openWindow('/client/dashboard'));
  }
});
