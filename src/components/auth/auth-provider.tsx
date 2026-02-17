'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile, ClientProfile } from '@/types';
import { COACH_UIDS } from '@/lib/coaches';

function serializeTimestamps(obj: any): any {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map(serializeTimestamps);
  }
  if (typeof obj === 'object') {
    if (obj instanceof Timestamp) {
      return obj.toDate().toISOString();
    }
    const newObj: { [key: string]: any } = {};
    for (const key in obj) {
      newObj[key] = serializeTimestamps(obj[key]);
    }
    return newObj;
  }
  return obj;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isCoach: boolean;
  getIdToken: () => Promise<string | null>; // Added getIdToken to the context type
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isCoach: false,
  getIdToken: async () => null, // Provide a default async function
});

export const useAuth = () => useContext(AuthContext);

const PUBLIC_PATHS = ['/login', '/signup', '/tos', '/privacy', '/support'];

function AuthRedirector({ children }: { children: ReactNode }) {
    const { user, isCoach, loading, userProfile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading || !pathname) return;

        const isPublicPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));
        const isClientRoute = pathname.startsWith('/client');
        const isCoachRoute = pathname.startsWith('/coach');

        if (user && userProfile) {
            if (isPublicPage) {
                router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard');
            } else if (isCoach && !isCoachRoute) {
                 if (!pathname.startsWith('/chats') && !pathname.startsWith('/settings')) {
                    router.replace('/coach/dashboard');
                 }
            } else if (!isCoach && !isClientRoute) {
                 if (!pathname.startsWith('/chats') && !pathname.startsWith('/settings')) {
                    router.replace('/client/dashboard');
                 }
            }
        } else if (!user) {
            if (!isPublicPage) {
                router.replace('/login');
            }
        }
    }, [user, userProfile, isCoach, loading, pathname, router]);

    return <>{children}</>;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCoach, setIsCoach] = useState(false);

  const getIdToken = async () => {
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken(true);
      }
      return null;
  };

  useEffect(() => {
    let unsubscribeUserProfile: (() => void) | undefined;
    let unsubscribeClientProfile: (() => void) | undefined;
    
    const unsubscribeAuth = onIdTokenChanged(auth, async (authUser) => {
      setLoading(true);
      if (unsubscribeUserProfile) unsubscribeUserProfile();
      if (unsubscribeClientProfile) unsubscribeClientProfile();
      
      if (authUser) {
        setUser(authUser);
        const userIsCoach = COACH_UIDS.includes(authUser.uid);
        setIsCoach(userIsCoach);

        let tempUserProfile: Partial<UserProfile> = {};
        let tempClientProfile: Partial<ClientProfile> = {};
        let hasInitialized = false;

        const combinedProfileUpdater = () => {
             const combined = { 
                ...tempUserProfile, 
                ...tempClientProfile,
                stripeCustomerId: tempClientProfile.stripeCustomerId || tempUserProfile.stripeCustomerId
            } as UserProfile;
             setUserProfile(serializeTimestamps(combined));
             if(!hasInitialized) {
                setLoading(false);
                hasInitialized = true;
             }
        };

        const userProfileDocRef = doc(db, 'userProfiles', authUser.uid);
        unsubscribeUserProfile = onSnapshot(userProfileDocRef, (snap) => {
          if (snap.exists()) {
            tempUserProfile = snap.data();
            combinedProfileUpdater();
          } else {
             console.error(`Auth Error: User profile not found for UID: ${authUser.uid}. Forcing logout.`);
             signOut(auth);
          }
        }, (error) => {
             console.error("Auth Error: userProfiles snapshot listener failed.", error);
             signOut(auth);
        });
        
        if (!userIsCoach) {
            const clientProfileDocRef = doc(db, 'clients', authUser.uid);
            unsubscribeClientProfile = onSnapshot(clientProfileDocRef, (snap) => {
              if (snap.exists()) {
                tempClientProfile = snap.data();
              }
              combinedProfileUpdater();
            }, (error) => {
                 console.error("Auth Error: clients snapshot listener failed.", error);
                 combinedProfileUpdater();
            });
        } else {
            setLoading(false);
        }

      } else {
        setUser(null);
        setIsCoach(false);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserProfile) unsubscribeUserProfile();
      if (unsubscribeClientProfile) unsubscribeClientProfile();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isCoach, getIdToken }}>
      {loading ? (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <AuthRedirector>{children}</AuthRedirector>
      )}
    </AuthContext.Provider>
  );
}