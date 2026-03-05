'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from './scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  profile?: {
      photoURL: string | null | undefined;
      displayName: string | null | undefined;
  };
}

export function BaseModal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  footer,
  profile,
}: BaseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("w-[90vw] max-w-lg max-h-[85dvh] p-0 grid grid-rows-[auto_1fr_auto]", className)}>
        <DialogHeader className="p-4 border-b space-y-2">
          <div className="flex items-center gap-4">
            {profile && (
                 <Avatar className="h-12 w-12 border-2 border-primary">
                    <AvatarImage src={profile.photoURL || ''} alt={profile.displayName || 'User'} />
                    <AvatarFallback className="text-lg">{profile.displayName?.charAt(0)}</AvatarFallback>
                </Avatar>
            )}
            <div className="flex-1">
                <DialogTitle>{title}</DialogTitle>
                {description && <DialogDescription>{description}</DialogDescription>}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-full overflow-y-auto">
          <div className="p-4">
            {children}
          </div>
        </ScrollArea>
        
        {footer && (
            <div className="p-4 border-t">
                {footer}
            </div>
        )}

      </DialogContent>
    </Dialog>
  );
}
