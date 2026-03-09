'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPerformed, PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter, useSearchParams } from 'next/navigation';
import { useNotificationStore } from '@/store/notification-store';
import { addFcmTokenAction } from '@/app/chats/actions'; // Ensure this action is correctly implemented and exposed
import { messaging } from '@/lib/firebase';
import { getToken, isSupported, onMessage } from 'firebase/messaging';
import { useToast } from '@/hooks/use-toast'; // Assuming useToast is a hook
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
  const { toast } = useToast(); // CORRECTED: Destructure toast from useToast hook
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Data:`, data);
    const { notificationType, chatId, workoutId, appointmentId, link, isCoach: isRecipientCoachStr } = data;

    const isRecipientCoach = isRecipientCoachStr === 'true';
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

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

  const showInAppNotification = useCallback((title: string | undefined, body: string | undefined, data: { [key: string]: any }) => {
    toast({
      title: title || 'New Notification',
      description: body || '',
      action: (
        <ToastAction
          altText="Open"
          onClick={() => handleNotificationAction('Foreground Click', data)}
        >
          Open
        </ToastAction>
      ),
    });
  }, [handleNotificationAction, toast]);

  useEffect(() => {
    log("PushNotificationProvider useEffect triggered for URL parsing.");
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
        log("PWA: Detected notification in URL. Parsing...");
        const data = Object.fromEntries(urlParams.entries());
        handleNotificationAction('PWA URL', data);
        router.replace(window.location.pathname, { scroll: false }); // Clear search params
    }
  }, [router, handleNotificationAction]);

  useEffect(() => {
    log("PushNotificationProvider useEffect triggered for native/web listener setup.");

    let cleanupFunction: (() => void) | null = null; // Consolidated cleanup to one variable

    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        log('Setting up NATIVE push notifications...');
        try {
          await createNotificationChannels();
          const permissionStatus = await PushNotifications.requestPermissions();
          if (permissionStatus.receive === 'granted') {
            log('Native push permission granted.');
            await PushNotifications.register(); // Register for FCM tokens

            PushNotifications.addListener('registration', async (token: Token) => {
                log('Native registration success, token:', token.value.substring(0,10) + '...');
                if (user?.uid) { // Only save token if user is definitely available
                  await addFcmTokenAction({ userId: user.uid, token: token.value });
                  log('Native token saved to backend for user:', user.uid);
                } else {
                  logError('User not available yet to save native token, token received:', token.value.substring(0,10) + '...');
                }
            });

            PushNotifications.addListener('registrationError', (error: any) => {
                logError('Native registration error:', error);
            });

            // Listener for foreground push notifications (display as toast)
            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
                log('Native foreground notification received:', notification);
                showInAppNotification(notification.title, notification.body, notification.data || {});
            });

            // Listener for when a notification is tapped (deep-linking)
            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
                log('Native notification action performed:', action);
                handleNotificationAction('Native Action', action.notification.data || {});
            });

            // Define cleanup for native platform
            cleanupFunction = () => {
                log(`Cleaning up NATIVE push listeners.`);
                PushNotifications.removeAllListeners();
            };

          } else {
            logError('Native push permission NOT granted or failed registration. Status:', permissionStatus.receive);
          }

        } catch (error) {
          logError('Error setting up native push notification listeners:', error);
        }

      } else { // Web platform logic
        log('Setting up PWA push notifications...');
        const setupWebListeners = async () => {
            const isFCMSupported = await isSupported();
            if (!isFCMSupported || !messaging) {
              logError('PWA notifications not supported or Firebase messaging not available in this browser.');
              return;
            }

            try {
              const permission = await Notification.requestPermission();
              if (permission === 'granted') {
                log('PWA permission granted. Getting token...');
                const fcmToken = await getToken(messaging, { vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
                if (fcmToken) {
                  log('PWA: Got token, saving to backend...', fcmToken.substring(0, 10) + '...');
                  if (user?.uid) {
                      await addFcmTokenAction({ userId: user.uid, token: fcmToken });
                      log('PWA token saved to backend for user:', user.uid);
                  } else {
                      logError('User not available yet to save PWA token, token received:', fcmToken.substring(0,10) + '...');
                  }
                } else {
                  logError('PWA: Failed to retrieve FCM token.');
                }
              } else {
                logError(`PWA permission not granted. Status: ${permission}`);
              }

              const unsubscribeOnMessage = onMessage(messaging, (payload) => {
                log('PWA: Foreground message received.', payload);
                const { notification, data } = payload;
                if (notification && data) {
                    showInAppNotification(notification.title, notification.body, data);
                } else if (notification) {
                    showInAppNotification(notification.title, notification.body, {});
                }
              });

              log('PWA: Foreground message listener attached.');

              const handleServiceWorkerMessage = (event: MessageEvent) => {
                if (event.data?.type === 'notification_clicked') {
                    log('Received notification click from service worker');
                    handleNotificationAction('PWA Click', event.data.data || {});
                }
              };

              navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

              // Define cleanup for web platform
              cleanupFunction = () => {
                log(`Cleaning up PWA listeners.`);
                unsubscribeOnMessage();
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
              };

            } catch (error) {
              logError('PWA: Error during notification setup:', error);
            }
        };
        setupWebListeners();
      }
    };

    // Trigger setup when user/loading state changes
    if (!loading && user) {
        log(`User (UID: ${user.uid}) and loading state ready for push notification setup.`);
        setupNotifications();
    } else if (loading) {
        log('Push notification setup deferred: User still loading.');
    } else if (!user) {
        log('Push notification setup deferred: User is null/undefined.');
        // No longer call cleanup here, rely on return function
    }

    // Cleanup function: this will be called when the component unmounts or dependencies change
    return () => {
      log('PushNotificationProvider unmount/cleanup.');
      if (cleanupFunction) {
        cleanupFunction();
      }
    };

  }, [user, loading, isCoach, router, showInAppNotification, handleNotificationAction, toast]);

  return <>{children}</>;
};

export default PushNotificationProvider;
