import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function populateAlgoliaIndex() {
  dotenv.config({ path: '.env.local' });

  console.log('Starting to populate Algolia index...');

  try {
    // FIX: Pass the service account key
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in .env.local");
    
    const serviceAccount = JSON.parse(serviceAccountKey);
    initializeApp({
      credential: cert(serviceAccount),
    });

    console.log('[Firebase Admin] Initialization successful.');
    const db = getFirestore();

    const { algoliaAdmin } = await import('../src/lib/algoliaAdmin');

    // DOUBLE CHECK: Is your collection name correct?
    const collectionName = 'global-food-cache'; 
    const foodCacheSnapshot = await db.collection(collectionName).get();
    
    console.log(`Found ${foodCacheSnapshot.size} documents in Firestore...`);

    const foodCacheData = foodCacheSnapshot.docs.map(doc => ({
      objectID: doc.id,
      ...doc.data(),
    }));

    if (foodCacheData.length > 0) {
        // v5 API Pattern
        await algoliaAdmin.saveObjects({
          indexName: 'food_cache',
          objects: foodCacheData,
        });
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESS: Algolia index populated successfully.');
    console.log(`   - Processed ${foodCacheData.length} records.`);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ FAILURE: Could not populate Algolia index.');
    console.error(error);
    process.exit(1);
  }
}

populateAlgoliaIndex();