
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
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notificationData = event.notification.data;
  let targetUrl = new URL('/', self.location.origin).href; // Default URL

  console.log('[firebase-messaging-sw.js] Notification clicked:', notificationData);

  // Check if it's an appointment reminder with an entityId
  if (notificationData && notificationData.notificationType === 'appointment_reminder' && notificationData.entityId) {
    targetUrl = new URL(`/calendar?eventId=${notificationData.entityId}`, self.location.origin).href;
    console.log(`[firebase-messaging-sw.js] Opening appointment URL: ${targetUrl}`);
  } else {
    console.log(`[firebase-messaging-sw.js] Opening default root URL: ${targetUrl}`);
  }

  const promiseChain = clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clientList) => {
    for (const client of clientList) {
      if ('navigate' in client && client.url.startsWith(self.location.origin)) {
        client.navigate(targetUrl);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl);
  });

  event.waitUntil(promiseChain);
});
