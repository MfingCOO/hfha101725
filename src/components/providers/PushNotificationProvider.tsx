'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPerformed, PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';
import { addFcmTokenAction } from '@/app/chats/actions';
import { messaging } from '@/lib/firebase';
import { isSupported, onMessage } from 'firebase/messaging';
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
  const { user, loading } = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();

  const cleanupRef = useRef<(() => void) | null>(null);

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Full Data:`, JSON.stringify(data, null, 2));
    const notificationType = String(data.notificationType || '');
    const chatId = String(data.chatId || '');
    const workoutId = String(data.workoutId || '');
    const appointmentId = String(data.appointmentId || '');
    const link = String(data.link || '');
    const isRecipientCoachStr = String(data.isCoach || 'false');

    const isRecipientCoach = isRecipientCoachStr === 'true';
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

    let targetUrl = dashboardBaseUrl;
    const queryParams = new URLSearchParams();
    queryParams.set('notificationType', notificationType);
    queryParams.set('isCoach', isRecipientCoachStr);

    if (notificationType === 'chat' && chatId) {
        setNotificationChatId(chatId);
        queryParams.set('openChatId', chatId);
        queryParams.set('entityId', chatId);
    } else if (notificationType === 'workout_reminder' && workoutId) {
        setNotificationWorkoutId(workoutId);
        queryParams.set('openWorkoutId', workoutId);
        queryParams.set('entityId', workoutId);
    } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && appointmentId) {
        setNotificationAppointmentId(appointmentId);
        queryParams.set('openAppointmentId', appointmentId);
        queryParams.set('entityId', appointmentId);
    } else if (notificationType === 'hydration') {
        setTriggerHydrationModal(true);
        queryParams.set('openHydration', 'true');
        queryParams.set('entityId', 'hydration');
    } else if (link) {
        targetUrl = link;
        log(`[${context}] Direct link navigation to: ${targetUrl}`);
        router.push(targetUrl);
        return;
    }

    targetUrl = `${dashboardBaseUrl}?${queryParams.toString()}`;
    log(`[${context}] Final Navigating URL: ${targetUrl}. IsRecipientCoach: ${isRecipientCoach}`);
    router.push(targetUrl);
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal]);

  const showInAppNotification = useCallback((incomingNotificationTitle: string | undefined, incomingNotificationBody: string | undefined, data: { [key: string]: any }) => {
    // Robust fallback: prioritize incoming 'notification' title/body, then data payload
    const finalTitle = incomingNotificationTitle || data.title || 'New Notification';
    const finalBody = incomingNotificationBody || data.body || '';

    log(`[PushProvider] Showing in-app toast. Final Title: ${finalTitle}, Final Body: ${finalBody}, Data:`, data);
    toast({
      title: finalTitle,
      description: finalBody,
      action: (
        <ToastAction
          altText="Open"
          onClick={() => handleNotificationAction('Foreground Click', data)}
        >
          Open
        </ToastAction>
      ),
      duration: 7000,
    });
  }, [handleNotificationAction, toast]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
        log("PWA: Detected notification in URL. Parsing...");

        const notificationType = urlParams.get('notificationType');
        const openChatId = urlParams.get('openChatId');
        const openWorkoutId = urlParams.get('openWorkoutId');
        const openAppointmentId = urlParams.get('openAppointmentId');
        const openHydration = urlParams.get('openHydration');

        if (notificationType === 'chat' && openChatId) {
            setNotificationChatId(openChatId);
        } else if (notificationType === 'workout_reminder' && openWorkoutId) {
            setNotificationWorkoutId(openWorkoutId);
        } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType || '') && openAppointmentId) {
            setNotificationAppointmentId(openAppointmentId);
        } else if (notificationType === 'hydration' && openHydration === 'true') {
            setTriggerHydrationModal(true);
        }

        const newParams = new URLSearchParams(window.location.search);
        newParams.delete('notificationType');
        newParams.delete('openChatId');
        newParams.delete('openWorkoutId');
        newParams.delete('openAppointmentId');
        newParams.delete('openHydration');
        newParams.delete('entityId');
        newParams.delete('isCoach');
        
        const queryString = newParams.toString();
        const cleanUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
        
        log(`PWA URL: State updated. Cleaning URL to: ${cleanUrl}`);
        router.replace(cleanUrl, { scroll: false });
    }
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal]);

  useEffect(() => {
    log("PushNotificationProvider useEffect (native/web setup) triggered.");

    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        log('Setting up NATIVE push notifications...');
        try {
          await createNotificationChannels();
          const permissionStatus = await PushNotifications.requestPermissions();
          if (permissionStatus.receive === 'granted') {
            log('Native push permission granted.');
            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token: Token) => {
                log('Native registration success, token:', token.value.substring(0,10) + '...');
                if (user?.uid) {
                  await addFcmTokenAction({ userId: user.uid, token: token.value });
                }
            });

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                log('Native foreground notification received:', notification);
                showInAppNotification(notification.title, notification.body, notification.data || {});
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
                log('Native notification action performed:', action);
                handleNotificationAction('Native Action', action.notification.data || {});
            });

            cleanupRef.current = () => {
                log(`Cleaning up NATIVE push listeners.`);
                PushNotifications.removeAllListeners();
            };
          }
        } catch (error) {
          logError('Error setting up native push notification listeners:', error);
        }

      } else { 
        // MODIFICATION: Only listen for foreground messages for the PWA bell, don't register for OS push notifications.
        log('Setting up PWA foreground notifications listener...');
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) {
          logError('PWA foreground messaging not supported.');
          return;
        }

        try {
          // Register the service worker to allow it to listen for messages
          await navigator.serviceWorker.register('/sw.js');

          // This listener handles messages when the app is in the foreground (active tab)
          const unsubscribeOnMessage = onMessage(messaging, (payload) => {
            log('PWA: Foreground message received.', payload);
            const { notification, data } = payload;
            showInAppNotification(notification?.title, notification?.body, data || {});
          });

          // This listener handles the click event if a notification is somehow displayed and clicked
          const handleServiceWorkerMessage = (event: MessageEvent) => {
            if (event.data?.type === 'notification_clicked') {
                log('PWA: Received notification_clicked event from service worker.');
                handleNotificationAction('PWA Click', event.data.data || {});
            }
          };
          navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

          cleanupRef.current = () => {
            log(`Cleaning up PWA listeners.`);
            unsubscribeOnMessage();
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
          };

        } catch (error) {
          logError('PWA: Error during foreground notification setup:', error);
        }
      }
    };

    if (!loading && user) {
        setupNotifications();
    }

    return () => {
      if (cleanupRef.current) {
        log('PushNotificationProvider unmount/cleanup.');
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };

  }, [user, loading, showInAppNotification, handleNotificationAction]);

  return <>{children}</>;
};

export default PushNotificationProvider;
