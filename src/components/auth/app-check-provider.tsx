
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

    if (process.env.NODE_ENV === 'development') {
        console.log("App Check is DISABLED in development environment.");
        setIsAppCheckInitialized(true);
        return;
    }

    if (typeof window !== 'undefined' && !isAppCheckInitialized) {
      const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (!recaptchaSiteKey) {
          console.error("CRITICAL: `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` is missing.");
          return;
      }

      try {
        initializeAppCheck(auth.app, {
          provider: new ReCaptchaV3Provider(recaptchaSiteKey),
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
