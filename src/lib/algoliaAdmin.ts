import * as AlgoliaSearch from 'algoliasearch';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const adminKey = process.env.ALGOLIA_ADMIN_API_KEY;

if (!appId || !adminKey) {
  throw new Error('Algolia App ID and Admin API Key must be configured in environment variables.');
}

// Initialize and export the Algolia admin client.
// The v5+ API pattern calls methods directly on this client.
const algoliaAdmin = AlgoliaSearch.algoliasearch(appId, adminKey);

export { algoliaAdmin };
