'use server';

import { db as adminDb } from '@/lib/firebaseAdmin';
import { differenceInCalendarDays, startOfDay, endOfDay as fnsEndOfDay, subDays, subHours, format } from 'date-fns';
import type { UserTier, ClientProfile, UserProfile, SavedMeal, MealItem, RecentFood } from '@/types';
import { calculateDailySummaryForUser } from './summary-calculator';
import { FieldValue, Timestamp, FieldPath, Query } from 'firebase-admin/firestore';
import { revalidatePath } from 'next/cache';
/**
 * A fire-and-forget function to trigger daily summary recalculation with a delay.
 * Fetches the client's timezone info and introduces a delay to prevent race conditions.
 */
function triggerSummaryCalculation(userId: string, dateSource: Timestamp | Date) {
    // This is a "fire-and-forget" task that runs in the background.
    (async () => {
        try {
            // 1. Fetch the user's client profile to get their timezone information.
            const clientSnap = await adminDb.collection('clients').doc(userId).get();
            
            let userTimezone = 'UTC';
            let timezoneOffset = 0;

            if (clientSnap.exists) {
                // Use 'any' to bypass potential TypeScript errors if the 'types.ts' file is not perfectly in sync.
                const clientData: any = clientSnap.data();
                // Safely access timezone properties and provide safe fallbacks if they don't exist.
                userTimezone = clientData?.timezone || 'UTC';
                timezoneOffset = clientData?.timezoneOffset || 0;
            } else {
                console.warn(`[triggerSummaryCalculation] Client profile ${userId} not found. Defaulting to UTC for calculation.`);
            }

            // 2. Introduce a delay to prevent a race condition, allowing the primary save/delete to complete in Firestore.
            await new Promise(resolve => setTimeout(resolve, 2000));

            const dateToRecalculate = dateSource instanceof Date ? dateSource : dateSource.toDate();
            const dateString = format(dateToRecalculate, 'yyyy-MM-dd');
            
            console.log(`[DEBOUNCED] Triggering summary calculation for user ${userId}, date: ${dateString} with timezone: ${userTimezone}`);
            
            // 3. Call the calculator function with the correct timezone info.
            await calculateDailySummaryForUser(userId, dateString, userTimezone, timezoneOffset);

        } catch (error) {
            console.error(`[triggerSummaryCalculation] CRITICAL background error for user ${userId}:`, error);
        }
    })();
}


/**
 * Helper function to call a Genkit flow via its API endpoint.
 */
async function callGenkitFlow(flowName: string, input: any) {
    // Use the full URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const url = `${baseUrl}/api/flows/${flowName}`;
  
    try {
      // IMPORTANT: This call is intentionally NOT awaited for 'calculateDailySummariesFlow'
      // to avoid blocking the user's request. It runs in the background.
      const promise = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Genkit's Next.js plugin expects the input under a 'data' key
        body: JSON.stringify({ data: input }),
      });
  
      // For insight flows, we need the result, so we await the response.
      if (['proactiveCoachingFlow', 'generateHolisticInsightFlow'].includes(flowName)) {
          const response = await promise;
          if (!response.ok) {
              const errorBody = await response.text();
              console.error(`Error calling flow '${flowName}'. Status: ${response.status}. Body: ${errorBody}`);
              throw new Error(`The AI engine failed to process the request.`);
          }
          const result = await response.json();
          if (result && result.result) {
              return result.result;
          }
          console.error(`Invalid response format from flow '${flowName}':`, result);
          throw new Error('The AI engine returned an invalid response.');
      }
  
    } catch (error: any) {
      console.error(`Fetch error calling flow '${flowName}':`, error);
      // Re-throw a generic error for the client
      throw new Error('There was a problem communicating with the AI engine.');
    }
  }
  
/**
 * Marks a coaching chat as "read" by the client by updating the lastClientMessage timestamp.
 */
