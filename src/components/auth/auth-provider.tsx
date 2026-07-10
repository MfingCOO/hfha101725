'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { ClientProfile, UserProfile } from '@/types';
import { getUserProfileAndRole } from '@/app/auth/actions';

interface AuthContextType {
  user: User | null;
  profile: ClientProfile | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [isCoach, setIsCoach] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);

      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const result = await getUserProfileAndRole(firebaseUser.uid);
          if (result.success && 'data' in result) {
            const profileData = result.data as any;
            setProfile(profileData as ClientProfile);
            setIsCoach(profileData?.role === 'coach');
          } else {
            setProfile(null);
            setIsCoach(false);
          }
        } catch (err) {
          console.error("[AuthProvider] Error fetching profile:", err);
          setProfile(null);
          setIsCoach(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setIsCoach(false);
      }

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [isClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        userProfile: profile as unknown as UserProfile,
        loading: isLoading,
        isCoach,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}