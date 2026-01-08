import { collection, query, where, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InAppMessage } from '@/contexts/NotificationContext';

// Defines how to query and transform different types of pop-ups
interface PopupConfig {
  // Transforms a Firestore doc into a standardized InAppMessage
  mapFn: (doc: any) => InAppMessage;
  // Defines the action to take when a message is dismissed
  dismiss: (userId: string, messageId: string) => Promise<void>;
}

// The scalable registry for all pop-up types
export const POPUP_CONFIG: Record<string, PopupConfig> = {
  coach_popup: {
    mapFn: (doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        type: 'coach_popup',
        title: data.title || 'A Message from Your Coach',
        message: data.message || '',
        imageUrl: data.imageUrl,
        ctaUrl: data.ctaUrl,
        ctaText: data.ctaText,
        scheduledAt: data.scheduledAt || Timestamp.now(), // Ensure scheduledAt is present
      };
    },
    dismiss: async (userId, messageId) => {
        // This dismiss logic is now specific to marking the original notification document
        const docRef = doc(db, 'user_notifications', messageId);
        try {
            await updateDoc(docRef, { status: 'dismissed' });
        } catch (error) {
            console.error("Failed to update notification status to dismissed:", error);
        }
    },
  },
  // Future pop-ups like 'workout_reminder' or 'challenge_milestone' will be added here
};
