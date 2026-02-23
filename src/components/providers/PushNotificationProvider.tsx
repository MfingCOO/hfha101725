'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema, PermissionStatus } from '@capacitor/push-notifications';
import { LocalNotifications, LocalNotificationSchema, LocalNotificationActionPerformed } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { messaging } from '@/lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { useRouter, useSearchParams } from 'next/navigation';
import { useChatModalStore, useWorkoutModalStore, useCalendarStore } from '@/store/ui-store';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';

// **THE FIX:** The function now accepts the idToken directly.
const callSaveFcmTokenHttp = async (fcmToken: string, isCoach: boolean, idToken: string | null) => {
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
  // **THE FIX:** Destructure only what the new AuthContext provides.
  const { user, isCoach, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const { openModal: openChatModal } = useChatModalStore();
  const { openModal: openWorkoutModal } = useWorkoutModalStore();
  const { openModal: openDataEntryModal } = useDataEntryModal();
  const { onOpen: onOpenCalendar } = useCalendarStore();
  
  const registrationCompletedForUser = useRef<string | null>(null);

  const handleNotificationAction = useCallback((data: { [key: string]: any }) => {
    if (!data) {
        console.warn("handleNotificationAction called with no data.");
        return;
    }
    console.log("Handling notification action with data:", data);
    const { notificationType, entityId } = data;

    if (notificationType) { 
      setTimeout(() => {
        switch (String(notificationType)) {
          case 'hydration':
            console.log('Opening hydration modal');
            openDataEntryModal('hydration');
            break;
          case 'chat':
            console.log(`Handling 'chat' notification. ChatID: ${entityId}`);
            openChatModal(entityId ? String(entityId) : undefined);
            break;
          case 'workout':
            if (entityId) {
              console.log(`Opening workout modal for entityId: ${entityId}`);
              openWorkoutModal(String(entityId));
            }
            break;
          case 'appointment_reminder':
          case 'appointment_booked':
            console.log(`Handling '${notificationType}' notification. EventID: ${entityId}`);
            onOpenCalendar(entityId ? String(entityId) : null);
            break;
          default:
            console.warn(`Unknown notificationType received: ${notificationType}`);
        }
      }, 100);
    }
  }, [openChatModal, openWorkoutModal, openDataEntryModal, onOpenCalendar]);

  useEffect(() => {
    if (searchParams) {
        const notificationType = searchParams.get('notificationType');
        const entityId = searchParams.get('entityId');
        if (notificationType) {
            console.log("Detected notification parameters in URL, handling action.");
            handleNotificationAction({ notificationType, entityId });
            router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard', { scroll: false });
        }
    }
  }, [searchParams, handleNotificationAction, router, isCoach]);

  useEffect(() => {
    // **THE FIX:** Removed check for 'userProfile' as it no longer exists.
    if (!user || loading || registrationCompletedForUser.current === user.uid) {
      return;
    }

    const initializeNotifications = async () => {
      try {
        const handleNewToken = async (token: string) => {
            console.log('New FCM token received:', token);
            // **THE FIX:** Get idToken directly from the user object.
            const idToken = await user.getIdToken();
            await callSaveFcmTokenHttp(token, isCoach, idToken);
            registrationCompletedForUser.current = user.uid;
        };

        if (Capacitor.isNativePlatform()) {
            let permStatus: PermissionStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') permStatus = await PushNotifications.requestPermissions();
            if (permStatus.receive !== 'granted') return;

            PushNotifications.addListener('registration', (token: Token) => {
                handleNewToken(token.value);
            });
            PushNotifications.addListener('registrationError', console.error);

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                console.log('Native FOREGROUND notification:', notification);
                LocalNotifications.schedule({
                    notifications: [{
                        title: notification.title || 'Hunger-Free & Happy',
                        body: notification.body || '',
                        id: Math.floor(Math.random() * 2147483647),
                        extra: notification.data,
                        smallIcon: 'ic_stat_notification'
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
              handleNewToken(currentToken);
              
              onMessage(messaging, (message) => {
                console.log('Web FOREGROUND notification:', message);
                if (message.data) {
                  const { title, body } = message.data;
                  const notification = new Notification(title || 'Hunger-Free & Happy', {
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
  // **THE FIX:** Updated the dependency array.
  }, [user, isCoach, loading, handleNotificationAction]);

  return <>{children}</>;
};

export default PushNotificationProvider;
