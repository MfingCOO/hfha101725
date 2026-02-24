'use server';
import { CoachDashboardClient } from "@/components/coach/dashboard/coach-dashboard-client";
import { getUnreviewedUserFoods } from "@/app/coach/food-cache/actions";
import { getPendingReportsAction } from "@/app/actions/moderation-actions";
import { headers } from 'next/headers';
import { getAuth } from "firebase-admin/auth";

// This is a Server Component. It fetches data on the server and passes it down.
export default async function CoachDashboardPage() {
    
    const idToken = (await headers()).get('Authorization')?.split('Bearer ')[1];
    
    if (!idToken) {
        // Return a default state if there's no token, ensuring an empty client list.
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} />;
    }
    
    let coachId = '';
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        coachId = decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token in CoachDashboardPage:", error);
        // Return a default state on token verification error, ensuring an empty client list.
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} />;
    }

    // THE FIX: Fetch only the necessary metadata, not the entire client list.
    // The client list will be fetched on-demand by the client component.
    const [unreviewedFoodsResult, pendingReportsResult] = await Promise.all([
        getUnreviewedUserFoods(),
        getPendingReportsAction(coachId)
    ]);

    const pendingFoodCount = unreviewedFoodsResult.length;
    const pendingReportCount = pendingReportsResult.data?.length || 0;

    // Pass an empty array for initialClients. The client component will handle fetching.
    return (
       <CoachDashboardClient 
            initialClients={[]}
            pendingFoodCount={pendingFoodCount} 
            pendingReportCount={pendingReportCount}
       />
    );
}
