'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { ActionPerformed, PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
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
  const { user, isCoach: isUserCoachFromAuth, loading } = useAuth(); // Renamed to avoid conflict
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Full Data:`, JSON.stringify(data, null, 2)); // Enhanced logging for full data
    const notificationType = String(data.notificationType || '');
    const chatId = String(data.chatId || '');
    const workoutId = String(data.workoutId || '');
    const appointmentId = String(data.appointmentId || '');
    const link = String(data.link || '');
    const isRecipientCoachStr = String(data.isCoach || 'false'); // Ensure isCoach is a string

    const isRecipientCoach = isRecipientCoachStr === 'true';
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

    let targetUrl = dashboardBaseUrl; // Default to dashboard
    const queryParams = new URLSearchParams();
    queryParams.set('notificationType', notificationType);
    queryParams.set('isCoach', isRecipientCoachStr); // Pass isCoach for routing

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
        return; // Exit after direct link push
    }

    targetUrl = `${dashboardBaseUrl}?${queryParams.toString()}`;
    log(`[${context}] Final Navigating URL: ${targetUrl}. IsRecipientCoach: ${isRecipientCoach}`);
    router.push(targetUrl);
  }, [isUserCoachFromAuth, router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal]);

  const showInAppNotification = useCallback((title: string | undefined, body: string | undefined, data: { [key: string]: any }) => {
    log(`[PushProvider] Showing in-app toast. Title: ${title}, Body: ${body}, Data:`, data);
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
    log("PushNotificationProvider useEffect (URL parsing) triggered.");
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
        log("PWA: Detected notification in URL. Parsing...");
        const data = Object.fromEntries(urlParams.entries());
        // The isCoach param in URL takes precedence for initial navigation
        const isCoachInUrl = urlParams.get('isCoach') === 'true'; // Ensure it's read as boolean
        const dashboardBaseUrl = isCoachInUrl ? '/coach/dashboard' : '/client/dashboard';

        let targetUrl = dashboardBaseUrl;
        const notificationType = urlParams.get('notificationType');
        const openChatId = urlParams.get('openChatId');
        const openWorkoutId = urlParams.get('openWorkoutId');
        const openAppointmentId = urlParams.get('openAppointmentId');
        const openHydration = urlParams.get('openHydration');
        const entityId = urlParams.get('entityId'); // Also get entityId from URL

        const queryParams = new URLSearchParams();
        if (notificationType) queryParams.set('notificationType', notificationType);
        queryParams.set('isCoach', String(isCoachInUrl));
        if (entityId) queryParams.set('entityId', entityId);

        if (notificationType === 'chat' && openChatId) {
            setNotificationChatId(openChatId);
            queryParams.set('openChatId', openChatId);
        } else if (notificationType === 'workout_reminder' && openWorkoutId) {
            setNotificationWorkoutId(openWorkoutId);
            queryParams.set('openWorkoutId', openWorkoutId);
        } else if (notificationType === 'appointment_reminder' && openAppointmentId) {
            setNotificationAppointmentId(openAppointmentId);
            queryParams.set('openAppointmentId', openAppointmentId);
        } else if (notificationType === 'hydration' && openHydration === 'true') {
            setTriggerHydrationModal(true);
            queryParams.set('openHydration', 'true');
        }

        targetUrl = `${dashboardBaseUrl}?${queryParams.toString()}`;
        log(`PWA URL: Determined final target URL: ${targetUrl}. IsCoachInUrl: ${isCoachInUrl}`);
        router.replace(targetUrl, { scroll: false });
    }
  }, [router, handleNotificationAction, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal]);

  useEffect(() => {
    log("PushNotificationProvider useEffect (native/web setup) triggered.");

    let cleanupFunction: (() => void) = () => { logError('No cleanup function set.'); }; // Default to no-op for safety

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

            cleanupFunction = () => {
                log(`Cleaning up NATIVE push listeners.`);
                PushNotifications.removeAllListeners();
            };

          } else {
            logError('Native push permission NOT granted or failed registration. Status:', permissionStatus.receive);
            cleanupFunction = () => { logError('Native setup did not fully complete, no listeners to clean.'); };
          }

        } catch (error) {
          logError('Error setting up native push notification listeners:', error);
          cleanupFunction = () => { logError('Native setup failed, no listeners to clean.'); };
        }

      } else { // Web platform logic
        log('Setting up PWA push notifications...');
        const setupWebListeners = async () => {
            const isFCMSupported = await isSupported();
            if (!isFCMSupported || !messaging) {
              logError('PWA notifications not supported or Firebase messaging not available in this browser.');
              cleanupFunction = () => { logError('PWA not supported, no listeners to clean.'); };
              return;
            }

            try {
              const swRegistration = await navigator.serviceWorker.register('/sw.js');
              log('PWA: Service worker registered.', swRegistration);

              const permission = await Notification.requestPermission();
              if (permission === 'granted') {
                log('PWA permission granted. Getting token...');
                const fcmToken = await getToken(messaging, { 
                    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                    serviceWorkerRegistration: swRegistration
                });
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

              cleanupFunction = () => {
                log(`Cleaning up PWA listeners.`);
                unsubscribeOnMessage();
                navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
              };

            } catch (error) {
              logError('PWA: Error during notification setup:', error);
              cleanupFunction = () => { logError('PWA setup failed, no listeners to clean.'); };
            }
        };
        setupWebListeners();
      }
    };

    // Trigger setup when user/loading state changes
    if (!loading && user) {
        log(`User (UID: ${user.uid}) and loading state ready for push notification setup.`);
        setupNotifications(); // Call directly now that cleanup is managed internally
    } else if (loading) {
        log('Push notification setup deferred: User still loading.');
    } else if (!user) {
        log('Push notification setup deferred: User is null/undefined.');
    }

    return () => {
      log('PushNotificationProvider unmount/cleanup.');
      cleanupFunction(); // Always callable
    };

  }, [user, loading, isUserCoachFromAuth, router, showInAppNotification, handleNotificationAction, toast]);

  return <>{children}</>;
};

export default PushNotificationProvider;
