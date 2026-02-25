'use client';

import { useState } from 'react';
import { useZxing } from 'react-zxing';
import { Button } from '@/components/ui/button';

interface BarcodeScannerViewProps {
  onFoodScanned: (food: { fdcId: number; description: string; brandOwner?: string; }) => void;
  onClose: () => void;
  onManualEntryClick: () => void;
}

export const BarcodeScannerView = ({ onFoodScanned, onClose, onManualEntryClick }: BarcodeScannerViewProps) => {
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState('');

  const { ref } = useZxing({
    constraints: { video: { facingMode: 'environment' } },
    paused,
    onDecodeResult(result) {
      setResultText(result.getText());
      setPaused(true);
      handleScannedBarcode(result.getText());
    },
    onDecodeError(err) {
      // Don't set an error for normal scanning operation, only for critical failures
      if (err.message.includes('device') || err.message.includes('stream')) {
          console.error('[BarcodeScannerView] Scanner Error:', err);
          setError('Scanner error: Could not access camera. Please ensure permissions are granted and no other app is using the camera.');
          setPaused(true);
      }
    },
  });

  const handleScannedBarcode = async (barcode: string) => {
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
      console.error('[BarcodeScannerView] Error processing barcode:', err);
      setError(err.message || 'An unexpected error occurred.');
      // Keep the scanner paused on API error to show the message
    }
  };

  const handleRetry = () => {
    setError(null);
    setResultText('');
    setPaused(false);
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black rounded-lg p-4 relative">
      <div className="absolute top-2 right-2 z-10">
        <Button variant="ghost" size="icon" onClick={onClose}>X</Button>
      </div>

      {error ? (
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={handleRetry}>Try Again</Button>
        </div>
      ) : resultText ? (
        <div className="text-center">
            <p className="text-white">Barcode found: {resultText}</p>
            <p className="text-white mt-2">Processing...</p>
        </div>
      ) : (
        <>
          <video ref={ref} className="w-full h-auto max-h-[70vh] rounded-md" />
          <p className="text-white mt-4">Point the camera at a barcode</p>
        </>
      )}

      <div className="mt-6">
        <Button variant="link" onClick={onManualEntryClick}>
          Can't Scan? Enter Manually
        </Button>
      </div>
    </div>
  );
};
