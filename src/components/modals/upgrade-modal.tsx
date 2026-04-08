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
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import { Loader2 } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: UserTier;
  featureName: string;
  reason: string;
}

export function UpgradeModal({ isOpen, onClose, requiredTier, featureName, reason }: UpgradeModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const isCoachingTier = requiredTier === 'coaching' || requiredTier === 'Coaching';

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async () => {
        if (!Capacitor.isNativePlatform()) {
            toast({ variant: 'destructive', title: 'Error', description: "Subscriptions are only available on the mobile app." });
            return;
        }

        if (!user || isCoachingTier) return;
        setIsRedirecting(true);

        try {
            // WE REMOVED: Purchases.configure(...) 
            // Because RootProviders.tsx handles the connection Boss duties.

            // 1. Check if the system is ready (should be true if RootProvider worked)
            const ready = await Purchases.isConfigured();
            if (!ready) throw new Error("Billing system not ready.");

            // 2. Get the products from RevenueCat
            const offerings = await Purchases.getOfferings();
            
            if (offerings.current && offerings.current.availablePackages.length > 0) {
                // 3. Start the purchase
                const { customerInfo } = await Purchases.purchasePackage({ 
                    aPackage: offerings.current.availablePackages[0] 
                });

                if (Object.keys(customerInfo.entitlements.active).length > 0) {
                    toast({ title: "Upgrade Successful!", description: `You now have access to ${featureName}.` });
                    onClose();
                }
            } else {
                throw new Error("No available plans found in the store.");
            }

        } catch (e: any) {
            // Only show an error if the user didn't just hit 'Cancel'
            if (!e.userCancelled) {
                console.error("Upgrade failed:", e);
                toast({ 
                    variant: 'destructive', 
                    title: 'Error', 
                    description: e.message || "Could not complete the upgrade." 
                });
            }
        } finally {
            setIsRedirecting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] sm:max-w-md">
                <DialogHeader className="text-center pt-4">
                    <DialogTitle className="text-2xl">Upgrade to Unlock {featureName}</DialogTitle>
                    <DialogDescription className="text-base px-4">{reason}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
                    <Button 
                        onClick={isCoachingTier ? handleContactCoaching : handleUpgrade} 
                        disabled={isRedirecting} 
                        className="w-full"
                    >
                        {isCoachingTier ? (
                            "Contact for Coaching"
                        ) : isRedirecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            `Upgrade to ${requiredTier}`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}