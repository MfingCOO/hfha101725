'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

const DashboardClient = dynamic(
  () => import('@/components/dashboard/dashboard-client').then((mod) => mod.DashboardClient),
  { ssr: false }
);

export default function ClientDashboardPage() {
  const searchParams = useSearchParams();
  const searchParamsObject = Object.fromEntries(searchParams.entries());

  return (
    <Suspense fallback={
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <DashboardClient searchParams={searchParamsObject} />
    </Suspense>
  );
}