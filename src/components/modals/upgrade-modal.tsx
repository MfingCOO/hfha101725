'use client';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases, PurchasesPackage } from '@revenuecat/purchases-capacitor';
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
    const [isLoading, setIsLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

    const handlePurchase = async (tier: 'ad_free_tier' | 'basic_tier' | 'premium', pkgKey: 'monthly' | 'annual') => {
        if (!Capacitor.isNativePlatform()) {
            toast({ variant: "destructive", title: "Error", description: "Subscriptions are only available on the mobile app." });
            return;
        }
        setIsLoading(true);
        try {
            let packageId = '';
            if (tier === 'premium') {
                packageId = pkgKey === 'monthly' ? 'premium_monthly' : 'premium_yearly';
            } else if (tier === 'basic_tier') {
                packageId = pkgKey === 'monthly' ? 'basic_monthly' : 'basic_yearly';
            } else if (tier === 'ad_free_tier') {
                packageId = pkgKey === 'monthly' ? 'ad_free_monthly' : 'ad_free_yearly';
            }

            console.log('🔍 Looking for packageId:', packageId);

            const offerings = await Purchases.getOfferings();
             console.log('📦 All available packages:', 
                offerings.current?.availablePackages?.map((p: any) => p.identifier));

            const pkg = offerings.current?.availablePackages?.find((p: any) => p.identifier === packageId);

            if (!pkg) {
                toast({ 
                    variant: "destructive", 
                    title: "Plan not found", 
                    description: `Could not find the ${pkgKey} ${tier} plan in the app store.` 
                });
                setIsLoading(false);
                return;
            }

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

            if (customerInfo.entitlements.active[tier] || customerInfo.entitlements.active['premium']) {
                 toast({ title: "Upgrade Successful!", description: `You now have access to ${featureName}.` });
                onClose();
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                toast({ variant: "destructive", title: "Billing Error", description: e.message || "Purchase failed" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const footer = (
        <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Upgrade to Unlock ${featureName}`}
            description={reason}
            footer={footer}
        >
            <div className="py-2 space-y-3">
                <div className="flex items-center justify-center space-x-4 bg-muted/50 p-2 rounded-full mb-6">
                    <Label className={billingCycle === 'monthly' ? "font-bold text-primary text-xs" : "text-xs"}>Monthly</Label>
                    <Switch checked={billingCycle === 'annual'} onCheckedChange={(v) => setBillingCycle(v ? 'annual' : 'monthly')} />
                    <Label className={billingCycle === 'annual' ? "font-bold text-primary text-xs" : "text-xs"}>Yearly</Label>
                </div>

                {isLoading && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 rounded-lg">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    </div>
                )}

                <ScrollArea className="h-72">
                    <div className="grid gap-4 pr-4">
                        <Card className="p-4 border-2 border-primary bg-primary/5 cursor-pointer shadow-md" onClick={() => handlePurchase('premium', billingCycle)}>
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <h4 className="font-bold text-lg text-primary">Premium</h4>
                                    <p className="text-[10px] text-primary font-bold uppercase tracking-tight">Best Value</p>
                                </div>
                                <span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$9.99' : '$99.99'}</span>
                            </div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                            <li>• UPF/Gluten Free Nutritional Analysis (Meal Scanning)</li>
                                    <li>• Exclusive access to Live Workout/Events</li>
                                    <li>• Exclusive Prerecorded Yoga, Pilates, and More</li>
                                    <li>• Community Chat Groups & Workout Programs</li>
                                    <li>• Priority Customer Support</li>
                            </ul>
                        </Card>

                        <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('basic_tier', billingCycle)}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-lg">Basic</h4>
                                <span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$6.99' : '$69.99'}</span>
                            </div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                            <li>• Everything From Ad-Free</li>
                                <li>• Full access to all App tracking tools</li>
                                <li>• Craving/Binge & Stress Tracking</li>
                                <li>• Historical progress charts & insights</li>
                            </ul>
                        </Card>

                        <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('ad_free_tier', billingCycle)}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-lg">Ad-Free</h4>
                                <span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$2.49' : '$24.99'}</span>
                            </div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                            <li>• Everything in Free</li>
                                <li>• **Completely Ad-Free experience**</li>
                                <li>• Cleaner, distraction-free interface</li>
                            </ul>
                        </Card>

                        <Card className="p-4 border border-dashed bg-muted/10 text-center flex flex-col items-center">
                            <h4 className="font-bold text-sm mb-1">One-on-One Coaching</h4>
                            <p className="text-[10px] text-muted-foreground mb-4">Get personalized strategy and direct support for your specific journey.</p>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = 'mailto:support@hungerfreeandhappy.app?subject=Coaching Consultation Request';
                                }}
                            >
                                Contact Us for Coaching
                            </Button>
                        </Card>
                    </div>
                </ScrollArea>
            </div>
        </BaseModal>
     );
}
