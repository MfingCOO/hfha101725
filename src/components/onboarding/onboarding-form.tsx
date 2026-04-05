'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppNumberInput } from '../ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';

// Step 1: Define the Validation Schema (Matches your original metrics collection)
const onboardingSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Please enter your full name."),
    birthdate: z.string().refine((val) => {
        const today = new Date();
        const birthDate = new Date(val);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age >= 18;
    }, { message: "You must be at least 18 years old." }),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.coerce.number().positive(),
    weight: z.coerce.number().positive(),
    waist: z.coerce.number().positive(),
    zipCode: z.string().regex(/^\d{5}$/, "Please enter a valid 5-digit zip code."),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),
    disclaimer: z.boolean().refine(val => val === true, { message: "You must accept the disclaimer to continue." }),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
    onFormSubmit: (data: any) => Promise<{success: boolean, error?: any}>;
}

type Tier = 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching' | 'Free' | 'AdFree' | 'Basic' | 'Premium' | 'Coaching';

// Package mapping for RevenueCat
const revenueCatPackageMap: Record<string, { monthly?: string; yearly?: string; free?: string }> = {
    'Free': { free: 'free_access' },
    'AdFree': { monthly: 'ad_free_monthly', yearly: 'ad_free_yearly' },
    'Basic': { monthly: 'basic_monthly', yearly: 'basic_yearly' },
    'Premium': { monthly: 'premium_monthly', yearly: 'premium_yearly' },
};

