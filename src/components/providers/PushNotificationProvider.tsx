'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema, PermissionStatus } from '@capacitor/push-notifications';
import { LocalNotifications, LocalNotificationSchema, LocalNotificationActionPerformed } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChatModalStore, useWorkoutModalStore } from '@/store/ui-store';

// HTTP call function remains unchanged
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

  // --- UNIFIED ACTION HANDLER ---
  const handleNotificationAction = useCallback((data: { [key: string]: any }) => {
    if (!data) {
        console.warn("handleNotificationAction called with no data.");
        return;
    }
    console.log("Handling notification action with data:", data);
    const { notificationType, entityId } = data;

    if (notificationType && entityId) {
      setTimeout(() => {
        switch (String(notificationType)) {
          case 'chat':
            console.log(`Opening chat modal for entityId: ${entityId}`);
            openChatModal(String(entityId));
            break;
          case 'workout':
            console.log(`Opening workout modal for entityId: ${entityId}`);
            openWorkoutModal(String(entityId));
            break;
          default:
            console.warn(`Unknown notificationType received: ${notificationType}`);
        }
      }, 100);
    }
  }, [openChatModal, openWorkoutModal]);

  // --- URL-BASED TRIGGER (The "Landing Pad") ---
  useEffect(() => {
    if (searchParams) {
        const notificationType = searchParams.get('notificationType');
        const entityId = searchParams.get('entityId');
        if (notificationType && entityId) {
            console.log("Detected notification parameters in URL, handling action.");
            handleNotificationAction({ notificationType, entityId });
            router.replace('/client/dashboard', { scroll: false });
        }
    }
  }, [searchParams, handleNotificationAction, router]);

  // --- INITIALIZATION LOGIC ---
  useEffect(() => {
    if (!user || loading || !userProfile || registrationCompletedForUser.current === user.uid) {
      return;
    }

    const initializeNotifications = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
            let permStatus: PermissionStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
            if (permStatus.receive !== 'granted') return;

            PushNotifications.addListener('registration', async (token: Token) => {
                await callSaveFcmTokenHttp(token.value, isCoach, getIdToken);
                registrationCompletedForUser.current = user.uid;
            });
            PushNotifications.addListener('registrationError', console.error);

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                console.log('Native FOREGROUND notification:', notification);
                LocalNotifications.schedule({
                    notifications: [{
                        title: notification.title || 'New Message',
                        body: notification.body || '',
                        id: Date.now(),
                        extra: notification.data,
                        smallIcon: 'res://public/app/icon.png'
                    } as LocalNotificationSchema]
                });
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
                console.log('Native ACTION event (tap)', action);
                handleNotificationAction(action.notification.data);
            });

            LocalNotifications.addListener('localNotificationActionPerformed', (action: LocalNotificationActionPerformed) => {
                console.log('Local notification ACTION event (tap)', action);
                handleNotificationAction(action.notification.extra);
            });
            
            await PushNotifications.register();
        } else {
          if (!messaging) return;
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;

          const currentToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });

          if (currentToken) {
              await callSaveFcmTokenHttp(currentToken, isCoach, getIdToken);
              registrationCompletedForUser.current = user.uid;
              
              onMessage(messaging, (message) => {
                console.log('Web FOREGROUND notification:', message);
                if (message.data) {
                  const { title, body } = message.data;
                  const notification = new Notification(title || 'New Message', {
                    body: body || '',
                    icon: '/apple-touch-icon.png',
                    data: message.data
                  });
                  
                  notification.onclick = (event) => {
                    event.preventDefault();
                    console.log('Foreground web notification CLICKED');
                    handleNotificationAction((event.currentTarget as Notification).data);
                  };
                }
              });
            }
        }
      } catch (error) {
        console.error("Critical error during push notification setup:", error);
        registrationCompletedForUser.current = user.uid;
      }
    };

    initializeNotifications();

    return () => {
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners();
        LocalNotifications.removeAllListeners();
      }
    };

  }, [user, userProfile, isCoach, getIdToken, loading, handleNotificationAction]);

  return <>{children}</>;
};

export default PushNotificationProvider;
