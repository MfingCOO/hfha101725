'use client';

import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// A more generic type that is compatible with both EnrichedFood and FoodSearchResult
interface FoodDisplayItem {
    fdcId?: number; // FIX: fdcId is optional to match the incoming data type
    description?: string;
    brandOwner?: string;
}

interface FoodItemRowProps {
    food: FoodDisplayItem;
    subDescription?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

export const FoodItemRow = ({ food, subDescription, onClick, actions, children }: FoodItemRowProps) => {
    // FIX: Add a guard to prevent rendering if the essential data is missing.
    if (!food || !food.fdcId) {
        return null;
    }

    const hasClickListener = !!onClick;
    const description = food.description || 'Description not available';

    return (
        <div 
            className={cn(
                "flex items-center p-2 rounded-lg",
                hasClickListener && "cursor-pointer hover:bg-muted/50"
            )}
            onClick={onClick}
        >
            <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{description}</p>
                {subDescription ? (
                    <div className="text-xs text-muted-foreground truncate">{subDescription}</div>
                ) : (
                    <p className="text-xs text-muted-foreground truncate">{food.brandOwner || 'Generic'}</p>
                )}
            </div>
            {actions && <div className="ml-2">{actions}</div>}
            {hasClickListener && !actions && <ChevronRight className="h-5 w-5 text-muted-foreground ml-2" />}
            {children}
        </div>
    );
};