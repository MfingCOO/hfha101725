
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
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );

  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
