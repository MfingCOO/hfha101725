'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { useRouter } from 'next/navigation';
import { AppNumberInput } from '../ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Capacitor } from '@capacitor/core';

const onboardingSchema = z.object({
    email: z.string().email("Invalid email"),
    password: z.string().min(8, "Min 8 characters"),
    fullName: z.string().min(2, "Name required"),
    birthdate: z.string().min(1, "Birthdate required"),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.coerce.number().positive(),
    weight: z.coerce.number().positive(),
    waist: z.coerce.number().positive(),
    zipCode: z.string().regex(/^\d{5}$/, "5-digit Zip required"),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),
    disclaimer: z.boolean().refine(val => val === true, { message: "Must accept disclaimer" }),
});

// CRITICAL FIX: Restored the 'export' keyword here
export type OnboardingValues = z.infer<typeof onboardingSchema>;

export function OnboardingForm({ onFormSubmit }: { onFormSubmit: (data: any) => Promise<{success: boolean}> }) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [offerings, setOfferings] = useState<any>(null);

    useEffect(() => {
        if (step === 4 && Capacitor.isNativePlatform()) {
            const fetchOfferings = async () => {
                try {
                    const { Purchases } = await import('@revenuecat/purchases-capacitor');
                    const offeringsObj = await Purchases.getOfferings();
                    if (offeringsObj.current) setOfferings(offeringsObj.current);
                } catch (e) {
                    console.error("RevenueCat Error:", e);
                }
            };
            fetchOfferings();
        }
    }, [step]);

    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: { units: 'imperial', height: 1, weight: 1, waist: 1, sex: 'unspecified', activityLevel: 'light', disclaimer: false },
    });

    const nextStep = async () => {
        const fields: any = {
            1: ['email', 'password', 'fullName'],
            2: ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'],
            3: ['activityLevel', 'wakeTime', 'sleepTime', 'disclaimer']
        };
        const isValid = await form.trigger(fields[step]);
        if (isValid) {
            window.scrollTo(0, 0);
            setStep(s => s + 1);
        }
    };

    const handlePurchase = async (tier: string, pkgKey?: 'monthly' | 'annual') => {
        setIsLoading(true);
        try {
            const values = form.getValues();
            if (tier === 'free') {
                const res = await onFormSubmit({ ...values, tier: 'free' });
                if (res.success) router.push('/login');
                return;
            }

            const { Purchases } = await import('@revenuecat/purchases-capacitor');
            const pkg = pkgKey === 'monthly' ? offerings?.monthly : offerings?.annual;
            
            if (!pkg) throw new Error("Plan not found. Check RevenueCat Dashboard.");

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
            if (customerInfo.entitlements.active) {
                await onFormSubmit({ ...values, tier, billingCycle });
                router.push('/login');
            }
        } catch (e: any) {
            if (!e.userCancelled) toast({ variant: "destructive", title: "Error", description: e.message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-lg mx-auto border-none shadow-none bg-transparent">
            <CardHeader>
                <CardTitle className="text-center text-2xl font-bold">
                    {step === 4 ? "Select Your Plan" : "Create Account"}
                </CardTitle>
                <Progress value={(step / 4) * 100} className="h-2 mt-2" />
                <CardDescription className="text-center">Step {step} of 4</CardDescription>
            </CardHeader>

            <Form {...form}>
                <form className="space-y-6">
                    <CardContent>
                        {/* STEPS 1-3: Account, Metrics, Lifestyle */}
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="birthdate" render={({ field }) => (<FormItem><FormLabel>Birthdate</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                    <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                    <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><Input {...field} /></FormItem>)} />
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="disclaimer" render={({ field }) => (
                                    <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <div className="space-y-1"><FormLabel>I agree to the Medical Disclaimer</FormLabel><FormMessage /></div>
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        {/* STEP 4: PRICING (ONLY REVEALED ON STEP 4) */}
                        {step === 4 && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-center space-x-4 bg-muted/50 p-3 rounded-full">
                                    <Label className={billingCycle === 'monthly' ? "font-bold text-primary" : ""}>Monthly</Label>
                                    <Switch checked={billingCycle === 'yearly'} onCheckedChange={(v) => setBillingCycle(v ? 'yearly' : 'monthly')} />
                                    <Label className={billingCycle === 'yearly' ? "font-bold text-primary" : ""}>Yearly (Save 25%)</Label>
                                </div>

                                <div className="grid gap-4">
                                    {/* FREE */}
                                    <Card className="p-4 border hover:border-primary transition-colors cursor-pointer" onClick={() => handlePurchase('free')}>
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold">Free Access</h4>
                                            <span className="text-lg font-bold">$0</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Includes advertisements</p>
                                    </Card>

                                    {/* PREMIUM */}
                                    <Card className="p-4 border-2 border-primary bg-primary/5 relative">
                                        <div className="absolute -top-3 left-4 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-full font-bold uppercase">Recommended</div>
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="font-bold text-lg">Premium</h4>
                                                <div className="flex items-center text-[11px] text-primary mt-1"><CheckCircle2 className="w-3 h-3 mr-1" /> AI Analysis & Logic</div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-xl font-bold text-primary">
                                                    {billingCycle === 'monthly' ? (offerings?.monthly?.product.priceString || "$9.99") : (offerings?.annual?.product.priceString || "$89.99")}
                                                </span>
                                            </div>
                                        </div>
                                        <Button className="w-full mt-4" onClick={() => handlePurchase('premium', billingCycle === 'monthly' ? 'monthly' : 'annual')} disabled={isLoading}>
                                            {isLoading ? <Loader2 className="animate-spin" /> : "Go Premium"}
                                        </Button>
                                    </Card>

                                    {/* COACHING */}
                                    <Card className="p-4 border border-dashed bg-muted/10">
                                        <h4 className="font-bold text-sm">1-on-1 Personalized Coaching</h4>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">Expert guidance tailored to your body and habits.</p>
                                        <Button variant="outline" size="sm" className="w-full" onClick={() => window.location.href='mailto:support@hungerfreehappy.com?subject=Coaching Inquiry'}>
                                            Contact Us for Pricing
                                        </Button>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-6">
                        <div className="flex justify-between w-full">
                            {step > 1 && step < 4 && (
                                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={isLoading}>
                                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                                </Button>
                            )}
                            {step < 4 && (
                                <Button type="button" className="ml-auto" onClick={nextStep}>
                                    Next <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        {/* SEPARATED LOG IN LINK */}
                        <div className="w-full pt-6 border-t text-center">
                            <p className="text-sm text-muted-foreground">
                                Already have an account? 
                                <Button variant="link" type="button" className="p-0 h-auto ml-1 font-bold text-primary" onClick={() => router.push('/login')}>
                                    Log In
                                </Button>
                            </p>
                        </div>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}