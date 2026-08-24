'use client';

import { useState, useEffect } from 'react';
import { useZxing } from 'react-zxing';
import { Button } from '@/components/ui/button';
import { Loader2, Camera as CameraIcon, Image as ImageIcon } from 'lucide-react';

// Capacitor Imports
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// ZXing for static image scanning
import { BrowserCodeReader, DecodeHintType } from '@zxing/library';

interface BarcodeScannerViewProps {
  onFoodScanned: (food: { fdcId: number; description: string; brandOwner?: string; }) => void;
  onClose: () => void;
  onManualEntryClick: () => void;
}

export const BarcodeScannerView = ({ onFoodScanned, onClose, onManualEntryClick }: BarcodeScannerViewProps) => {
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultText, setResultText] = useState('');
  const [isLoadingScanner, setIsLoadingScanner] = useState(false);

  // Safe platform detection (prevents hydration/hook mismatch)
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  // Web/PWA camera stream using useZxing
  // We now use the stable `isNative` state instead of calling Capacitor directly during render
  const { ref } = useZxing({
    constraints: { video: { facingMode: 'environment' } },
    paused: paused || isNative,
    onDecodeResult(result) {
      if (!isNative) {
        setResultText(result.getText());
        setPaused(true);
        handleScannedBarcode(result.getText());
      }
    },
    onDecodeError(err) {
      if (!isNative && (err.message.includes('device') || err.message.includes('stream'))) {
        console.error('[BarcodeScannerView] Web Scanner Error:', err);
        setError('Scanner error: Could not access camera. Please ensure permissions are granted and no other app is using the camera.');
        setPaused(true);
      }
    },
  });

  // ADDED: Function to scan a static image for a barcode
  const scanImageForBarcode = async (dataUrl: string): Promise<string | null> => {
    // @ts-ignore
    const codeReader = new BrowserCodeReader();
    try {
      const hints = new Map<DecodeHintType, any>();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, ["CODE_128", "EAN_13", "EAN_8", "QR_CODE", "CODE_39", "UPC_A", "UPC_E"]);

      const image = new Image();
      image.src = dataUrl;
      await new Promise(resolve => image.onload = resolve);

      const result = await codeReader.decodeFromImage(image, hints as any);
      return result.getText();
    } catch (err) {
      console.warn("No barcode found in image or scanning error:", err);
      return null;
    } finally {
      codeReader.reset();
    }
  };

  // ADDED: handleCapacitorScan for native camera/gallery
  const handleCapacitorScan = async (source: CameraSource) => {
    setIsLoadingScanner(true);
    setError(null);
    setResultText('');
    try {
      const permissionTarget = source === CameraSource.Camera ? 'camera' : 'photos';
      const permissions = await Camera.requestPermissions({ permissions: [permissionTarget] });
  
      if (permissionTarget === 'camera' && permissions.camera !== 'granted') {
        setError('Camera access is required. Enable it in iOS Settings and try again.');
        return;
      }
  
      if (permissionTarget === 'photos' && permissions.photos !== 'granted' && permissions.photos !== 'limited') {
        setError('Photo library access is required. Enable it in iOS Settings and try again.');
        return;
      }
  
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: source,
      });
  
      if (photo.dataUrl) {
        setResultText("Scanning image for barcode...");
        const barcode = await scanImageForBarcode(photo.dataUrl);
        if (barcode) {
          setResultText(`Barcode found: ${barcode}`);
          handleScannedBarcode(barcode);
        } else {
          setError("No barcode found in the captured image. Please try again.");
        }
      } else {
        setError("No photo captured or selected.");
      }
    } catch (err: any) {
      console.error('[BarcodeScannerView] Capacitor Camera Error:', err);
      setError(err.message || 'Failed to access camera or gallery.');
    } finally {
      setIsLoadingScanner(false);
    }
  };

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
    }
  };

  const handleRetry = () => {
    setError(null);
    setResultText('');
    if (!isNative) {
      setPaused(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-black rounded-lg p-4 relative">
      <div className="absolute top-2 right-2 z-10">
        <Button variant="ghost" size="icon" onClick={onClose}>X</Button>
      </div>

      {isLoadingScanner ? (
        <div className="flex flex-col items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-white mt-4">Accessing camera...</p>
        </div>
      ) : error ? (
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={handleRetry}>Try Again</Button>
        </div>
      ) : resultText ? (
        <div className="text-center">
          <p className="text-white">{resultText}</p>
          {!resultText.startsWith("Barcode found") && <p className="text-white mt-2">Processing...</p>}
        </div>
      ) : (
        <>
          {isNative ? (
            <div className="flex flex-col items-center gap-4">
              <Button onClick={() => handleCapacitorScan(CameraSource.Camera)} disabled={isLoadingScanner}>
                <CameraIcon className="mr-2 h-4 w-4" /> Scan with Camera
              </Button>
              <Button onClick={() => handleCapacitorScan(CameraSource.Photos)} disabled={isLoadingScanner}>
                <ImageIcon className="mr-2 h-4 w-4" /> Pick from Gallery
              </Button>
              <p className="text-white mt-2">Select an option to scan a barcode</p>
            </div>
          ) : (
            <>
              <video
                ref={ref as React.RefObject<HTMLVideoElement>}
                className="w-full h-auto max-h-[70vh] rounded-md"
              />
              <p className="text-white mt-4">Point the camera at a barcode</p>
            </>
          )}
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