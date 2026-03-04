'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPerformed, PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';
import { addFcmTokenAction } from '@/app/chats/actions';
import { messaging } from '@/lib/firebase';
import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

const log = (message: string, ...data: any[]) => console.log(`[PushProvider] ${message}`, ...data);
const logError = (message: string, ...data: any[]) => console.error(`[PushProvider] ${message}`, ...data);

const createNotificationChannels = async () => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
        log("Creating Android notification channels...");
        await LocalNotifications.createChannel({ id: 'chat_messages', name: 'Chat Messages', importance: 5, sound: 'default', vibration: true, visibility: 1 });
        await LocalNotifications.createChannel({ id: 'reminders', name: 'Reminders', importance: 4, sound: 'default', vibration: true, visibility: 1 });
        log('Android channels created.');
    } catch (error) {
        logError('Error creating channels:', error);
    }
};

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isCoach, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();
  const listenersAttachedForUser = useRef<string | null>(null);

  const handleNotificationAction = (context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Data:`, data);
    const { notificationType, chatId, workoutId, appointmentId, link } = data;
    if (notificationType === 'chat' && chatId) setNotificationChatId(String(chatId));
    else if (notificationType === 'workout' && workoutId) setNotificationWorkoutId(String(workoutId));
    else if (['appointment_reminder', 'appointment_booked'].includes(String(notificationType)) && appointmentId) setNotificationAppointmentId(String(appointmentId));
    else if (notificationType === 'hydration') setTriggerHydrationModal(true);
    else if (link) router.push(String(link));
    else logError(`Unknown notification action.`, data);
  };

  const showInAppNotification = (title: string, body: string, data: { [key: string]: any }) => {
    toast({
      title,
      description: body,
      action: (
        <ToastAction
          altText="Open"
          onClick={() => handleNotificationAction('Foreground Click', data)}
        >
          Open
        </ToastAction>
      ),
    });
  };

  useEffect(() => {
    if (searchParams?.get('notificationType')) {
        log("PWA: Detected notification in URL.");
        handleNotificationAction('PWA URL', Object.fromEntries(searchParams.entries()));
        router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard', { scroll: false });
    }
  }, [searchParams, router, isCoach]);

  useEffect(() => {
    if (loading || !user || listenersAttachedForUser.current === user.uid) return;

    const initialize = async () => {
      log(`Attaching listeners for user: ${user.uid}`);
      listenersAttachedForUser.current = user.uid;

      if (Capacitor.isNativePlatform()) {
        await createNotificationChannels();
        await PushNotifications.requestPermissions();
        await PushNotifications.register();

        PushNotifications.addListener('registration', async (token: Token) => {
            log('Native registration success, token:', token.value.substring(0,10));
            await addFcmTokenAction({ userId: user.uid, token: token.value });
            log('Native token saved.');
        });

        PushNotifications.addListener('registrationError', (error: any) => {
            logError('Native registration error:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            log('Native foreground notification:', notification);
            const { title, body, data } = notification;
            showInAppNotification(title || 'New Message', body || '', data);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            log('Native notification action performed:', action);
            handleNotificationAction('Native Action', action.notification.data);
        });


      } else {
          log('Initializing WEB push...');

          try {
            // CORRECTED: Point to the default PWA service worker.
            await navigator.serviceWorker.register('/sw.js');
            log('Service Worker registered successfully.');
          } catch (error) {
            logError('Service Worker registration failed:', error);
            return; // Do not proceed if the SW fails to register.
          }
          
          const supported = await isSupported();
          if (!supported || !messaging) {
            return logError('Firebase messaging is not supported in this browser.');
          }

          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            return logError(`Web permission denied.`, `Status: ${permission}`);
          }
          
          log('Web permission granted. Getting token...');
          // Now we can safely wait for the registration to be ready.
          const swRegistration = await navigator.serviceWorker.ready;
          const fcmToken = await getToken(messaging, {
              vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
              serviceWorkerRegistration: swRegistration,
          });

          if (fcmToken) {
              log('Web token received. Saving...');
              await addFcmTokenAction({ userId: user.uid, token: fcmToken });
              log('Web token saved.');
          } else {
              logError('Could not get web FCM token.');
          }
          
          const unsubscribeOnMessage = onMessage(messaging, (payload) => {
            log('Web foreground message received:', payload);
            const { notification, data } = payload;
            if (notification && data) {
                showInAppNotification(notification.title || 'New Message', notification.body || '', data);
            }
          });

          const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data?.type === 'notification_clicked') {
                log('Received notification click from service worker');
                handleNotificationAction('PWA Click', event.data.data);
            }
          };
    
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

          return () => {
            unsubscribeOnMessage();
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
          }
      }
    };

    initialize();

  }, [user, loading, isCoach, router]);

  return <>{children}</>;
};

export default PushNotificationProvider;