export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [currentOffering, setCurrentOffering] = useState<any | null>(null);

    // Load Offerings using the Capacitor Plugin
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const loadPlans = async () => {
            try {
                const { Purchases } = await import('@revenuecat/purchases-capacitor');
                const offerings = await Purchases.getOfferings();
                if (offerings.current) {
                    setCurrentOffering(offerings.current);
                }
            } catch (error) {
                console.error("Failed to load RevenueCat offerings", error);
            }
        };
        loadPlans();
    }, []);

    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: { 
            email: "", password: "", fullName: "", birthdate: "", sex: "unspecified", 
            units: 'imperial', height: 0, weight: 0, waist: 0, zipCode: "", 
            activityLevel: 'light', wakeTime: "07:00", sleepTime: "22:00", disclaimer: false 
        },
    });

    const totalSteps = 4;
    const progress = (step / totalSteps) * 100;

    const nextStep = async () => {
        window.scrollTo(0, 0);
        let fieldsToValidate: (keyof OnboardingValues)[] = [];
        if (step === 1) fieldsToValidate = ['email', 'password', 'fullName'];
        if (step === 2) fieldsToValidate = ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'];
        if (step === 3) fieldsToValidate = ['activityLevel', 'wakeTime', 'sleepTime', 'disclaimer'];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) setStep(s => s + 1);
    };

    const prevStep = () => {
        window.scrollTo(0, 0);
        setStep(s => s - 1);
    };

    const handlePurchase = async (tier: Tier) => {
        setIsLoading(true);
        try {
            const finalTier = tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
            const cycle = (finalTier === 'Free') ? 'free' : billingCycle;
            
            // Logic for "Free" tier (No purchase needed)
            if (finalTier === 'Free') {
                const values = form.getValues();
                await onFormSubmit({ ...values, tier: 'free', billingCycle: 'free' });
                router.push('/login');
                return;
            }

            if (!Capacitor.isNativePlatform()) {
                throw new Error("Billing is only available on mobile devices.");
            }

            const { Purchases } = await import('@revenuecat/purchases-capacitor');
            const packageId = (cycle === 'monthly') 
                ? revenueCatPackageMap[finalTier]?.monthly 
                : revenueCatPackageMap[finalTier]?.yearly;

            const pkg = currentOffering.availablePackages.find((p: any) => p.identifier === packageId);
            if (!pkg) throw new Error("Selected plan not found.");

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

            if (customerInfo.entitlements.active[tier.toLowerCase()] || Object.keys(customerInfo.entitlements.active).length > 0) {
                const values = form.getValues();
                await onFormSubmit({ ...values, tier: tier.toLowerCase(), billingCycle: cycle });
                toast({ title: "Welcome!", description: "Account created successfully." });
                router.push('/login');
            }
        } catch (e: any) {
            toast({ variant: "destructive", title: "Purchase Error", description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full shadow-none border-none">
            <CardHeader>
                <CardTitle className="text-center">{step === 4 ? "Choose Your Plan" : "Create Your Account"}</CardTitle>
                <CardDescription className="text-center">Step {step} of {totalSteps}</CardDescription>
                <Progress value={progress} className="mt-2" />
            </CardHeader>
            <Form {...form}>
                <form className="space-y-4">
                    <CardContent>
                        {/* STEP 1: ACCOUNT DETAILS */}
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Account Details</h3>
                                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        )}

                        {/* STEP 2: METRICS COLLECTION (THE MISSING PIECE) */}
                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Your Metrics</h3>
                                <FormField control={form.control} name="birthdate" render={({ field }) => (<FormItem><FormLabel>Birthdate</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="sex" render={({ field }) => (
                                    <FormItem><FormLabel>Sex</FormLabel>
                                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="male" /> <Label>Male</Label></div>
                                            <div className="flex items-center space-x-2"><RadioGroupItem value="female" /> <Label>Female</Label></div>
                                        </RadioGroup>
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><FormControl><AppNumberInput {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight</FormLabel><FormControl><AppNumberInput {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist</FormLabel><FormControl><AppNumberInput {...field} /></FormControl></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="units" render={({ field }) => (
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="imperial" /> <Label>Imperial (lbs/in)</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="metric" /> <Label>Metric (kg/cm)</Label></div>
                                    </RadioGroup>
                                )} />
                                <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                            </div>
                        )}

{/* STEP 3: LIFESTYLE & FULL DISCLAIMER */}
{step === 3 && (
    <div className="space-y-4 animate-in fade-in">
        <h3 className="font-semibold text-lg">Your Lifestyle</h3>
        <FormField control={form.control} name="activityLevel" render={({ field }) => (
            <FormItem className="space-y-3">
                <FormLabel>Approximate Activity Level</FormLabel>
                <FormControl>
                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                        <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="sedentary" /></FormControl>
                            <FormLabel className="font-normal">Sedentary (little or no exercise)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="light" /></FormControl>
                            <FormLabel className="font-normal">Lightly active (light exercise/sports 1-3 days/week)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="moderate" /></FormControl>
                            <FormLabel className="font-normal">Moderately active (moderate exercise/sports 3-5 days/week)</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-3 space-y-0">
                            <FormControl><RadioGroupItem value="active" /></FormControl>
                            <FormLabel className="font-normal">Very active (hard exercise/sports 6-7 days a week)</FormLabel>
                        </FormItem>
                    </RadioGroup>
                </FormControl>
                <FormMessage />
            </FormItem>
        )} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField control={form.control} name="wakeTime" render={({ field }) => (
                <FormItem><FormLabel>Approx. Wake Up Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
            )} />
            <FormField control={form.control} name="sleepTime" render={({ field }) => (
                <FormItem><FormLabel>Approx. Bedtime</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>
            )} />
        </div>

        <h3 className="font-semibold text-lg pt-4">Disclaimer</h3>
        <div className="p-4 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-sm">
            <p className="mb-2 font-bold">Important Medical Disclaimer:</p>
            <p className="mb-2">
                This application ('App') is intended as a tool to help you track your habits and choices. 
                The information and guidance provided within this App are based on the principles of the 
                "~Hunger Free and Happy" book.
            </p>
            <p className="mb-2">
                The App is not a medical device, nor does it provide medical advice. The creators, developers, 
                distributors, and affiliates of this App are not medical professionals and expressly disclaim 
                all liability for any actions taken or not taken based on the content of this App. 
                Your use of this App is solely at your own risk.
            </p>
            <p className="mb-2">
                Always seek the advice of your physician or other qualified health provider with any 
                questions you may have regarding a medical condition. Never disregard professional 
                medical advice or delay in seeking it because of something you have read on this App.
            </p>
            <p>
                By checking the box below, you acknowledge that you have read, understood, and 
                agree to this disclaimer, releasing the App and its creators of all liability.
            </p>
        </div>

        <FormField control={form.control} name="disclaimer" render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                    <FormLabel>I have read, understood, and agree to the disclaimer.</FormLabel>
                    <FormMessage />
                </div>
            </FormItem>
        )} />
    </div>
)}

                        {/* STEP 4: REVENUECAT PAYWALL */}
                        {step === 4 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="flex items-center justify-center space-x-2">
                                    <Label>Monthly</Label>
                                    <Switch checked={billingCycle === 'yearly'} onCheckedChange={(c) => setBillingCycle(c ? 'yearly' : 'monthly')} />
                                    <Label>Yearly</Label>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-4">
                                    {/* Free Tier */}
                                    <Card className="p-4 cursor-pointer hover:border-primary" onClick={() => handlePurchase('free')}>
                                        <h4 className="font-bold">Free Access</h4>
                                        <p className="text-2xl font-bold">$0</p>
                                        <Button className="w-full mt-4" variant="outline">Start Free</Button>
                                    </Card>

                                    {/* Premium Tier */}
                                    <Card className="p-4 border-primary bg-primary/5 cursor-pointer" onClick={() => handlePurchase('premium')}>
                                        <h4 className="font-bold">Premium Plan</h4>
                                        <p className="text-2xl font-bold">
                                            {currentOffering ? "Check Price" : "Loading..."}
                                        </p>
                                        <Button className="w-full mt-4" disabled={isLoading}>
                                            {isLoading ? <Loader2 className="animate-spin" /> : "Subscribe Now"}
                                        </Button>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex justify-between">
                        {step > 1 && step < 4 && (
                            <Button type="button" variant="ghost" onClick={prevStep}><ArrowLeft className="mr-2" /> Back</Button>
                        )}
                        {step < 4 && (
                            <Button type="button" className="ml-auto" onClick={nextStep}>Next <ArrowRight className="ml-2" /></Button>
                        )}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}