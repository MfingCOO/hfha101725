
'use client';

import { useEffect } from 'react';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from '@/lib/firebase';

let isAppCheckInitialized = false;

/**
 * This provider component initializes Firebase App Check with reCAPTCHA v3.
 * It includes a workaround for a known issue where a null promise rejection
 * can occur during initialization, blocking the app from loading.
 */
export function AppCheckProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Handler to catch the specific null rejection from Firebase App Check
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason === null) {
        console.warn(
          "Caught a harmless null promise rejection, likely from Firebase App Check. Suppressing to allow app load."
        );
        // Prevent the error from propagating and crashing the app
        event.preventDefault();
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);

    // Initialize App Check only on the client and only once.
    if (typeof window !== 'undefined' && !isAppCheckInitialized) {
      const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

      if (!recaptchaSiteKey) {
        console.error("CRITICAL: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is missing. App Check will not be initialized.");
        return;
      }

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

    // Cleanup the event listener when the component unmounts
    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return <>{children}</>;
}
