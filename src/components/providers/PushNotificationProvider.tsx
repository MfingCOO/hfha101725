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
    // Existing chat messages channel (Importance 5 for banners)
    await LocalNotifications.createChannel({
      id: 'chat_messages',
      name: 'Chat Messages',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1
    });
    // **MODIFIED/NEW:** Specific channels for appointments, workouts, and hydration reminders (all Importance 5 for banners)
    await LocalNotifications.createChannel({
      id: 'appointment_booked_notifications',
      name: 'Appointment Booked',
      importance: 5, // High importance for banners
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'appointment_reminders',
      name: 'Appointment Reminders',
      importance: 5, // High importance for banners
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'workout_reminders',
      name: 'Workout Reminders',
      importance: 5, // High importance for banners
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'hydration_reminders',
      name: 'Hydration Reminders',
      importance: 5, // High importance for banners
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    // ADDED: New channels for custom popups, indulgence, challenge, and streak notifications
    await LocalNotifications.createChannel({
      id: 'custom_popups',
      name: 'Custom Popups',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'indulgence_notifications',
      name: 'Indulgence Reminders',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'challenge_notifications',
      name: 'Challenge Reminders',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    await LocalNotifications.createChannel({
      id: 'streak_notifications',
      name: 'Streak Accomplishments',
      importance: 5,
      sound: 'default',
      vibration: true,
      visibility: 1,
    });
    log('Android channels created.');
  } catch (error) {
    logError('Error creating channels:', error);
  }
};

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList } = useNotificationStore();

  const cleanupRef = useRef<(() => void) | null>(null);

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Full Data:`, JSON.stringify(data, null, 2));
    const notificationType = String(data.notificationType || '');
    const chatId = String(data.chatId || '');
    const workoutId = String(data.workoutId || '');
    const appointmentId = String(data.appointmentId || '');
    const indulgenceId = String(data.indulgenceId || '');
    const challengeId = String(data.challengeId || '');
    const openChallengeList = String(data.openChallengeList || 'false');
    const backendCtaUrl = String(data.url || ''); // This is the URL provided directly by your backend
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || '');
    const isRecipientCoachStr = String(data.isCoach || 'false');

    console.log(`[PushProvider][${context}] Parsed Data: notificationType=${notificationType}, appointmentId=${appointmentId}, entityId=${String(data.entityId || '')}, isCoach=${isRecipientCoachStr}, appointmentStartTimeMillis=${appointmentStartTimeMillis}, indulgenceId=${indulgenceId}, challengeId=${challengeId}, openChallengeList=${openChallengeList}`);

    const isRecipientCoach = isRecipientCoachStr === 'true';
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

    let finalNavigationUrl = backendCtaUrl; // Start with the URL provided by the backend

    // If the backend did not provide a complete URL, or if it provided a relative path that needs parameters,
    // then construct the URL with dynamic query parameters.
    if (!finalNavigationUrl || (finalNavigationUrl.startsWith('/') && !finalNavigationUrl.includes('?'))) {
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
        } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && (appointmentId || data.entityId)) {
            const resolvedAppointmentId = appointmentId || String(data.entityId || '');
            setNotificationAppointmentId(resolvedAppointmentId);
            queryParams.set('openAppointmentId', resolvedAppointmentId);
            queryParams.set('entityId', resolvedAppointmentId);
            if (appointmentStartTimeMillis) {
                queryParams.set('appointmentStartTimeMillis', appointmentStartTimeMillis);
            }
        } else if (notificationType === 'hydration') {
            setTriggerHydrationModal(true);
            queryParams.set('openHydration', 'true');
            queryParams.set('entityId', 'hydration');
        } else if (notificationType.includes('indulgence_') && indulgenceId) {
            setNotificationIndulgenceId(indulgenceId);
            queryParams.set('openIndulgenceId', indulgenceId);
            queryParams.set('entityId', indulgenceId);
            if (appointmentStartTimeMillis) {
                queryParams.set('indulgenceStartTimeMillis', appointmentStartTimeMillis);
            }
        } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType) && openChallengeList === 'true') {
            setOpenChallengeList(true);
            queryParams.set('openChallengeList', 'true');
            if (challengeId) queryParams.set('entityId', challengeId);
        } else if (notificationType === 'custom-popup') {
            // For custom popups, if backendCtaUrl is not absolute, it should still go to dashboard with params
            // If backendCtaUrl is empty, it will construct a default dashboard URL.
            // If backendCtaUrl is a relative path (e.g., '/some/page'), it will append params to it.
        }

        const queryString = queryParams.toString();
        // Append query params to backendCtaUrl if it's a relative path, or start fresh if empty
        finalNavigationUrl = `${finalNavigationUrl || dashboardBaseUrl}${queryString ? (finalNavigationUrl.includes('?') ? '&' : '?') + queryString : ''}`;

    }
    // else: finalNavigationUrl already contains a complete, possibly absolute URL from backendCtaUrl

    log(`[${context}] Final Navigating URL: ${finalNavigationUrl}. IsRecipientCoach: ${isRecipientCoach}`);
    router.push(finalNavigationUrl);
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);

  const showInAppNotification = useCallback((incomingNotificationTitle: string | undefined, incomingNotificationBody: string | undefined, data: { [key: string]: any }) => {
    const finalTitle = incomingNotificationTitle || data.title || 'New Notification';
    let finalBody = incomingNotificationBody || data.body || '';

    const notificationType = String(data.notificationType || '');
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || '');

    if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && appointmentStartTimeMillis) {
      const date = new Date(Number(appointmentStartTimeMillis));
      const localizedTime = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      finalBody = `⏰ ${localizedTime} - ${finalBody}`;
    }
    const imageUrl = data.imageUrl || undefined;
    if (imageUrl) {
        log(`[PushProvider] Notification has image: ${imageUrl}`);
    }

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
      const openIndulgenceId = urlParams.get('openIndulgenceId');
      const openChallengeList = urlParams.get('openChallengeList');
      const appointmentStartTimeMillis = urlParams.get('appointmentStartTimeMillis');

      if (notificationType === 'chat' && openChatId) {
        setNotificationChatId(openChatId);
      } else if (notificationType === 'workout_reminder' && openWorkoutId) {
        setNotificationWorkoutId(openWorkoutId);
      } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType || '') && openAppointmentId) {
        setNotificationAppointmentId(openAppointmentId);
      } else if (notificationType === 'hydration' && openHydration === 'true') {
        setTriggerHydrationModal(true);
      } else if (notificationType?.includes('indulgence_') && openIndulgenceId) {
        setNotificationIndulgenceId(openIndulgenceId);
      } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType || '') && openChallengeList === 'true') {
        setOpenChallengeList(true);
      }

      const newParams = new URLSearchParams(window.location.search);
      newParams.delete('notificationType');
      newParams.delete('openChatId');
      newParams.delete('openWorkoutId');
      newParams.delete('openAppointmentId');
      newParams.delete('openHydration');
      newParams.delete('entityId');
      newParams.delete('isCoach');
      newParams.delete('appointmentStartTimeMillis');
      newParams.delete('openIndulgenceId');
      newParams.delete('indulgenceStartTimeMillis');
      newParams.delete('openChallengeList');
      
      const queryString = newParams.toString();
      const cleanUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
      
      log(`PWA URL: State updated. Cleaning URL to: ${cleanUrl}`);
      router.replace(cleanUrl, { scroll: false });
    }
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);

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
              const senderId = notification.data?.senderId;
              if (senderId && user?.uid && String(senderId) === String(user.uid)) {
                log('Native: Suppressing self-notification toast.');
                return;
              }
              
              log('Native foreground notification received (raw):', notification);
              showInAppNotification(notification.title, notification.body, notification.data || {});
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
              log('Native notification action performed (raw):', action);
              log('Native notification action performed (data):', action.notification.data);
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
        log('Setting up PWA foreground notifications listener...');
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) {
          logError('PWA foreground messaging not supported.');
          return;
        }

        try {
          await navigator.serviceWorker.register('/sw.js');

          const unsubscribeOnMessage = onMessage(messaging, (payload) => {
            const senderId = payload.data?.senderId;
            if (senderId && user?.uid && String(senderId) === String(user.uid)) {
              log('PWA: Suppressing self-notification toast.');
              return;
            }

            log('PWA: Foreground message received (raw payload):', payload);
            const { notification, data } = payload;
            showInAppNotification(notification?.title, notification?.body, data || {});
          });

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
  }, [user, loading, showInAppNotification, handleNotificationAction, setNotificationIndulgenceId, setOpenChallengeList]);

  return <>{children}</>;
};

export default PushNotificationProvider;
