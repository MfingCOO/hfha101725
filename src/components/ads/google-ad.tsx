'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: { [key: string]: unknown }[];
  }
}

export function GoogleAd({ slotId }: { slotId: string }) {
  const adRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    // Use a timeout to delay the push call.
    // This gives the DOM time to update and for the container to get its proper dimensions,
    // which resolves the "availableWidth=0" error.
    const timeout = setTimeout(() => {
      try {
        if (adRef.current && adRef.current.getAttribute("data-ad-status") !== "filled") {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
            // Mark as initialized so this component instance doesn't try to push another ad.
            // This resolves the "already have ads in them" error.
            initialized.current = true; 
        }
      } catch (err) {
        console.error(`AdSense push error for slot ${slotId}:`, err);
      }
    }, 100); // 100ms is a safe delay.

    return () => clearTimeout(timeout);

  }, [slotId]);

  // Using the slotId as a key on the parent div ensures that React
  // treats each ad slot as a distinct component, preventing issues
  // when navigating between pages where ads might be present.
  return (
    <div ref={adRef} key={slotId} className="google-ad-container text-center my-4 min-h-[50px] flex items-center justify-center bg-gray-50/10 rounded-lg">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
