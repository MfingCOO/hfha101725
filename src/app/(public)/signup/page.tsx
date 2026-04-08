'use client';

import { useState, useEffect } from 'react';
import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Logo } from '@/components/icons/logo';
import { useToast } from '@/hooks/use-toast';
import { unifiedSignupAction } from '@/app/coach/clients/actions';
import type { OnboardingValues } from '@/components/onboarding/onboarding-form';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Capacitor } from '@capacitor/core';
import { Loader2 } from 'lucide-react';

export default function SignupPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [offerings, setOfferings] = useState<any>(null); // type will be inferred
    const [loading, setLoading] = useState<boolean>(true);
    const [isNative, setIsNative] = useState<boolean>(false);

    useEffect(() => {
        const isNativePlatform = Capacitor.isNativePlatform();
        setIsNative(isNativePlatform);

        const loadOfferings = async () => {
            if (!isNativePlatform) {
                setLoading(false);
                return;
            }

            try {
                // Dynamic import — only loads native SDK after bridge is ready
                const { Purchases } = await import('@revenuecat/purchases-capacitor');

                const offeringsResult = await Purchases.getOfferings();
                if (offeringsResult && offeringsResult.current) {
                    setOfferings(offeringsResult.current);
                    console.log("✅ RevenueCat Offerings loaded successfully (native).");
                }
            } catch (e) {
                console.error("RevenueCat Offerings Fetch Failed:", e);
                toast({
                    variant: 'destructive',
                    title: 'Could Not Load Plans',
                    description: 'Please check your connection and try again.',
                });
            } finally {
                setLoading(false);
            }
        };

        loadOfferings();
    }, [toast]);

    const handleSignup = async (data: OnboardingValues) => {
        try {
            const result = await unifiedSignupAction({
                ...data,
                tier: (data as any).tier || 'free', 
                coachId: 'default',
            });

            if (result.success) {
                toast({
                    title: "Account Created!",
                    description: "Welcome! Please log in to begin your journey.",
                });
                router.push('/login');
                return { success: true };
            } else {
                throw new Error(result.error || "An unknown error occurred.");
            }
        } catch (error: any) {
            console.error("Signup failed:", error);
            const errorMessage = error.message || "An unexpected error occurred.";
            toast({
                variant: 'destructive',
                title: 'Sign Up Failed',
                description: errorMessage,
            });
            return { success: false, error: { message: errorMessage } };
        }
    };

    if (isNative && loading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="mt-4 text-sm text-muted-foreground">Connecting to app store...</p>
            </div>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background">
            <div className="sticky top-0 z-10 bg-background w-full flex items-center justify-center gap-2 py-2">
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-semibold">Hunger-Free and Happy</h1>
            </div>

            <div className="w-full max-w-2xl mt-6">
                <OnboardingForm onFormSubmit={handleSignup} offerings={offerings} />
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
    );
}