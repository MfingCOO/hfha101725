'use client';

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { getSmartReminderAction } from '@/app/client/reminders/actions';
import { SmartReminderModal } from '@/components/modals/SmartReminderModal';
import { ClientProfile } from '@/types';

interface SmartReminder {
    type: 'hydration' | 'binge' | 'inactivity';
    message: string;
}

interface ReminderContextType {
  showReminder: (reminder: SmartReminder) => void;
}

const ReminderContext = createContext<ReminderContextType | undefined>(undefined);

export const useSmartReminders = () => {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useSmartReminders must be used within a SmartReminderProvider');
  }
  return context;
};

export const SmartReminderProvider: React.FC<{ children: React.ReactNode; profile: ClientProfile | null }> = ({ children, profile }) => {
  const { user } = useAuth();
  const [activeReminder, setActiveReminder] = useState<SmartReminder | null>(null);

  const checkForDueReminders = useCallback(async () => {
    if (user && profile?.remindersEnabled) {
      try {
        const result = await getSmartReminderAction();
        if (result.success && result.data) {
          setActiveReminder(result.data);
        }
      } catch (error) {
        console.error("Failed to check for smart reminders:", error);
      }
    }
  }, [user, profile]);

  useEffect(() => {
    if (user && profile?.remindersEnabled) {
      const interval = setInterval(checkForDueReminders, 5 * 60 * 1000); // Check every 5 minutes
      return () => clearInterval(interval);
    }
  }, [user, profile, checkForDueReminders]);

  const showReminder = (reminder: SmartReminder) => {
    setActiveReminder(reminder);
  };

  const handleDismiss = () => {
    setActiveReminder(null);
  };

  return (
    <ReminderContext.Provider value={{ showReminder }}>
      {children}
      {activeReminder && (
        <SmartReminderModal
          isOpen={!!activeReminder}
          onClose={handleDismiss}
          reminder={activeReminder}
        />
      )}
    </ReminderContext.Provider>
  );
};
