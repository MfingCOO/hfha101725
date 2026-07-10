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

// ✅ This fixes the build error
export const dynamic = 'force-dynamic';

export default function SignupPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [loading, setLoading] = useState<boolean>(false);
    const [isNative, setIsNative] = useState<boolean>(false);

    useEffect(() => {
        setIsNative(Capacitor.isNativePlatform());
    }, []);

    const handleSignup = async (data: OnboardingValues) => {
        setLoading(true);
        try {
            const result = await unifiedSignupAction({
                ...data,
                units: 'imperial',
                tier: (data as any).tier || 'free',
                coachId: 'default',
            });

            if (result.success) {
                toast({ 
                    title: "Account Created!", 
                    description: "Welcome! Please log in." 
                });
                router.push('/login');
                return { success: true };
            } else {
                throw new Error(result.error || "Signup failed");
            }
        } catch (error: any) {
            const errorMessage = error.message || "An unexpected error occurred.";
            toast({ 
                variant: 'destructive', 
                title: 'Sign Up Failed', 
                description: errorMessage 
            });
            return { success: false, error: { message: errorMessage } };
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-background">
            <div className="sticky top-0 z-10 bg-background w-full flex items-center justify-center gap-2 py-2">
                <Logo className="w-8 h-8 text-primary" />
                <h1 className="text-2xl font-semibold">Hunger-Free and Happy</h1>
            </div>

            <div className="w-full max-w-2xl mt-6">
                <OnboardingForm />
            </div>

            {/* Already have an account? Link */}
            <div className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="underline hover:text-primary font-medium">
                    Log in
                </Link>
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
                    <Link href="/tos" className="underline hover:text-primary">
                        Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="underline hover:text-primary">
                        Privacy Policy
                    </Link>.
                </div>
            </div>
        </main>
    );
}