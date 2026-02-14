'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed } from '@capacitor/push-notifications';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/auth-provider';
// Import the Next.js router
import { useRouter } from 'next/navigation';

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  // Get the router instance
  const router = useRouter();

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
        // Use arrayUnion to prevent duplicate tokens
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

  const addListeners = useCallback(async () => {
    if (!user || !Capacitor.isNativePlatform()) return;

    // This listener handles what happens when a user taps on a notification.
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.info('Push notification action performed', action);
        
        let chatId: string | undefined;

        // The backend now sends the chatId in the 'tag' for Android to avoid a Capacitor crash.
        // For iOS, it's in the 'data' payload as is standard. We check both.
        if (Capacitor.getPlatform() === 'android') {
            chatId = action.notification.tag;
        } else {
            chatId = action.notification.data?.chatId;
        }

        // If a chatId exists, navigate to the specific chat
        if (chatId && typeof chatId === 'string') {
          console.log(`Navigating to chat: ${chatId}`);
          router.push(`/chat/${chatId}`);
        } else {
          console.log('No valid chatId found in notification.');
        }
      }
    );

  }, [user, router]);

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
