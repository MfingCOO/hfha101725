'use server';

import { db } from '@/lib/firebaseAdmin';

/**
 * Performs a vector search on the 'library_index' collection using the 
 * Firebase Vector Search extension.
 *
 * @param queryVector The embedding vector to search for.
 * @param limit The maximum number of similar documents to return.
 * @returns A promise that resolves to an array of the most relevant text chunks.
 */
export async function findSimilarKnowledge(
  queryVector: number[],
  limit: number = 3
): Promise<string[]> {
  try {
    // This performs an optimized, approximate nearest neighbor search using the 
    // pre-built index from the Firebase Vector Search extension.
    // It's dramatically more efficient than fetching all documents.
    const neighbors = await (db.collection('library_index') as any).findNeighbors(
      'embedding',
      queryVector,
      {
        limit: limit,
        distanceMeasure: 'COSINE',
      }
    );

    const relevantChunks = neighbors.map((neighbor) => {
      // We are extracting just the 'textChunk' from each of the neighboring documents.
      return neighbor.document.data().textChunk as string;
    });
    
    return relevantChunks;

  } catch (error) {
    // If the vector search fails, log the error and return an empty array.
    // This makes the function resilient and prevents it from crashing the parent flow.
    console.error(
      '[Vector Search Service] The vector search query failed. This might be due to the Firebase Vector Search extension not being configured correctly or a transient issue.',
      {
        error: error instanceof Error ? { name: error.name, message: error.message } : error,
      }
    );
    return []; // Gracefully fail.
  }
}
