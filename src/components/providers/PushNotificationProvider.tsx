'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, PushNotificationSchema } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast'; // <-- ADDED: This was missing

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast(); // <-- ADDED: This was missing

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

    // --- START OF ADDED CODE BLOCK ---
    // This listener handles notifications that are received while the app is in the foreground.
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Push notification received in foreground: ', notification);
        toast({
          title: notification.title || 'New Notification',
          description: notification.body || '',
        });
      },
    );

    // This listener handles what happens when a user taps on a notification.
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (notification) => {
        console.info('Push notification action performed:', notification);
        // Here you can add logic to navigate the user to a specific page
        // based on the notification data, e.g., router.push(notification.data.url)
      }
    );
    // --- END OF ADDED CODE BLOCK ---

  }, [user, toast]); // Added toast to dependency array

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