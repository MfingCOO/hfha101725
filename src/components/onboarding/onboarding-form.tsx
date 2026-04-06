'use client';

import { useState, useEffect, useCallback } from 'react';
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
import type { PurchasesOffering, PurchasesPackage } from '@revenuecat/purchases-capacitor';

const onboardingSchema = z.object({
    email: z.string().email("Please enter a valid email."),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Please enter your full name."),
    birthdate: z.string().min(1, "Birthdate is required."),
    sex: z.enum(['male', 'female', 'unspecified']),
    height: z.coerce.number().positive("Height must be positive"),
    weight: z.coerce.number().positive("Weight must be positive"),
    waist: z.coerce.number().positive("Waist must be positive"),
    zipCode: z.string().regex(/^\d{5}$/, "Invalid Zip Code (5 digits)"),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string().min(1, "Wake time is required"),
    sleepTime: z.string().min(1, "Sleep time is required"),
    disclaimer: z.boolean().refine(val => val === true, { message: "You must accept the disclaimer to continue." }),
    units: z.enum(['imperial', 'metric']),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
    onFormSubmit: (data: any) => Promise<{success: boolean}>;
    offerings: PurchasesOffering | null;
}

export function OnboardingForm({ onFormSubmit, offerings }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');

    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        // FIX: Provide default values for ALL form fields to prevent uncontrolled -> controlled error.
        defaultValues: { 
            email: "",
            password: "",
            fullName: "",
            birthdate: "",
            sex: 'unspecified',
            height: 0,
            weight: 0,
            waist: 0,
            zipCode: "",
            activityLevel: 'light',
            wakeTime: "07:00",
            sleepTime: "22:00",
            disclaimer: false,
            units: 'imperial'
        },
    });

    const nextStep = async () => {
        const fields: any = {
            1: ['email', 'password', 'fullName'],
            2: ['birthdate', 'sex', 'height', 'weight', 'waist', 'zipCode', 'units'],
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
            
            if (!pkg) throw new Error("Plan not found in store.");

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
            if (customerInfo.entitlements.active) {
                await onFormSubmit({ ...values, tier, billingCycle: pkgKey });
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
                    {step === 4 ? "Select Your Plan" : "Create Your Account"}
                </CardTitle>
                <Progress value={(step / 4) * 100} className="h-2 mt-2" />
                <CardDescription className="text-center pt-2">Step {step} of 4</CardDescription>
            </CardHeader>

            <Form {...form}>
                <form className="space-y-6">
                    <CardContent>
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="fullName" render={({ field }) => (<FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="Your Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email Address</FormLabel><FormControl><Input type="email" placeholder="email@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="Min. 8 characters" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="birthdate" render={({ field }) => (<FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="sex" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Biological Sex</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="male" /></FormControl><FormLabel className="font-normal text-sm">Male</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="female" /></FormControl><FormLabel className="font-normal text-sm">Female</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="unspecified" /></FormControl><FormLabel className="font-normal text-sm">Prefer not to say</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-3 gap-2">
                                    <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                    <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                    <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist</FormLabel><AppNumberInput {...field} /></FormItem>)} />
                                </div>
                                <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><Input placeholder="12345" {...field} /></FormItem>)} />
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in">
                                <FormField control={form.control} name="activityLevel" render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <FormLabel>Approximate Activity Level</FormLabel>
                                        <FormControl>
                                            <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="sedentary" /></FormControl><FormLabel className="font-normal text-sm">Sedentary (little or no exercise)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="light" /></FormControl><FormLabel className="font-normal text-sm">Lightly active (light exercise 1-3 days/week)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="moderate" /></FormControl><FormLabel className="font-normal text-sm">Moderately active (moderate exercise 3-5 days/week)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="active" /></FormControl><FormLabel className="font-normal text-sm">Very active (hard exercise 6-7 days/week)</FormLabel></FormItem>
                                                <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="very_active" /></FormControl><FormLabel className="font-normal text-sm">Extra active (very hard exercise & physical job)</FormLabel></FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="wakeTime" render={({ field }) => (<FormItem><FormLabel>Typical Wake Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name="sleepTime" render={({ field }) => (<FormItem><FormLabel>Typical Sleep Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                </div>
                                
                                <div className="p-4 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-[11px] leading-relaxed">
                                    <p className="mb-2">This application ('App') is intended as a tool to help you track your habits and choices. The information and guidance provided within this App are based on the principles of the "~Hunger Free and Happy" book.</p>
                                    <p className="mb-2">The App is not a medical device, nor does it provide medical advice. The creators, developers, distributors, and affiliates of this App are not medical professionals and expressly disclaim all liability for any actions taken or not taken based on the content of this App. Your use of this App is solely at your own risk.</p>
                                    <p>By checking this box, you acknowledge that you have read, understood, and agree to this disclaimer, releasing the App and its creators of all liability.</p>
                                </div>

                                <FormField control={form.control} name="disclaimer" render={({ field }) => (
                                    <FormItem className="flex items-start space-x-3 space-y-0 rounded-md border p-4">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <div className="space-y-1"><FormLabel className="text-xs font-medium">I have read, understood, and agree to the disclaimer.</FormLabel><FormMessage /></div>
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-4 animate-in slide-in-from-bottom-4">
                                <div className="flex items-center justify-center space-x-4 bg-muted/50 p-2 rounded-full mb-6">
                                    <Label className={billingCycle === 'monthly' ? "font-bold text-primary text-xs" : "text-xs"}>Monthly</Label>
                                    <Switch checked={billingCycle === 'annual'} onCheckedChange={(v) => setBillingCycle(v ? 'annual' : 'monthly')} />
                                    <Label className={billingCycle === 'annual' ? "font-bold text-primary text-xs" : "text-xs"}>Yearly</Label>
                                </div>
                                <div className="grid gap-4">
                                    <Card className="p-4 border-2 border-primary bg-primary/5 cursor-pointer shadow-md" onClick={() => handlePurchase('premium', billingCycle)}>
                                        <div className="flex justify-between items-center mb-2">
                                            <div>
                                                <h4 className="font-bold text-lg text-primary">Premium</h4>
                                                <p className="text-[10px] text-primary font-bold uppercase tracking-tight">Best for Total Transformation</p>
                                            </div>
                                            <span className="font-bold text-lg text-primary">
                                                {billingCycle === 'monthly' ? (offerings?.monthly?.product.priceString || "$--") : (offerings?.annual?.product.priceString || "$--")}
                                            </span>
                                        </div>
                                        <ul className="text-[11px] space-y-1 text-muted-foreground">
                                            <li>• **UPF/Gluten Free Nutritional Analysis** (Meal Scanning)</li>
                                            <li>• Exclusive access to Live Events</li>
                                            <li>• Community Chat Groups & Workout Programs</li>
                                            <li>• Priority Customer Support</li>
                                        </ul>
                                    </Card>
                                    <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('basic_tier', billingCycle)}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-lg">Basic</h4>
                                            <span className="font-bold text-lg text-primary">
                                                {offerings?.availablePackages?.find(p => p.identifier === `basic_tier:basic-${billingCycle}`)?.product.priceString || "$--"}
                                            </span>
                                        </div>
                                        <ul className="text-[11px] space-y-1 text-muted-foreground">
                                            <li>• Everything From Ad-Free</li>
                                            <li>• Full access to all App tracking tools</li>
                                            <li>• Craving/Binge & Stress Tracking</li>
                                            <li>• Historical progress charts & insights</li>
                                        </ul>
                                    </Card>
                                    <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('ad_free_tier', billingCycle)}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-lg">Ad-Free</h4>
                                            <span className="font-bold text-lg text-primary">
                                                {offerings?.availablePackages?.find(p => p.identifier === `ad_free_tier:ad-free-${billingCycle}`)?.product.priceString || "$--"}
                                            </span>
                                        </div>
                                        <ul className="text-[11px] space-y-1 text-muted-foreground">
                                            <li>• Everything in Free</li>
                                            <li>• **Completely Ad-Free experience**</li>
                                            <li>• Cleaner, distraction-free interface</li>
                                        </ul>
                                    </Card>
                                    <Card className="p-4 border cursor-pointer hover:border-primary transition-all" onClick={() => handlePurchase('free')}>
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="font-bold text-lg">Free</h4>
                                            <span className="font-bold text-lg text-primary">$0</span>
                                        </div>
                                        <ul className="text-[11px] space-y-1 text-muted-foreground">
                                            <li>• Basic Habit Tracking (Hydration, Nutrition, Activity)</li>
                                            <li>• Full Calendar Access</li>
                                            <li>• Supported by advertisements</li>
                                        </ul>
                                    </Card>
                                    <Card className="p-4 border border-dashed bg-muted/10 text-center flex flex-col items-center">
                                        <h4 className="font-bold text-sm mb-1">One-on-One Coaching</h4>
                                        <p className="text-[10px] text-muted-foreground mb-4">Get personalized strategy and direct support for your specific journey.</p>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full text-xs font-bold border-primary text-primary hover:bg-primary hover:text-white"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.location.href='mailto:support@hungerfreeandhappy.app?subject=Coaching Consultation Request';
                                            }}
                                        >
                                            Contact Us for Coaching
                                        </Button>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col space-y-4">
                        <div className="flex justify-between w-full">
                            {step > 1 && step < 4 && (
                                <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={isLoading}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
                            )}
                            {step < 4 && (
                                <Button type="button" className="ml-auto" onClick={nextStep}>Next <ArrowRight className="ml-2 h-4 w-4" /></Button>
                            )}
                        </div>

                        <div className="w-full pt-4 border-t text-center">
                            <p className="text-sm text-muted-foreground">
                                Already have an account? 
                                <Button variant="link" type="button" className="p-0 h-auto ml-1 font-bold text-primary" onClick={() => router.push('/login')}>Log In</Button>
                            </p>
                        </div>
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}
