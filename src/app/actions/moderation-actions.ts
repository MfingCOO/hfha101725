 'use server';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { COACH_UIDS } from '@/lib/coaches';
import { z } from 'zod';
import { Timestamp, FieldPath } from 'firebase-admin/firestore';

// Helper function to verify if the user is a coach
async function verifyCoach(coachId: string) {
    if (!COACH_UIDS.includes(coachId)) {
        throw new Error("User is not authorized to perform this action.");
    }
}

const ReportSchema = z.object({
    id: z.string(),
    messageId: z.string(),
    chatId: z.string(),
    chatName: z.string().optional(),
    messageContent: z.string(),
    reportedUserId: z.string(),
    reportedUserName: z.string().optional(),
    reportingUserId: z.string(),
    reportingUserName: z.string().optional(),
    timestamp: z.string(), // Timestamps will be serialized to ISO strings
    status: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

// Gets all pending reports for the modal, now with enriched data
export async function getPendingReportsAction(coachId: string): Promise<{ success: boolean; data?: Report[]; error?: string }> {
    try {
        await verifyCoach(coachId);
        const reportsSnapshot = await adminDb.collection('reports').where('status', '==', 'pending').get();
        
        if (reportsSnapshot.empty) {
            return { success: true, data: [] };
        }

        const userIds = new Set<string>();
        const chatIds = new Set<string>();
        reportsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            userIds.add(data.reportedUserId);
            userIds.add(data.reportingUserId);
            chatIds.add(data.chatId);
        });

        // SURGICAL CHANGE: Query 'clients' collection instead of 'userProfiles'.
        const clientData: { [key: string]: string } = {};
        if (userIds.size > 0) {
            const usersSnapshot = await adminDb.collection('clients').where('uid', 'in', Array.from(userIds)).get();
            usersSnapshot.forEach(doc => {
                clientData[doc.id] = doc.data().fullName || 'Unknown User';
            });
        }

        const chatNames: { [key: string]: string } = {};
        if (chatIds.size > 0) {
            const chatDocs = await adminDb.collection('chats').where(FieldPath.documentId(), 'in', Array.from(chatIds)).get();
            chatDocs.forEach(doc => {
                chatNames[doc.id] = doc.data().name || 'Unknown Chat';
            });
        }
        
        let reports = reportsSnapshot.docs.map(doc => {
            const reportData = doc.data();
            const timestamp = (reportData.timestamp as Timestamp).toDate().toISOString();
            
            // SURGICAL CHANGE: Use the new clientData variable.
            return ReportSchema.parse({
                id: doc.id,
                ...reportData,
                timestamp: timestamp,
                reportedUserName: clientData[reportData.reportedUserId],
                reportingUserName: clientData[reportData.reportingUserId],
                chatName: chatNames[reportData.chatId],
            });
        });

        reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return { success: true, data: reports };
    } catch (error: any) {
        console.error("Error in getPendingReportsAction: ", error);
        if (error instanceof z.ZodError) {
            return { success: false, error: "Data validation failed: " + error.message };
        }
        return { success: false, error: error.message };
    }
}


// Gets the count of pending reports
export async function getPendingReportsCountAction(coachId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        await verifyCoach(coachId);
        const reportsSnapshot = await adminDb.collection('reports').where('status', '==', 'pending').count().get();
        const count = reportsSnapshot.data().count;
        return { success: true, count };
    } catch (error: any) {
        console.error("Error in getPendingReportsCountAction: ", error);
        return { success: false, error: error.message };
    }
}

// Action to dismiss a report
export async function dismissReportAction(coachId: string, reportId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await verifyCoach(coachId);
        await adminDb.collection('reports').doc(reportId).update({ status: 'dismissed' });
        return { success: true };
    } catch (error: any) {
        console.error("Error in dismissReportAction: ", error);
        return { success: false, error: error.message };
    }
}

// Action to delete a message and resolve the report
export async function deleteMessageAndResolveReportAction(coachId: string, reportId: string, chatId: string, messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await verifyCoach(coachId);
        const batch = adminDb.batch();
        const reportRef = adminDb.collection('reports').doc(reportId);
        const messageRef = adminDb.collection('chats').doc(chatId).collection('messages').doc(messageId);
        
        batch.delete(messageRef);
        batch.update(reportRef, { status: 'resolved' });
        
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Error in deleteMessageAndResolveReportAction: ", error);
        return { success: false, error: error.message };
    }
}

// Action to ban a user and resolve the report
export async function banUserAndResolveReportAction(coachId: string, reportId: string, userIdToBan: string): Promise<{ success: boolean; error?: string }> {
    try {
        await verifyCoach(coachId);
        const batch = adminDb.batch();
        const reportRef = adminDb.collection('reports').doc(reportId);
        // SURGICAL CHANGE: Reference the 'clients' collection.
        const clientRef = adminDb.collection('clients').doc(userIdToBan);

        // SURGICAL CHANGE: Use the new clientRef variable.
        batch.update(clientRef, { isBannedFromChat: true });
        batch.update(reportRef, { status: 'resolved' });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Error in banUserAndResolveReportAction: ", error);
        return { success: false, error: error.message };
    }
}
