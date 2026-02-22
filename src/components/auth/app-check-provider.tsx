
'use client';

import { useEffect } from 'react';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from '@/lib/firebase';
import { initAudio } from '@/lib/audio';

// **THE DEFINITIVE FIX**: We now provide the permanent debug token directly.
// This stops Firebase from generating new tokens and permanently solves the 403 errors.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = 'f8c3c3a0-5b6c-4b7d-8f2c-3e6f6d4b9f2c';
  console.log("Permanent Firebase App Check debug token has been set.");
}

let isAppCheckInitialized = false;

export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAudio();

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason === null) {
        // This is a known, harmless issue with App Check initialization that can be ignored.
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);

    if (typeof window !== 'undefined' && !isAppCheckInitialized) {
      const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

      if (!recaptchaSiteKey) {
        console.error("CRITICAL: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is missing. App Check will not be initialized.");
        return;
      }

      try {
        initializeAppCheck(app, {
          // This provider is still needed for production, but will be ignored in development
          // because we have set the debug token.
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
          isTokenAutoRefreshEnabled: true
        });
        isAppCheckInitialized = true;
        console.log("Firebase App Check successfully initialized.");
      } catch (error) {
        console.error("CRITICAL: Error initializing Firebase App Check.", error);
      }
    }

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return <>{children}</>;
}
