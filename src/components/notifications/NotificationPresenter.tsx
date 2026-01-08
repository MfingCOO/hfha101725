'use client';

import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export const NotificationPresenter: React.FC = () => {
  const { notifications, removeNotification } = useNotification();

  if (notifications.length === 0) {
    return null;
  }

  const currentNotification = notifications[0];

  const handleDismiss = () => {
    removeNotification(currentNotification.id);
  };

  // This function will now be called by the anchor tag after the link is opened.
  const handleAction = () => {
    removeNotification(currentNotification.id);
  };

  // Create the footer element to pass to BaseModal's `footer` prop
  const modalFooter = (
    <div className="flex flex-col sm:flex-col sm:space-x-0 w-full">
        {/* FIXED: Only render the button if there is a URL and TEXT */}
        {currentNotification.ctaUrl && currentNotification.ctaText && (
             /* FIXED: Use a standard <a> tag for the link to ensure it always opens */
            <a 
                href={currentNotification.ctaUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                onClick={handleAction} 
                className="w-full"
            >
                <Button className="w-full mb-2">{currentNotification.ctaText}</Button>
            </a>
        )}
        <Button onClick={handleDismiss} variant="ghost" className="w-full">Dismiss</Button>
    </div>
  );

  return (
    <BaseModal 
        isOpen={true} 
        onClose={handleDismiss}
        title={currentNotification.title}
        description={currentNotification.message}
        footer={modalFooter}
        className="max-w-md w-[90%]"
    >
        {currentNotification.imageUrl && (
            <div className="relative w-full h-64 my-4">
                <Image 
                    src={currentNotification.imageUrl} 
                    alt={currentNotification.title} 
                    layout="fill"
                    objectFit="contain"
                />
            </div>
        )}
    </BaseModal>
  );
};
