'use client';

import { useMemo } from 'react';
import { useAuth } from "@/components/auth/auth-provider";
import { ClientProfile } from '@/types';

export function useSubscription() {
  const { user, loading } = useAuth();
  
  // Cast the user to your ClientProfile type to get access to 'tier'
  const clientData = user as ClientProfile | null;

  const subscriptionInfo = useMemo(() => {
    const tier = clientData?.tier || 'free';
    
    return {
      tier,
      isPro: tier === 'premium' || tier === 'basic', // Anyone not 'free' is considered "Pro"
      isPremium: tier === 'premium',
      isBasic: tier === 'basic',
      isAdFree: tier === 'ad-free',
      loading
    };
  }, [clientData, loading]);

  return subscriptionInfo;
}