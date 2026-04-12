'use client';

import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import { Loader2, CheckCircle } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { cn } from '@/lib/utils';
import { BaseModal } from '../ui/base-modal';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';

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
    const [billingCycle, setBillingCycle] = useState<'ANNUAL' | 'MONTHLY'>('ANNUAL');

    const isCoachingTier = requiredTier === 'coaching' || requiredTier === 'Coaching';

    useEffect(() => {
        if (isOpen && Capacitor.isNativePlatform() && !isCoachingTier) {
            const fetchPackages = async () => {
                setIsLoadingPackages(true);
                try {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current && offerings.current.availablePackages.length > 0) {
                        setPackages(offerings.current.availablePackages);
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

    const filteredPackages = useMemo(() => {
        return packages.filter(p => p.packageType === billingCycle);
    }, [packages, billingCycle]);

    useEffect(() => {
        if (filteredPackages.length > 0) {
            setSelectedPackage(filteredPackages[0]);
        } else {
            setSelectedPackage(null)
        }
    }, [filteredPackages]);

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async () => {
        if (!Capacitor.isNativePlatform() || !user || isCoachingTier || !selectedPackage) return;
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

    const footer = (
        <div className="flex-col sm:flex-row gap-2 w-full">
            <Button onClick={onClose} variant="outline" className="w-full mb-2 sm:mb-0">Maybe Later</Button>
            <Button 
                onClick={isCoachingTier ? handleContactCoaching : handleUpgrade} 
                disabled={isRedirecting || isLoadingPackages || (!isCoachingTier && !selectedPackage)} 
                className="w-full"
            >
                {isCoachingTier ? "Contact for Coaching" : 
                 isRedirecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                 `Upgrade with ${billingCycle === 'ANNUAL' ? 'Yearly' : 'Monthly'} Plan`}
            </Button>
        </div>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Upgrade to Unlock ${featureName}`}
            description={reason}
            footer={footer}
        >
            {!isCoachingTier && (
                <div className="py-2 space-y-3">
                    <div className="flex items-center justify-center space-x-2">
                        <Label htmlFor="billing-cycle">Monthly</Label>
                        <Switch
                            id="billing-cycle"
                            checked={billingCycle === 'ANNUAL'}
                            onCheckedChange={(checked) => setBillingCycle(checked ? 'ANNUAL' : 'MONTHLY')}
                        />
                        <Label htmlFor="billing-cycle">Yearly</Label>
                    </div>

                    {isLoadingPackages ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        filteredPackages.map(pkg => (
                            <div
                                key={pkg.identifier}
                                className={cn(
                                    "relative border-2 rounded-lg p-3 cursor-pointer transition-all flex justify-between items-center",
                                    selectedPackage?.identifier === pkg.identifier ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                                )}
                                onClick={() => setSelectedPackage(pkg)}
                            >
                                <div>
                                    <p className="font-bold text-lg">{pkg.product.title.split('(')[0]}</p>
                                    <p className="text-sm text-muted-foreground">{pkg.product.description}</p>
                                </div>
                                <div className="flex items-center">
                                    <p className="font-semibold mr-4">{pkg.product.priceString}</p>
                                    {selectedPackage?.identifier === pkg.identifier && (
                                        <CheckCircle className="h-5 w-5 text-primary" />
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </BaseModal>
    );
}
