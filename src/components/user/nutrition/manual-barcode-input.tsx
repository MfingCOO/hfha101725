'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ManualBarcodeInputProps {
    onFoodScanned: (barcode: { fdcId: number; description: string; brandOwner?: string; }) => void;
    onClose: () => void;
    onBackToScanClick: () => void;
}

export const ManualBarcodeInput = ({ onFoodScanned, onClose, onBackToScanClick }: ManualBarcodeInputProps) => {
    const [barcode, setBarcode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!barcode.trim()) {
            setError('Please enter a barcode.');
            return;
        }
        setError(null);
        setIsLoading(true);

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to find food for this barcode');
            }

            const foodData = await response.json();
            onFoodScanned(foodData);
        } catch (err: any) {
            console.error('[ManualBarcodeInput] Error processing barcode:', err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-background rounded-lg p-4 relative">
            <div className="absolute top-2 right-2 z-10">
                <Button variant="ghost" size="icon" onClick={onClose}>X</Button>
            </div>

            <h2 className="text-xl font-semibold mb-4">Enter Barcode</h2>

            <div className="w-full max-w-sm space-y-4">
                <Input
                    type="text"
                    placeholder="Enter barcode number"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    disabled={isLoading}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button onClick={handleSubmit} disabled={isLoading} className="w-full">
                    {isLoading ? 'Searching...' : 'Find Food'}
                </Button>
            </div>

            <div className="mt-6">
                <Button variant="link" onClick={onBackToScanClick}>
                    Back to Scanner
                </Button>
            </div>
        </div>
    );
};
