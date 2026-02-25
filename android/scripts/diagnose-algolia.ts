import dotenv from 'dotenv';

/**
 * A diagnostic script to verify the connection and authentication 
 * with the Algolia service.
 */
async function diagnoseAlgoliaConnection() {
  // First, load environment variables from .env.local.
  // This MUST be done before importing any module that relies on them.
  dotenv.config({ path: '.env.local' });

  console.log('Running Algolia Diagnostics...');

  try {
    // Dynamically import the Algolia admin module AFTER loading env vars.
    // This avoids the ES module hoisting issue where imports are processed
    // before the rest of the code is executed.
    const { foodCacheIndex } = await import('../src/lib/algoliaAdmin');

    console.log(`Attempting to fetch settings for index: '${foodCacheIndex.indexName}'...`);

    const settings = await foodCacheIndex.getSettings();

    console.log('\x1b[32m%s\x1b[0m', '✅ SUCCESS: Connection to Algolia is working.');
    console.log('   - Algolia App ID is valid.');
    console.log('   - Algolia Admin API Key is valid and has permissions.');
    console.log('   - Successfully connected to the index.');
    console.log('\nIndex Settings:');
    console.log(JSON.stringify(settings, null, 2));

  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '❌ FAILURE: Could not connect to Algolia.');
    console.error('The environment variables were loaded, but the connection still failed.');
    console.error('Please check the following:');
    console.error('   1. Verify the VALUES of NEXT_PUBLIC_ALGOLIA_APP_ID and ALGOLIA_ADMIN_API_KEY in your .env.local file are correct.');
    console.error('   2. Ensure the Admin API Key has the necessary permissions (e.g., getSettings) on the Algolia dashboard.');
    console.error('   3. Check for any network issues that might be blocking the connection to *.algolia.net.');
    console.error('\nFull Error:');
    console.error(error);
    process.exit(1); // Exit with a failure code
  }
}

diagnoseAlgoliaConnection();
