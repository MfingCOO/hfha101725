'use server';
import { CoachDashboardClient } from "@/components/coach/dashboard/coach-dashboard-client";
import { getClientsForCoach } from "@/app/coach/dashboard/actions";
import { getUnreviewedUserFoods } from "@/app/coach/food-cache/actions";
import { getPendingReportsAction } from "@/app/actions/moderation-actions";
import { headers } from 'next/headers';
import { getAuth } from "firebase-admin/auth";

// This is a Server Component. It fetches data on the server and passes it down.
export default async function CoachDashboardPage() {
    
    const idToken = (await headers()).get('Authorization')?.split('Bearer ')[1];
    
    if (!idToken) {
        // Return a default state if there's no token
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} />;
    }
    
    let coachId = '';
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        coachId = decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token in CoachDashboardPage:", error);
        // Return a default state on token verification error
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} pendingReportCount={0} />;
    }

    // Fetch all necessary data in parallel
    const [clientsResult, unreviewedFoodsResult, pendingReportsResult] = await Promise.all([
        getClientsForCoach(coachId),
        getUnreviewedUserFoods(),
        getPendingReportsAction(coachId)
    ]);

    const initialClients = clientsResult.clients || [];
    const pendingFoodCount = unreviewedFoodsResult.length;
    const pendingReportCount = pendingReportsResult.data?.length || 0;

    return (
       <CoachDashboardClient 
            initialClients={initialClients} 
            pendingFoodCount={pendingFoodCount} 
            pendingReportCount={pendingReportCount}
       />
    );
}
