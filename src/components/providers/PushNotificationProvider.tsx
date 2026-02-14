'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { getMessaging, getToken } from 'firebase/messaging'; // Import for Web Push

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const router = useRouter();

  // This function remains UNCHANGED and is only for native platforms.
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

      await PushNotifications.addListener('registration', async (token) => {
        console.info('Registration token: ', token.value);
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(token.value),
        });
      });

      await PushNotifications.addListener('registrationError', (error) => {
        console.error('Error on registration: ', JSON.stringify(error));
      });

    } catch (error) {
      console.error('Error registering for push notifications', error);
    }
  }, [user]);

  // This function remains UNCHANGED and is only for native platforms.
  const addListeners = useCallback(async () => {
    if (!user || !Capacitor.isNativePlatform()) return;

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.info('Push notification action performed', action);
        const chatId = action.notification.tag || action.notification.data?.chatId;

        if (chatId && typeof chatId === 'string') {
          console.log(`Navigating to chat: ${chatId}`);
          router.push(`/chat/${chatId}`);
        } else {
          console.log('No valid chatId found in notification action.', action);
        }
      }
    );
  }, [user, router]);

  // NEW: This function is ONLY for the Web (PWA)
  const registerForWebPush = useCallback(async () => {
    if (!user) return;
    try {
      const messaging = getMessaging();
      // IMPORTANT: You need to generate this VAPID key in your Firebase project settings.
      const vapidKey = 'BMyc3iTR9yA9Izs2b8_a-6_Yad1AAdcMJwg1aYprDkHnFveP5nN81vI8a5zFMIp2SEl2BCHZkUP2lHftgyXNNOg'; 
      const currentToken = await getToken(messaging, { vapidKey });

      if (currentToken) {
        console.log('Web FCM registration token:', currentToken);
        const userDocRef = doc(db, 'users', user.uid);
        await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(currentToken),
        });
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } catch (err) {
      console.error('An error occurred while retrieving web token. ', err);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      if (Capacitor.isNativePlatform()) {
        // Native path - REMAINS UNCHANGED
        registerDevice();
        addListeners();
      } else {
        // Web path - NEW AND ISOLATED
        registerForWebPush();
      }
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
      }
    };
  }, [user, registerDevice, addListeners, registerForWebPush]);

  return <>{children}</>;
};

export default PushNotificationProvider;
