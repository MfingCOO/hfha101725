
'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Reminder, dismissReminderAction } from '@/services/reminders';
import type { LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UserTier } from '@/types';
import { useState } from 'react';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { pillarsAndTools } from '@/lib/pillars';
import { useToast } from '@/hooks/use-toast';
import { createStripeCheckoutSession } from '@/app/client/settings/actions';
import { useAuth } from '../auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, X, Trophy } from 'lucide-react';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder & { id: string };
}

export function SmartReminderModal({ isOpen, onClose, reminder }: SmartReminderModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const router = useRouter();
    const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    if (!reminder) return null;

    const pillar = pillarsAndTools.find(p => p.id === reminder.pillarId);
    const Icon = pillar?.icon || Trophy;
    const isCustomPopup = reminder.type === 'custom-popup';

    const handleDismiss = async () => {
        if (user?.uid && reminder.id) {
            await dismissReminderAction(user.uid, reminder.id);
        }
        onClose();
    };

    const handleAction = () => {
        // If the reminder has a URL, treat it as the primary action, even for non-custom popups.
        // This makes the component more robust to mis-configured reminder data.
        if (reminder.data?.ctaUrl) {
            window.open(reminder.data.ctaUrl, '_blank');
            handleDismiss();
        } 
        // Otherwise, fall back to data entry if a pillar is specified.
        else if (reminder.pillarId) {
            setIsDataEntryOpen(true);
        }
    };

    const handleUpgrade = async () => {
        if (!user?.uid || !reminder.requiredTier) return;
        try {
            setIsRedirecting(true);
            const result = await createStripeCheckoutSession(user.uid, reminder.requiredTier as any, 'monthly');
            if (result.url) {
                router.push(result.url);
            } else {
                throw new Error('Could not create a checkout session. Please try again.');
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Upgrade Failed',
                description: error.message,
            });
            setIsRedirecting(false);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <div className="flex items-center justify-center mb-4">
                            {isCustomPopup && reminder.data?.imageUrl ? (
                                <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-primary/20">
                                <Image
                                    src={reminder.data.imageUrl}
                                    alt={reminder.title}
                                    fill
                                    className="object-cover"
                                />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Icon className="h-8 w-8 text-primary" />
                                </div>
                            )}
                        </div>
                        <DialogTitle className="text-center">{reminder.title}</DialogTitle>
                        <DialogDescription className="text-center pt-2">
                            {reminder.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-4 flex-col space-y-2">
                         <div className="flex w-full space-x-2">
                             <Button onClick={handleDismiss} variant="outline" className="w-full">Dismiss</Button>
                             {!reminder.requiredTier && reminder.type !== 'custom-popup' && reminder.data?.ctaText && (
                                 <Button onClick={handleAction} className="w-full">
                                     {reminder.data.ctaText}
                                 </Button>
                             )}
                            {reminder.requiredTier && (
                                <Button onClick={handleUpgrade} disabled={isRedirecting} className="w-full">
                                    {isRedirecting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    Upgrade to {reminder.requiredTier}
                                </Button>
                            )}
                             {reminder.type === 'custom-popup' && reminder.data?.ctaUrl && reminder.data?.ctaText && (
                                <Button asChild className="w-full">
                                    <Link href={reminder.data.ctaUrl} target="_blank">
                                        {reminder.data.ctaText}
                                    </Link>
                                </Button>
                             )}
                             {reminder.type === 'custom-popup' && !reminder.data?.ctaUrl && (
                                 <Button onClick={handleDismiss} className="w-full">{reminder.data?.ctaText || 'Got it!'}</Button>
                             )}
                         </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {pillar && (
                <DataEntryDialog
                    open={isDataEntryOpen}
                    onOpenChange={(wasSaved) => {
                        setIsDataEntryOpen(false);
                        if (wasSaved) {
                            handleDismiss();
                        }
                    }}
                    pillar={pillar}
                />
            )}
        </>
    );
}
