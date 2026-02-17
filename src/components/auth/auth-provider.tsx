'use client';
import { createContext, useContext, useEffect, useState, ReactNode, useMemo } from 'react';
import { onIdTokenChanged, User, signOut } from 'firebase/auth';
import { doc, onSnapshot, getDoc, DocumentData, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import type { UserProfile } from '@/types';
import { COACH_UIDS } from '@/lib/coaches';

// --- Utility to convert Firestore Timestamps --- //
function serializeTimestamps(obj: any): any {
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(serializeTimestamps);
    }
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = serializeTimestamps(obj[key]);
            return acc;
        }, {} as { [key: string]: any });
    }
    return obj;
}

// --- Context Definition --- //
interface AuthContextType {
    user: User | null;
    userProfile: UserProfile | null;
    loading: boolean; // This will now represent ONLY the initial auth check
    isCoach: boolean;
    getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true, isCoach: false, getIdToken: async () => null });

export const useAuth = () => useContext(AuthContext);

// --- Auth Provider: The Core Fix --- //
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true); // True only for the initial user presence check

    const isCoach = useMemo(() => user ? COACH_UIDS.includes(user.uid) : false, [user]);

    // Effect 1: Listen for Firebase auth state changes. This is the only place `setLoading` is used.
    useEffect(() => {
        const unsubscribeAuth = onIdTokenChanged(auth, (authUser) => {
            setUser(authUser);
            setLoading(false); // Auth check is complete. Show the app or redirect.
        });
        return () => unsubscribeAuth();
    }, []);

    // Effect 2: Fetch and listen for profile data changes, only if the user exists.
    useEffect(() => {
        if (!user) {
            setUserProfile(null); // Clear profile if user logs out
            return;
        }

        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const clientProfileRef = doc(db, 'clients', user.uid);

        // Set up snapshot listeners for both profiles
        const unsubscribeUserProfile = onSnapshot(userProfileRef, (snap) => {
            if (!snap.exists()) {
                console.error(`Auth Error: User profile not found for UID: ${user.uid}. Forcing logout.`);
                signOut(auth);
                return;
            }
            const baseProfile = snap.data();

            // If not a coach, we need the client profile too. Otherwise, we can set the profile now.
            if (!isCoach) {
                getDoc(clientProfileRef).then(clientSnap => {
                    const clientProfile = clientSnap.exists() ? clientSnap.data() : {};
                    setUserProfile(serializeTimestamps({ ...baseProfile, ...clientProfile }));
                }).catch(err => console.error("Error fetching client profile doc", err));
            } else {
                setUserProfile(serializeTimestamps(baseProfile));
            }
        }, (error) => {
            console.error("Auth Error: userProfiles snapshot listener failed.", error);
            signOut(auth);
        });
        
        // A second listener for the client profile for real-time updates
        let unsubscribeClientProfile: (()=>void) | undefined;
        if(!isCoach) {
            unsubscribeClientProfile = onSnapshot(clientProfileRef, (clientSnap) => {
                 getDoc(userProfileRef).then(userSnap => {
                    if(userSnap.exists()) {
                        const clientProfile = clientSnap.exists() ? clientSnap.data() : {};
                        setUserProfile(serializeTimestamps({ ...userSnap.data(), ...clientProfile }));
                    }
                 })
            });
        }
        

        return () => {
            unsubscribeUserProfile();
            if (unsubscribeClientProfile) unsubscribeClientProfile();
        };
    }, [user, isCoach]);

    const getIdToken = async () => {
        if (auth.currentUser) {
            return await auth.currentUser.getIdToken();
        }
        return null;
    };

    // Memoize the context value to prevent unnecessary re-renders of consumers
    const value = useMemo(() => ({
        user,
        userProfile,
        loading,
        isCoach,
        getIdToken
    }), [user, userProfile, loading, isCoach]);

    return (
        <AuthContext.Provider value={value}>
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


// --- Auth Redirector: Handles routing logic --- //
const PUBLIC_PATHS = ['/login', '/signup', '/tos', '/privacy', '/support'];

function AuthRedirector({ children }: { children: ReactNode }) {
    const { user, isCoach, loading } = useAuth(); // No longer needs userProfile
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (loading || !pathname) return; // Wait until initial auth check is done

        const isPublicPage = PUBLIC_PATHS.some(p => pathname.startsWith(p));

        if (user) {
            // User is logged in
            if (isPublicPage) {
                router.replace(isCoach ? '/coach/dashboard' : '/client/dashboard');
            }
        } else {
            // User is not logged in
            if (!isPublicPage) {
                router.replace('/login');
            }
        }
    }, [user, isCoach, loading, pathname, router]);

    return <>{children}</>;
}
