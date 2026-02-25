
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
// Correctly importing the data OBJECT from your library file.
import { educationalContentLibrary } from '@/lib/educational-content';

// Using Application Default Credentials. No service account file is needed.
if (!getApps().length) {
    initializeApp();
}

const db = getFirestore();

const seedDatabase = async () => {
    const libraryCollection = db.collection('library');
    console.log('Starting to seed library collection...');

    const snapshot = await libraryCollection.limit(1).get();
    if (!snapshot.empty) {
        console.log('Library collection already contains data. Seeding skipped.');
        return;
    }

    const batch = db.batch();

    // Convert the imported object into an array of its values to loop over.
    const contentArray = Object.values(educationalContentLibrary);

    contentArray.forEach((content) => {
        // Use the 'id' field from your data as the unique document ID in Firestore.
        const docRef = libraryCollection.doc(content.id);
        batch.set(docRef, {
            title: content.title,
            // Combine what, how, and why into a single 'text' field for efficient indexing.
            text: `What it is: ${content.what}\n\nHow to do it: ${content.how}\n\nWhy it matters: ${content.why}`,
            requiredTier: content.requiredTier
        });
    });

    await batch.commit();
    console.log(`Successfully seeded ${contentArray.length} documents into the library collection.`);
};

seedDatabase().then(() => {
    console.log('Seeding process finished.');
}).catch((error) => {
    console.error('Error seeding database:', error);
});
