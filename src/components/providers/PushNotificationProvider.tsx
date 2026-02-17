'use client';

import { useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { getApp } from 'firebase/app';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChatModalStore } from '@/store/ui-store';
import { useWorkoutModalStore } from '@/store/ui-store';

const app = getApp();

const callSaveFcmTokenHttp = async (fcmToken: string, isCoach: boolean, getIdToken: () => Promise<string | null>) => {
    const idToken = await getIdToken();
    if (!idToken) {
        console.error("Could not get ID token, cannot save FCM token.");
        return;
    }
    const functionUrl = 'https://us-central1-hunger-free-and-happy-app.cloudfunctions.net/saveFcmToken';
    const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ data: { token: fcmToken, isCoach: isCoach } }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to save FCM token. Status: ${response.status}. Message: ${errorText}`);
    }
    return response.json();
};


const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isCoach, getIdToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { openModal: openChatModal } = useChatModalStore();
  const { openModal: openWorkoutModal } = useWorkoutModalStore();

  const handleNotificationAction = useCallback((data: { [key: string]: string }) => {
    console.log("Handling notification action with data:", data);
    const { notificationType, entityId } = data;

    if (notificationType && entityId) {
      switch (notificationType) {
        case 'chat':
          console.log(`Opening chat modal for entityId: ${entityId}`)
          openChatModal(entityId);
          break;
        case 'workout':
           console.log(`Opening workout modal for entityId: ${entityId}`)
           openWorkoutModal(entityId);
          break;
        default:
          console.warn(`Unknown notificationType received: ${notificationType}`);
      }
    }
  }, [openChatModal, openWorkoutModal]);

  useEffect(() => {
    // **THE FIX**: Check if searchParams is available before using it.
    if (searchParams) {
        const notificationType = searchParams.get('notificationType');
        const entityId = searchParams.get('entityId');

        if (notificationType && entityId) {
            handleNotificationAction({ notificationType, entityId });
            // Clean the URL to remove the query parameters after handling.
            router.replace('/client/dashboard', { scroll: false });
        }
    }
  }, [searchParams, handleNotificationAction, router]);

  useEffect(() => {
    if (user && getIdToken && Capacitor.isNativePlatform()) {
      const registerAndListen = async () => {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
            return;
        }
        
        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token: Token) => {
          try {
            await callSaveFcmTokenHttp(token.value, isCoach, getIdToken);
          } catch (error) {
            console.error('Error saving native FCM token:', error);
          }
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            let data = action.notification.data;

            if (!data || Object.keys(data).length === 0) {
                const title = action.notification.title || '';
                if (title.startsWith('[')) {
                    try {
                        const parts = title.substring(1, title.indexOf(']')).split(':');
                        const type = parts[0];
                        const id = parts[1];
                        data = { notificationType: type, entityId: id };
                    } catch (e) {
                        console.error("Error parsing Android title for notification data:", e)
                    }
                }
            }
            
            handleNotificationAction(data);
        });
      };

      registerAndListen();

      return () => {
        PushNotifications.removeAllListeners();
      };
    }
  }, [user, isCoach, getIdToken, handleNotificationAction]);

  useEffect(() => {
    if (user && getIdToken && !Capacitor.isNativePlatform()) {
      const registerForWebPush = async () => {
        try {
          const messaging = getMessaging(app);
          const currentToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });

          if (currentToken) {
            await callSaveFcmTokenHttp(currentToken, isCoach, getIdToken);
            onMessage(messaging, (message) => {
              console.log('New foreground notification from Firebase Messaging!', message.notification);
            });
          } else {
            console.warn('No FCM token available. Notification permission might be denied.');
          }
        } catch (error) {
            console.error('Error during web push registration or saving FCM token:', error);
        }
      };

      registerForWebPush();
    }
  }, [user, isCoach, getIdToken]);

  return <>{children}</>;
};

export default PushNotificationProvider;
