"use client";

import { useEffect, useState, ReactNode } from 'react';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { auth } from '@/lib/firebase';

interface AppCheckProviderProps {
  children: ReactNode;
}

export function AppCheckProvider({ children }: AppCheckProviderProps) {
  const [isAppCheckInitialized, setIsAppCheckInitialized] = useState(false);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (event.reason === null) {
        event.preventDefault();
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);

    const isLocalDevelopment = process.env.NODE_ENV === 'development';
    const isLocalProductionLike = process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

    if (isAppCheckInitialized) {
      return; // Already initialized or bypassed
    }

    if (isLocalDevelopment || isLocalProductionLike) { // MODIFIED: Simplified bypass condition for localhost in dev/prod
        console.log(`App Check is DISABLED for local environment (NODE_ENV: ${process.env.NODE_ENV}, Host: ${typeof window !== 'undefined' ? window.location.hostname : 'N/A'}).`);
        setIsAppCheckInitialized(true);
        return;
    }

    // Proceed with initialization only if not a local bypass scenario
    if (typeof window !== 'undefined') {
      if (!recaptchaSiteKey) {
          console.error("CRITICAL: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is missing. App Check will fail.");
          // For production deployment, this should ideally be an unrecoverable error.
          // For local testing in production-like mode, it's handled by the bypass above.
      }

      try {
        initializeAppCheck(auth.app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey!),
          isTokenAutoRefreshEnabled: true
        });
        setIsAppCheckInitialized(true);
        console.log("Firebase App Check initialized in PRODUCTION mode with reCAPTCHA.");
      } catch (error) {
        console.error("Firebase App Check initialization failed:", error);
      }
    }

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [isAppCheckInitialized]);

  return <>{children}</>;
}
