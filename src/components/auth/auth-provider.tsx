
'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
// CORRECTED: Added 'signOut' to the import to match modern Firebase v9+ API
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db, messaging } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile, ClientProfile } from '@/types';
import { COACH_UIDS } from '@/lib/coaches';
import { getToken } from 'firebase/messaging';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isCoach: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isCoach: false,
});

export const useAuth = () => useContext(AuthContext);

const PUBLIC_PATHS = ['/login', '/signup', '/tos', '/privacy', '/support'];

function AuthRedirector({ children }: { children: ReactNode }) {
    const { user, isCoach, loading, userProfile } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading) return;

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

  useEffect(() => {
    let unsubscribeUserProfile: (() => void) | undefined;
    let unsubscribeClientProfile: (() => void) | undefined;
    
    const requestNotificationPermission = async (currentUser: User) => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator && messaging) {
        try {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            if (!vapidKey) {
              console.error("VAPID key not found in environment variables.");
              return;
            }
            try {
              const currentToken = await getToken(messaging, { vapidKey: vapidKey });
              if (currentToken) {
                const userProfileRef = doc(db, 'userProfiles', currentUser.uid);
                await updateDoc(userProfileRef, {
                  fcmTokens: arrayUnion(currentToken)
                });
              } else {
                console.log('No registration token available. Request permission to generate one.');
              }
            } catch (err) {
              console.error('An error occurred while retrieving token. This is expected in some environments (like local dev without HTTPS).', err);
            }
          }
        } catch (error) {
          console.error('An error occurred during notification permission request.', error);
        }
      }
    };


    const unsubscribeAuth = onIdTokenChanged(auth, async (authUser) => {
      setLoading(true);
      if (unsubscribeUserProfile) unsubscribeUserProfile();
      if (unsubscribeClientProfile) unsubscribeClientProfile();
      
      if (authUser) {
        setUser(authUser);
        requestNotificationPermission(authUser);
        const userIsCoach = COACH_UIDS.includes(authUser.uid);
        setIsCoach(userIsCoach);

        let tempUserProfile: Partial<UserProfile> = {};
        let tempClientProfile: Partial<ClientProfile> = {};
        let hasInitialized = false;

        const combinedProfileUpdater = () => {
             const combined = { ...tempUserProfile, ...tempClientProfile } as UserProfile;
             setUserProfile(combined);
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
             // CORRECTED: Updated to the modern Firebase v9+ modular syntax
             signOut(auth);
          }
        }, (error) => {
             console.error("Auth Error: userProfiles snapshot listener failed.", error);
             // CORRECTED: Updated to the modern Firebase v9+ modular syntax
             signOut(auth);
        });
        
        if (!userIsCoach) {
            const clientProfileDocRef = doc(db, 'clients', authUser.uid);
            unsubscribeClientProfile = onSnapshot(clientProfileDocRef, (snap) => {
              if (snap.exists()) {
                const data = snap.data();
                if (data.bingeFreeSince && typeof data.bingeFreeSince.toDate === 'function') {
                    data.bingeFreeSince = data.bingeFreeSince.toMillis();
                }
                if (data.lastInteraction && typeof data.lastInteraction.toDate === 'function') {
                    data.lastInteraction = data.lastInteraction.toMillis();
                }
                tempClientProfile = data;
              }
              combinedProfileUpdater();
            }, (error) => {
                 console.error("Auth Error: clients snapshot listener failed.", error);
                 combinedProfileUpdater();
            });
        } else {
             if (unsubscribeUserProfile) {
             } else {
                setLoading(false);
             }
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
    <AuthContext.Provider value={{ user, userProfile, loading, isCoach }}>
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
