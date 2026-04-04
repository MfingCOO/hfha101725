
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
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2, X, Trophy } from 'lucide-react';
import { UserTier } from '@/types';
import { Purchases, PACKAGE_TYPE } from '@revenuecat/purchases-capacitor';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: UserTier;
  featureName: string;
  reason: string;
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

export function UpgradeModal({ isOpen, onClose, requiredTier, featureName, reason }: UpgradeModalProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [isRedirecting, setIsRedirecting] = useState(false);

    const isCoachingTier = requiredTier === 'coaching' || requiredTier === 'Coaching'; // FIXED: Compare with both casing options

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async (billingCycle: 'monthly' | 'yearly' = 'monthly') => {
        if (!user || !requiredTier || isCoachingTier) return;
        setIsRedirecting(true);
        try {
            const offerings = await Purchases.getOfferings();
            if (!offerings.current) {
                throw new Error("No current RevenueCat offering found.");
            }

            let desiredPackageIdentifier: string | undefined;
            // Dynamically select the correct map entry based on `requiredTier`'s casing
            const tierKey = (requiredTier === 'free' || requiredTier === 'Free') ? 'Free' : 
                            (requiredTier === 'ad-free' || requiredTier === 'AdFree') ? 'AdFree' : 
                            (requiredTier === 'basic' || requiredTier === 'Basic') ? 'Basic' : 
                            (requiredTier === 'premium' || requiredTier === 'Premium') ? 'Premium' : null; // Handles coaching explicitly being filtered out already

            if (!tierKey) {
                throw new Error(`Invalid tier: ${requiredTier} for package mapping.`);
            }

            if (tierKey === 'Free') {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.free;
            } else {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.[billingCycle];
            }

            if (!desiredPackageIdentifier) {
                throw new Error(`No RevenueCat package mapped for tier: ${requiredTier} and cycle: ${billingCycle}`);
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
                toast({ title: "Upgrade Successful!", description: "Your subscription has been updated." });
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[90vw] sm:max-w-md">
                <DialogHeader className="text-center pt-4">
                    <DialogTitle className="text-2xl">Upgrade to Unlock {featureName}</DialogTitle>
                    <DialogDescription className="text-base px-4">
                        {reason}
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
                    <Button onClick={isCoachingTier ? handleContactCoaching : () => handleUpgrade('monthly')} disabled={isRedirecting} className="w-full">
                        {isCoachingTier ? "Contact for Coaching" : (isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : `Upgrade to ${requiredTier}`)}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