export async function markChatAsRead(userId: string, chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId || !chatId) {
            throw new Error("User ID and Chat ID are required.");
        }
        const chatRef = adminDb.collection('chats').doc(chatId);
        await chatRef.update({ lastClientMessage: FieldValue.serverTimestamp() });
        return { success: true };
    } catch (error: any) {
        console.error("Error marking chat as read:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Recalculates and resets a user's binge-free streak.
 * This function finds the last two binge events and sets the 'bingeFreeSince'
 * date to the timestamp of the second-to-last binge. If only one or zero
 * binges exist, it clears the streak.
 */
export async function resetBingeStreakAction(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) {
            throw new Error("User ID is required.");
        }

        const clientRef = adminDb.collection('clients').doc(userId);
        
        // This query now correctly uses a field that is indexed by default with entryDate.
        const bingeQuery = adminDb.collection(`clients/${userId}/cravings`)
            .orderBy('entryDate', 'desc');

        const bingeSnapshot = await bingeQuery.get();
        
        // We must filter for binges in the code, as a composite index is not available.
        const bingeDocs = bingeSnapshot.docs.filter(doc => doc.data().type === 'binge');

        if (bingeDocs.length <= 1) {
            // If there's 1 or 0 binges, deleting it means the user has no binge history.
            // We should REMOVE the field, not set it to the creation date.
            // This signals to the UI that the streak card should not be displayed.
            await clientRef.update({
                bingeFreeSince: FieldValue.delete(),
                lastBinge: FieldValue.delete(),
            });
        } else {
            // The second document in our filtered list is the "new" last binge.
            const newLastBinge = bingeDocs[1].data();
            const newStreakStartDate = newLastBinge.entryDate;
            await clientRef.update({
                bingeFreeSince: newStreakStartDate,
                lastBinge: newStreakStartDate,
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error resetting binge streak:", error);
        return { success: false, error: error.message };
    }
}


/**
 * Server Action to save data using the Admin SDK, bypassing client-side security rules.
 */
export async function saveDataAction(collectionName: string, data: any, userId: string, docId?: string) {
    try {
      if (!userId) throw new Error("User ID is required to save data.");
  
      let finalData = data.log;
      const settingsData = data.settings;
  
      // Convert ISO date strings back to Timestamps for Firestore
      if (finalData?.entryDate && typeof finalData.entryDate === 'string') {
        finalData.entryDate = Timestamp.fromDate(new Date(finalData.entryDate));
      } else if (finalData?.entryDate instanceof Date) {
        finalData.entryDate = Timestamp.fromDate(finalData.entryDate);
      }
      
      if (finalData?.wakeUpDay && typeof finalData.wakeUpDay === 'string') {
        finalData.wakeUpDay = Timestamp.fromDate(new Date(finalData.wakeUpDay));
      } else if (finalData?.wakeUpDay instanceof Date) {
        finalData.wakeUpDay = Timestamp.fromDate(finalData.wakeUpDay);
      }
  
      let displayPillar: string;
      switch (collectionName) {
          case 'cravings':
              displayPillar = finalData.type; // 'craving' or 'binge'
              break;
          case 'stress':
              displayPillar = finalData.type === 'event' ? 'stress' : 'relief';
              break;
          case 'sleep':
              displayPillar = finalData.isNap ? 'sleep-nap' : 'sleep';
              break;
          default:
              displayPillar = collectionName;
              break;
      }
      
      if (collectionName === 'nutrition' && finalData?.items) {
        finalData.items = finalData.items.map((item: any) => {
          const { ...foodData } = item;
          return foodData;
        });
      }
      
      const dataPath = `clients/${userId}/${collectionName}`;
      let savedDocId = docId;
  
      if (finalData && Object.keys(finalData).length > 0) {
          const fullDataToSave = {
              ...finalData,
              uid: userId,
              pillar: collectionName, 
              displayPillar: displayPillar, 
          };
  
          if (docId) {
              const docRef = adminDb.doc(`${dataPath}/${docId}`);
              await docRef.set({
                ...fullDataToSave,
                updatedAt: FieldValue.serverTimestamp(),
                log: FieldValue.delete(), // THIS LINE KILLS THE PHANTOM DATA
            }, { merge: true });

          } else {
              const docRef = await adminDb.collection(dataPath).add({
                  ...fullDataToSave,
                  createdAt: FieldValue.serverTimestamp(),
              });
              savedDocId = docRef.id;
          }
      }
      
      const clientRef = adminDb.doc(`clients/${userId}`);
  
      if (collectionName === 'cravings' && finalData?.type === 'binge') {
          const bingeTimestamp = finalData.entryDate;
          await clientRef.update({ 
              lastBinge: bingeTimestamp, 
              bingeFreeSince: bingeTimestamp 
          });
      }
  
      if (settingsData && Object.keys(settingsData).length > 0) {
           if (collectionName === 'hydration') {
               await clientRef.set({ hydrationSettings: settingsData }, { merge: true });
           }
      }
  
      await clientRef.update({ lastInteraction: FieldValue.serverTimestamp() });
      
            // TEMP: AI calls for cravings and stress are disabled to test the actionable response pop-up.
      // if (collectionName === 'cravings') {
      //     // CORRECTED: Call the flow via its API endpoint.
      //     const insight = await callGenkitFlow('proactiveCoachingFlow', {
      //       userId: userId,
      //       log: finalData,
      //   });
          
      //     const serializableInsight = {
      //         title: insight.title,
      //         message: insight.message,
      //         suggestion: insight.suggestion,
      //         logType: finalData.type,
      //     };
  
      //     return { success: true, id: savedDocId, insight: serializableInsight };
  
      // } else if (collectionName === 'stress' && finalData?.type === 'event') {
      //     // CORRECTED: Call the flow via its API endpoint.
      //     const insight = await callGenkitFlow('generateHolisticInsightFlow', {
      //         userId,
      //         periodInDays: 3,
      //         triggeringEvent: JSON.stringify(finalData),
      //     });
  
      //     if (insight) {
      //         const serializableInsight = {
      //             title: insight.title,
      //             message: insight.explanation,
      //             suggestion: insight.suggestion
      //         };
      //         return { success: true, id: savedDocId, insight: serializableInsight };
      //     }
      // }
            // =======================================================================
      // THE IGNITION: THIS IS THE FINAL, CRITICAL FIX
      // After any successful save, this code runs the summary calculator.
      // =======================================================================
      if (data) {
        const dateSource = data.entryDate || data.wakeUpDay;
        if (dateSource) {
            triggerSummaryCalculation(userId, dateSource);
        }
    }


      // Revalidate the cache to ensure the UI updates.
      revalidatePath('/calendar');
      revalidatePath('/');



      return { success: true, id: savedDocId, insight: null };
  
    } catch (e: any) {
      console.error("Error in saveDataAction: ", e);
      return { success: false, error: e.message || "An unknown server error occurred." };
    }
  }
  

interface LogChallengeProgressInput {
  userId: string;
  challengeId: string;
  date: string; // YYYY-MM-DD
  progress: Record<string, boolean | number>;
}

export async function logChallengeProgressAction(input: LogChallengeProgressInput) {
    const { userId, challengeId, date, progress } = input;
    try {
        const challengeRef = adminDb.collection('challenges').doc(challengeId);
        
        const updates: { [key: string]: any } = {};
        for (const taskDescription in progress) {
            const progressValue = progress[taskDescription];
            const progressFieldPath = `progress.${userId}.${date}.${taskDescription}`;
            updates[progressFieldPath] = progressValue;
        }

        await challengeRef.update(updates);
        
        // For simplicity, we won't generate an AI insight in this batch update model.
        // We could add it back by picking one of the tasks to generate an insight for.
        
        return { success: true, insight: null };

    } catch (error: any) {
        console.error('Error logging challenge progress:', error);
        return { success: false, error: error.message };
    }
}


export async function deleteData(collectionName: string, docId: string, userId: string) {
    try {
        if (!userId) throw new Error("User ID is required to delete data.");
        
        const dataPath = `clients/${userId}/${collectionName}`;
        const docRef = adminDb.doc(`${dataPath}/${docId}`);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
             console.warn(`Attempted to delete non-existent document: ${dataPath}/${docId}`);
             // Return success even if not found, as the desired state is "deleted".
             return { success: true }; 
        }
        
        const data = docSnap.data();

        await docRef.delete();
        
        // Handle post-deletion side-effects, like resetting a binge streak.
        if (collectionName === 'cravings' && data?.type === 'binge') {
            await resetBingeStreakAction(userId);
        }
        // After a deletion, also trigger a recalculation.
        if (data) {
            const dateSource = data.entryDate || data.wakeUpDay;
            if (dateSource) {
                triggerSummaryCalculation(userId, dateSource);
            }
        }

        revalidatePath('/calendar');
        revalidatePath('/');

        return { success: true };

    } catch (e: any) {
        console.error("Error deleting document: ", e);
        return { success: false, error: e.message };
    }
}

const ALL_DATA_COLLECTIONS = [
    'nutrition', 'hydration', 'activity', 'sleep', 
    'stress', 'measurements', 'protocol', 'planner', 'cravings'
];

export async function getDataForDay(date: string, userId: string) {
    if (!userId) {
        console.log("No user ID provided for getDataForDay");
        return { success: true, data: [] };
    }

    const clientDate = new Date(date);
    const startOfDayResult = startOfDay(clientDate);
    const endOfDay = fnsEndOfDay(clientDate);
 

    const startTimestamp = Timestamp.fromDate(startOfDayResult);
    const endTimestamp = Timestamp.fromDate(endOfDay);
    
    try {
        const promises = ALL_DATA_COLLECTIONS.map(collectionName => {
             const collectionPath = `clients/${userId}/${collectionName}`;
             
             if (collectionName === 'sleep') {
                 const q = adminDb.collection(collectionPath)
                    .where("wakeUpDay", ">=", startTimestamp)
                    .where("wakeUpDay", "<=", endTimestamp);
                 return q.get().then(snapshot => snapshot.docs.map(doc => ({ id: doc.id, pillar: collectionName, ...doc.data() })));
             }
             
             const q = adminDb.collection(collectionPath)
                .where("entryDate", ">=", startTimestamp)
                .where("entryDate", "<=", endTimestamp);
                
            return q.get().then(snapshot => snapshot.docs.map(doc => ({
                id: doc.id,
                pillar: collectionName,
                ...doc.data()
            })));
        });

        const [results] = await Promise.all([Promise.all(promises)]);
        const allEntries = results.flat();

        if (allEntries.length === 0) {
            return { success: true, data: [] };
        }
        
        allEntries.sort((a: any, b: any) => {
            const dateA = a.entryDate || a.wakeUpDay;
            const dateB = b.entryDate || b.wakeUpDay;
            if (!dateA || !dateB) return 0;
            return (dateA as Timestamp).toMillis() - (dateB as Timestamp).toMillis();
        });
        

        const serializableData = allEntries.map(entry => {
            const newEntry = { ...entry };
            for(const key in newEntry) {
                if (newEntry[key] instanceof Timestamp) {
                    newEntry[key] = newEntry[key].toDate();
                }
            }
            return newEntry;
        });

        return { success: true, data: serializableData };

    } catch(e: any) {
        console.error("Error getting documents: ", e);
        return { success: false, error: e, data: [] };
    }
}


export async function getAllDataForPeriod(days: number, userId: string, fromDate?: Date) {
    if (!userId) return { success: true, data: [] };

    const endDate = new Date();
    const startDate = fromDate ? startOfDay(new Date(fromDate)) : startOfDay(subDays(new Date(), days > 0 ? days - 1 : 0));
    
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);

    try {
        const promises = ALL_DATA_COLLECTIONS.map(collectionName => {
            const collectionPath = `clients/${userId}/${collectionName}`;
            let q: Query;
        
            if (collectionName === 'sleep') {
                q = adminDb.collection(collectionPath)
                    .where("wakeUpDay", ">=", startTimestamp)
                    .where("wakeUpDay", "<=", endTimestamp);
            } else if (collectionName === 'planner') {
                // This now correctly queries the NEW location for planner entries
                q = adminDb.collection(collectionPath)
                    .where("entryDate", ">=", startTimestamp)
                    .where("entryDate", "<=", endTimestamp);
            } else {
                q = adminDb.collection(collectionPath)
                    .where("entryDate", ">=", startTimestamp)
                    .where("entryDate", "<=", endTimestamp);
            }
            // BUG FIX: Adds the 'pillar' property, which is required by getHabitHighlights
            return q.get().then(snapshot => snapshot.docs.map(doc => ({
                id: doc.id,
                pillar: collectionName, 
                ...doc.data()
            })));
        });
        
        
        const [results] = await Promise.all([Promise.all(promises)]);
        
        // Combine the results from all collections, including the legacy planner data
        const allEntries = results.flat();
        
        allEntries.sort((a: any, b: any) => {
            const dateA = a.entryDate || a.wakeUpDay || a.indulgenceDate;
            const dateB = b.entryDate || b.wakeUpDay || b.indulgenceDate;
            if (!dateA || !dateB) return 0;
            const timeA = dateA.toMillis ? dateA.toMillis() : new Date(dateA).getTime();
            const timeB = dateB.toMillis ? dateB.toMillis() : new Date(dateB).getTime();
            return timeB - timeA;
        });
        
        const serializableData = allEntries.map(entry => {
            const newEntry = { ...entry };
            for(const key in newEntry) {
                if (newEntry[key] && typeof newEntry[key].toDate === 'function') {
                    newEntry[key] = newEntry[key].toDate().toISOString();
                }
            }
            return newEntry;
        });
        
        return { success: true, data: serializableData };
        
    } catch(e: any) {
        console.error("Error getting documents for period: ", e);
        return { success: false, error: e.message || 'Unknown error in getAllDataForPeriod', data: [] };
    }
}


export interface WeightDataPoint {
    entryDate: Date;
    weight: number;
    date: string;
}

export async function getWeightData(userId: string) {
    if (!userId) return { success: true, data: [] };
    
    try {
        const collectionPath = `clients/${userId}/measurements`;
        const q = adminDb.collection(collectionPath).orderBy('entryDate', 'asc');
        
        const querySnapshot = await q.get();
        const data = querySnapshot.docs
            .map(doc => {
                const docData = doc.data();
                // This is the fix: only process docs that have a valid, non-zero weight.
                if (docData.weight === undefined || docData.weight === null || Number(docData.weight) <= 0) {
                    return null;
                }
                return {
                    entryDate: docData.entryDate,
                    weight: Number(docData.weight),
                }
            })
            .filter((d): d is { entryDate: Timestamp; weight: number } => d !== null);

         const serializableData = data.map(d => ({
            ...d,
            entryDate: d.entryDate.toDate()
        }));
        
        return { success: true, data: serializableData };
    } catch (e: any) {
        console.error("Error getting weight data: ", e);
        return { success: false, error: e, data: [] };
    }
}


export interface WthrDataPoint {
    entryDate: Date;
    wthr: number;
    date: string;
}

export async function getWthrData(userId: string) {
    if (!userId) return { success: true, data: [] };
    
    try {
        const collectionPath = `clients/${userId}/measurements`;
        const q = adminDb.collection(collectionPath).orderBy('entryDate', 'asc');
        
        const querySnapshot = await q.get();
        const data = querySnapshot.docs
            .map(doc => {
                const docData = doc.data();
                if (docData.wthr === undefined || docData.wthr === null) return null;
                return {
                    entryDate: docData.entryDate,
                    wthr: Number(docData.wthr),
                }
            })
            .filter((d): d is { entryDate: Timestamp; wthr: number } => d !== null && !isNaN(d.wthr));

         const serializableData = data.map(d => ({
            ...d,
            entryDate: d.entryDate.toDate()
        }));
        
        return { success: true, data: serializableData };
    } catch (e: any) {
        console.error("Error getting WtHR data: ", e);
        return { success: false, error: e, data: [] };
    }
}


export interface Chat {
    id: string;
    name: string;
    description: string;
    type: 'coaching' | 'challenge' | 'open' | 'private_group';
    participants: string[];
    participantCount: number;
    createdAt?: Timestamp;
    lastClientMessage?: Timestamp;
    lastCoachMessage?: Timestamp;
    lastAutomatedMessage?: Timestamp;
    thumbnailUrl?: string;
    rules?: string[];
    ownerId?: string;
    lastMessage?: Timestamp;
}

export interface Challenge {
    id: string;
    name: string;
    description: string;
    dates: { from: Timestamp, to: Timestamp };
    maxParticipants: number;
    trackables: any[];
    thumbnailUrl: string;
    participants: string[];
    participantCount: number;
    points?: { [key: string]: number };
    streaks?: { [key: string]: { lastLog: Timestamp, count: number } };
    notes?: string;
    type: 'challenge';
    createdAt?: Timestamp;
    scheduledPillars?: {
        pillarId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
        notes?: string;
    }[];
    scheduledHabits?: {
        habitId: string;
        days: string[];
        recurrenceType: 'weekly' | 'custom';
        recurrenceInterval?: number;
    }[];
    customTasks?: {
        description: string;
        startDay: number;
        unit: 'reps' | 'seconds' | 'minutes';
        goalType: 'static' | 'progressive' | 'user-records';
        goal?: number;
        startingGoal?: number;
        increaseBy?: number;
        increaseEvery?: 'week' | '2-weeks' | 'month';
        notes?: string;
    }[];
    progress?: {
        [userId: string]: {
            [date: string]: { // format: yyyy-MM-dd
                [taskDescription: string]: boolean | number;
            }
        }
    }
}


export async function getChallenges() {
    try {
        const q = adminDb.collection("challenges").orderBy("dates.from", "desc");
        const querySnapshot = await q.get();
        const challenges = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Challenge));
        return { success: true, data: challenges };
    } catch (error) {
        console.error("Fetching challenges: ", error);
        return { success: false, error, data: [] };
    }
}

