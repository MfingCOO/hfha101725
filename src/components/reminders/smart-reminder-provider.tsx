'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { getSmartReminderAction } from '@/app/client/reminders/actions';
import { SmartReminderModal } from '@/components/modals/SmartReminderModal';
import { ClientProfile } from '@/types';

// Matches the data structure coming back from the Server Action
interface ActiveReminder {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
}

interface ReminderContextType {
  showReminder: (reminder: any) => void;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

export const useSmartReminders = () => {
  const context = useContext(ReminderContext);
  if (!context) throw new Error('useSmartReminders must be used within a SmartReminderProvider');
  return context;
};

export const SmartReminderProvider: React.FC<{ children: React.ReactNode; profile: ClientProfile | null }> = ({ children, profile }) => {
  const { user } = useAuth();
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);

  const checkForDueReminders = useCallback(async () => {
    // Only check if user is logged in and has reminders enabled
    if (user?.uid && profile?.remindersEnabled) {
      try {
        const result = await getSmartReminderAction(user.uid);
        if (result.success && result.data) {
          setActiveReminder(result.data);
        }
      } catch (error) {
        console.error("Failed to check for smart reminders:", error);
      }
    }
  }, [user?.uid, profile?.remindersEnabled]);

  useEffect(() => {
    if (user && profile?.remindersEnabled) {
      // Check immediately on load
      checkForDueReminders();
      // Then check every 5 minutes
      const interval = setInterval(checkForDueReminders, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, profile?.remindersEnabled, checkForDueReminders]);

  return (
    <ReminderContext.Provider value={{ showReminder: setActiveReminder }}>
      {children}
      {activeReminder && (
        <SmartReminderModal
          isOpen={!!activeReminder}
          onClose={() => setActiveReminder(null)}
          reminder={activeReminder as any}
        />
      )}
    </ReminderContext.Provider>
  );
};