'use client';

import { Button } from '@/components/ui/button';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '../auth/auth-provider';
import { Loader2 } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { cn } from '@/lib/utils';
import { BaseModal } from '../ui/base-modal';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';

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

    const handleContactCoaching = () => {
      toast({ title: "Contact Us", description: "Please contact us to inquire about coaching services." });
      onClose();
    };

    const handleUpgrade = async (pkg: PurchasesPackage) => {
        if (!Capacitor.isNativePlatform() || !user || isCoachingTier) return;
        setIsRedirecting(true);

        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
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
            <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
        </div>
    );

    const filteredPackages = useMemo(() => {
        return packages.filter(p => p.packageType === billingCycle);
    }, [packages, billingCycle]);

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
                    <div className="flex items-center justify-center space-x-4 bg-muted/50 p-2 rounded-full mb-6">
                        <Label className={cn("font-bold text-xs", billingCycle === 'MONTHLY' ? 'text-primary' : '')}>Monthly</Label>
                        <Switch
                            checked={billingCycle === 'ANNUAL'}
                            onCheckedChange={(v) => setBillingCycle(v ? 'ANNUAL' : 'MONTHLY')}
                        />
                        <Label className={cn("font-bold text-xs", billingCycle === 'ANNUAL' ? 'text-primary' : '')}>Yearly</Label>
                    </div>

                    {isLoadingPackages ? (
                        <div className="flex justify-center items-center h-24">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <ScrollArea className="h-72">
                            <div className="grid gap-4 pr-4">
                                {filteredPackages.map(pkg => (
                                    <Card 
                                        key={pkg.identifier} 
                                        className="p-4 border cursor-pointer hover:border-primary transition-all" 
                                        onClick={() => handleUpgrade(pkg)}
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-lg">{pkg.product.title.split('(')[0]}</h4>
                                            <span className="font-bold text-lg text-primary">{pkg.product.priceString}</span>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{pkg.product.description}</p>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>
            )}
        </BaseModal>
     );
}
