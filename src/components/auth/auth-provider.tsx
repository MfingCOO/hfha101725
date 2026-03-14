'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { ClientProfile, UserProfile } from '@/types';
import { getUserProfileAndRole } from '@/app/auth/actions';
import { usePathname, useRouter } from 'next/navigation';

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
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (isLoading) return; // Wait until auth state is loaded

    const isLoggedIn = user && profile;
    const isPublicPage = ['/login', '/signup'].includes(pathname);
    const isProtectedPage = ['/coach', '/client'].some(p => pathname.startsWith(p));

    if (isLoggedIn && isPublicPage) {
      // User is logged in and on a public page, redirect to their dashboard.
      const targetDashboard = isCoach ? '/coach/dashboard' : '/client/dashboard';
      router.push(targetDashboard);
    } else if (!isLoggedIn && isProtectedPage) {
      // User is not logged in but trying to access a protected page, redirect to login.
      router.push('/login');
    }
  }, [user, profile, isCoach, isLoading, pathname, router]);

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        profile, 
        userProfile: profile as unknown as UserProfile, // Alias for compatibility
        loading: isLoading, 
        isCoach 
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
