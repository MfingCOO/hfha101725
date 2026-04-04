
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
import { useRouter } from 'next/navigation'; // FIXED: Corrected import statement
import { UserTier } from '@/types';
import { useState } from 'react';
import { DataEntryDialog } from '../dashboard/data-entry-dialog';
import { pillarsAndTools } from '@/lib/pillars';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, X, Trophy } from 'lucide-react';
import { Purchases } from '@revenuecat/purchases-capacitor';

interface SmartReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminder: Reminder & { id: string };
}

// Map your internal UserTier and billing cycle to RevenueCat Package Identifiers
// FIXED: Corrected keys to explicitly include both lowercase/kebab-case and PascalCase from UserTier type
const revenueCatPackageMap: Record<UserTier, { monthly?: string; yearly?: string; free?: string }> = {
  // Lowercase/kebab-case keys
  'free': { free: 'free_access' }, // Using 'free_access' as a placeholder for a $0 tier if one exists
  'ad-free': {
    monthly: 'ad_free_monthly',
    yearly: 'ad_free_yearly',
  },
  'basic': {
    monthly: 'basic_monthly',
    yearly: 'basic_yearly',
  },
  'premium': {
    monthly: 'premium_monthly',
    yearly: 'premium_yearly',
  },
  'coaching': {}, 
  // PascalCase keys (for full UserTier compatibility)
  'Free': { free: 'free_access' }, // Using 'free_access' as a placeholder for a $0 tier if one exists
  'AdFree': {
    monthly: 'ad_free_monthly',
    yearly: 'ad_free_yearly',
  },
  'Basic': {
    monthly: 'basic_monthly',
    yearly: 'basic_yearly',
  },
  'Premium': {
    monthly: 'premium_monthly',
    yearly: 'premium_yearly',
  },
  'Coaching': {}, 
};

export function SmartReminderModal({ isOpen, onClose, reminder }: SmartReminderModalProps) {
    const { toast } = useToast(); // FIXED: Removed default value here, as useToast handles it
    const { user } = useAuth();
    const router = useRouter();
    const [isDataEntryOpen, setIsDataEntryOpen] = useState(false);
    const [isRedirecting, setIsRedirecting] = useState(false);

    if (!reminder) return null;

    const pillar = pillarsAndTools.find(p => p.id === reminder.pillarId);
    const Icon = pillar?.icon || Trophy;
    const isCustomPopup = reminder.type === 'custom-popup';
    const isCoachingTier = reminder.requiredTier === 'coaching' || reminder.requiredTier === 'Coaching'; // FIXED: Compare with both casing options

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
        }
        else if (reminder.pillarId) {
            setIsDataEntryOpen(true);
        }
    };

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async (billingCycle: 'monthly' | 'yearly' = 'monthly') => {
        if (!user || !reminder.requiredTier || isCoachingTier) return;
        setIsRedirecting(true);
        try {
            const offerings = await Purchases.getOfferings();
            if (!offerings.current) {
                throw new Error("No current RevenueCat offering found.");
            }

            let desiredPackageIdentifier: string | undefined;
            // Dynamically select the correct map entry based on `reminder.requiredTier`'s casing
            const tierKey = (reminder.requiredTier === 'free' || reminder.requiredTier === 'Free') ? 'Free' : 
                            (reminder.requiredTier === 'ad-free' || reminder.requiredTier === 'AdFree') ? 'AdFree' : 
                            (reminder.requiredTier === 'basic' || reminder.requiredTier === 'Basic') ? 'Basic' : 
                            (reminder.requiredTier === 'premium' || reminder.requiredTier === 'Premium') ? 'Premium' : null; // Handles coaching explicitly being filtered out already

            if (!tierKey) {
                throw new Error(`Invalid tier: ${reminder.requiredTier} for package mapping.`);
            }

            if (tierKey === 'Free') {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.free;
            } else {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.[billingCycle];
            }

            if (!desiredPackageIdentifier) {
                throw new Error(`No RevenueCat package mapped for tier: ${reminder.requiredTier} and cycle: ${billingCycle}`);
            }

            let packageToPurchase;
            for (const offeringPackage of offerings.current.availablePackages) {
                if (offeringPackage.identifier === desiredPackageIdentifier) {
                    packageToPurchase = offeringPackage;
                    break;
                }
            }

            if (!packageToPurchase) {
                throw new Error(`RevenueCat package '${desiredPackageIdentifier}' not found in current offering.`);
            }

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });

            if (Object.keys(customerInfo.entitlements.active).length > 0) {
                toast({ title: "Purchase Successful!", description: "Your subscription has been activated." });
                onClose();
            } else {
                throw new Error("Purchase completed, but no active entitlements found. Please check your subscription status.");
            }

        } catch (e: any) {
            console.error("RevenueCat purchase failed:", e);
            let errorMessage = "Could not complete the upgrade. Please try again.";
            if (e.code === 'PURCHASE_CANCELLED') {
                errorMessage = "Purchase was cancelled.";
            } else if (e.message) {
                errorMessage = e.message;
            }
            toast({ variant: 'destructive', title: 'Error', description: errorMessage });
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
                                <Button
                                    onClick={isCoachingTier ? handleContactCoaching : () => handleUpgrade('monthly')}
                                    disabled={isRedirecting}
                                    className="w-full"
                                >
                                    {isCoachingTier ? "Contact for Coaching" : (isRedirecting && <Loader2 className="h-4 w-4 animate-spin" />)}
                                    {isCoachingTier ? null : `Upgrade to ${reminder.requiredTier}`}
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
