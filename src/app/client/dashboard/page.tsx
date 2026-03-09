'use client';

import { DashboardClient } from '@/components/dashboard/dashboard-client';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation'; // ADDED: Import useSearchParams

// This is a Client Component page. It uses the useSearchParams hook to get URL parameters.
export default function ClientDashboardPage() { // MODIFIED: Removed searchParams from props
  const searchParams = useSearchParams(); // ADDED: Use useSearchParams hook

  // Convert URLSearchParams to a plain object for DashboardClient
  // This is necessary because searchParams from useSearchParams is a URLSearchParams object,
  // but our DashboardClient expects a plain object type based on its interface.
  const searchParamsObject = Object.fromEntries(searchParams.entries());

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      {/* Pass the converted searchParams object down to DashboardClient */}
      <DashboardClient searchParams={searchParamsObject} /> {/* MODIFIED: Pass searchParamsObject */}
    </Suspense>
  );
}
