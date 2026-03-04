'use client';

import { useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { user, loading, isCoach } = useAuth(); // Corrected: use `isCoach`
  const router = useRouter();

  useEffect(() => {
    // Wait until the authentication state is determined.
    if (!loading) {
      if (user) {
        // If a user exists, redirect based on their role.
        if (isCoach) {
          router.replace('/coach/dashboard');
        } else {
          router.replace('/client/dashboard');
        }
      } else {
        // If no user exists, they are not logged in.
        router.replace('/signup');
      }
    }
    // This effect runs when the authentication state changes.
  }, [user, loading, isCoach, router]);

  // Display a loading indicator while the authentication check is in progress.
  // This prevents a flash of content before the redirect occurs.
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
