'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  const initPush = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    // Wait for the capacitor platform to be ready
    await Capacitor.ready();

    // Create the notification channel
    await LocalNotifications.createChannel({
      id: 'default',
      name: 'Default',
      description: 'Default channel for notifications',
      importance: 5, // This is the highest importance, for pop-up notifications
      visibility: 1, // Public visibility
      vibration: true,
    });

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        throw new Error('User denied permissions for push notifications.');
      }

      await PushNotifications.register();
    } catch (error) {
      console.error('Error during push notification registration:', error);
    }

    await PushNotifications.addListener('registration', async (token) => {
      if (!user) {
        console.error('FCM registration token received, but no user is logged in.');
        return;
      }

      console.log(`FCM Registration token received: ${token.value}`);
      try {
        const userRef = doc(db, 'userProfiles', user.uid);
        await updateDoc(userRef, { fcmTokens: arrayUnion(token.value) });
        console.log('Successfully saved FCM token to Firestore.');
      } catch (error) {
        console.error('Error saving FCM token to Firestore:', error);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on push registration:', JSON.stringify(error));
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('Push notification received in foreground: ', notification);

        await LocalNotifications.schedule({
          notifications: [
            {
              title: notification.title || 'New Notification',
              body: notification.body || 'You have a new message.',
              id: new Date().getTime(),
              extra: notification.data,
              smallIcon: 'ic_launcher',
              channelId: 'default', // Assign the notification to our new channel
            },
          ],
        });
      },
    );
  }, [user]);

  useEffect(() => {
    initPush();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [initPush]);

  return <>{children}</>;
};

export default PushNotificationProvider;
