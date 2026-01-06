
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/auth-provider';
import { db } from '@/lib/firebase'; // Corrected import
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface StickyPopup {
    id: string;
    message: string;
}

export function StickyPopups() {
    const { user } = useAuth();
    const [popups, setPopups] = useState<StickyPopup[]>([]);

    useEffect(() => {
        if (!user) return;

        const fetchPopups = async () => {
            const popupsRef = collection(db, 'sticky-popups'); // Use the corrected 'db' variable
            const q = query(popupsRef, where('userId', '==', user.uid), where('isRead', '==', false));
            const querySnapshot = await getDocs(q);
            const fetchedPopups: StickyPopup[] = [];
            querySnapshot.forEach((doc) => {
                fetchedPopups.push({ id: doc.id, ...doc.data() } as StickyPopup);
            });
            setPopups(fetchedPopups);
        };

        fetchPopups();
    }, [user]);

    const dismissPopup = async (popupId: string) => {
        const popupRef = doc(db, 'sticky-popups', popupId); // Use the corrected 'db' variable
        await updateDoc(popupRef, { isRead: true });
        setPopups(popups.filter(p => p.id !== popupId));
    };

    if (popups.length === 0) {
        return null;
    }

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-4">
            {popups.map(popup => (
                <div key={popup.id} className="bg-background border border-border rounded-lg p-4 shadow-lg flex items-start gap-4">
                    <div className="flex-1">
                        <p className="font-bold">Reminder</p>
                        <p>{popup.message}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => dismissPopup(popup.id)}>
                        <X className="h-4 w-4"/>
                    </Button>
                </div>
            ))}
        </div>
    );
}
