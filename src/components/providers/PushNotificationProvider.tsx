'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();

  const registerDevice = useCallback(async () => {
    if (!user || !Capacitor.isNativePlatform()) return;

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        throw new Error('User denied permissions!');
      }

      await PushNotifications.register();
    } catch (error) {
      console.error('Error during push notification registration:', error);
    }
  }, [user]);

  const addListeners = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;

    await PushNotifications.addListener('registration', async (token) => {
      if (user) {
        console.info('Registration token found', token.value);
        const userRef = doc(db, 'userProfiles', user.uid);
        await updateDoc(userRef, { fcmTokens: arrayUnion(token.value) });
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration:', JSON.stringify(error));
    });

    // The 'pushNotificationReceived' listener has been intentionally removed.
    // This ensures that all incoming notifications are handled by the native
    // Android service, which will always create a system notification banner.
    // This creates a consistent user experience.

    // This listener handles what happens when a user taps on a notification.
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.info('Push notification action performed:', notification);
        // Logic to navigate the user on tap can be added here.
        // e.g., router.push(notification.data.url)
      }
    );

  }, [user]);

  useEffect(() => {
    if (user) {
        registerDevice();
        addListeners();
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user, registerDevice, addListeners]);

  return <>{children}</>;
};

export default PushNotificationProvider;
