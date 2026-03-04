import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebaseAdmin';
import { enrichFoodDetailsFlow } from '@/ai/flows/nutrition/enrich-food-details-flow';
import { getSiteSettingsAction } from '@/app/coach/site-settings/actions';

/**
 * Fixes the "Only plain objects" error by converting 
 * Firestore Timestamps into plain numbers.
 */
function makePlain(data: any): any {
  return JSON.parse(JSON.stringify(data, (key, value) => {
    if (value && typeof value === 'object' && value._seconds !== undefined) {
      return (value._seconds * 1000) + (value._nanoseconds / 1000000);
    }
    return value;
  }));
}

export async function POST(req: NextRequest) {
  try {
    const { fdcId } = await req.json();
    if (!fdcId) return NextResponse.json({ error: 'Missing fdcId' }, { status: 400 });

    // 1. Check Cache
    const cachedDoc = await db.collection('foodCache').doc(String(fdcId)).get();
    if (cachedDoc.exists) {
      console.log(`[Cache Hit] Returning cached data for ${fdcId}`);
      // The makePlain() call is the critical fix here
      return NextResponse.json(makePlain(cachedDoc.data()));
    }

    // 2. Fetch from USDA
    const apiKey = process.env.USDA_API_KEY;
    const usdaRes = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
    if (!usdaRes.ok) throw new Error('USDA API failure');
    const foodData = await usdaRes.json();

    // 3. Get Model & Run AI
    const settings = await getSiteSettingsAction();
    const model = settings.data?.aiModelSettings?.flash || 'gemini-1.5-flash';

    const enrichedData = await enrichFoodDetailsFlow({
      description: foodData.description,
      ingredients: foodData.ingredients || '',
      modelName: model
    });

    // 4. Save to Cache
    const finalData = {
      ...enrichedData,
      fdcId,
      updatedAt: new Date(),
    };
    await db.collection('foodCache').doc(String(fdcId)).set(finalData);

    return NextResponse.json(makePlain(finalData));

  } catch (error: any) {
    console.error('[Details API Error]:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}