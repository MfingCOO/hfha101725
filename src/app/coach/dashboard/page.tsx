'use server';
import { CoachDashboardClient } from "@/components/coach/dashboard/coach-dashboard-client";
import { getUnreviewedUserFoods } from "@/app/coach/food-cache/actions";
import { getPendingReportsCountAction } from "@/app/actions/moderation-actions";
import { headers } from 'next/headers';
import { auth } from "@/lib/firebaseAdmin";

// This is a Server Component. It fetches data on the server and passes it down.
export default async function CoachDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    // MODIFIED: Await searchParams Promise to pass plain object to client component
    const resolvedSearchParams = await searchParams;

    const idToken = (await headers()).get('Authorization')?.split('Bearer ')[1];
    
    if (!idToken) {
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} searchParams={resolvedSearchParams} />;
    }
    
    let coachId = '';
    try {
        const decodedToken = await auth.verifyIdToken(idToken);
        coachId = decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token in CoachDashboardPage:", error);
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} searchParams={resolvedSearchParams} />;
    }

    // Fetch data in parallel
    // Use the original getUnreviewedUserFoods and the efficient getPendingReportsCountAction
    const [unreviewedFoodsResult, pendingReportsResult] = await Promise.all([
        getUnreviewedUserFoods(),
        getPendingReportsCountAction(coachId)
    ]);

    // Safely access the counts from the different return structures
    const pendingFoodCount = unreviewedFoodsResult.length || 0;
    const pendingReportCount = pendingReportsResult.count || 0;

    return (
       <CoachDashboardClient 
            initialClients={[]}
            pendingFoodCount={pendingFoodCount} 
            pendingReportCount={pendingReportCount}
            searchParams={resolvedSearchParams}
       />
    );
}