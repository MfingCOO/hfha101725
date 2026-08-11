'use client';

import { OnboardingForm } from '@/components/onboarding/onboarding-form';
import { Logo } from '@/components/icons/logo';

export default function SignupPage() {
    return (
        <main className="flex h-dvh flex-col bg-background pt-[--safe-area-top] pb-[--safe-area-bottom] overflow-hidden">
            {/* Sticky Header */}
            <div className="shrink-0 z-20 w-full bg-background/95 backdrop-blur border-b px-4 py-3 flex items-center justify-center gap-2">
                <Logo className="w-7 h-7 text-primary" />
                <h1 className="text-xl font-semibold">Hunger-Free and Happy</h1>
            </div>

            {/* Form container - takes up all remaining space */}
            <div className="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
                <OnboardingForm />
            </div>
        </main>
    );
}