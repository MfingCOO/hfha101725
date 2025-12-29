
import { NextResponse } from 'next/server';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { EnrichedFood } from '@/types';

export const dynamic = 'force-dynamic';

interface UsdaFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  brandName?: string;
  ingredients?: string;
  dataType?: string;
}

interface UsdaApiResponse {
  foods: UsdaFoodItem[];
}

const BRAND_ALIASES: { [key: string]: string } = {
    'hardees': 'CKE Restaurants Holdings, Inc.',
    "hardee's": 'CKE Restaurants Holdings, Inc.',
    'carls jr': 'CKE Restaurants Holdings, Inc.',
    "carl's jr": 'CKE Restaurants Holdings, Inc.',
    "carlsjr": 'CKE Restaurants Holdings, Inc.',
    'arbys': 'Inspire Brands',
    "arby's": 'Inspire Brands',
    'mcdonalds': "McDonald's Corporation",
    "mcdonald's": "McDonald's Corporation",
    'mcd': "McDonald's Corporation",
    'mcds': "McDonald's Corporation",
    'starbucks': 'Starbucks Corporation',
    'starbuck': 'Starbucks Corporation',
    'subway': 'Subway (Roark Capital Group affiliate)',
    'chickfila': 'Chick-fil-A, Inc.',
    'chick fil a': 'Chick-fil-A, Inc.',
    "chick-fil-a": 'Chick-fil-A, Inc.',
    'cfa': 'Chick-fil-A, Inc.',
    'kfc': 'Yum! Brands',
    'kentucky fried chicken': 'Yum! Brands',
    'taco bell': 'Yum! Brands',
    'tacobell': 'Yum! Brands',
    'pizza hut': 'Yum! Brands',
    'pizzahut': 'Yum! Brands',
    'habit burger': 'Yum! Brands',
    'the habit': 'Yum! Brands',
    'habit burger grill': 'Yum! Brands',
    'dominos': "Domino's Pizza, Inc.",
    "domino's": "Domino's Pizza, Inc.",
    'domino': "Domino's Pizza, Inc.",
    'wendys': "The Wendy's Company",
    "wendy's": "The Wendy's Company",
    'burger king': 'Restaurant Brands International',
    'burgerking': 'Restaurant Brands International',
    'bk': 'Restaurant Brands International',
    'popeyes': 'Restaurant Brands International',
    'popeyes louisiana kitchen': 'Restaurant Brands International',
    'firehouse subs': 'Restaurant Brands International',
    'firehouse': 'Restaurant Brands International',
    'sonic': 'Inspire Brands',
    'sonic drive in': 'Inspire Brands',
    'sonicdrivein': 'Inspire Brands',
    'dunkin': 'Inspire Brands',
    'dunkin donuts': 'Inspire Brands',
    "dunkin'": 'Inspire Brands',
    'jimmy johns': 'Inspire Brands',
    "jimmy john's": 'Inspire Brands',
    'jimmyjohns': 'Inspire Brands',
    'buffalo wild wings': 'Inspire Brands',
    'bww': 'Inspire Brands',
    'baskin robbins': 'Inspire Brands',
    "baskin-robbins": 'Inspire Brands',
    'panda express': 'Panda Restaurant Group',
    'pandaexpress': 'Panda Restaurant Group',
    'chipotle': 'Chipotle Mexican Grill, Inc.',
    'chipotle mexican grill': 'Chipotle Mexican Grill, Inc.',
    "papa johns": "Papa John's International, Inc.",
    "papa john's": "Papa John's International, Inc.",
    'papajohns': "Papa John's International, Inc.",
    'dairy queen': 'Dairy Queen (International Dairy Queen, Inc. / Berkshire Hathaway)',
    'dq': 'Dairy Queen (International Dairy Queen, Inc. / Berkshire Hathaway)',
    'jack in the box': 'Jack in the Box Inc.',
    'jackinthebox': 'Jack in the Box Inc.',
    'del taco': 'Jack in the Box Inc.',
    'deltaco': 'Jack in the Box Inc.',
    'whataburger': 'Whataburger (BDT Capital Partners majority)',
    'five guys': 'Five Guys Enterprises, LLC',
    'fiveguys': 'Five Guys Enterprises, LLC',
    'wingstop': 'Wingstop Inc.',
    'in n out': 'In-N-Out Burgers',
    'innout': 'In-N-Out Burgers',
    "in-n-out": 'In-N-Out Burgers',
    'panera': 'Panera Bread (JAB Holding Company)',
    'panera bread': 'Panera Bread (JAB Holding Company)',
    'saint louis bread company': 'Panera Bread (JAB Holding Company)',
    'jersey mikes': "Jersey Mike's Subs",
    "jersey mike's": "Jersey Mike's Subs",
    'jerseymikes': "Jersey Mike's Subs",
    'raising canes': "Raising Cane's Chicken Fingers",
    "raising cane's": "Raising Cane's Chicken Fingers",
    'canes': "Raising Cane's Chicken Fingers",
    'culvers': "Culver's",
    "culver's": "Culver's",
    'shake shack': 'Shake Shack Inc.',
    'shakeshack': 'Shake Shack Inc.',
    'little caesars': 'Little Caesars Enterprises, Inc.',
    'littlecaesars': 'Little Caesars Enterprises, Inc.',
    'zaxbys': "Zaxby's",
    "zaxby's": "Zaxby's",
    'bojangles': "Bojangles",
    "bojangles'": "Bojangles",
    'qdoba': 'QDOBA Mexican Eats (Butterfly Equity)',
    'qdoba mexican eats': 'QDOBA Mexican Eats (Butterfly Equity)',
    'marcos pizza': "Marco's Pizza",
    "marco's pizza": "Marco's Pizza",
    'marcos': "Marco's Pizza",
    'popeyes chicken': 'Restaurant Brands International',
    'krispy kreme': 'Krispy Kreme Doughnuts, Inc. (JAB Holding)',
    'tim hortons': 'Restaurant Brands International',
    'tims': 'Restaurant Brands International',
    'white castle': 'White Castle',
    'cook out': 'Cook Out',
    'cookout': 'Cook Out',
    'el pollo loco': 'El Pollo Loco Holdings, Inc.',
    'checkers': 'Checkers Drive-In Restaurants, Inc.',
    'rallys': 'Checkers Drive-In Restaurants, Inc.',
    "rally's": 'Checkers Drive-In Restaurants, Inc.',
    "freddys": "Freddy's Frozen Custard & Steakburgers",
    "freddy's": "Freddy's Frozen Custard & Steakburgers",
    'steak n shake': "Steak 'n Shake",
    "steak 'n shake": "Steak 'n Shake",
    'krystal': 'Krystal Restaurants LLC',
    'biscuitville': 'Biscuitville',
    'dutch bros': 'Dutch Bros Coffee',
    'dutchbros': 'Dutch Bros Coffee',
    'cava': 'CAVA Group, Inc.',
    'runza': 'Runza Restaurants',
    'pollo tropical': 'Pollo Tropical (Fiesta Restaurant Group)',
    "zippy's": "Zippy's",
    'farm burger': 'Farm Burger',
    'gold star chili': 'Gold Star Chili',
    'skyline chili': 'Skyline Chili',
    'jollibee': 'Jollibee Foods Corporation',
    'cafe rio': 'Cafe Rio Mexican Grill',
    "moe's southwest grill": "Moe's Southwest Grill (Focus Brands)",
    'einstein bros bagels': 'Einstein Noah Restaurant Group',
};

