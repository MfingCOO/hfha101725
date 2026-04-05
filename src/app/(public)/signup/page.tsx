'use client';

import { useState, useEffect } from 'react'; // Added useEffect
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Logo } from '@/components/icons/logo';
import { useToast } from '@/hooks/use-toast';
import { unifiedSignupAction } from '@/app/coach/clients/actions';
import type { OnboardingValues } from '@/components/onboarding/onboarding-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Purchases, LOG_LEVEL } from '@revenuecat/purchases-capacitor'; // Import RevenueCat
import { Capacitor } from '@capacitor/core'; // To check if we are on a phone

export default function SignupPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [selectedTier] = useState<'free' | 'ad-free' | 'basic' | 'premium' | 'coaching'>('free');

    // INITIALIZATION BLOCK: This tells the Android side to wake up
    useEffect(() => {
        const initRevenueCat = async () => {
            if (Capacitor.isNativePlatform()) {
                try {
                    await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
                    await Purchases.configure({ 
                        apiKey: "goog_NklNVostxEsZmVEiHkgORKJMJgp" 
                    });
                    console.log("RevenueCat Initialized on Android");
                } catch (e) {
                    console.error("RevenueCat Init Failed:", e);
                }
            }
        };
        initRevenueCat();
    }, []);

    const handleSignup = async (data: OnboardingValues) => {
        try {
            const result = await unifiedSignupAction({
                ...data,
                tier: (data as any).tier || selectedTier, 
                coachId: 'default',
            });

            if (result.success) {
                if (result.checkoutUrl) {
                    window.location.href = result.checkoutUrl;
                    return { success: true };
                } else {
                    toast({
                        title: "Account Created!",
                        description: "Welcome! Please log in to begin your journey.",
                    });
                    router.push('/login');
                    return { success: true };
                }
            } else {
                throw new Error(result.error || "An unknown error occurred during sign up.");
            }
        } catch (error: any) {
            console.error("Client creation failed:", error);
            let errorMessage = error.message || "An unexpected error occurred during sign up.";
            toast({
                variant: 'destructive',
                title: 'Sign Up Failed',
                description: errorMessage,
            });
            return { success: false, error: { message: errorMessage } };
        }
    };
    
    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background">
            <div className="sticky top-0 z-10 bg-background w-full flex items-center justify-center gap-2 py-2">
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-semibold">Hunger-Free and Happy</h1>
            </div>

            <div className="w-full max-w-2xl mt-6">
                <OnboardingForm onFormSubmit={handleSignup} />
            </div>

            <div className="mt-8 text-center text-xs text-muted-foreground max-w-lg space-y-2">
                <p>
                    Need help? Visit our{' '}
                    <Link href="/support" className="underline hover:text-primary font-medium">
                        Support Page
                    </Link>
                </p>
                <div>
                    By creating an account, you agree to our{' '}
                    <Link href="/tos" className="underline hover:text-primary">Terms of Service</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="underline hover:text-primary">Privacy Policy</Link>.
                </div>
            </div>
        </main>
    )
}