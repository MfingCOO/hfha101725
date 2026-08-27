'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { ClientProfile, UserProfile } from '@/types';

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

    // Listen for the Firebase Auth state change (Login/Logout)
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setIsCoach(false);
        setIsLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [isClient]);

  // LIVE PROFILE LISTENER: This fixes the "Reboot" requirement.
  useEffect(() => {
    if (!user?.uid) return;

    setIsLoading(true);
    
    // Create a real-time listener to the 'clients' collection
    const unsubscribeProfile = onSnapshot(doc(db, 'clients', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as ClientProfile;
        // This updates the global 'profile' state INSTANTLY when the database changes
        setProfile(data);
        setIsCoach(data.role === 'coach');
        setIsLoading(false);
      } else {
        // Fallback check for coaches or new users
        setIsCoach(false);
        setIsLoading(false);
      }
    }, (error) => {
      console.error("[AuthProvider] Real-time profile error:", error);
      setIsLoading(false);
    });

    return () => unsubscribeProfile();
  }, [user?.uid]);

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
