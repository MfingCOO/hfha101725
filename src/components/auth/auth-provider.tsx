"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, DocumentData } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';

const COACH_UIDS = [
    'yue7fVPBQZg45vmfXXUH5PdG7jE2',
    'oYsf7Iah6hVlEgHvWJ7Ms7j1oTB2',
    'rVBbOZ1l0xbc7dXjezVpU5BgmgC2'
];

interface AuthContextType {
    user: User | null;
    userProfile: DocumentData | null;
    loading: boolean;
    isCoach: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, userProfile: null, loading: true, isCoach: false });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [isCoach, setIsCoach] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = doc(db, 'clients', firebaseUser.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists()) {
                    const profileData = userDoc.data();
                    setUser(firebaseUser);
                    setUserProfile(profileData);

                    const coachCheck = COACH_UIDS.includes(firebaseUser.uid);
                    setIsCoach(coachCheck);

                    if (pathname) {
                        if (coachCheck) {
                            if (!pathname.startsWith('/coach')) router.push('/coach/dashboard');
                        } else {
                            if (!pathname.startsWith('/client')) router.push('/client/dashboard');
                        }
                    }
                } else {
                    console.error("CRITICAL: User profile not found. Logging out.");
                    auth.signOut();
                    setUser(null);
                    setUserProfile(null);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                setIsCoach(false);
                const publicPaths = ['/login', '/', '/signup', '/tos', '/privacy', '/support'];
                if (pathname && !publicPaths.includes(pathname)) {
                    router.push('/login');
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router, pathname]);

    return (
        <AuthContext.Provider value={{ user, userProfile, loading, isCoach }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);