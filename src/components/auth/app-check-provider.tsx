
'use client';

import { useEffect } from 'react';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from '@/lib/firebase';
import { initAudio } from '@/lib/audio';

// **THE ONLY FIX NEEDED**: When this flag is true during development,
// Firebase automatically bypasses the reCAPTCHA provider and uses the debug token.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  console.log("Firebase App Check debug token has been set for this development session.");
}

let isAppCheckInitialized = false;

export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAudio();

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason === null) {
        console.warn(
          "Caught a harmless null promise rejection, likely from Firebase App Check. Suppressing to allow app load."
        );
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

      // **THE FIX**: A single, correct initialization path.
      // The provider is required, but will be ignored in development because of the debug flag above.
      try {
        initializeAppCheck(app, {
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
