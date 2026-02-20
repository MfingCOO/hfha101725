'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, DocumentData, Timestamp } from 'firebase/firestore';
import { auth, db, initializeFirebasePersistence } from '@/lib/firebase'; // Simplified imports
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
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true, isCoach: false, getIdToken: async () => null });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [firebaseReady, setFirebaseReady] = useState(false);

    const isCoach = useMemo(() => user ? COACH_UIDS.includes(user.uid) : false, [user]);

    // **THE FIX**: This single useEffect initializes Firebase at the root.
    useEffect(() => {
        initializeFirebasePersistence().then(() => {
            setFirebaseReady(true);
        });
    }, []);

    useEffect(() => {
        if (!firebaseReady) return; // Don't do anything until Firebase is ready

        const unsubscribeAuth = onIdTokenChanged(auth, (authUser) => {
            setUser(authUser);
            setLoading(false);
        });

        return () => unsubscribeAuth();
    }, [firebaseReady]);

    useEffect(() => {
        if (!firebaseReady || !user) {
            setUserProfile(null);
            return;
        }

        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const clientProfileRef = doc(db, 'clients', user.uid);

        const fetchAndSetProfile = async () => {
            try {
                const userProfileSnap = await getDoc(userProfileRef);
                if (!userProfileSnap.exists()) {
                    console.error(`Permissions Error: User profile does not exist for uid: ${user.uid}. Logging out.`);
                    signOut(auth);
                    return;
                }

                let clientProfileData = {};
                if (!isCoach) {
                    const clientProfileSnap = await getDoc(clientProfileRef);
                    if (clientProfileSnap.exists()) {
                        clientProfileData = clientProfileSnap.data();
                    }
                }
                setUserProfile(serializeTimestamps({ ...userProfileSnap.data(), ...clientProfileData }));

            } catch (error) {
                console.error('A critical permission error occurred while fetching user data...', error);
                signOut(auth);
            }
        };

        // Set up listeners
        const unsubUser = onSnapshot(userProfileRef, fetchAndSetProfile, (error) => {
            console.error("User profile listener failed:", error);
            signOut(auth);
        });

        let unsubClient: (() => void) | undefined;
        if (!isCoach) {
            unsubClient = onSnapshot(clientProfileRef, fetchAndSetProfile, (error) => {
                console.warn("Client profile listener failed:", error);
            });
        }

        return () => {
            unsubUser();
            if (unsubClient) unsubClient();
        };
    }, [user, isCoach, firebaseReady]);

    const getIdToken = useCallback(async () => {
        if (!firebaseReady || !auth.currentUser) return null;
        return auth.currentUser.getIdToken();
    }, [firebaseReady]);

    const value = useMemo(() => ({ user, userProfile, loading, isCoach, getIdToken }), [user, userProfile, loading, isCoach, getIdToken]);

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
