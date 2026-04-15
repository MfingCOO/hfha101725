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
    log('✅ Android channels created.');
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

  const showInAppNotification = useCallback((incomingTitle?: string, incomingBody?: string, data: { [key: string]: any } = {}) => {
    const title = incomingTitle || data.title || 'New Notification';
    let body = incomingBody || data.body || '';

    const notificationType = String(data.notificationType || '');
    const appointmentStartTimeMillis = String(data.appointmentStartTimeMillis || '');

    if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && appointmentStartTimeMillis) {
      const date = new Date(Number(appointmentStartTimeMillis));
      body = `⏰ ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })} - ${body}`;
    }

    toast({
      title,
      description: body,
      action: <ToastAction altText="Open" onClick={() => triggerNavigation('Foreground Click', data)}>Open</ToastAction>,
      duration: 7000,
    });
  }, [toast]);

  const triggerNavigation = useCallback((context: string, data: { [key: string]: any }) => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    log(`[${context}] Handling notification`, data);

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
      else if (['challenge_checkin', 'streak_congrats', 'challenge_notification', 'challenge'].includes(type)) {
        setOpenChallengeList(true);
        finalUrl = `/client/dashboard?notificationType=${type}&openChallengeList=true&isCoach=false`;
      } 
      else {
        logError(`Unknown notificationType: "${type}"`, data);
      }
    }

    if (finalUrl && finalUrl !== '/') {
      router.push(finalUrl);
    }

    setTimeout(() => { hasNavigatedRef.current = false; }, 1500);
  }, [router, user, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setNotificationIndulgenceId, setOpenChallengeList]);

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

            // IMPORTANT: Removed setPresentationOptions so background/closed banners work
            // We now rely on pushNotificationReceived for foreground custom toast only

            await PushNotifications.removeAllListeners();

            PushNotifications.addListener('registration', async (token: Token) => {
              if (user?.uid) await addFcmTokenAction({ userId: user.uid, token: token.value });
            });

            PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
              log('Foreground Push Received → Custom Toast');
              showInAppNotification(notification.title, notification.body, notification.data || {});
            });

            PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
              log('Native Banner Tapped (background/closed) → Navigation');
              triggerNavigation('Native Action', action.notification.data || {});
            });

            cleanupRef.current = () => PushNotifications.removeAllListeners();
          }
        } catch (error) {
          logError('Error setting up native push:', error);
        }
      } else {
        // Web PWA fallback
        const isFCMSupported = await isSupported();
        if (!isFCMSupported || !messaging) return;

        try {
          await navigator.serviceWorker.register('/sw.js');
          const unsubscribe = onMessage(messaging, (payload) => {
            showInAppNotification(payload.notification?.title, payload.notification?.body, payload.data || {});
          });
          cleanupRef.current = () => unsubscribe();
        } catch (error) {
          logError('PWA setup error:', error);
        }
      }
    };

    setupNotifications();

    return () => {
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = null;
    };
  }, [user, loading, showInAppNotification, triggerNavigation]);

  return <>{children}</>;
};

export default PushNotificationProvider;