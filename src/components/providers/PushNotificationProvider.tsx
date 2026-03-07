'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPerformed, PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';
import { addFcmTokenAction } from '@/app/chats/actions';
import { messaging } from '@/lib/firebase';
import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();
  const listenersAttachedForUser = useRef<string | null>(null);

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Data:`, data);
    const { notificationType, chatId, workoutId, appointmentId, link } = data;

    const dashboardBaseUrl = isCoach ? '/coach/dashboard' : '/client/dashboard';

    if (notificationType === 'chat' && chatId) {
        setNotificationChatId(String(chatId));
        router.push(`${dashboardBaseUrl}?openChatId=${String(chatId)}`);
    } else if (notificationType === 'workout_reminder' && workoutId) {
        setNotificationWorkoutId(String(workoutId));
        router.push(`${dashboardBaseUrl}?openWorkoutId=${String(workoutId)}`);
    } else if (['appointment_reminder', 'appointment_booked'].includes(String(notificationType)) && appointmentId) {
        setNotificationAppointmentId(String(appointmentId));
        router.push(`${dashboardBaseUrl}?openAppointmentId=${String(appointmentId)}`);
    } else if (notificationType === 'hydration') {
        setTriggerHydrationModal(true);
        router.push(`${dashboardBaseUrl}?openHydration=true`);
    } else if (link) {
        router.push(String(link));
    } else {
        logError(`Unknown notification action. No specific handler found.`, data);
        router.push(dashboardBaseUrl);
    }
  }, [isCoach, router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
        log("PWA: Detected notification in URL.");
        const data = Object.fromEntries(urlParams.entries());
        handleNotificationAction('PWA URL', data);
        router.replace(window.location.pathname, { scroll: false });
    }
  }, [router, handleNotificationAction]);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const handleSWMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'notification_clicked') {
            log('Received notification click event from Service Worker.');
            handleNotificationAction('SW Click', event.data.data);
        }
    };

    navigator.serviceWorker.addEventListener('message', handleSWMessage);
    log('PWA: Attached service worker message listener.');

    return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
        log('PWA: Cleaned up service worker message listener.');
    };
  }, [handleNotificationAction]);

  useEffect(() => {
    if (loading || !user) {
      if (listenersAttachedForUser.current) {
        log(`User logged out or loading. Cleaning up listeners for ${listenersAttachedForUser.current}`);
        if (Capacitor.isNativePlatform()) {
          PushNotifications.removeAllListeners();
        }
        listenersAttachedForUser.current = null;
      }
      return;
    }
    
    if (listenersAttachedForUser.current === user.uid) {
      log(`Listeners already attached for user: ${user.uid}. Skipping.`);
      return;
    }

    log(`Attaching NEW listeners for user: ${user.uid}`);
    listenersAttachedForUser.current = user.uid;

    let cleanupFunction: (() => void) | null = null;

    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        log('Setting up NATIVE push notifications...');
        try {
          await createNotificationChannels();
          const permissionStatus = await PushNotifications.requestPermissions();
          if (permissionStatus.receive === 'granted') {
            log('Native push permission granted.');
            await PushNotifications.register();
          } else {
            logError('Native push permission NOT granted.');
          }

          PushNotifications.addListener('registration', async (token: Token) => {
            log('Native registration success, token:', token.value.substring(0, 10));
            await addFcmTokenAction({ userId: user.uid, token: token.value });
            log('Native token saved to backend.');
          });

          PushNotifications.addListener('registrationError', (error: any) => logError('Native registration error:', error));
          
          PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            log('Native foreground notification received.', notification);
            LocalNotifications.schedule({
                notifications: [{
                    id: new Date().getTime(),
                    title: notification.title || 'New Message',
                    body: notification.body || '',
                    channelId: notification.data?.notificationType === 'chat' ? 'chat_messages' : 'reminders',
                    extra: notification.data,
                    smallIcon: 'ic_stat_icon_config_sample',
                    largeIcon: notification.data?.imageUrl,
                    group: notification.data?.chatId, 
                }]
            });
          });

          PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            log('Native notification action performed.', action);
            handleNotificationAction('Native Action', action.notification.data);
          });

        } catch (error) {
          logError('Error setting up native push listeners:', error);
        }
        cleanupFunction = () => {
            log(`Cleaning up NATIVE push listeners for user: ${user.uid}`);
            PushNotifications.removeAllListeners();
        };

      } else {
        log('Setting up PWA push notifications...');
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) {
          logError('PWA notifications not supported or Firebase messaging not available in this browser.');
          return;
        }

        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            log('PWA permission granted. Registering for token...');
            const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
            if (fcmToken) {
              log('PWA: Got token, saving to backend...', fcmToken.substring(0, 10));
              await addFcmTokenAction({ userId: user.uid, token: fcmToken });
            } else {
              logError('PWA: Failed to retrieve FCM token.');
            }
          } else {
            logError(`PWA permission not granted. Status: ${permission}`);
          }
        
          const unsubscribe = onMessage(messaging, (payload) => {
            log('PWA: Foreground message received.', payload);
            const { notification, data } = payload;
            if (notification) {
                toast({
                    title: notification.title || 'New Message',
                    description: notification.body || '',
                    action: (
                        <ToastAction
                          altText="Open"
                          onClick={() => handleNotificationAction('Foreground Click', data || {})}
                        >
                          Open
                        </ToastAction>
                    ),
                });
            }
          });
          
          log('PWA: Foreground message listener attached.');
          cleanupFunction = () => {
              log(`Cleaning up PWA message listener for user: ${user.uid}`);
              unsubscribe();
          };

        } catch (error) {
          logError('PWA: Error during notification setup:', error);
        }
      }
    };

    setupNotifications();

    return () => {
      if (cleanupFunction) {
        cleanupFunction();
      }
      listenersAttachedForUser.current = null;
    };

  }, [user, loading, handleNotificationAction, toast]);

  return <>{children}</>;
};

export default PushNotificationProvider;
