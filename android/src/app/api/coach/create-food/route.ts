
import { NextResponse } from 'next/server';
import { admin } from '@/lib/firebaseAdmin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';

// Helper to verify coach role from the request token
async function isCoach(request: Request): Promise<{ authorized: boolean; uid: string | null }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, uid: null };
  }
  const token = authHeader.split('Bearer ')[1];
  if (!token) {
    return { authorized: false, uid: null };
  }
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (decodedToken.role === 'coach') {
      return { authorized: true, uid: decodedToken.uid };
    }
    return { authorized: false, uid: null };
  } catch (error) {
    console.error("Error verifying auth token:", error);
    return { authorized: false, uid: null };
  }
}

export async function POST(request: Request) {
  try {
    const { authorized, uid } = await isCoach(request);
    if (!authorized || !uid) {
      return new NextResponse(JSON.stringify({ message: 'Unauthorized: Access denied.' }), { status: 403 });
    }

    const body = await request.json();

    const {
      foodName,
      brand,
      servingSize,
      servingSizeUnit,
      calories,
      protein,
      carbohydrates,
      fat,
      ingredients,
      // NEW OPTIONAL FIELDS
      isGlutenFree,
      upfPercentage,
      upfRanking,
      micronutrients,
    } = body;

    // --- Core Validation ---
    if (!foodName || !servingSize || !servingSizeUnit || calories === undefined || protein === undefined || carbohydrates === undefined || fat === undefined) {
      return new NextResponse(JSON.stringify({ message: 'Missing mandatory fields.' }), { status: 400 });
    }
    if (typeof foodName !== 'string' || typeof servingSize !== 'number' || typeof servingSizeUnit !== 'string' || typeof calories !== 'number' || typeof protein !== 'number' || typeof carbohydrates !== 'number' || typeof fat !== 'number') {
        return new NextResponse(JSON.stringify({ message: 'Invalid data type for one or more core fields.' }), { status: 400 });
    }

    // --- Optional Fields Validation ---
    if (isGlutenFree !== undefined && typeof isGlutenFree !== 'boolean') {
        return new NextResponse(JSON.stringify({ message: 'Invalid data type for isGlutenFree, must be boolean.' }), { status: 400 });
    }
    if (upfPercentage !== undefined && typeof upfPercentage !== 'number') {
        return new NextResponse(JSON.stringify({ message: 'Invalid data type for upfPercentage, must be number.' }), { status: 400 });
    }
    const allowedRankings = ['whole_food', 'processed', 'UPF'];
    if (upfRanking !== undefined && !allowedRankings.includes(upfRanking)) {
        return new NextResponse(JSON.stringify({ message: `Invalid value for upfRanking. Must be one of: ${allowedRankings.join(', ')}` }), { status: 400 });
    }
    if (micronutrients !== undefined && typeof micronutrients !== 'object') {
        return new NextResponse(JSON.stringify({ message: 'Invalid data type for micronutrients, must be an object.' }), { status: 400 });
    }

    const newFood: { [key: string]: any } = {
      foodName,
      brand: brand || null,
      servingSize,
      servingSizeUnit,
      calories,
      protein,
      carbohydrates,
      fat,
      ingredients: ingredients || null,
      createdBy: uid,
      status: 'APPROVED',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    // Add optional fields to the payload if they exist
    if (isGlutenFree !== undefined) newFood.isGlutenFree = isGlutenFree;
    if (upfPercentage !== undefined) newFood.upfPercentage = upfPercentage;
    if (upfRanking !== undefined) newFood.upfRanking = upfRanking;
    if (micronutrients !== undefined) newFood.micronutrients = micronutrients;

    const docRef = await admin.firestore().collection('custom-foods').add(newFood);

    return new NextResponse(JSON.stringify({ message: 'Food created successfully', foodId: docRef.id }), { status: 201 });

  } catch (error: any) {
    console.error('[API Create Food Route] Error:', error);
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: error.message }), { status: 500 });
  }
}
