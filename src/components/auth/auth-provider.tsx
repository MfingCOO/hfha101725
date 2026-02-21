'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { onIdTokenChanged, User, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, DocumentData, Timestamp } from 'firebase/firestore';
import { auth, db, initializeFirebasePersistence } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/types';
import { COACH_UIDS } from '@/lib/coaches';

// Helper to serialize Firestore Timestamps
function serializeTimestamps(obj: any): any {
    if (obj instanceof Timestamp) return obj.toDate().toISOString();
    if (Array.isArray(obj)) return obj.map(serializeTimestamps);
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = serializeTimestamps(obj[key]);
            return acc;
        }, {} as { [key: string]: any });
    }
    return obj;
}

interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
    isCoach: boolean;
    getIdToken: () => Promise<string | null>;
    signOut: () => Promise<void>;
    setFcmToken: (token: string | null) => void;
}

const AuthContext = createContext<AuthContextType>(
    { user: null, userProfile: null, loading: true, isCoach: false, getIdToken: async () => null, signOut: async () => {}, setFcmToken: () => {} }
);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseReady, setFirebaseReady] = useState(false);
    const [fcmToken, setFcmToken] = useState<string | null>(null);

    const isCoach = useMemo(() => user ? COACH_UIDS.includes(user.uid) : false, [user]);

    useEffect(() => {
        initializeFirebasePersistence().then(() => {
            setFirebaseReady(true);
        });
    }, []);

    useEffect(() => {
        if (!firebaseReady) return;
        const unsubscribeAuth = onIdTokenChanged(auth, (authUser) => {
            setUser(authUser);
            if (!authUser) {
                setUserProfile(null);
                setFcmToken(null);
            }
            setLoading(false);
        });
        return () => unsubscribeAuth();
    }, [firebaseReady]);

    useEffect(() => {
        if (!firebaseReady || !user) {
            setUserProfile(null);
            return;
        }

        // **FINAL FIX:** Logic now ONLY uses 'clients' or 'coaches' collections, ignoring 'userProfiles'.
        const profileCollection = isCoach ? 'coaches' : 'clients';
        const profileRef = doc(db, profileCollection, user.uid);

        const unsub = onSnapshot(profileRef, (docSnap) => {
            if (docSnap.exists()) {
                setUserProfile(serializeTimestamps(docSnap.data()));
            } else {
                // This is the correct security behavior: if no profile exists, sign out.
                console.error(`Permissions Error: User profile for uid: ${user.uid} not found in '${profileCollection}'. Logging out.`);
                firebaseSignOut(auth);
            }
        }, (error) => {
            console.error(`Error listening to profile in '${profileCollection}':`, error);
            firebaseSignOut(auth);
        });

        return () => unsub();

    }, [user, isCoach, firebaseReady]);

    const getIdToken = useCallback(async () => {
        if (!firebaseReady || !auth.currentUser) return null;
        return auth.currentUser.getIdToken();
    }, [firebaseReady]);

    const signOut = useCallback(async () => {
        if (!firebaseReady) return;

        if (fcmToken) {
            console.log(`Attempting to remove FCM token: ${fcmToken}`);
            const idToken = await getIdToken();
            if (idToken) {
                try {
                    const functionUrl = 'https://us-central1-hunger-free-and-happy-app.cloudfunctions.net/removeFcmToken';
                    await fetch(functionUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`,
                        },
                        body: JSON.stringify({ data: { token: fcmToken, isCoach } }),
                    });
                    console.log('Successfully called removeFcmToken function.');
                } catch (error) {
                    console.error('Error removing FCM token:', error);
                }
            }
        }
        await firebaseSignOut(auth);
        console.log('User signed out.');

    }, [firebaseReady, fcmToken, isCoach, getIdToken]);

    const value = useMemo(() => 
        ({ user, userProfile, loading, isCoach, getIdToken, signOut, setFcmToken }), 
        [user, userProfile, loading, isCoach, getIdToken, signOut]
    );

    return (
        <AuthContext.Provider value={value}>
            {loading || !firebaseReady ? <FullScreenLoader /> : <AuthRedirector>{children}</AuthRedirector>}
        </AuthContext.Provider>
    );
}

function FullScreenLoader() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}

const PUBLIC_PATHS = ['/login', '/signup', '/tos', '/privacy', '/support'];

function AuthRedirector({ children }: { children: ReactNode }) {
    const { user, isCoach, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading || !pathname) return;
        const isPublicPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));
        if (user) {
            if (isPublicPage) {
                router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard');
            }
        } else {
            if (!isPublicPage) {
                router.replace('/login');
            }
        }
    }, [user, isCoach, loading, pathname, router]);
    
    return <>{children}</>;
}
