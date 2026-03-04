'use client';

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

// This tells Next.js explicitly that this page depends on runtime search params
export default function ClientDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      {/* Passing the searchParams down can sometimes help bypass the hook bailout */}
      <DashboardClient />
    </Suspense>
  );
}