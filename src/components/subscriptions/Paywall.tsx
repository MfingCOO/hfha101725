'use client';

import React, { useEffect, useState } from 'react';
import { Purchases, PurchasesOffering } from '@revenuecat/purchases-capacitor';
import { useSubscription } from '@/hooks/useSubscription';
import { Capacitor } from '@capacitor/core'; // Import this!

export function Paywall() {
  const { isPro, loading: subLoading } = useSubscription();
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch from RevenueCat if we are on a native device (Android/iOS)
    if (!Capacitor.isNativePlatform()) {
      console.log("Paywall: Web platform detected. RevenueCat offerings skipped.");
      return;
    }

    const fetchOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        if (offerings.current) {
          setOffering(offerings.current);
        }
      } catch (e: any) {
        console.error("Error fetching offerings", e);
        setError("Could not load subscription plans.");
      }
    };

    fetchOfferings();
  }, []);

  const handlePurchase = async (packageToBuy: any) => {
    // Safety check: Don't try to buy native packages on the web
    if (!Capacitor.isNativePlatform()) {
      setError("Please use the mobile app to subscribe, or use our website checkout.");
      return;
    }

    setIsPurchasing(true);
    setError(null);
    try {
      await Purchases.purchasePackage({ aPackage: packageToBuy });
    } catch (e: any) {
      if (!e.userCancelled) {
        setError(e.message || "Purchase failed.");
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  if (subLoading) return <div className="p-4 text-center">Checking status...</div>;
  
  if (isPro) {
    return (
      <div className="p-6 text-center bg-green-900/20 border border-green-500 rounded-lg">
        <h3 className="text-xl font-bold text-green-400">You are a Pro Member!</h3>
        <p className="text-green-300">Your access is active.</p>
      </div>
    );
  }

  // If we are on web, show a friendly message or a Stripe link instead of just "Loading..."
  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-gray-700 rounded-xl">
        <h2 className="text-xl font-bold">Web Subscription</h2>
        <p className="text-gray-400 mt-2">To manage your subscription, please use the HungerFree & Happy app on your Android device.</p>
        {/* You can add a Stripe link here later for web users */}
      </div>
    );
  }

  if (!offering) return <div className="p-4 text-center">Loading plans...</div>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h2 className="text-2xl font-black text-center">Upgrade to Pro</h2>
      
      {/* ... (Your buttons for Monthly and Annual stay exactly the same) ... */}
      {offering.monthly && (
         <button onClick={() => handlePurchase(offering.monthly)} disabled={isPurchasing} className="w-full border-2 border-gray-700 bg-gray-900 p-4 rounded-xl flex justify-between items-center">
            <div className="text-left">
              <p className="font-bold text-lg text-white">Monthly Pro</p>
              <p className="text-gray-400 text-sm">{offering.monthly.product.priceString} / month</p>
            </div>
            <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
              {isPurchasing ? '...' : 'Select'}
            </div>
         </button>
      )}

      {offering.annual && (
        <button onClick={() => handlePurchase(offering.annual)} disabled={isPurchasing} className="w-full border-2 border-blue-600 bg-blue-900/40 p-4 rounded-xl flex justify-between items-center relative">
          <span className="absolute -top-3 left-4 bg-blue-600 text-white text-xs px-2 py-1 rounded-full uppercase font-black">Best Value</span>
          <div className="text-left">
            <p className="font-bold text-lg text-white">Yearly Pro</p>
            <p className="text-blue-400 text-sm">{offering.annual.product.priceString} / year</p>
          </div>
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold">
            {isPurchasing ? '...' : 'Select'}
          </div>
        </button>
      )}

      {error && <p className="text-red-500 text-xs text-center">{error}</p>}
    </div>
  );
}