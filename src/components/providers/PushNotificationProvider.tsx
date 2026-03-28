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
  const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList } = useNotificationStore(); // MODIFIED: Added new setters

  const cleanupRef = useRef<(() => void) | null>(null);

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Full Data:`, JSON.stringify(data, null, 2));
    const notificationType = String(data.notificationType || '');
    const chatId = String(data.chatId || '');
    const workoutId = String(data.workoutId || '');
    const appointmentId = String(data.appointmentId || '');
    const indulgenceId = String(data.indulgenceId || ''); // ADDED
    const challengeId = String(data.challengeId || ''); // ADDED
    const openChallengeList = String(data.openChallengeList || 'false'); // ADDED
    const url = String(data.url || ''); // VERIFIED: 'url' from dataPayload (which is ctaUrl) is correctly used
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || ''); // Get appointmentStartTimeMillis
    const isRecipientCoachStr = String(data.isCoach || 'false');

    // ADDED: Granular logging for parsed data
    console.log(`[PushProvider][${context}] Parsed Data: notificationType=${notificationType}, appointmentId=${appointmentId}, entityId=${String(data.entityId || '')}, isCoach=${isRecipientCoachStr}, appointmentStartTimeMillis=${appointmentStartTimeMillis}, indulgenceId=${indulgenceId}, challengeId=${challengeId}, openChallengeList=${openChallengeList}`);

    const isRecipientCoach = isRecipientCoachStr === 'true';
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

    let targetUrl = url; // **MODIFIED:** Start with the 'url' from data, which is the ctaUrl
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
      if (appointmentStartTimeMillis) { // Pass appointmentStartTimeMillis
        queryParams.set('appointmentStartTimeMillis', appointmentStartTimeMillis);
      }
    } else if (notificationType === 'hydration') {
      setTriggerHydrationModal(true);
      queryParams.set('openHydration', 'true');
      queryParams.set('entityId', 'hydration');
    } else if (notificationType.includes('indulgence_') && indulgenceId) { // ADDED: Indulgence Planner notifications
      setNotificationIndulgenceId(indulgenceId);
      queryParams.set('openIndulgenceId', indulgenceId);
      queryParams.set('entityId', indulgenceId);
      if (appointmentStartTimeMillis) { // Indulgence might also use this for context
        queryParams.set('indulgenceStartTimeMillis', appointmentStartTimeMillis); // Renamed for clarity
      }
    } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType) && openChallengeList === 'true') { // ADDED: Challenge and Streak notifications
      setOpenChallengeList(true);
      queryParams.set('openChallengeList', 'true');
      if (challengeId) queryParams.set('entityId', challengeId); // Use challengeId as entityId
    } else if (notificationType === 'custom-popup' && url) { // ADDED: Custom popup navigation
      // For custom popups, the 'url' from the data payload is the direct target.
      targetUrl = url;
      // Clear any dashboard base URL if the custom URL is absolute or external
      if (url.startsWith('http') || (url.startsWith('/') && url.length > 1 && url[1] !== '/')) { // Check for absolute or root-relative external URL
        // If it's a full external URL, or a root-relative URL not intended for dashboard
        // we might want to just navigate to it directly without dashboardBaseUrl prefix
        // For now, let's keep it simple and ensure the queryParams are still added to the *base* dashboard if it's an internal link.
        // If it's a truly external link, we'll let the 'router.push(targetUrl)' handle it directly.
        log(`[${context}] Custom Popup with direct URL: ${targetUrl}`);
      }
    }
    // Removed the old `if (link)` block, as `url` now holds the direct link

    // If targetUrl is not an external URL, or it's empty, use the dashboard base URL with query params
    // This ensures that if a custom popup has an external URL, it's used directly.
    // If it's an internal link (like to /client/dashboard), then query params are correctly appended.
    if (!targetUrl.startsWith('http') && !url.startsWith('/')) { // Only append query params if it's not an external URL or a root relative one already
      targetUrl = `${dashboardBaseUrl}?${queryParams.toString()}`;
    } else if (!targetUrl.startsWith('http') && url.startsWith('/') && queryParams.toString().length > 0) { // If root relative and has params, append them
        targetUrl = `${targetUrl}?${queryParams.toString()}`;
    }

    log(`[${context}] Final Navigating URL: ${targetUrl}. IsRecipientCoach: ${isRecipientCoach}`);
    router.push(targetUrl);
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]); // MODIFIED: Added new setters to deps

  const showInAppNotification = useCallback((incomingNotificationTitle: string | undefined, incomingNotificationBody: string | undefined, data: { [key: string]: any }) => {
    const finalTitle = incomingNotificationTitle || data.title || 'New Notification';
    let finalBody = incomingNotificationBody || data.body || ''; // Use let for modification

    // **NEW SURGICAL FIX:** Enhance appointment toast description with localized time
    const notificationType = String(data.notificationType || '');
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || '');

    if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && appointmentStartTimeMillis) {
      const date = new Date(Number(appointmentStartTimeMillis));
      const localizedTime = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
      // Prepend or append the localized time to the existing body
      finalBody = `⏰ ${localizedTime} - ${finalBody}`;
    }
    // ADDED: Handle custom popup imageUrl for richer toasts if needed. (Optional, current toast doesn't support image)
    const imageUrl = data.imageUrl || undefined;
    if (imageUrl) {
        log(`[PushProvider] Notification has image: ${imageUrl}`);
        // You might extend your toast component to display images if desired.
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
      const openIndulgenceId = urlParams.get('openIndulgenceId'); // ADDED
      const openChallengeList = urlParams.get('openChallengeList'); // ADDED
      const appointmentStartTimeMillis = urlParams.get('appointmentStartTimeMillis'); // Get appointmentStartTimeMillis from URL

      if (notificationType === 'chat' && openChatId) {
        setNotificationChatId(openChatId);
      } else if (notificationType === 'workout_reminder' && openWorkoutId) {
        setNotificationWorkoutId(openWorkoutId);
      } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType || '') && openAppointmentId) {
        setNotificationAppointmentId(openAppointmentId);
      } else if (notificationType === 'hydration' && openHydration === 'true') {
        setTriggerHydrationModal(true);
      } else if (notificationType?.includes('indulgence_') && openIndulgenceId) { // ADDED
        setNotificationIndulgenceId(openIndulgenceId);
      } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType || '') && openChallengeList === 'true') { // ADDED
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
      newParams.delete('appointmentStartTimeMillis'); // Clear from URL
      newParams.delete('openIndulgenceId'); // ADDED
      newParams.delete('indulgenceStartTimeMillis'); // ADDED
      newParams.delete('openChallengeList'); // ADDED
      
      const queryString = newParams.toString();
      const cleanUrl = queryString ? `${window.location.pathname}?${queryString}` : window.location.pathname;
      
      log(`PWA URL: State updated. Cleaning URL to: ${cleanUrl}`);
      router.replace(cleanUrl, { scroll: false });
    }
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]); // MODIFIED: Added new setters to deps

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
              log('Native foreground notification received (raw):', notification);
              log('Native foreground notification received (title):', notification.title);
              log('Native foreground notification received (body):', notification.body);
              log('Native foreground notification received (data):', notification.data);
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
        // MODIFIED: Only listen for foreground messages for the PWA bell, don't register for OS push notifications.
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
            log('PWA: Foreground message received (raw payload):', payload);
            log('PWA: Foreground message received (notification):', payload.notification);
            log('PWA: Foreground message received (data):', payload.data);
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
  }, [user, loading, showInAppNotification, handleNotificationAction, setNotificationIndulgenceId, setOpenChallengeList]); // MODIFIED: Added new setters to deps

  return <>{children}</>;
};

export default PushNotificationProvider;