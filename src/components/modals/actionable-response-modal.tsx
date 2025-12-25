'use client';

import * as React from 'react';
import { BaseModal } from '@/components/ui/base-modal';
import { Button } from '@/components/ui/button';

// Define the shape of an action button
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  className?: string;
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
    <div className="w-full pt-4 flex flex-col sm:flex-row sm:justify-end gap-2">
      {actions.map((action, index) => (
        <Button
          key={index}
          onClick={action.onClick}
          variant={action.variant || 'default'}
          className={`w-full sm:w-auto ${action.className || ''}`}>
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
      footer={dialogFooter}
      className="sm:max-w-md">
      <p className="text-sm text-muted-foreground">{description}</p>
    </BaseModal>
  );
}
