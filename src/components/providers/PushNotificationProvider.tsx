'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChatModalStore, useWorkoutModalStore } from '@/store/ui-store';

const app = getApp();

const callSaveFcmTokenHttp = async (fcmToken: string, isCoach: boolean, getIdToken: () => Promise<string | null>) => {
    const idToken = await getIdToken();
    if (!idToken) {
        console.error("Auth token not available. Cannot save FCM token.");
        return;
    }
    const functionUrl = 'https://us-central1-hunger-free-and-happy-app.cloudfunctions.net/saveFcmToken';
    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ data: { token: fcmToken, isCoach } }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to save FCM token. Status: ${response.status}. Message: ${errorText}`);
        }
        console.log('Successfully saved FCM token to backend.');
        return response.json();
    } catch (error) {
        console.error("Error saving FCM token to backend:", error);
    }
};

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, userProfile, isCoach, getIdToken, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { openModal: openChatModal } = useChatModalStore();
  const { openModal: openWorkoutModal } = useWorkoutModalStore();
  
  const registrationCompletedForUser = useRef<string | null>(null);

  const handleNotificationAction = useCallback((data: { [key: string]: any }) => {
    console.log("Handling notification action with data:", data);
    const { notificationType, entityId } = data;

    if (notificationType && entityId) {
      switch (String(notificationType)) {
        case 'chat':
          openChatModal(String(entityId));
          break;
        case 'workout':
           openWorkoutModal(String(entityId));
          break;
        default:
          console.warn(`Unknown notificationType received: ${notificationType}`);
      }
    }
  }, [openChatModal, openWorkoutModal]);

  useEffect(() => {
    if (searchParams) {
        const notificationType = searchParams.get('notificationType');
        const entityId = searchParams.get('entityId');
        if (notificationType && entityId) {
            handleNotificationAction({ notificationType, entityId });
            router.replace('/client/dashboard', { scroll: false });
        }
    }
  }, [searchParams, handleNotificationAction, router]);

  useEffect(() => {
    if (!user || loading || !userProfile || registrationCompletedForUser.current === user.uid) {
      return;
    }

    const initializeNotifications = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }
            if (permStatus.receive !== 'granted') {
                console.warn('Native push permission not granted.');
                return;
            }

            PushNotifications.removeAllListeners();

            PushNotifications.addListener('registration', async (token: Token) => {
                console.log('Native push registration success, token:', token.value);
                await callSaveFcmTokenHttp(token.value, isCoach, getIdToken);
                registrationCompletedForUser.current = user.uid;
            });

            PushNotifications.addListener('registrationError', (err: any) => {
                console.error('Native push registration error:', err);
            });

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                console.log('Native foreground notification received:', notification);
                LocalNotifications.schedule({
                    notifications: [{
                        title: notification.title || 'New Notification',
                        body: notification.body || '',
                        id: Date.now(),
                        extra: notification.data,
                        smallIcon: 'res://public/app/icon.png'
                    }]
                });
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
                console.log('Native notification action performed');
                handleNotificationAction(action.notification.data);
            });
            
            await PushNotifications.register();

        } else {
          const messaging = getMessaging(app);
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.warn('Web push notification permission not granted. Will not attempt to get token.');
            return; // Stop execution if permission is not granted.
          }

          // Manually register the service worker to ensure it works on production.
          const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

          const currentToken = await getToken(messaging, { 
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: swRegistration
          });

          if (currentToken) {
              console.log('Web push registration success, token:', currentToken);
              await callSaveFcmTokenHttp(currentToken, isCoach, getIdToken);
              registrationCompletedForUser.current = user.uid;
              
              onMessage(messaging, (message) => {
                console.log('Web foreground notification received:', message);
              });

            } else {
              console.warn('Could not get web push token. This can happen if the service worker is not set up correctly.');
            }
        }
      } catch (error) {
        console.error("A critical error occurred during push notification initialization. This is likely due to permissions being blocked. The app will continue to run without push notifications.", error);
        registrationCompletedForUser.current = user.uid; // Mark as complete to prevent re-tries that will also fail.
      }
    };

    initializeNotifications();

  }, [user, userProfile, isCoach, getIdToken, loading, handleNotificationAction]);

  return <>{children}</>;
};

export default PushNotificationProvider;