function calculateRelevance(food: UsdaFoodItem, queryLower: string): number {
  const sanitize = (text: string) => text.toLowerCase().replace(/['.,]/g, '');
  const sanitizedDescription = sanitize(food.description);
  const sanitizedBrandOwner = sanitize(food.brandOwner || '').replace(/\s+(inc|llc|corp)$/, '');
  const sanitizedBrandName = sanitize(food.brandName || '');
  const sanitizedQuery = sanitize(queryLower);
  const queryTokens = sanitizedQuery.split(' ').filter(token => token.length > 0);

  let score = 0;

  const isBrandMatch = queryTokens.some(token => sanitizedBrandOwner.includes(token) || sanitizedBrandName.includes(token));
  if (isBrandMatch) {
    score += 10000;
  }

  const allTokensInDescription = queryTokens.every(token => sanitizedDescription.includes(token));
  if (allTokensInDescription) {
    score += 1000;
  }

  for (const token of queryTokens) {
    if (sanitizedDescription.includes(token)) {
      score += 100;
    }
  }

  if (sanitizedDescription.startsWith(sanitizedQuery)) {
    score += 500;
  }

  if (food.dataType === 'SR Legacy' || food.dataType === 'Foundation') {
    score -= 10;
  }

  score -= sanitizedDescription.length * 0.01;

  return score;
}

async function searchLocalCache(query: string) {
    if (query.length < 2) return [];
    const lowercasedQuery = query.toLowerCase();
    try {
        const snapshot = await adminDb.collection('global-food-cache')
            .where('searchableDescription', '>=', lowercasedQuery)
            .where('searchableDescription', '<=', lowercasedQuery + '\uf8ff')
            .limit(25)
            .get();

        if (snapshot.empty) return [];

        return snapshot.docs.map(doc => {
            const food = doc.data() as EnrichedFood;
            return {
                fdcId: food.fdcId,
                description: food.description,
                brandOwner: food.brandOwner || '',
                isCached: true,
                relevanceScore: 99999, // High score to boost to top
            };
        });
    } catch (error) {
        console.error('[API Search Route] Local cache search error:', error);
        return [];
    }
}

async function searchUSDA(query: string) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return { error: 'SERVER_NOT_READY', message: 'API key is not available.' };
  }

  const queryLower = query.toLowerCase();
  const searchTerms = new Set([queryLower]);

  const alias = BRAND_ALIASES[queryLower];
  if (alias) {
    searchTerms.add(alias);
  }

  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`;

  try {
    const searchPromises = [...searchTerms].map(term =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, pageSize: 25, dataType: ['Branded', 'Foundation', 'SR Legacy'] }),
      }).then(res => res.ok ? res.json() as Promise<UsdaApiResponse> : null)
    );

    const responses = await Promise.all(searchPromises);

    const uniqueFoods = new Map<number, UsdaFoodItem>();
    responses.forEach(response => {
      if (response?.foods) {
        response.foods.forEach(food => {
          if (!uniqueFoods.has(food.fdcId)) {
            uniqueFoods.set(food.fdcId, food);
          }
        });
      }
    });
    const combinedFoods = [...uniqueFoods.values()];

    const sortedFoods = combinedFoods
      .map(food => ({
        ...food,
        relevanceScore: calculateRelevance(food, queryLower),
        isCached: false, // Default for USDA results
      }));

    return { results: sortedFoods };

  } catch (error) {
    console.error('[API Search Route] An error occurred during the USDA search operation:', error);
    return { results: [] };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || query.length < 2) {
      return new NextResponse(JSON.stringify({ message: 'Search query must be at least 2 characters.' }), { status: 400 });
    }

    const [localResults, usdaSearchOutput] = await Promise.all([
        searchLocalCache(query),
        searchUSDA(query)
    ]);

    if (usdaSearchOutput.error === 'SERVER_NOT_READY') {
      return new NextResponse(
        JSON.stringify({ message: 'Server is warming up. Please try again in a moment.' }),
        { status: 503 }
      );
    }
    
    const usdaResults = usdaSearchOutput.results || [];
    const resultsMap = new Map();

    localResults.forEach(food => resultsMap.set(food.fdcId, food));
    usdaResults.forEach(food => {
        if (!resultsMap.has(food.fdcId)) {
            resultsMap.set(food.fdcId, food);
        }
    });

    const combinedResults = Array.from(resultsMap.values());
    combinedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const finalResults = combinedResults.map(({ fdcId, description, brandOwner, isCached }) => ({
        fdcId,
        description,
        brandOwner,
        isCached
    }));

    return NextResponse.json({ results: finalResults });

  } catch (error: any) {
    console.error('[API Search Route] A truly unhandled error occurred:', error);
    return new NextResponse(
      JSON.stringify({ message: error.message || 'An internal server error occurred.' }), 
      { status: 500 }
    );
  }
}