export async function joinChallenge(challengeId: string, userId: string) {
    const challengeRef = adminDb.collection('challenges').doc(challengeId);
    const chatRef = adminDb.collection('chats').doc(challengeId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);
    const clientRef = adminDb.collection('clients').doc(userId);

    try {
        await adminDb.runTransaction(async (transaction) => {
            const challengeDoc = await transaction.get(challengeRef);
            if (!challengeDoc.exists) throw "Challenge does not exist!";

            const clientDoc = await transaction.get(clientRef);
            const userName = clientDoc.exists ? clientDoc.data()?.fullName : 'A new user';
            
            const messagesCollectionRef = adminDb.collection(`chats/${challengeId}/messages`);

            transaction.update(challengeRef, {
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1),
            });
             transaction.update(chatRef, {
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1),
            });

            transaction.update(userProfileRef, {
                chatIds: FieldValue.arrayUnion(challengeId),
            });

            transaction.set(messagesCollectionRef.doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has joined the challenge!`,
                timestamp: FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error joining challenge: ", error);
        return { success: false, error: error.message };
    }
}


export async function joinChat(chatId: string, userId: string) {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        const userProfileSnap = await userProfileRef.get();
        if (!userProfileSnap.exists) {
            throw new Error("User profile not found.");
        }
        const userName = userProfileSnap.data()?.fullName || 'A new user';
        
        await adminDb.runTransaction(async (transaction) => {
            transaction.update(chatRef, {
                participants: FieldValue.arrayUnion(userId),
                participantCount: FieldValue.increment(1),
            });
            transaction.update(userProfileRef, {
                chatIds: FieldValue.arrayUnion(chatId),
            });
             transaction.set(chatRef.collection('messages').doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has joined the chat!`,
                timestamp: FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });
        return { success: true };
    } catch(error: any) {
         console.error("Error joining chat: ", error);
        return { success: false, error: error.message };
    }
}

