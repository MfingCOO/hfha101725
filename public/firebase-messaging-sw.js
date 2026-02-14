// Import the Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// This is the same Firebase configuration object from your app
const firebaseConfig = {
  "projectId": "hunger-free-and-happy-app",
  "appId": "1:1002580546718:web:a8574bfc3732c7c137978f",
  "storageBucket": "hunger-free-and-happy-app.appspot.com",
  "apiKey": "AIzaSyAk8vuQj8JfEyweNdtK9en9uUk6amEblYo",
  "authDomain": "hunger-free-and-happy-app.firebaseapp.com",
  "messagingSenderId": "1002580546718"
};

// Initialize the Firebase app in the service worker
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

// Handler for background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Correctly read title, body, and chatId from the 'data' payload for webpush
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/logo.png', // A default icon
    // Store the chatId in the notification's data attribute to use on click
    data: {
      chatId: payload.data.chatId
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handler for when a user clicks on the notification
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);

  // Close the notification
  event.notification.close();

  const chatId = event.notification.data?.chatId;
  if (chatId) {
    // Open the correct chat window
    const promise = clients.openWindow(`/chat/${chatId}`);
    event.waitUntil(promise);
  } else {
    console.log('[firebase-messaging-sw.js] No chatId found in notification data.');
    // Optional: open a generic page if no chatId is found
    const promise = clients.openWindow('/');
    event.waitUntil(promise);
  }
});
