
import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebaseAdmin';

export async function POST(req: NextRequest) {
    try {
        const sessionCookie = req.cookies.get('session');
        if (!sessionCookie) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const decodedToken = await auth.verifyIdToken(sessionCookie.value);
        const userId = decodedToken.uid;

        if (!userId) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { message } = await req.json();
        if (!message) {
            return new NextResponse("Missing message", { status: 400 });
        }

        const popup = {
            userId,
            message,
            createdAt: new Date(),
            isRead: false,
        };

        await db.collection('sticky-popups').add(popup);

        return new NextResponse("Popup saved", { status: 200 });
    } catch (error) {
        console.error("Error saving sticky popup:", error);
        // If the error is due to an invalid token, return a 401
        if ((error as any).code === 'auth/id-token-expired' || (error as any).code === 'auth/argument-error') {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
