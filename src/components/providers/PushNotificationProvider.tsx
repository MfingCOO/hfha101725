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
    await LocalNotifications.createChannel({ id: 'appointment_booked_notifications', name: 'Appointment Booked', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'appointment_reminders', name: 'Appointment Reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'workout_reminders', name: 'Workout Reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'hydration_reminders', name: 'Hydration Reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'custom_popups', name: 'Custom Popups', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'indulgence_notifications', name: 'Indulgence Reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'challenge_notifications', name: 'Challenge Reminders', importance: 5, sound: 'default', vibration: true, visibility: 1 });
    await LocalNotifications.createChannel({ id: 'streak_notifications', name: 'Streak Accomplishments', importance: 5, sound: 'default', vibration: true, visibility: 1 });
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

  const handleNotificationAction = useCallback((context: string, data: { [key: string]: any }) => {
    log(`[${context}] Handling action. Full Data:`, data);

    const sId = data.senderId || data.userId;
    if (sId && user?.uid && String(sId) === String(user.uid)) {
      log('Suppressing self-notification');
      return;
    }

    const backendCtaUrl = String(data.url || data.ctaUrl || '');
    const notificationType = String(data.notificationType || '');

    let finalNavigationUrl = backendCtaUrl;

    if (!finalNavigationUrl || finalNavigationUrl === '/') {
      finalNavigationUrl = '/client/dashboard';
      if (notificationType === 'chat' && data.chatId) {
        setNotificationChatId(data.chatId);
        finalNavigationUrl = `/client/dashboard?openChatId=${data.chatId}&notificationType=chat&isCoach=false`;
      } else if (notificationType === 'workout_reminder' && data.workoutId) {
        setNotificationWorkoutId(data.workoutId);
        finalNavigationUrl = `/client/dashboard?notificationType=workout_reminder&openWorkoutId=${data.workoutId}&isCoach=false`;
      } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && (data.appointmentId || data.entityId)) {
        const id = data.appointmentId || data.entityId;
        setNotificationAppointmentId(id);
        finalNavigationUrl = `/client/dashboard?notificationType=${notificationType}&openAppointmentId=${id}&isCoach=false`;
      } else if (notificationType === 'hydration') {
        setTriggerHydrationModal(true);
        finalNavigationUrl = '/client/dashboard?openHydration=true&notificationType=hydration&isCoach=false';
      } else if (notificationType.includes('indulgence_') && data.indulgenceId) {
        setNotificationIndulgenceId(data.indulgenceId);
        finalNavigationUrl = `/client/dashboard?notificationType=${notificationType}&openIndulgenceId=${data.indulgenceId}&isCoach=false`;
      } else if (['challenge_checkin', 'streak_congrats'].includes(notificationType) && data.openChallengeList === 'true') {
        setOpenChallengeList(true);
        finalNavigationUrl = `/client/dashboard?notificationType=${notificationType}&openChallengeList=true&isCoach=false`;
      }
    }

    log(`[${context}] Final Navigating URL: ${finalNavigationUrl}`);
    router.push(finalNavigationUrl);
  }, [router, user, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);

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

    log(`Showing in-app toast. Final Title: ${finalTitle}, Final Body: ${finalBody}`);
    toast({
      title: finalTitle,
      description: finalBody,
      action: (
        <ToastAction altText="Open" onClick={() => handleNotificationAction('Foreground Click', data)}>
          Open
        </ToastAction>
      ),
      duration: 7000,
    });
  }, [handleNotificationAction, toast]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('notificationType')) {
      log("PWA: Detected notification in URL on load. Handling...");

      const notificationType = urlParams.get('notificationType') || '';
      const openChatId = urlParams.get('openChatId');
      const openWorkoutId = urlParams.get('openWorkoutId');
      const openAppointmentId = urlParams.get('openAppointmentId');
      const openHydration = urlParams.get('openHydration');
      const openIndulgenceId = urlParams.get('openIndulgenceId');
      const openChallengeList = urlParams.get('openChallengeList');

      if (notificationType === 'chat' && openChatId) setNotificationChatId(openChatId);
      else if (notificationType === 'workout_reminder' && openWorkoutId) setNotificationWorkoutId(openWorkoutId);
      else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && openAppointmentId) setNotificationAppointmentId(openAppointmentId);
      else if (notificationType === 'hydration' && openHydration === 'true') setTriggerHydrationModal(true);
      else if (notificationType.includes('indulgence_') && openIndulgenceId) setNotificationIndulgenceId(openIndulgenceId);
      else if (['challenge_checkin', 'streak_congrats'].includes(notificationType) && openChallengeList === 'true') setOpenChallengeList(true);

      router.replace(window.location.pathname, { scroll: false });
    }
  }, [router, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);

  useEffect(() => {
    log("PushNotificationProvider useEffect triggered.");

    const setupNotifications = async () => {
      if (Capacitor.isNativePlatform()) {
        log('Setting up NATIVE push notifications...');
        try {
          await createNotificationChannels();
          const permissionStatus = await PushNotifications.requestPermissions();
          if (permissionStatus.receive === 'granted') {
            await PushNotifications.register();

            PushNotifications.addListener('registration', async (token: Token) => {
              log('Native registration success, token:', token.value.substring(0,10) + '...');
              if (user?.uid) await addFcmTokenAction({ userId: user.uid, token: token.value });
            });

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
              const sId = notification.data?.senderId;
              if (sId && user?.uid && String(sId) === String(user.uid)) return;
              showInAppNotification(notification.title, notification.body, notification.data || {});
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
              handleNotificationAction('Native Action', action.notification.data || {});
            });

            cleanupRef.current = () => PushNotifications.removeAllListeners();
          }
        } catch (error) {
          logError('Error setting up native push:', error);
        }
      } else {
        log('Setting up PWA foreground notifications listener...');
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) return;

        try {
          await navigator.serviceWorker.register('/sw.js');

          const unsubscribeOnMessage = onMessage(messaging, (payload) => {
            const sId = payload.data?.senderId;
            if (sId && user?.uid && String(sId) === String(user.uid)) return;
            showInAppNotification(payload.notification?.title, payload.notification?.body, payload.data || {});
          });

          cleanupRef.current = () => unsubscribeOnMessage();
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
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [user, loading, showInAppNotification, handleNotificationAction]);

  return <>{children}</>;
};

export default PushNotificationProvider;