export async function leaveChatAction(chatId: string, userId: string): Promise<{ success: boolean, error?: string }> {
    const chatRef = adminDb.collection('chats').doc(chatId);
    const userProfileRef = adminDb.collection('userProfiles').doc(userId);

    try {
        const userProfileSnap = await userProfileRef.get();
        if (!userProfileSnap.exists) {
            throw new Error("User profile not found.");
        }
        const userName = userProfileSnap.data()?.fullName || 'A user';

        await adminDb.runTransaction(async (transaction) => {
            transaction.update(chatRef, {
                participants: FieldValue.arrayRemove(userId),
                participantCount: FieldValue.increment(-1),
            });
            transaction.update(userProfileRef, {
                chatIds: FieldValue.arrayRemove(chatId),
            });
            transaction.set(chatRef.collection('messages').doc(), {
                userId: 'system',
                userName: 'System',
                text: `${userName} has left the chat.`,
                timestamp: FieldValue.serverTimestamp(),
                isSystemMessage: true,
            });
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error leaving chat: ", error);
        return { success: false, error: error.message || "An unknown error occurred while leaving the chat." };
    }
}


export interface ChatMessage {
    id: string;
    text: string;
    userId: string;
    userName: string;
    timestamp: Timestamp;
    isSystemMessage?: boolean;
    fileUrl?: string;
    fileName?: string;
}

export async function getUserChats(userId: string): Promise<{ success: boolean; data?: Chat[]; error?: any; }> {
    try {
        const userProfileRef = adminDb.collection('userProfiles').doc(userId);
        const userProfileSnap = await userProfileRef.get();

        if (!userProfileSnap.exists) {
             return { success: true, data: [] };
        }
       
        const userProfileData = userProfileSnap.data() as UserProfile;
        const chatIds = userProfileData.chatIds || [];

        if (chatIds.length === 0) {
            return { success: true, data: [] };
        }
        
        const allData: Chat[] = [];
        const MAX_IDS_PER_QUERY = 30;
        
        for (let i = 0; i < chatIds.length; i += MAX_IDS_PER_QUERY) {
            const chunk = chatIds.slice(i, i + MAX_IDS_PER_QUERY);
            if(chunk.length > 0) {
                const q = adminDb.collection('chats').where(FieldPath.documentId(), 'in', chunk);
                const snapshot = await q.get();
                snapshot.forEach(docSnap => {
                    allData.push({ id: docSnap.id, ...docSnap.data() } as Chat);
                });
            }
        }
        
        allData.sort((a, b) => {
            const dateA = a.lastClientMessage || a.createdAt;
            const dateB = b.lastClientMessage || b.createdAt;
            if (dateA && dateB) {
                return (dateB as Timestamp).toMillis() - (dateA as Timestamp).toMillis();
            }
            return 0;
        });

        const serializableData = allData.map(chat => {
            const newChat = {...chat};
             for(const key in newChat) {
                if (newChat[key] instanceof Timestamp) {
                    newChat[key] = newChat[key].toDate().toISOString();
                }
            }
            return newChat;
        });

        return { success: true, data: serializableData as any[] };
    } catch (error: any) {
        console.error("Error fetching user's chats: ", error);
        return { success: false, error: new Error(error.message || "An unknown error occurred") };
    }
}

export interface HabitHighlights {
    averageCalories: number | null;
    averageActivity: number | null;
    averageSleep: number | null;
    averageHydration: number | null;
    averageUpfScore: number | null;
    cravingsLogged: number;
    bingesLogged: number;
    stressEventsLogged: number;
}


export async function getHabitHighlights(userId: string, periodInDays: number): Promise<{ success: boolean; data?: HabitHighlights; error?: any; }> {
    try {
        const result = await getAllDataForPeriod(periodInDays, userId);
        if (!result.success) {
            return { success: false, error: result.error || 'Failed to fetch data' };
        }
        const entries = result.data;
        
        const dailyData: Record<string, {
            calories: number,
            hydration: number,
            sleep: number,
            activity: number,
            upfScore: number,
            upfMeals: number,
        }> = {};

        // Initialize daily data
        for (let i = 0; i < periodInDays; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dailyData[dateStr] = { calories: 0, hydration: 0, sleep: 0, activity: 0, upfScore: 0, upfMeals: 0 };
        }

        let cravingsLogged = 0;
        let bingesLogged = 0;
        let stressEventsLogged = 0;

        for (const entry of entries) {
            const entryDate = new Date(entry.entryDate || entry.wakeUpDay);
            const dateStr = entryDate.toISOString().split('T')[0];
            
            if (!dailyData[dateStr]) continue;

            if (entry.pillar === 'nutrition') {
                if (entry.summary?.allNutrients?.Energy?.value) {
                    dailyData[dateStr].calories += entry.summary.allNutrients.Energy.value;
                }
                if (entry.summary?.upf) {
                    dailyData[dateStr].upfScore += entry.summary.upf.score;
                    dailyData[dateStr].upfMeals++;
                }
            } else if (entry.pillar === 'hydration') {
                dailyData[dateStr].hydration += entry.amount || 0;
            } else if (entry.pillar === 'activity') {
                dailyData[dateStr].activity += entry.duration || 0;
            } else if (entry.pillar === 'sleep' && !entry.isNap) {
                dailyData[dateStr].sleep = entry.duration || 0;
            } else if (entry.pillar === 'cravings') {
                if (entry.type === 'craving') cravingsLogged++;
                if (entry.type === 'binge') bingesLogged++;
            } else if (entry.pillar === 'stress' && entry.type === 'event') {
                 stressEventsLogged++;
            }
        }
        
        const daysWithCalories = Object.values(dailyData).filter(d => d.calories > 0);
        const daysWithSleep = Object.values(dailyData).filter(d => d.sleep > 0);
        const daysWithHydration = Object.values(dailyData).filter(d => d.hydration > 0);
        const totalUpfMeals = Object.values(dailyData).reduce((acc, d) => acc + d.upfMeals, 0);

        const highlights: HabitHighlights = {
            averageCalories: daysWithCalories.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.calories, 0) / daysWithCalories.length : null,
            averageActivity: Object.values(dailyData).reduce((acc, d) => acc + d.activity, 0) / periodInDays,
            averageSleep: daysWithSleep.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.sleep, 0) / daysWithSleep.length : null,
            averageHydration: daysWithHydration.length > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.hydration, 0) / daysWithHydration.length : null,
            averageUpfScore: totalUpfMeals > 0 ? Object.values(dailyData).reduce((acc, d) => acc + d.upfScore, 0) / totalUpfMeals : null,
            cravingsLogged,
            bingesLogged,
            stressEventsLogged,
        };

        return { success: true, data: highlights };

    } catch (error: any) {
        console.error(`Error in getHabitHighlights for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches all upcoming indulgence plans for a specific user.
 */
export async function getUpcomingIndulgences(userId: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!userId) {
        return { success: false, error: "User ID is required." };
    }
    try {
        const now = Timestamp.now();
        // This now correctly points to the new, nested planner collection
        const q = adminDb.collection(`clients/${userId}/planner`)
            // It correctly uses entryDate, not the old indulgenceDate
            .where('entryDate', '>=', now)
            .orderBy('entryDate', 'asc');

        const snapshot = await q.get();
        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const plans = snapshot.docs.map(doc => {
            const data = doc.data();
            // Serialize timestamps to ISO strings for the client
            const serializableData: { [key: string]: any } = { id: doc.id };
            for (const key in data) {
                // Handle Timestamps correctly
                if (data[key] && typeof data[key].toDate === 'function') {
                    serializableData[key] = data[key].toDate().toISOString();
                } else {
                    serializableData[key] = data[key];
                }
            }
            return serializableData;
        });

        return { success: true, data: plans };
    } catch (error: any) {
        console.error("Error fetching upcoming indulgences:", error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches and analyzes stress and hunger data from the last 24 hours
 * to provide a single, actionable "spotlight" insight.
 */

/**
 * Saves or updates a food item in the user's "recent foods" list.
 * Uses the fdcId as the document ID to automatically handle duplicates.
 * Updates the lastViewed timestamp each time a food is saved.
 */
export async function saveRecentFood(userId: string, food: RecentFood): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) throw new Error("User ID is required.");
        if (!food || !food.fdcId) throw new Error("Valid food object with fdcId is required.");

        const recentFoodRef = adminDb.collection(`clients/${userId}/userRecentFoods`).doc(food.fdcId.toString());

        await recentFoodRef.set({
            ...food,
            lastViewed: FieldValue.serverTimestamp(), // Always update the last viewed time
            uid: userId,
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error(`Error saving recent food for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches a user's recent foods, ordered by when they were last viewed.
 */
export async function getRecentFoods(userId: string): Promise<{ success: boolean; data?: RecentFood[]; error?: string }> {
    try {
        if (!userId) throw new Error("User ID is required.");

        const recentFoodsCollection = adminDb.collection(`clients/${userId}/userRecentFoods`).orderBy('lastViewed', 'desc').limit(50);
        const snapshot = await recentFoodsCollection.get();

        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const foods = snapshot.docs.map(doc => {
            const data = doc.data();
            const newEntry: { [key: string]: any } = { ...data };
            for(const key in newEntry) {
                if (newEntry[key] && typeof newEntry[key].toDate === 'function') {
                    newEntry[key] = newEntry[key].toDate().toISOString();
                }
            }
            return newEntry as RecentFood;
        });
        

        return { success: true, data: foods };
    } catch (error: any) {
        console.error(`Error fetching recent foods for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggles the favorite status of a food item.
 */
export async function updateFoodAsFavorite(userId: string, fdcId: number, isFavorite: boolean): Promise<{ success: boolean; error?: string }> {
    try {
        if (!userId) throw new Error("User ID is required.");
        if (!fdcId) throw new Error("Food FDC ID is required.");

        const foodRef = adminDb.collection(`clients/${userId}/userRecentFoods`).doc(fdcId.toString());

        await foodRef.update({ isFavorite: isFavorite });

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating favorite status for food ${fdcId} for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Saves a new meal to the user's saved meals collection.
 */
/**
 * Saves a new meal to the user's saved meals collection.
 */
export async function saveUserMeal(userId: string, mealName: string, items: MealItem[]): Promise<{ success: boolean; mealId?: string; error?: string }> {
    try {
        if (!userId) throw new Error("User ID is required.");
        if (!mealName) throw new Error("Meal name is required.");
        if (!items || items.length === 0) throw new Error("Meal must contain at least one item.");

        const newMealRef = adminDb.collection(`clients/${userId}/userSavedMeals`).doc();

        const totalCalories = items.reduce((acc, item) => acc + item.calories, 0);

        const mealData: Omit<SavedMeal, 'id'> = {
            name: mealName,
            items: items,
            totalCalories: totalCalories,
            createdAt: FieldValue.serverTimestamp(),
            uid: userId,
        };

        await newMealRef.set(mealData);

        return { success: true, mealId: newMealRef.id };
    } catch (error: any) {
        console.error(`Error saving meal for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}


/**
 * Fetches all saved meals for a given user.
 */
export async function getUserMeals(userId: string): Promise<{ success: boolean; data?: SavedMeal[]; error?: string }> {
    try {
        if (!userId) throw new Error("User ID is required.");

        const mealsCollection = adminDb.collection(`clients/${userId}/userSavedMeals`).orderBy('createdAt', 'desc');
        const snapshot = await mealsCollection.get();

        if (snapshot.empty) {
            return { success: true, data: [] };
        }

        const meals = snapshot.docs.map(doc => {
            const data = doc.data();
            const newEntry: { [key: string]: any } = { id: doc.id, ...data };
            for(const key in newEntry) {
                if (newEntry[key] && typeof newEntry[key].toDate === 'function') {
                    newEntry[key] = newEntry[key].toDate().toISOString();
                }
            }
            return newEntry as SavedMeal;
        });
        

        return { success: true, data: meals };
    } catch (error: any) {
        console.error(`Error fetching user meals for user ${userId}:`, error);
        return { success: false, error: error.message };
    }
}