
import { NextResponse } from 'next/server';

async function findFdcIdByBarcode(barcode: string) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.error("[API Scan Route] USDA_API_KEY is not configured.");
    return { error: 'SERVER_NOT_READY' };
  }

  // Use the specific USDA endpoint for GTIN/UPC lookups
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(barcode)}&dataType=Branded&api_key=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`[API Scan Route] USDA API returned status ${response.status}`);
      return { error: 'NOT_FOUND' };
    }

    const data = await response.json();

    // Find the most likely match (usually the first result for a barcode scan)
    if (data.foods && data.foods.length > 0) {
      const food = data.foods[0];
      return {
        success: true,
        fdcId: food.fdcId,
        description: food.description,
        brandOwner: food.brandOwner,
      };
    }

    return { error: 'NOT_FOUND' };
  } catch (error) {
    console.error('[API Scan Route] An error occurred during the USDA barcode search:', error);
    return { error: 'INTERNAL_ERROR' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { barcode } = body;

    if (!barcode) {
      return new NextResponse(JSON.stringify({ message: 'Barcode is required.' }), { status: 400 });
    }

    const result = await findFdcIdByBarcode(barcode);

    if (result.error) {
      const status = result.error === 'SERVER_NOT_READY' ? 503 : 404;
      return new NextResponse(JSON.stringify({ message: 'Food not found for this barcode.' }), { status });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('[API Scan Route] Unhandled error:', error);
    return new NextResponse(
      JSON.stringify({ message: 'An internal server error occurred.' }),
      { status: 500 }
    );
  }
}
