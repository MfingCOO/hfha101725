import dotenv from 'dotenv';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

async function populateAlgoliaIndex() {
  // Load environment variables FIRST
  dotenv.config({ path: '.env.local' });

  console.log('Starting to populate Algolia index...');

  try {
    // Initialize Firebase Admin using Application Default Credentials
    initializeApp();
    console.log('[Firebase Admin] Initialization successful.');
    const db = getFirestore();

    // Dynamically import the Algolia admin module AFTER loading env vars.
    const { algoliaAdmin } = await import('../src/lib/algoliaAdmin');

    // Fetch data from Firestore
    const foodCacheSnapshot = await db.collection('global-food-cache').get();
    const foodCacheData = foodCacheSnapshot.docs.map(doc => ({
      objectID: doc.id,
      ...doc.data(),
    }));

    // Save data to Algolia using the v5+ API pattern
    if (foodCacheData.length > 0) {
        await algoliaAdmin.saveObjects({
          indexName: 'food_cache',
          objects: foodCacheData,
        });
    }

    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESS: Algolia index populated successfully.');
    console.log(`   - Processed ${foodCacheData.length} records from 'global-food-cache'.`);

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ FAILURE: Could not populate Algolia index.');
    console.error('Please check your .env.local file and Firestore/Algolia permissions.');
    console.error(error);
    process.exit(1);
  }
}

populateAlgoliaIndex();
