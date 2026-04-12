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
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import { Loader2, CheckCircle } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { cn } from '@/lib/utils';

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
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [isLoadingPackages, setIsLoadingPackages] = useState(true);

    const isCoachingTier = requiredTier === 'coaching' || requiredTier === 'Coaching';

    useEffect(() => {
        if (isOpen && Capacitor.isNativePlatform() && !isCoachingTier) {
            const fetchPackages = async () => {
                setIsLoadingPackages(true);
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current && offerings.current.availablePackages.length > 0) {
                        const availablePackages = offerings.current.availablePackages;
                        setPackages(availablePackages);
                        // Pre-select the yearly package if available, otherwise the first one
                        const yearlyPackage = availablePackages.find(p => p.packageType === 'ANNUAL') || availablePackages[0];
                        setSelectedPackage(yearlyPackage);
                    }
                } catch (e) {
                    toast({ variant: 'destructive', title: 'Error', description: "Could not load subscription plans." });
                } finally {
                    setIsLoadingPackages(false);
                }
            };
            fetchPackages();
        }
    }, [isOpen, isCoachingTier, toast]);

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async () => {
        if (!Capacitor.isNativePlatform()) {
            toast({ variant: 'destructive', title: 'Error', description: "Subscriptions are only available on the mobile app." });
            return;
        }

        if (!user || isCoachingTier || !selectedPackage) return;
        setIsRedirecting(true);

        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: selectedPackage });

            if (Object.keys(customerInfo.entitlements.active).length > 0) {
                toast({ title: "Upgrade Successful!", description: `You now have access to ${featureName}.` });
                onClose();
            }
        } catch (e: any) {
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
                
                {!isCoachingTier && (
                    <div className="px-4 py-2 space-y-3">
                        {isLoadingPackages ? (
                            <div className="flex justify-center items-center h-24">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : (
                            packages.map(pkg => (
                                <div
                                    key={pkg.identifier}
                                    className={cn(
                                        "relative border-2 rounded-lg p-3 cursor-pointer transition-all",
                                        selectedPackage?.identifier === pkg.identifier ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                    )}
                                    onClick={() => setSelectedPackage(pkg)}
                                >
                                    {selectedPackage?.identifier === pkg.identifier && (
                                        <CheckCircle className="h-5 w-5 text-primary absolute top-2 right-2" />
                                    )}
                                    <p className="font-bold text-lg">{pkg.product.title.split('(')[0]}</p>
                                    <p className="text-sm text-muted-foreground">{pkg.product.description}</p>
                                    <p className="font-semibold mt-2">{pkg.product.priceString}</p>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
                    <Button 
                        onClick={isCoachingTier ? handleContactCoaching : handleUpgrade} 
                        disabled={isRedirecting || isLoadingPackages || (!isCoachingTier && !selectedPackage)} 
                        className="w-full"
                    >
                        {isCoachingTier ? (
                            "Contact for Coaching"
                        ) : isRedirecting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            `Upgrade with ${selectedPackage?.packageType === 'ANNUAL' ? 'Yearly' : 'Monthly'} Plan`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
