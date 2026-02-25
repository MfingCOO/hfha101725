'use client';

import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Droplet } from 'lucide-react';

export const NotificationPresenter: React.FC = () => {
  const { notifications, removeNotification } = useNotification();
  const { openModal } = useDataEntryModal();

  if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[0];

  // If the notification is a hydration reminder or a chat message, do not render this modal.
  if (currentNotification.type === 'hydration_reminder' || currentNotification.type === 'chat_message') {
    return null;
  }

  const handleDismiss = () => {
    if (removeNotification) {
      removeNotification(currentNotification.id);
    }
  };

  const handleAction = () => {
    if (currentNotification.ctaType === 'openPillar' && currentNotification.pillarId) {
        openModal(currentNotification.pillarId as any);
        removeNotification(currentNotification.id);
    } else if (currentNotification.ctaType === 'openUrl' && currentNotification.ctaUrl) {
        // This is the corrected line
        window.open(currentNotification.ctaUrl, '_blank');
    } else {
        removeNotification(currentNotification.id);
    }
  };

  return (
    <BaseModal isOpen={true} onClose={handleDismiss} title={currentNotification.title}>
      <div className="p-4 flex flex-col items-center">
        <div className="mb-6 flex items-center justify-center h-24 w-24">
          {currentNotification.imageUrl ? (
            <div className="relative w-full h-full">
              <Image
                src={currentNotification.imageUrl}
                alt={currentNotification.title}
                layout="fill"
                objectFit="cover"
                className="rounded-lg"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-gray-800 rounded-lg"></div> // Placeholder
          )}
        </div>
        <p className="mb-4 text-center">{currentNotification.message}</p>
        <div className="flex w-full space-x-2">
          <Button onClick={handleDismiss} variant="outline" className="w-full">Dismiss</Button>
          {currentNotification.ctaText && (
            <Button onClick={handleAction} className="w-full bg-yellow-500 hover:bg-yellow-600 text-black">
              {currentNotification.ctaText}
            </Button>
          )}
        </div>
      </div>
    </BaseModal>
  );

};
