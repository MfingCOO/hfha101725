'use client';
import { useState, useEffect } from 'react';
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
import { Loader2, ArrowLeft, ArrowRight, CheckCircle, Sparkles } from 'lucide-react';
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
import { Purchases, PurchasesOffering } from '@revenuecat/purchases-capacitor';

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
    disclaimer: z.boolean().refine(val => val === true, { message: "You must accept the disclaimer." }),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

interface OnboardingFormProps {
    onFormSubmit: (data: any) => Promise<{success: boolean, error?: any}>;
}

export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

    // Initialize RevenueCat and get plans
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const initRevenueCat = async () => {
                try {
                    await Purchases.configure({ apiKey: "goog_NklNVostxEsZmVEiHkgORKJMJgp" });
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current) {
                        setCurrentOffering(offerings.current);
                    }
                } catch (e) {
                    console.error("RevenueCat Init Failed", e);
                }
            };
            initRevenueCat();
        }
    }, []);

    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: { 
            email: "", password: "", fullName: "", birthdate: "", 
            sex: "unspecified", units: 'imperial', height: 0, 
            weight: 0, waist: 0, zipCode: "", activityLevel: 'light', 
            wakeTime: "07:00", sleepTime: "22:00", disclaimer: false, 
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
        if (isValid) setStep(s => s + 1);
    };

    const handlePurchase = async (pkg: any) => {
        setIsLoading(true);
        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
            
            if (Object.keys(customerInfo.entitlements.active).length > 0) {
                const values = form.getValues();
                await onFormSubmit({ ...values, tier: 'premium' });
                router.push('/dashboard');
            }
        } catch (e: any) {
            if (!e.userCancelled) {
                toast({ variant: 'destructive', title: "Error", description: e.message });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleFreeSignUp = async () => {
        setIsLoading(true);
        const values = form.getValues();
        const result = await onFormSubmit({ ...values, tier: 'free' });
        if (result.success) {
            router.push('/dashboard');
        } else {
            toast({ variant: 'destructive', title: "Error", description: "Failed to create account." });
        }
        setIsLoading(false);
    };

    return (
        <Card className="w-full shadow-none border-none">
            <CardHeader>
                <CardTitle className="text-center">
                    {step === 4 ? "Choose Your Plan" : "Create Your Account"}
                </CardTitle>
                <Progress value={progress} className="mt-2" />
            </CardHeader>

            <Form {...form}>
                <form className="space-y-4">
                    <CardContent>
                        {step === 1 && (
                            <div className="space-y-4">
                                <FormField control={form.control} name="fullName" render={({ field }) => (
                                    <FormItem><FormLabel>Full Name</FormLabel><Input {...field} /></FormItem>
                                )} />
                                <FormField control={form.control} name="email" render={({ field }) => (
                                    <FormItem><FormLabel>Email</FormLabel><Input {...field} /></FormItem>
                                )} />
                                <FormField control={form.control} name="password" render={({ field }) => (
                                    <FormItem><FormLabel>Password</FormLabel><Input type="password" {...field} /></FormItem>
                                )} />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4">
                                <FormField control={form.control} name="birthdate" render={({ field }) => (
                                    <FormItem><FormLabel>Birthdate</FormLabel><Input type="date" {...field} /></FormItem>
                                )} />
                                {/* ... Add sex and units fields here ... */}
                            </div>
                        )}

                        {step === 4 && (
                            <div className="space-y-4">
                                {currentOffering?.availablePackages.map((pkg) => (
                                    <Card key={pkg.identifier} className="border-primary border-2">
                                        <CardHeader>
                                            <CardTitle>{pkg.product.title}</CardTitle>
                                            <div className="text-2xl font-bold">{pkg.product.priceString}</div>
                                        </CardHeader>
                                        <CardFooter>
                                            <Button className="w-full" onClick={() => handlePurchase(pkg)} disabled={isLoading}>
                                                {isLoading ? <Loader2 className="animate-spin" /> : "Subscribe Now"}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                                <Button variant="ghost" className="w-full" onClick={handleFreeSignUp}>
                                    Continue with Free Version
                                </Button>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex justify-between">
                        {step > 1 && step < 4 && (
                            <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>
                        )}
                        {step < 4 && (
                            <Button onClick={nextStep}>Next</Button>
                        )}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}