'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { getActiveStickyPopupsAction, markPopupAsReadAction } from '@/app/coach/popups/actions';
import { useAuth } from '@/components/auth/auth-provider';
import Image from 'next/image';
import Link from 'next/link';

interface StickyPopup {
  id: string;
  title: string;
  message: string;
  imageUrl?: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function StickyPopups() {
  const { user } = useAuth();
  const [popups, setPopups] = useState<StickyPopup[]>([]);

  const fetchPopups = useCallback(async () => {
    // Only fetch if the user is authenticated.
    if (!user) return;
    
    try {
      const result = await getActiveStickyPopupsAction();
      if (result.success && result.data) {
        setPopups(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch sticky popups:", error);
    }
  }, [user]);

  useEffect(() => {
    fetchPopups();
  }, [fetchPopups]);

  const dismissPopup = async (popupId: string) => {
    // Optimistically update the UI to remove the popup immediately.
    setPopups(currentPopups => currentPopups.filter(p => p.id !== popupId));
    
    // Silently tell the server to mark this as read for the current user.
    try {
      await markPopupAsReadAction(popupId);
    } catch (error) {
        // If the server fails, the popup will just reappear on the next page load.
        // No need to bother the user with an error toast for this.
        console.error("Failed to mark popup as read:", error);
    }
  };

  if (popups.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-4 items-end">
      {popups.map(popup => (
        <div key={popup.id} className="bg-card border border-border rounded-lg p-4 shadow-2xl flex items-start gap-4 max-w-sm w-full">
          {popup.imageUrl && (
            <div className="relative w-16 h-16 flex-shrink-0">
              <Image src={popup.imageUrl} alt={popup.title} fill className="object-cover rounded-md" unoptimized />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-card-foreground">{popup.title}</p>
            <p className="text-sm text-muted-foreground mt-1">{popup.message}</p>
            {popup.ctaText && popup.ctaUrl && (
                <Button asChild size="sm" className="mt-3">
                    <Link href={popup.ctaUrl}>{popup.ctaText}</Link>
                </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => dismissPopup(popup.id)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
