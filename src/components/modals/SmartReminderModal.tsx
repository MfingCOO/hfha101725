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
import { useRouter } from 'next/navigation'; 
import { useState } from 'react';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { pillarsAndTools } from '@/lib/pillars';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Trophy } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder & { id: string };
}

export function SmartReminderModal({ isOpen, onClose, reminder }: SmartReminderModalProps) {
    const { toast } = useToast(); 
    const { user } = useAuth();
    const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    if (!reminder) return null;

    const pillar = pillarsAndTools.find(p => p.id === reminder.pillarId);
    const Icon = pillar?.icon || Trophy;
    const isCustomPopup = reminder.type === 'custom-popup';
    const isCoachingTier = reminder.requiredTier === 'coaching' || reminder.requiredTier === 'Coaching';

    const handleDismiss = async () => {
        if (user?.uid && reminder.id) {
            await dismissReminderAction(user.uid, reminder.id);
        }
        onClose();
    };

    const handleAction = () => {
        if (reminder.data?.ctaUrl) {
            window.open(reminder.data.ctaUrl, '_blank');
            handleDismiss();
        } else if (reminder.pillarId) {
            setIsDataEntryOpen(true);
        }
    };

    const handleUpgrade = async () => {
        if (!Capacitor.isNativePlatform()) {
            toast({ variant: 'destructive', title: 'Error', description: "Please use the mobile app to upgrade." });
            return;
        }

        setIsRedirecting(true);

        try {
            // We REMOVED the Purchases.configure line because RootProviders handles it.

            // 1. Fetch the current offerings (Monthly/Yearly plans)
            const offerings = await Purchases.getOfferings();
            
            if (offerings.current && offerings.current.availablePackages.length > 0) {
                // 2. Purchase the first available package
                const { customerInfo } = await Purchases.purchasePackage({ 
                    aPackage: offerings.current.availablePackages[0] 
                });

                if (Object.keys(customerInfo.entitlements.active).length > 0) {
                    toast({ title: "Upgrade Successful!", description: "Welcome to HungerFree & Happy Pro!" });
                    onClose();
                }
            } else {
                throw new Error("No subscription plans found.");
            }
        } catch (e: any) {
            // Check if the user just cancelled the purchase (not a real error)
            if (e.userCancelled) {
                console.log("User cancelled the purchase");
            } else {
                console.error("Purchase failed", e);
                toast({ 
                    variant: 'destructive', 
                    title: 'Upgrade Failed', 
                    description: e.message || "Could not complete purchase." 
                });
            }
        } finally {
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
                                    <Image src={reminder.data.imageUrl} alt={reminder.title} fill className="object-cover" />
                                </div>
                            ) : (
                                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Icon className="h-8 w-8 text-primary" />
                                </div>
                            )}
                        </div>
                        <DialogTitle className="text-center">{reminder.title}</DialogTitle>
                        <DialogDescription className="text-center pt-2">{reminder.message}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="pt-4 flex-col space-y-2">
                         <div className="flex w-full space-x-2">
                             <Button onClick={handleDismiss} variant="outline" className="w-full">Dismiss</Button>
                             
                             {reminder.requiredTier && !isCoachingTier && (
                                 <Button onClick={handleUpgrade} disabled={isRedirecting} className="w-full">
                                     {isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Upgrade`}
                                 </Button>
                             )}

                             {!reminder.requiredTier && reminder.data?.ctaText && (
                                 <Button onClick={handleAction} className="w-full">{reminder.data.ctaText}</Button>
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
                        if (wasSaved) { handleDismiss(); } 
                    }} 
                    pillar={pillar} 
                />
            )}
        </>
    );
}