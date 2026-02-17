
'use client';

import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';

const app = getApp();

// --- NEW HTTP FETCH LOGIC ---
const callSaveFcmTokenHttp = async (fcmToken: string, isCoach: boolean, getIdToken: () => Promise<string | null>) => {
    const idToken = await getIdToken();
    if (!idToken) {
        console.error("Could not get ID token, cannot call saveFcmToken function.");
        return;
    }

    const functionUrl = 'https://us-central1-hunger-free-and-happy-app.cloudfunctions.net/saveFcmToken';

    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
            data: {
                token: fcmToken,
                isCoach: isCoach,
            },
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save FCM token. Status: ${response.status}. Message: ${errorText}`);
    }

    return response.json();
};


const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isCoach, getIdToken } = useAuth(); // This will now correctly receive getIdToken
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const handleNotificationAction = (notification: PushNotificationSchema) => {
    console.log('Push notification action performed', notification);
    if (notification.data.chatId) {
      // Example: navigate(`/chat/${notification.data.chatId}`);
    }
  };

  const registerForWebPush = useCallback(async () => {
    if (!user || !getIdToken) {
      console.log("User or getIdToken not available yet, cannot register for web push.");
      return;
    }

    try {
      const messaging = getMessaging(app);
      const currentToken = await getToken(messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      });

      if (currentToken) {
        console.log('Got FCM device token:', currentToken);
        setFcmToken(currentToken);

        console.log("Calling saveFcmToken HTTP Function...");
        await callSaveFcmTokenHttp(currentToken, isCoach, getIdToken);
        console.log("FCM token successfully saved via HTTP Function!");

        onMessage(messaging, (message) => {
          console.log('New foreground notification from Firebase Messaging!', message.notification);
        });

      } else {
        console.warn('No FCM token available. Notification permission might be denied or VAPID key is missing.');
      }
    } catch (error) {
        console.error('Error during web push registration or saving FCM token:', error);
    }
  }, [user, isCoach, getIdToken]);

  // This effect handles the initial registration for web push.
  useEffect(() => {
    if (user && !fcmToken && !Capacitor.isNativePlatform()) {
      registerForWebPush();
    }
  }, [user, fcmToken, registerForWebPush]);

  // This effect handles native device registration and listeners.
  useEffect(() => {
    if (user && getIdToken && Capacitor.isNativePlatform()) {
      const registerDevice = async () => {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive === 'granted') {
          await PushNotifications.register();
        }
      };

      const addListeners = async () => {
        await PushNotifications.addListener('registration', async (token: Token) => {
          try {
            console.log('Calling saveFcmToken HTTP Function for native device...');
            await callSaveFcmTokenHttp(token.value, isCoach, getIdToken);
            console.log('FCM token successfully saved for native device!');
          } catch (error) {
            console.error('Error saving native FCM token:', error);
          }
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('Error on native push registration', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
          console.log('Native push received', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          handleNotificationAction(notification.notification);
        });
      };

      registerDevice();
      addListeners();
    }
  }, [user, isCoach, getIdToken]);

  return <>{children}</>;
};

export default PushNotificationProvider;
