'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, ActionPerformed, Token, PushNotificationSchema, PermissionStatus } from '@capacitor/push-notifications';
import { LocalNotifications, LocalNotificationSchema, LocalNotificationActionPerformed } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { messaging } from '@/lib/firebase';
import { getToken } from 'firebase/messaging';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';

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
  const { user, isCoach, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    setNotificationChatId, 
    setNotificationAppointmentId, 
    setNotificationWorkoutId, 
    setTriggerHydrationModal 
  } = useNotificationStore();
  
  const listenersAttachedForUser = useRef<string | null>(null);

  const handleNotificationAction = (data: { [key: string]: any } | undefined) => {
    if (!data) {
        console.warn("handleNotificationAction called with no data.");
        return;
    }
    console.log("Provider: Processing notification action with data:", data);
    
    const { notificationType } = data;

    switch (String(notificationType)) {
      case 'hydration':
        console.log('Provider: Setting hydration trigger.');
        setTriggerHydrationModal(true);
        break;
      case 'chat':
        const chatId = data.chatId;
        console.log(`Provider: Setting notification chat ID: ${chatId}`);
        if (chatId) setNotificationChatId(String(chatId));
        break;
      case 'workout':
        const workoutId = data.workoutId;
        console.log(`Provider: Setting notification workout ID: ${workoutId}`);
        if (workoutId) setNotificationWorkoutId(String(workoutId));
        break;
      case 'appointment_reminder':
      case 'appointment_booked':
        const appointmentId = data.appointmentId;
        console.log(`Provider: Setting notification appointment ID: ${appointmentId}`);
        if (appointmentId) setNotificationAppointmentId(String(appointmentId));
        break;
      default:
        console.warn(`Provider: Unknown notificationType received: ${notificationType}`);
        // No navigation here, the handler will decide what to do.
        break;
    }
  };

  useEffect(() => {
    if (Capacitor.isNativePlatform() || !searchParams) return;
    
    const notificationType = searchParams.get('notificationType');
    if (notificationType) {
        console.log("PWA: Detected notification parameters in URL, handling action.");
        const payload = { ...Object.fromEntries(searchParams.entries()) };
        handleNotificationAction(payload);
        router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard', { scroll: false });
    }
  }, [searchParams, router, isCoach]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user || loading || listenersAttachedForUser.current === user.uid) {
      return;
    }

    const initializeNativeNotifications = async () => {
      console.log("Initializing NATIVE push notification listeners...");

      let permStatus: PermissionStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }
      if (permStatus.receive !== 'granted') {
        console.warn("User has not granted notification permissions.");
        return;
      }

      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token: Token) => {
        console.log('Native FCM token received:', token.value);
        const idToken = await user.getIdToken();
        await callSaveFcmTokenHttp(token.value, !!isCoach, idToken);
      });

      PushNotifications.addListener('registrationError', (err) => console.error('Native FCM registration error:', err));

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        console.log('Native FOREGROUND notification received:', notification);
        LocalNotifications.schedule({
            notifications: [{
                title: notification.title || 'Hunger-Free & Happy',
                body: notification.body || '',
                id: Math.floor(Math.random() * 2147483647),
                extra: notification.data,
                smallIcon: 'ic_stat_notification',
            }]
        });
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
        console.log('Native BACKGROUND/COLD-START notification action performed:', action);
        handleNotificationAction(action.notification.data);
      });

      LocalNotifications.addListener('localNotificationActionPerformed', (action: LocalNotificationActionPerformed) => {
        console.log('Native FOREGROUND notification action performed:', action);
        handleNotificationAction(action.notification.extra);
      });

      listenersAttachedForUser.current = user.uid;
    };

    initializeNativeNotifications().catch(err => {
      console.error("Critical error during NATIVE push notification setup:", err);
    });

    return () => {
      if (Capacitor.isNativePlatform()) {
        console.log("Cleaning up native notification listeners.");
        PushNotifications.removeAllListeners();
        LocalNotifications.removeAllListeners();
      }
    };
  }, [user, isCoach, loading]);

  return <>{children}</>;
};

export default PushNotificationProvider;
