'use server';

import { auth, db as adminDb } from '@/lib/firebaseAdmin';
import { COACH_UIDS } from '@/lib/coaches';
import { FieldValue } from 'firebase-admin/firestore';
import type { ClientProfile } from '@/types';

/**
 * This is the action that will be triggered upon a coaching client's first login.
 * It creates their private coaching chat and sends the initial welcome message.
 */
export async function createCoachingChatOnFirstLogin(user: ClientProfile): Promise<{ success: boolean; error?: string; }> {
    // 1. Double-check this is a coaching client who has never had this action run before.
    // We check for `hasLoggedInBefore` being false (for coach-created clients) OR
    // undefined (for Stripe-created clients).
    if (user.tier !== 'coaching' || user.hasLoggedInBefore === true) {
        return { success: true }; // Not applicable or already run, so we exit gracefully.
    }

    const batch = adminDb.batch();
    const userRef = adminDb.collection('userProfiles').doc(user.uid);
    const chatRef = adminDb.collection('chats').doc(); // Create a new chat document reference

    try {
        // 2. Define the chat participants: The client, plus the two head coaches.
        const alanUID = 'yue7fVPBQZg45vmfXXUH5PdG7jE2'; // Alan Roberts
        const crystalUID = 'oYsf7Iah6hVlEgHvWJ7Ms7j1oTB2'; // Crystal Roberts
        const participants = [user.uid, alanUID, crystalUID];

        // 3. Create the chat document.
        batch.set(chatRef, {
            name: `${user.fullName} Coaching`,
            type: 'coaching',
            participants: participants,
            participantCount: participants.length,
            ownerId: alanUID, // Designate Alan as the owner
            createdAt: FieldValue.serverTimestamp(),
        });

        // 4. Create the welcome message from Alan.
        const welcomeMessageRef = chatRef.collection('messages').doc();
        const userFirstName = user.fullName.split(' ')[0];
        const welcomeText = `Hi ${userFirstName} and welcome to coaching. This is your private coaching chat with just the two of us and yourself. We are excited to work with you. Can you tell us a bit about yourself, what brings you to coaching, and what you hope to accomplish through it? To make your video conference appointment you can go to the "Book a Call" button and choose either of us to book a call with and the available times each day.`;

        batch.set(welcomeMessageRef, {
            userId: alanUID,
            userName: 'Alan Roberts',
            timestamp: FieldValue.serverTimestamp(),
            text: welcomeText,
            isSystemMessage: false,
        });

        // 5. Update the chat's last message for UI purposes.
        batch.update(chatRef, {
            lastMessage: welcomeText,
            lastMessageSenderId: alanUID,
            lastCoachMessage: FieldValue.serverTimestamp(),
        });
        
        // 6. Mark the user so this doesn't run again and add the new chat ID to their profile.
        batch.update(userRef, {
            hasLoggedInBefore: true,
            chatIds: FieldValue.arrayUnion(chatRef.id)
        });

        // 7. Commit all the changes to the database at once.
        await batch.commit();

        return { success: true };

    } catch (error: any) {
        console.error('Error in createCoachingChatOnFirstLogin:', error);
        return { success: false, error: error.message };
    }
}