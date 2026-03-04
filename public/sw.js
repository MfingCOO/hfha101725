// Import the config and the Firebase libraries
importScripts('/firebase-config.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handler for background messages (when the app is not in the foreground)
// This is responsible for showing the system notification.
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message: ', payload);
  const notificationTitle = payload.data.title;
  const notificationOptions = {
    body: payload.data.body,
    icon: '/favicon.ico',
    // Store all the data from the push payload into the notification's data attribute
    data: payload.data
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handler for when the user clicks the notification
self.addEventListener('notificationclick', (event) => {
  console.log('[sw.js] Notification click received.', event.notification.data);
  event.notification.close();

  const data = event.notification.data;
  const urlToOpen = new URL(self.location.origin);

  // Dynamically add all data properties as search parameters
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      urlToOpen.searchParams.append(key, data[key]);
    }
  }

  // This will open a URL like: https://site.com/?notificationType=chat&chatId=123...
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then(clientList => {
      // If a window for the app is already open, focus it and navigate it to the new URL
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        client.focus();
        return client.navigate(urlToOpen.href);
      }
      // Otherwise, open a new window
      return clients.openWindow(urlToOpen.href);
    })
  );
});
