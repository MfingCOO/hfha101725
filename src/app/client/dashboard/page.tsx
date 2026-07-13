'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';

const DashboardClient = dynamic(
  () => import('@/components/dashboard/dashboard-client').then((mod) => mod.DashboardClient),
  { ssr: false }
);

export default function ClientDashboardPage() {
  const searchParams = useSearchParams();
  const searchParamsObject = Object.fromEntries(searchParams.entries());

  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <DashboardClient searchParams={searchParamsObject} />
    </Suspense>
  );
}