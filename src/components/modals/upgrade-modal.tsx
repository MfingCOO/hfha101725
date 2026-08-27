'use client';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { UserTier } from '@/types';
import { Capacitor } from '@capacitor/core';
import { Purchases } from '@revenuecat/purchases-capacitor';
import { BaseModal } from '../ui/base-modal';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredTier: UserTier;
  featureName: string;
  reason: string;
}

export function UpgradeModal({ isOpen, onClose, requiredTier, featureName, reason }: UpgradeModalProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('annual');

    const handlePurchase = async (tier: 'ad_free_tier' | 'basic_tier' | 'premium', pkgKey: 'monthly' | 'annual') => {
        if (!Capacitor.isNativePlatform()) {
            toast({ variant: "destructive", title: "Error", description: "Subscriptions are only available on mobile." });
            return;
        }
    
        setIsLoading(true);
        try {
            if (user?.uid) {
                await Purchases.logIn({ appUserID: user.uid });
            }

            let packageId = '';
            if (tier === 'premium') {
                packageId = pkgKey === 'monthly' ? 'premium_monthly' : 'premium_yearly';
            } else if (tier === 'basic_tier') {
                packageId = pkgKey === 'monthly' ? 'basic_monthly' : 'basic_yearly';
            } else if (tier === 'ad_free_tier') {
                packageId = pkgKey === 'monthly' ? 'ad_free_monthly' : 'ad_free_yearly';
            }
    
            const offerings = await Purchases.getOfferings();
            
            // FALLBACK LOGIC: Try current offering first, then search all offerings
            let pkg = offerings.current?.availablePackages?.find((p: any) => p.identifier === packageId);
            
            if (!pkg) {
                const allPkgs = Object.values(offerings.all).flatMap(o => o.availablePackages);
                pkg = allPkgs.find(p => p.identifier === packageId);
            }
    
            if (!pkg) {
                const availableIds = Object.values(offerings.all)
                    .flatMap(o => o.availablePackages.map(p => p.identifier))
                    .join(', ');
                
                throw new Error(`Plan "${packageId}" not found. Available in dashboard: ${availableIds || 'None'}`);
            }
    
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    
            const active = customerInfo.entitlements.active;
            const hasAccess = active['premium_access'] || active['premium_tier'] || 
                              active['basic_access'] || active['basic_tier'] || 
                              active['ad_free_access'] || active['ad_free_tier'];

            if (hasAccess) {
                toast({ title: "Upgrade Successful!", description: "Your features are now unlocked." });
                onClose();
            } else {
                toast({ title: "Processing...", description: "Purchase complete. Your account will update shortly." });
                onClose();
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error("Purchase error:", e);
                toast({ variant: "destructive", title: "Billing Error", description: e.message || "Purchase failed" });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const footer = <Button onClick={onClose} variant="outline" className="w-full">Maybe Later</Button>;

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={`Upgrade to Unlock ${featureName}`} description={reason} footer={footer}>
            <div className="py-2 space-y-3">
                <div className="flex items-center justify-center space-x-4 bg-muted/50 p-2 rounded-full mb-6">
                    <Label className={billingCycle === 'monthly' ? "font-bold text-primary text-xs" : "text-xs"}>Monthly</Label>
                    <Switch checked={billingCycle === 'annual'} onCheckedChange={(v) => setBillingCycle(v ? 'annual' : 'monthly')} />
                    <Label className={billingCycle === 'annual' ? "font-bold text-primary text-xs" : "text-xs"}>Yearly</Label>
                </div>
                {isLoading && <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50 rounded-lg"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}
                <ScrollArea className="h-72">
                    <div className="grid gap-4 pr-4">
                        <Card className="p-4 border-2 border-primary bg-primary/5 cursor-pointer shadow-md" onClick={() => handlePurchase('premium', billingCycle)}>
                            <div className="flex justify-between items-center mb-2">
                                <div><h4 className="font-bold text-lg text-primary">Premium</h4><p className="text-[10px] text-primary font-bold uppercase tracking-tight">Best Value</p></div>
                                <span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$9.99' : '$99.99'}</span>
                            </div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                                <li>• UPF/Gluten Free Nutritional Analysis</li>
                                <li>• Exclusive Live Workouts & Events</li>
                                <li>• Exclusive Prerecorded Content</li>
                                <li>• Community Chat & Programs</li>
                                <li>• Priority Support</li>
                            </ul>
                        </Card>
                        <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('basic_tier', billingCycle)}>
                            <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-lg">Basic</h4><span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$6.99' : '$69.99'}</span></div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                                <li>• Everything From Ad-Free</li>
                                <li>• Full Tracking & Insights</li>
                                <li>• Craving & Stress Tracking</li>
                                <li>• Progress Charts</li>
                            </ul>
                        </Card>
                        <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('ad_free_tier', billingCycle)}>
                            <div className="flex justify-between items-center mb-2"><h4 className="font-bold text-lg">Ad-Free</h4><span className="font-bold text-lg text-primary">{billingCycle === 'monthly' ? '$2.99' : '$29.99'}</span></div>
                            <ul className="text-[11px] space-y-1 text-muted-foreground">
                                <li>• Everything in Free</li>
                                <li>• **No Advertisements**</li>
                                <li>• Clean Interface</li>
                            </ul>
                        </Card>
                    </div>
                </ScrollArea>
            </div>
        </BaseModal>
    );
}
