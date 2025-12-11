
import { z } from 'zod';
import type { App } from 'firebase-admin/app';
import { configuredGenkit } from '@/ai/genkit.config';
import { googleAI } from '@genkit-ai/googleai';
import { DocumentSnapshot } from 'firebase-admin/firestore';

const ProactiveCoachInputSchema = z.object({
  clientId: z.string(),
  event: z.object({
    type: z.string(),
    notes: z.string().optional(),
  }).optional(),
});
const ProactiveCoachOutputSchema = z.object({ coachResponse: z.string() });

export const proactiveCoachingFlow = configuredGenkit.defineFlow(
  {
    name: 'proactiveCoachingFlow',
    inputSchema: ProactiveCoachInputSchema,
    outputSchema: ProactiveCoachOutputSchema,
  },
  async (input) => {
    console.log('[AI Flow] Proactive Coach Invoked. Attempting to load dependencies...');

    try {
      const { initializeApp, getApps } = await import('firebase-admin/app');
      const { getFirestore, Timestamp } = await import('firebase-admin/firestore');
      const { subDays, startOfDay } = await import('date-fns');
      
      console.log('[AI Flow] Dependencies loaded successfully.');

      let firebaseApp: App;
      if (!getApps().length) {
        firebaseApp = initializeApp();
      } else {
        firebaseApp = getApps()[0];
      }
      const db = getFirestore(firebaseApp);

      console.log(`[AI Flow] Starting for client ${input.clientId}`);

      const settingsDoc = await db.collection('siteSettings').doc('v1').get();
      if (!settingsDoc.exists) throw new Error("Site settings not found.");
      
      const modelNameFromDb = settingsDoc.data()?.aiModelSettings?.flash;
      if (!modelNameFromDb) throw new Error("Flash AI model not configured.");
      
      const model = googleAI.model(modelNameFromDb);

      const thirtyDaysAgo = Timestamp.fromDate(subDays(startOfDay(new Date()), 30));
      const collectionsToQuery = [`clients/${input.clientId}/cravings`, `clients/${input.clientId}/stress`];

      console.log(`[AI Flow] Querying collections for logs from the last 30 days...`);

      const queryPromises = collectionsToQuery.flatMap(collectionPath => [
          db.collection(collectionPath).where('entryDate', '>=', thirtyDaysAgo).get(),
          db.collection(collectionPath).where('log.entryDate', '>=', thirtyDaysAgo).get()
      ]);

      const snapshots = await Promise.all(queryPromises);
      
      const docs = new Map<string, DocumentSnapshot>();
      snapshots.forEach(snapshot => {
        snapshot.docs.forEach(doc => docs.set(doc.id, doc));
      });

      const unnest = (doc: DocumentSnapshot) => {
          const data = doc.data();
          if (!data) return null;
          const logData = data.log || {};
          delete data.log;
          return { id: doc.id, ...data, ...logData };
      };

      const allLogs = Array.from(docs.values()).map(unnest).filter(Boolean);
      console.log(`[AI Flow] Found ${allLogs.length} total raw logs. Now sorting...`);

      allLogs.sort((a, b) => {
        const dateA = a?.entryDate?.toMillis ? a.entryDate.toMillis() : 0;
        const dateB = b?.entryDate?.toMillis ? b.entryDate.toMillis() : 0;
        return dateB - dateA;
      });

      const recentLogs = allLogs.slice(0, 10);
      console.log(`[AI Flow] Successfully sorted and sliced to ${recentLogs.length} most recent logs.`);

      const clientDataSummary = JSON.stringify(recentLogs.map(log => log?.entryDate ? { ...log, entryDate: log.entryDate.toDate().toISOString() } : log), null, 2);

      const librarySnapshot = await db.collection('library').get();
      const allLibraryDocs = librarySnapshot.docs.map(doc => doc.data().text as string);
      const searchTerms = (input.event?.type + " " + (input.event?.notes || '')).toLowerCase();
      const relevantDocs = allLibraryDocs.filter(text => 
        searchTerms.split(' ').some(term => term.length > 3 && text.toLowerCase().includes(term))
      ).slice(0, 3);
      const retrievedContentForPrompt = relevantDocs.join('\n---\n');

      const finalPrompt = `You are an expert health coach...`;

      console.log('[AI Flow] Sending request to Google AI...');
      const finalResponse = await configuredGenkit.generate({ model, prompt: finalPrompt, config: { temperature: 0.5 } });
      const coachResponse = finalResponse.text;

      if (!coachResponse) throw new Error('AI response generation failed.');

      console.log('[AI Flow] Successfully generated AI response.');
      return { coachResponse };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('[AI Flow CRITICAL] Proactive Coaching Flow failed.', { error: errorMessage, stack: error instanceof Error ? error.stack : 'N/A' });
      throw new Error(`AI flow failed: ${errorMessage}`);
    }
  }
);