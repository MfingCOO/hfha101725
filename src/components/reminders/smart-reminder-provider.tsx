'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { getNextDueNotificationAction, dismissReminderAction } from '@/services/reminders';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';
import { Reminder } from '@/types';
import Image from 'next/image';

export const SmartReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [dueReminder, setDueReminder] = useState<Reminder | null>(null);

  const checkForDueReminders = useCallback(async () => {
    if (user?.uid) {
      try {
        const result = await getNextDueNotificationAction(user.uid);
        if (result.success && result.reminder) {
          setDueReminder(result.reminder);
        }
      } catch (error) {
        console.error("Failed to check for due reminders:", error);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Check immediately on user load
      checkForDueReminders();

      // And check periodically (e.g., every minute)
      const interval = setInterval(checkForDueReminders, 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [user, checkForDueReminders]);

  const handleDismiss = async () => {
    if (user?.uid && dueReminder?.id) {
      try {
        await dismissReminderAction(user.uid, dueReminder.id);
        setDueReminder(null); // Close the modal immediately
      } catch (error) {
        console.error("Failed to dismiss reminder:", error);
      }
    }
  };

  const ctaText = dueReminder?.data?.ctaText || 'Dismiss';

  return (
    <>
      {children}
      {dueReminder && (
        <BaseModal
          isOpen={!!dueReminder}
          onClose={handleDismiss} // For now, any close action is a dismiss
          title={dueReminder.title}
          className="max-w-md"
          footer={
            <div className="flex justify-end w-full">
                <Button onClick={handleDismiss}>{ctaText}</Button>
            </div>
          }
        >
            <div className="space-y-4">
                {dueReminder.data?.imageUrl && (
                    <div className="relative w-full h-48 rounded-lg overflow-hidden">
                         <Image src={dueReminder.data.imageUrl} alt={dueReminder.title} fill className="object-cover" unoptimized/>
                    </div>
                )}
                <p className="text-sm text-muted-foreground">
                    {dueReminder.message}
                </p>
            </div>
        </BaseModal>
      )}
    </>
  );
};
