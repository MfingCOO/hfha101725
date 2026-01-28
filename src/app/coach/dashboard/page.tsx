'use server';
import { CoachDashboardClient } from "@/components/coach/dashboard/coach-dashboard-client";
import { getClientsForCoach } from "@/app/coach/dashboard/actions";
import { getUnreviewedUserFoods } from "@/app/coach/food-cache/actions";
import { UserProfile, UserTier } from "@/types";
import { headers } from 'next/headers';
import { getAuth } from "firebase-admin/auth";

// This is now a Server Component. It fetches data on the server and passes it down.
export default async function CoachDashboardPage() {
    
    const idToken = (await headers()).get('Authorization')?.split('Bearer ')[1];
    
    if (!idToken) {
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} />;
    }
    
    let coachId = '';
    try {
        const decodedToken = await getAuth().verifyIdToken(idToken);
        coachId = decodedToken.uid;
    } catch (error) {
        console.error("Error verifying auth token in CoachDashboardPage:", error);
        return <CoachDashboardClient initialClients={[]} pendingFoodCount={0} />;
    }

    const [clientsResult, unreviewedFoods] = await Promise.all([
        getClientsForCoach(coachId),
        getUnreviewedUserFoods()
    ]);

    const initialClients = clientsResult.clients || [];
    const pendingFoodCount = unreviewedFoods.length;

    return (
       <CoachDashboardClient 
            initialClients={initialClients} 
            pendingFoodCount={pendingFoodCount} 
       />
    );
}
