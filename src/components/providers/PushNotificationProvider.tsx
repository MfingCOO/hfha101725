'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { 
  ActionPerformed, 
  PushNotifications, 
  Token, 
  PushNotificationSchema 
} from '@capacitor/push-notifications';
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

// 1. Create Channels (Crucial for Background/Closed Banners on Android)
const createNotificationChannels = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    log("Creating Android notification channels...");
    const channels = [
      { id: 'chat_messages', name: 'Chat Messages' },
      { id: 'appointment_booked_notifications', name: 'Appointment Booked' },
      { id: 'appointment_reminders', name: 'Appointment Reminders' },
      { id: 'workout_reminders', name: 'Workout Reminders' },
      { id: 'hydration_reminders', name: 'Hydration Reminders' },
      { id: 'custom_popups', name: 'Custom Popups' },
      { id: 'indulgence_notifications', name: 'Indulgence Reminders' },
      { id: 'challenge_notifications', name: 'Challenge Reminders' },
      { id: 'streak_notifications', name: 'Streak Accomplishments' }
    ];

    for (const channel of channels) {
      await LocalNotifications.createChannel({
        id: channel.id,
        name: channel.name,
        importance: 5, 
        sound: 'default',
        vibration: true,
        visibility: 1
      });
    }
    log('Android channels created.');
  } catch (error) {
    logError('Error creating channels:', error);
  }
};

const PushNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { 
    setNotificationChatId, 
    setNotificationAppointmentId, 
    setNotificationWorkoutId, 
    setTriggerHydrationModal, 
    setNotificationIndulgenceId, 
    setOpenChallengeList 
  } = useNotificationStore();

  const cleanupRef = useRef<(() => void) | null>(null);
  const hasNavigatedRef = useRef(false);
  const hasSetupRef = useRef(false);

  // 2. The UI Trigger (Toasts when open)
  const showInAppNotification = useCallback((incomingTitle: string | undefined, incomingBody: string | undefined, data: { [key: string]: any }, type: 'toast' | 'banner' = 'toast') => {
    const title = incomingTitle || data.title || 'New Notification';
    let body = incomingBody || data.body || '';

    const notificationType = String(data.notificationType || '');
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || '');

    if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && appointmentStartTimeMillis) {
      const date = new Date(Number(appointmentStartTimeMillis));
      body = `⏰ ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })} - ${body}`;
    }

    if (type === 'toast') {
      toast({
        title,
        description: body,
        // Using an inline function for onClick avoids the circular dependency issue in useCallback
        action: <ToastAction altText="Open" onClick={() => triggerNavigation('Foreground Click', data)}>Open</ToastAction>,
        duration: 7000,
      });
    } else if (type === 'banner') {
      log(`Triggering post-navigation logic for: "${title}"`);
    }
  }, [toast]);

  // 3. The Navigation Engine (Routing to pop-ups)
  const triggerNavigation = useCallback((context: string, data: { [key: string]: any }) => {
    if (hasNavigatedRef.current) {
        log(`[${context}] Navigation already in progress, suppressing action.`);
        return;
    }
    hasNavigatedRef.current = true;
    log(`[${context}] Handling action.`, data);

    // Prevent self-notification
    const sId = data.senderId || data.userId;
    if (sId && user?.uid && String(sId) === String(user.uid)) {
        hasNavigatedRef.current = false;
        return;
    }

    const type = String(data.notificationType || '').toLowerCase();
    let finalUrl = String(data.url || data.ctaUrl || '');

    if (!finalUrl || finalUrl === '/') {
        if (type === 'chat' && data.chatId) {
            setNotificationChatId(data.chatId);
            finalUrl = `/client/dashboard?openChatId=${data.chatId}&notificationType=chat&isCoach=false`;
        } 
        else if (type === 'workout_reminder' && data.workoutId) {
            setNotificationWorkoutId(data.workoutId);
            finalUrl = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${data.workoutId}&isCoach=false`;
        } 
        else if (['appointment_reminder', 'appointment_booked'].includes(type) && (data.appointmentId || data.entityId)) {
            const id = data.appointmentId || data.entityId;
            setNotificationAppointmentId(id);
            finalUrl = `/client/dashboard?notificationType=${type}&openAppointmentId=${id}&isCoach=false`;
        } 
        else if (type === 'hydration') {
            setTriggerHydrationModal(true);
            finalUrl = `/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false`;
        } 
        else if (type.includes('indulgence_') && data.indulgenceId) {
            setNotificationIndulgenceId(data.indulgenceId);
            finalUrl = `/client/dashboard?notificationType=${type}&openIndulgenceId=${data.indulgenceId}&isCoach=false`;
        } 
        else if (['challenge_checkin', 'streak_congrats', 'challenge_notification'].includes(type)) {
            // More flexible check for challenge modal
            setOpenChallengeList(true);
            finalUrl = `/client/dashboard?notificationType=${type}&openChallengeList=true&isCoach=false`;
        } 
        else {
            // ← IMPORTANT: Log unknown types so you can see what's coming from backend
            logError(`Unknown notificationType: "${type}"`, data);
        }
    }

    if (finalUrl && finalUrl !== '/') {
        router.push(finalUrl);
    }

    // Reset guard after a short delay
    setTimeout(() => { hasNavigatedRef.current = false; }, 1500);
}, [router, user, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);
  // 4. URL Parameter Handling (Deep Links)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
      const dataFromUrl = Object.fromEntries(urlParams.entries());
      triggerNavigation('URL Load', dataFromUrl);

      if (window.history.replaceState) {
        const newUrl = new URL(window.location.href);
        ['notificationType', 'openChatId', 'openWorkoutId', 'openAppointmentId', 'openHydration', 'indulgenceId', 'openChallengeList'].forEach(p => newUrl.searchParams.delete(p));
        window.history.replaceState({}, document.title, newUrl.toString());
      }
    }
  }, [triggerNavigation]);

  // 5. Capacitor Native Registration & Listeners
  useEffect(() => {
    if (loading || !user || hasSetupRef.current) return;
    hasSetupRef.current = true;

    const setupNotifications = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        try {
          await createNotificationChannels();
          const permissionStatus = await PushNotifications.requestPermissions();
          
          if (permissionStatus.receive === 'granted') {
            await PushNotifications.register();

            // FIX FOR THE TYPESCRIPT ERROR: 
            // We cast to `any` to bypass TS complaints, but the native Java code still executes this.
            // This guarantees the app won't show a native banner while FOREGROUNDED.
            try {
              await (PushNotifications as any).setPresentationOptions({
                presentationOptions: ['badge', 'sound'], // 'alert' is removed
              });
            } catch (e) {
              logError("Failed to set foreground presentation options (safe to ignore on some devices)", e);
            }

            await PushNotifications.removeAllListeners();

            // Save Token to Firebase
            PushNotifications.addListener('registration', async (token: Token) => {
              if (user?.uid) await addFcmTokenAction({ userId: user.uid, token: token.value });
            });

            // APP IS OPEN (Foreground) -> Trigger custom Toast
            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
              log('Foreground Push Received -> Triggering Toast');
              showInAppNotification(notification.title, notification.body, notification.data || {}, 'toast');
            });

            // APP WAS CLOSED/BACKGROUNDED -> User tapped Native Banner -> Route to popup
            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
              log('Native Banner Tapped -> Routing to Page');
              triggerNavigation('Native Action', action.notification.data || {});
            });

            cleanupRef.current = () => PushNotifications.removeAllListeners();
          }
        } catch (error) {
          logError('Error setting up native push:', error);
        }
      } else {
        // Web PWA Fallback
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) return;

        try {
          await navigator.serviceWorker.register('/sw.js');
          const unsubscribe = onMessage(messaging, (payload) => {
            showInAppNotification(payload.notification?.title, payload.notification?.body, payload.data || {}, 'toast');
          });
          cleanupRef.current = () => unsubscribe();
        } catch (error) {
          logError('PWA setup error:', error);
        }
      }
    };

    setupNotifications();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [user, loading, showInAppNotification, triggerNavigation]);

  return <>{children}</>;
};

export default PushNotificationProvider;