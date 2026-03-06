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
    const { notificationType, chatId, workoutId, appointmentId, link, isCoach: isRecipientCoachStr } = data;

    // Determine the base dashboard URL based on the recipient type from the payload
    const isRecipientCoach = isRecipientCoachStr === 'true'; // Convert string boolean back to boolean
    const dashboardBaseUrl = isRecipientCoach ? '/coach/dashboard' : '/client/dashboard';

    // Handle different notification types and open appropriate pop-ups
    if (notificationType === 'chat' && chatId) {
        setNotificationChatId(String(chatId));
        router.push(`${dashboardBaseUrl}?openChatId=${String(chatId)}`); // Navigate to dashboard, then open chat popup
    } else if (notificationType === 'workout_reminder' && workoutId) { // Changed to workout_reminder to match function payload
        setNotificationWorkoutId(String(workoutId));
        router.push(`${dashboardBaseUrl}?openWorkoutId=${String(workoutId)}`); // Navigate to dashboard, then open workout popup
    } else if (['appointment_reminder', 'appointment_booked'].includes(String(notificationType)) && appointmentId) {
        setNotificationAppointmentId(String(appointmentId));
        router.push(`${dashboardBaseUrl}?openAppointmentId=${String(appointmentId)}`); // Navigate to dashboard, then open appointment popup
    } else if (notificationType === 'hydration') {
        setTriggerHydrationModal(true);
        router.push(`${dashboardBaseUrl}?openHydration=true`); // Navigate to dashboard, then open hydration popup
    } else if (link) {
        router.push(String(link)); // Fallback for generic links
    } else {
        logError(`Unknown notification action. No specific handler found.`, data);
        router.push(dashboardBaseUrl); // Default to dashboard
    }
  };

  // Memoize showInAppNotification to avoid re-creating it, which helps with useEffect dependencies
  // This ensures handleNotificationAction always has the latest state/router
  const showInAppNotification = useRef((title: string, body: string, data: { [key: string]: any }) => {
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
  }).current;


  useEffect(() => {
    if (searchParams?.get('notificationType')) {
        log("PWA: Detected notification in URL.");
        // We need to parse all search params as data for handleNotificationAction
        handleNotificationAction('PWA URL', Object.fromEntries(searchParams.entries()));
        // Clear search params to prevent re-triggering on subsequent renders
        // CORRECTED: Use window.location.pathname as router.pathname is not available in AppRouterInstance
        router.replace(window.location.pathname, { scroll: false });
    }
  }, [searchParams, router, isCoach, handleNotificationAction]); // Added handleNotificationAction to dependencies

  useEffect(() => {
    // Only proceed if user is loaded and not null, and platform is native
    if (loading || !user || !Capacitor.isNativePlatform()) {
      // Clean up listeners if conditions are not met, or if switching users/platforms
      if (listenersAttachedForUser.current) {
        log(`Cleaning up listeners for old user/platform: ${listenersAttachedForUser.current}`);
        PushNotifications.removeAllListeners();
        listenersAttachedForUser.current = null;
      }
      return;
    }

    // Attach listeners only once per user session
    if (listenersAttachedForUser.current === user.uid) {
        log(`Listeners already attached for user: ${user.uid}. Skipping re-attachment.`);
        return;
    }

    log(`Attaching NEW listeners for user: ${user.uid}`);
    listenersAttachedForUser.current = user.uid; // Mark listeners as attached for this user

    const setupListeners = async () => {
      try {
        await createNotificationChannels();
        const permissionStatus = await PushNotifications.requestPermissions();
        if (permissionStatus.receive === 'granted') {
          log('Native push permission granted.');
          await PushNotifications.register();
        } else {
          logError('Native push permission NOT granted:', permissionStatus.receive);
          // You might want to prompt the user to enable permissions here if needed
        }

        // Listener for registration token (always active when registered)
        PushNotifications.addListener('registration', async (token: Token) => {
            log('Native registration success, token:', token.value.substring(0,10));
            // Ensure userId is available before sending token
            if (user?.uid) {
              await addFcmTokenAction({ userId: user.uid, token: token.value });
              log('Native token saved to backend.');
            } else {
              logError('User not available to save native token.');
            }
        });

        // Listener for registration errors
        PushNotifications.addListener('registrationError', (error: any) => {
            logError('Native registration error:', error);
        });

        // Listener for foreground push notifications
        PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            log('Native foreground notification received:', notification);
            const { title, body, data } = notification;
            showInAppNotification(title || 'New Message', body || '', data); // Use the memoized function
        });

        // Listener for when a notification is tapped
        PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            log('Native notification action performed:', action);
            handleNotificationAction('Native Action', action.notification.data);
        });

      } catch (error) {
        logError('Error setting up native push notification listeners:', error);
      }
    };

    setupListeners();

    // Cleanup function: remove all listeners when the component unmounts or user changes
    return () => {
      log(`Cleaning up ALL native push listeners for user: ${listenersAttachedForUser.current}`);
      PushNotifications.removeAllListeners();
      listenersAttachedForUser.current = null;
    };

  }, [user, loading, isCoach, router, showInAppNotification, handleNotificationAction]);
  // Added handleNotificationAction to dependencies to ensure it's up-to-date


  return <>{children}</>;
};

export default PushNotificationProvider;
