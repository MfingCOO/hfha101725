'use client';

import * as React from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';

// Define the shape of an action button
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string; // Add this line
}

// Define the props for the modal itself
export interface ActionableResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  actions: ActionButtonProps[];
}

export function ActionableResponseModal({
  isOpen,
  onClose,
  title,
  description,
  actions,
}: ActionableResponseModalProps) {

  const dialogFooter = (
    <div className="flex items-center justify-end gap-2 w-full">
      {actions.map((action, index) => (
        <Button
          key={index}
          onClick={action.onClick}
          variant={action.variant || 'outline'}
          size="sm"
          className={`flex-shrink-0 ${action.className || ''}`}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      footer={dialogFooter}
    >
      {/* The main content/message is passed as the 'description' to the BaseModal header */}
      <div />
    </BaseModal>
  );
}
