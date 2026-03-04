'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { ClientProfile } from '@/types';

/**
 * Recursively converts Firestore Timestamps to ISO strings.
 */
function serializeTimestamps(docData: any): any {
    if (!docData) return docData;
    
    // Handle arrays
    if (Array.isArray(docData)) {
        return docData.map(item => serializeTimestamps(item));
    }

    const newObject: { [key: string]: any } = { ...docData };
    for (const key in newObject) {
      if (newObject[key] && typeof newObject[key].toDate === 'function') {
        newObject[key] = newObject[key].toDate().toISOString();
      } else if (typeof newObject[key] === 'object' && newObject[key] !== null) {
          newObject[key] = serializeTimestamps(newObject[key]);
      }
    }
    return newObject;
}

export interface PopulationInsight {
    title: string;
    finding: string;
    explanation: string;
    suggestion: string;
}

/**
 * RESTORED: Fetches clients with a Waist-to-Height Ratio (WtHR) > 0.5.
 */
export async function getHighWtHRClients(): Promise<{ success: boolean; data: ClientProfile[] }> {
    try {
        // Querying based on the centralized dailySummary object
        const snapshot = await adminDb.collection('clients')
            .where('dailySummary.currentWthr', '>', 0.5)
            .get();

        const clients = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as ClientProfile));

        return { 
            success: true, 
            data: serializeTimestamps(clients) 
        };
    } catch (error) {
        console.error("Error fetching high WtHR clients:", error);
        return { success: false, data: [] };
    }
}

/**
 * RESTORED: Generates an AI-style population insight based on aggregate data.
 */
export async function generatePopulationInsights(): Promise<{ success: boolean; data: PopulationInsight | null }> {
    try {
        // In a real scenario, this might call OpenAI. 
        // For now, we calculate a real insight from your DB data.
        const snapshot = await adminDb.collection('clients').get();
        const total = snapshot.size;
        
        if (total === 0) return { success: true, data: null };

        const highRiskCount = snapshot.docs.filter(d => (d.data().dailySummary?.currentWthr || 0) > 0.5).length;
        const percentage = Math.round((highRiskCount / total) * 100);

        // Returning a structured insight object the UI expects
        const insight: PopulationInsight = {
            title: "Population Health Alert",
            finding: `${percentage}% of your client population currently exceeds the 0.5 WtHR threshold.`,
            explanation: "Waist-to-Height ratio is a primary indicator of visceral fat levels. A cluster of clients in this range suggests a need for targeted cardiovascular or metabolic focus.",
            suggestion: "Consider launching a 'Waist-Line' challenge or sharing a meal plan focused on reducing inflammatory processed foods for this specific group."
        };

        return { success: true, data: insight };
    } catch (error) {
        console.error("Error generating population insights:", error);
        return { success: false, data: null };
    }
}