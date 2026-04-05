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
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import { useRouter } from 'next/navigation';
import { AppNumberInput } from '../ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Capacitor } from '@capacitor/core';

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

// Fixed mapping to match your RevenueCat Dashboard exactly
const revenueCatPackageMap: Record<string, { monthly?: string; yearly?: string }> = {
    'Premium': { monthly: '$rc_monthly', yearly: '$rc_yearly' },
    'Basic': { monthly: 'basic_monthly', yearly: 'basic_yearly' },
};

export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [currentOffering, setCurrentOffering] = useState<any | null>(null);

    // Only load plans when we reach Step 4 or on mount if mobile
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
                console.error("RevenueCat Load Error:", error);
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
        let fieldsToValidate: (keyof OnboardingValues)[] = [];
        if (step === 1) fieldsToValidate = ['email', 'password', 'fullName'];
        if (step === 2) fieldsToValidate = ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'];
        if (step === 3) fieldsToValidate = ['activityLevel', 'wakeTime', 'sleepTime', 'disclaimer'];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            window.scrollTo(0, 0);
            setStep(s => s + 1);
        }
    };

    const prevStep = () => {
        window.scrollTo(0, 0);
        setStep(s => s - 1);
    };

    const handlePurchase = async (tier: string) => {
        setIsLoading(true);
        try {
            const values = form.getValues();

            if (tier === 'free') {
                const result = await onFormSubmit({ ...values, tier: 'free', billingCycle: 'free' });
                if (result.success) router.push('/login');
                return;
            }

            if (!Capacitor.isNativePlatform()) {
                throw new Error("Purchases are only available on the mobile app.");
            }

            const { Purchases } = await import('@revenuecat/purchases-capacitor');
            
            // Find the correct package from the offering
            const pkgType = billingCycle === 'monthly' ? 'monthly' : 'yearly';
            const pkg = billingCycle === 'monthly' ? currentOffering.monthly : currentOffering.annual;

            if (!pkg) throw new Error(`No ${billingCycle} plan available.`);

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });

            // Check if the entitlement is now active
            if (customerInfo.entitlements.active) {
                const result = await onFormSubmit({ ...values, tier: tier.toLowerCase(), billingCycle });
                if (result.success) {
                    toast({ title: "Success!", description: "Subscription activated." });
                    router.push('/login');
                }
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                toast({ variant: "destructive", title: "Purchase Error", description: e.message });
            }
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
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Account Details</h3>
                                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input placeholder="you@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        )}

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

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Your Lifestyle</h3>
                                <FormField control={form.control} name="activityLevel" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Approximate Activity Level</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="sedentary" /></FormControl><FormLabel className="font-normal">Sedentary (little or no exercise)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="light" /></FormControl><FormLabel className="font-normal">Lightly active (1-3 days/week)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="moderate" /></FormControl><FormLabel className="font-normal">Moderately active (3-5 days/week)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="active" /></FormControl><FormLabel className="font-normal">Very active (6-7 days/week)</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField control={form.control} name="wakeTime" render={({ field }) => (<FormItem><FormLabel>Wake Up Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="sleepTime" render={({ field }) => (<FormItem><FormLabel>Bedtime</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                </div>

                                <h3 className="font-semibold text-lg pt-4">Disclaimer</h3>
                                <div className="p-4 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-sm">
                                    <p className="mb-2 font-bold">Important Medical Disclaimer:</p>
                                    <p className="mb-2">This app is a tool based on the "~Hunger Free and Happy" book. It is not a medical device.</p>
                                    <p className="mb-2">The creators disclaim liability for actions taken based on this App. Use is at your own risk.</p>
                                    <p>By checking the box, you agree to these terms.</p>
                                </div>

                                <FormField control={form.control} name="disclaimer" render={({ field }) => (
                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <div className="space-y-1 leading-none"><FormLabel>I agree to the disclaimer.</FormLabel><FormMessage /></div>
                                    </FormItem>
                                )} />
                            </div>
                        )}

{step === 4 && (
    <div className="space-y-6 animate-in fade-in pb-8">
        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-4 mb-6">
            <Label className={(billingCycle === 'monthly' ? "text-primary font-bold" : "text-muted-foreground")}>Monthly</Label>
            <Switch checked={billingCycle === 'yearly'} onCheckedChange={(c) => setBillingCycle(c ? 'yearly' : 'monthly')} />
            <Label className={(billingCycle === 'yearly' ? "text-primary font-bold" : "text-muted-foreground")}>Yearly</Label>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
            {/* 1. FREE TIER (Ad-Free logic usually implies the free tier HAS ads) */}
            <Card className="p-5 border-2 hover:border-muted transition-all">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-lg">Free Access</h4>
                    <span className="text-xl font-bold">$0</span>
                </div>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Basic calorie tracking</li>
                    <li>• Standard food database</li>
                    <li>• Supported by ads</li>
                </ul>
                <Button className="w-full mt-4" variant="outline" onClick={() => handlePurchase('free')} disabled={isLoading}>
                    Start Free
                </Button>
            </Card>

            {/* 2. BASIC TIER */}
            <Card className="p-5 border-2 hover:border-primary transition-all">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-lg">Basic (Ad-Free)</h4>
                    <span className="text-xl font-bold text-primary">
                        {billingCycle === 'monthly' 
                            ? (currentOffering?.basic?.monthly?.product.priceString || "$4.99") 
                            : (currentOffering?.basic?.annual?.product.priceString || "$44.99")
                        }
                    </span>
                </div>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• **No Advertisements**</li>
                    <li>• Meal history logs</li>
                    <li>• Weight & Waist progress charts</li>
                </ul>
                <Button className="w-full mt-4" onClick={() => handlePurchase('basic')} disabled={isLoading || (Capacitor.isNativePlatform() && !currentOffering)}>
                    Select Basic
                </Button>
            </Card>

            {/* 3. PREMIUM TIER (Most Popular) */}
            <Card className="p-5 border-2 border-primary bg-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] px-2 py-0.5 rounded-bl-lg font-bold">MOST POPULAR</div>
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="font-bold text-lg">Premium Plan</h4>
                        {billingCycle === 'yearly' && <span className="text-green-600 text-xs font-bold">Save 25% with Yearly</span>}
                    </div>
                    <span className="text-xl font-bold text-primary">
                        {billingCycle === 'monthly' 
                            ? (currentOffering?.monthly?.product.priceString || "$9.99") 
                            : (currentOffering?.annual?.product.priceString || "$89.99")
                        }
                    </span>
                </div>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                    <li>• Everything in Basic</li>
                    <li>• **AI Meal Analysis**</li>
                    <li>• Full hunger-logic integration</li>
                    <li>• Priority support</li>
                </ul>
                <Button className="w-full mt-4" onClick={() => handlePurchase('premium')} disabled={isLoading || (Capacitor.isNativePlatform() && !currentOffering)}>
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Go Premium"}
                </Button>
            </Card>

            {/* 4. COACHING (Contact Us) */}
            <Card className="p-5 border-2 border-dashed border-muted-foreground/50 bg-muted/20">
                <div className="flex justify-between items-center">
                    <h4 className="font-bold text-lg">1-on-1 Coaching</h4>
                    <span className="text-sm font-medium italic">Custom Pricing</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                    Work directly with our team to build a personalized plan based on the "HungerFree & Happy" methodology.
                </p>
                <Button 
                    className="w-full mt-4" 
                    variant="secondary" 
                    onClick={() => window.location.href = 'mailto:support@yourdomain.com?subject=Coaching Inquiry'}
                >
                    Contact Us for Coaching
                </Button>
            </Card>
        </div>
    </div>
)}
                    </CardContent>

                    <CardFooter className="flex justify-between">
                        {step > 1 && step < 4 && (
                            <Button type="button" variant="ghost" onClick={prevStep} disabled={isLoading}>
                                <ArrowLeft className="mr-2 h-4 w-4" /> Back
                            </Button>
                        )}
                        {step < 4 && (
                            <Button type="button" className="ml-auto" onClick={nextStep}>
                                Next <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}