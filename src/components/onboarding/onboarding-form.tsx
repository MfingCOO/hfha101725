
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
import { Purchases, PurchasesOffering, PurchasesPackage } from '@revenuecat/purchases-capacitor'; // Import RevenueCat Purchases types


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

// REMOVED: prices object entirely
// REMOVED: productIds object entirely

type Tier = 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching'
  | 'Free' | 'AdFree' | 'Basic' | 'Premium' | 'Coaching'; // Ensure Tier matches UserTier

type Platform = 'web' | 'android';

// Map your internal UserTier and billing cycle to RevenueCat Package Identifiers
// FIXED: Corrected keys to explicitly include both lowercase/kebab-case and PascalCase from UserTier type
// NOTE: You MUST REPLACE THESE PLACEHOLDER IDs WITH YOUR ACTUAL REVENUECAT PACKAGE IDENTIFIERS.
//       These are the `identifier` values you assign to packages in RevenueCat's dashboard.
const revenueCatPackageMap: Record<Tier, { monthly?: string; yearly?: string; free?: string }> = {
  // Lowercase/kebab-case keys for compatibility
  'free': { free: 'your_rc_free_web_package_id' }, 
  'ad-free': {
    monthly: 'your_rc_ad_free_monthly_package_id',
    yearly: 'your_rc_ad_free_yearly_package_id',
  },
  'basic': {
    monthly: 'your_rc_basic_monthly_package_id',
    yearly: 'your_rc_basic_yearly_package_id',
  },
  'premium': {
    monthly: 'your_rc_premium_monthly_package_id',
    yearly: 'your_rc_premium_yearly_package_id',
  },
  'coaching': {}, 
  // PascalCase keys for full UserTier compatibility
  'Free': { free: 'your_rc_free_web_package_id' }, 
  'AdFree': {
    monthly: 'your_rc_ad_free_monthly_package_id',
    yearly: 'your_rc_ad_free_yearly_package_id',
  },
  'Basic': {
    monthly: 'your_rc_basic_monthly_package_id',
    yearly: 'your_rc_basic_yearly_package_id',
  },
  'Premium': {
    monthly: 'your_rc_premium_monthly_package_id',
    yearly: 'your_rc_premium_yearly_package_id',
  },
  'Coaching': {}, 
};

const FeatureListItem = ({ children }: { children: React.ReactNode }) => (
    <li className="flex items-start">
        <CheckCircle className="h-4 w-4 mr-2 mt-1 flex-shrink-0 text-primary" />
        <span className="text-sm text-muted-foreground">{children}</span>
    </li>
);

export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
    const [platform, setPlatform] = useState<Platform>('web');
    const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null); // ADDED: State to store current offering

    // ADDED: Fetch offerings on component mount
    useEffect(() => {
        const fetchOfferings = async () => {
            try {
                if (typeof window !== 'undefined' && (window as any).androidBridge) {
                    setPlatform('android');
                } else { // Assume web if not androidBridge
                    setPlatform('web');
                }
                const offerings = await Purchases.getOfferings();
                if (offerings.current) {
                    setCurrentOffering(offerings.current);
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: "No current RevenueCat offering found." });
                }
            } catch (error) {
                console.error("Error fetching RevenueCat offerings:", error);
                toast({ variant: 'destructive', title: 'Error', description: "Failed to load subscription plans." });
            } finally {
                // Even if loading fails, we want to allow user to try free or contact for coaching
                // setIsLoading(false); // Do not set false here, as purchase flow sets it.
            }
        };
        fetchOfferings();
    }, [toast]);

    const form = useForm<OnboardingValues>({
        resolver: zodResolver(onboardingSchema),
        defaultValues: {
            email: "",
            password: "",
            fullName: "",
            birthdate: "",
            sex: "unspecified",
            units: 'imperial',
            height: 0,
            weight: 0,
            waist: 0,
            zipCode: "",
            activityLevel: 'light',
            wakeTime: "07:00",
            sleepTime: "22:00",
            disclaimer: false,
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
        if (!isValid) return;

        setStep(s => s + 1);
    };

    const prevStep = () => {
        window.scrollTo(0, 0);
        setStep(s => s - 1);
    };

    // ADDED: getPackagePrice function to retrieve price from offerings
    const getPackagePrice = useCallback((tier: Tier, cycle: 'monthly' | 'yearly' | 'free') => {
        if (!currentOffering) return null;

        // Dynamically select the correct map entry based on `tier`'s casing
        const tierKey = (tier === 'free' || tier === 'Free') ? 'Free' : 
                        (tier === 'ad-free' || tier === 'AdFree') ? 'AdFree' : 
                        (tier === 'basic' || tier === 'Basic') ? 'Basic' : 
                        (tier === 'premium' || tier === 'Premium') ? 'Premium' : null; 
        
        if (!tierKey) return null; // Should not happen with correct Tier input

        let desiredPackageIdentifier: string | undefined;
        if (tierKey === 'Free') {
            desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.free;
        } else {
            desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.[cycle as 'monthly' | 'yearly'];
        }
        
        if (!desiredPackageIdentifier) return null;

        const foundPackage = currentOffering.availablePackages.find(pkg => pkg.identifier === desiredPackageIdentifier);
        // FIXED: Changed currency_code to currencyCode
        return foundPackage ? `${foundPackage.product.currencyCode} ${foundPackage.product.price}` : null;
    }, [currentOffering]);

    const handlePurchase = async (tier: Tier, billingCycle: 'monthly' | 'yearly' | 'free') => {
        setIsLoading(true);
        setSelectedTier(tier); // Set selected tier for loading state

        try {
            if (!currentOffering) {
                throw new Error("RevenueCat offerings not loaded.");
            }

            let desiredPackageIdentifier: string | undefined;
            // Dynamically select the correct map entry based on `tier`'s casing
            const tierKey = (tier === 'free' || tier === 'Free') ? 'Free' : 
                            (tier === 'ad-free' || tier === 'AdFree') ? 'AdFree' : 
                            (tier === 'basic' || tier === 'Basic') ? 'Basic' : 
                            (tier === 'premium' || tier === 'Premium') ? 'Premium' : null; 

            if (!tierKey) {
                throw new Error(`Invalid tier: ${tier} for package mapping.`);
            }

            if (tierKey === 'Free') {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.free;
            } else {
                desiredPackageIdentifier = revenueCatPackageMap[tierKey]?.[billingCycle as 'monthly' | 'yearly'];
            }

            if (!desiredPackageIdentifier) {
                throw new Error(`No RevenueCat package mapped for tier: ${tier} and cycle: ${billingCycle}`);
            }

            let packageToPurchase: PurchasesPackage | undefined;
            for (const offeringPackage of currentOffering.availablePackages) {
                if (offeringPackage.identifier === desiredPackageIdentifier) {
                    packageToPurchase = offeringPackage;
                    break;
                }
            }

            if (!packageToPurchase) {
                throw new Error(`RevenueCat package '${desiredPackageIdentifier}' not found in current offering.`);
            }

            const { customerInfo } = await Purchases.purchasePackage({ aPackage: packageToPurchase });

            if (Object.keys(customerInfo.entitlements.active).length > 0 || tierKey === 'Free') { 
                toast({ title: "Purchase Successful!", description: "Your subscription is now active." });
                
                const values = form.getValues();
                const submissionData = {
                    ...values,
                    tier: tier,
                    billingCycle: billingCycle,
                };
                await onFormSubmit(submissionData); 
                router.push('/login'); 
            } else {
                toast({ title: "Purchase Completed", description: "Please check your subscription status.", variant: "default" });
            }

        } catch (e: any) {
            console.error("RevenueCat purchase failed:", e);
            let errorMessage = "Could not complete the purchase. Please try again.";
            if (e.code === 'PURCHASE_CANCELLED') {
                errorMessage = "Purchase cancelled.";
            } else if (e.message) {
                errorMessage = e.message;
            }
            toast({ title: "Purchase Failed", description: errorMessage, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    const handleButtonClick = (tier: Tier) => {
        if (tier === 'coaching' || tier === 'Coaching') { // FIXED: Compare with both casing options
            window.location.href = "mailto:support@yourapp.com?subject=Coaching Inquiry";
            return;
        }

        const finalBillingCycle = (tier === 'free' || tier === 'Free') ? 'free' : billingCycle; // FIXED: Compare with both casing options
        handlePurchase(tier, finalBillingCycle);
    };

    // ADDED: renderPrice helper function for JSX
    const renderPrice = (tier: Tier, cycle: 'monthly' | 'yearly') => {
        const price = getPackagePrice(tier, cycle);
        if (!currentOffering) { // Show loading state if offerings are not yet loaded
            return <p className="text-3xl font-bold">Loading...</p>;
        }
        return price ? 
            <p className="text-3xl font-bold">{price} <span className="text-lg font-normal text-muted-foreground">/ {cycle === 'monthly' ? 'mo' : 'yr'}</span></p> : 
            <p className="text-3xl font-bold">Not Available</p>;
    };

    return (
    <Card className="w-full shadow-none border-none">
        <CardHeader className="pt-2">
             <CardTitle className="text-xl text-center">
                {step === 4 ? "Choose Your Plan" : "Create Your Account"}
            </CardTitle>
            <CardDescription className="text-center">
                {step === 4 ? "Select a plan to continue." : `Step ${step} of ${totalSteps}`}
            </CardDescription>
            <Progress value={progress} className="mt-2" />
        </CardHeader>
        <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()}> 
                <CardContent className="space-y-3">
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
                             <FormField control={form.control} name="sex" render={({ field }) => (<FormItem className="space-y-2"><FormLabel>Sex</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="male" /></FormControl><FormLabel className="font-normal">Male</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="female" /></FormControl><FormLabel className="font-normal">Female</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="unspecified" /></FormControl><FormLabel className="font-normal">Prefer not to say</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <FormField control={form.control} name="height" render={({ field }) => (<FormItem><FormLabel>Height ({form.watch('units') === 'imperial' ? 'in' : 'cm'})</FormLabel><FormControl><AppNumberInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="weight" render={({ field }) => (<FormItem><FormLabel>Weight ({form.watch('units') === 'imperial' ? 'lbs' : 'kg'})</FormLabel><FormControl><AppNumberInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                                 <FormField control={form.control} name="waist" render={({ field }) => (<FormItem><FormLabel>Waist ({form.watch('units') === 'imperial' ? 'in' : 'cm'})</FormLabel><FormControl><AppNumberInput {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="units" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Units of Measure</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4"><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="imperial" /></FormControl><FormLabel className="font-normal">Imperial</FormLabel></FormItem><FormItem className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value="metric" /></FormControl><FormLabel className="font-normal">Metric</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                                <FormField control={form.control} name="zipCode" render={({ field }) => (<FormItem><FormLabel>Zip Code</FormLabel><FormControl><Input placeholder="e.g., 90210" {...field} /></FormControl><FormMessage /></FormItem>)} />
                            </div>
                        </div>
                    )}
                    {step === 3 && (
                         <div className="space-y-4 animate-in fade-in">
                            <h3 className="font-semibold text-lg">Your Lifestyle</h3>
                            <FormField control={form.control} name="activityLevel" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Approximate Activity Level</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1"><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="sedentary" /></FormControl><FormLabel className="font-normal">Sedentary (little or no exercise)</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="light" /></FormControl><FormLabel className="font-normal">Lightly active (light exercise/sports 1-3 days/week)</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="moderate" /></FormControl><FormLabel className="font-normal">Moderately active (moderate exercise/sports 3-5 days/week)</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="active" /></FormControl><FormLabel className="font-normal">Very active (hard exercise/sports 6-7 days a week)</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="very_active" /></FormControl><FormLabel className="font-normal">Extra active (very hard exercise/sports & physical job)</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)}/>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <FormField control={form.control} name="wakeTime" render={({ field }) => ( <FormItem><FormLabel>Approx. Wake Up Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                                <FormField control={form.control} name="sleepTime" render={({ field }) => ( <FormItem><FormLabel>Approx. Bedtime</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                            </div>
                            <h3 className="font-semibold text-lg pt-4">Disclaimer</h3>
                            <div className="p-4 border rounded-md max-h-48 overflow-y-auto bg-muted/50 text-sm"><p className="mb-2">This application ('App') is intended as a tool to help you track your habits and choices. The information and guidance provided within this App are based on the principles of the "~Hunger Free and Happy" book.</p><p className="mb-2">The App is not a medical device, nor does it provide medical advice. The creators, developers, distributors, and affiliates of this App are not medical professionals and expressly disclaim all liability for any actions taken or not taken based on the content of this App. Your use of this App is solely at your own risk.</p><p>By checking this box, you acknowledge that you have read, understood, and agree to this disclaimer, releasing the App and its creators of all liability.</p></div>
                            <FormField control={form.control} name="disclaimer" render={({ field }) => (<FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange}/></FormControl><div className="space-y-1 leading-none"><FormLabel>I have read, understood, and agree to the disclaimer.</FormLabel><FormMessage /></div></FormItem>)}/>
                         </div>
                    )}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in">
                             <div className="flex items-center justify-center space-x-2">
                                <Label htmlFor="billing-cycle">Monthly</Label>
                                <Switch id="billing-cycle" checked={billingCycle === 'yearly'} onCheckedChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')} />
                                <Label htmlFor="billing-cycle">Yearly</Label>
                            </div>
                            <div className={cn("gap-4", billingCycle === 'monthly' ? "grid grid-cols-1 lg:grid-cols-3" : "grid grid-cols-1 justify-items-center")}>
                                {/* Free Tier Card - Always visible, but only 'Sign Up Free' button works for web age verification */}
                                <Card className="flex flex-col">
                                    <CardHeader><CardTitle>Free</CardTitle><CardDescription>Build lasting habits with essential tracking tools. Ad-supported.</CardDescription></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        <p className="text-3xl font-bold">Free</p>
                                        <ul className="space-y-2">
                                            <FeatureListItem>Log meals with UPF% & Gluten-Free insights</FeatureListItem>
                                            <FeatureListItem>Track hydration, sleep, and activity</FeatureListItem>
                                            <FeatureListItem>Basic data summaries</FeatureListItem>
                                        </ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => handleButtonClick('Free')} disabled={isLoading && selectedTier === 'Free'}>
                                            {isLoading && selectedTier === 'Free' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sign Up Free'}
                                        </Button>
                                    </CardFooter>
                                </Card>

                                {/* Ad-Free Card */}
                                <Card className={cn("flex flex-col", billingCycle === 'yearly' && "w-full max-w-md")}>
                                    <CardHeader><CardTitle>Ad-Free</CardTitle><CardDescription>Focus on your goals with an uninterrupted, ad-free experience.</CardDescription></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        {renderPrice('AdFree', billingCycle)} 
                                        <ul className="space-y-2"><FeatureListItem>All features from the Free plan</FeatureListItem><FeatureListItem>A completely ad-free experience</FeatureListItem></ul>
                                    </CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleButtonClick('AdFree')} disabled={isLoading && selectedTier === 'AdFree'}>
                                        {isLoading && selectedTier === 'AdFree' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}
                                    </Button></CardFooter>
                                </Card>

                                {/* Basic Card */}
                                <Card className={cn("flex flex-col", billingCycle === 'yearly' && "w-full max-w-md")}>
                                    <CardHeader><CardTitle>Basic</CardTitle><CardDescription>Unlock powerful insights and track all aspects of your health.</CardDescription></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        {renderPrice('Basic', billingCycle)} 
                                        <ul className="space-y-2"><FeatureListItem>Everything in Ad-Free</FeatureListItem><FeatureListItem>Track Stress, Cravings, and Binges</FeatureListItem><FeatureListItem>Analyze trends in Weight and WtHR</FeatureListItem><FeatureListItem>Enable smart hydration reminders</FeatureListItem></ul>
                                    </CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleButtonClick('Basic')} disabled={isLoading && selectedTier === 'Basic'}>
                                        {isLoading && selectedTier === 'Basic' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}
                                    </Button></CardFooter>
                                </Card>

                                {/* Premium Card */}
                                <Card className={cn("border-primary flex flex-col", billingCycle === 'yearly' && "w-full max-w-md")}>
                                    <CardHeader><CardTitle>Premium</CardTitle><CardDescription>Access exclusive content and join our vibrant community.</CardDescription></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        {renderPrice('Premium', billingCycle)} 
                                        <ul className="space-y-2"><FeatureListItem>Everything in Basic</FeatureListItem><FeatureListItem>Full access to all workout programs</FeatureListItem><FeatureListItem>Join live events, Q&As & workouts</FeatureListItem><FeatureListItem>Participate in community challenges & chats</FeatureListItem></ul>
                                    </CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleButtonClick('Premium')} disabled={isLoading && selectedTier === 'Premium'}>
                                        {isLoading && selectedTier === 'Premium' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}
                                    </Button></CardFooter>
                                </Card>

                                {/* Coaching Card - Always visible, but as a contact option */}
                                <Card className="flex flex-col lg:col-span-2">
                                    <CardHeader><CardTitle>Coaching</CardTitle><CardDescription>The ultimate accountability partnership for transformative results.</CardDescription></CardHeader>
                                    <CardContent className="flex-grow space-y-4">
                                        <p className="text-3xl font-bold">Contact Us</p>
                                        <ul className="space-y-2"><FeatureListItem>All Premium features</FeatureListItem><FeatureListItem>Personalized one-on-one coaching</FeatureListItem><FeatureListItem>Daily check-ins & direct messaging</FeatureListItem><FeatureListItem>Weekly one-on-one video conferences</FeatureListItem></ul>
                                    </CardContent>
                                    <CardFooter>
                                        <Button className="w-full" onClick={() => handleButtonClick('Coaching')}> 
                                            Contact for Services 
                                        </Button>
                                    </CardFooter>
                                </Card>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div>{step > 1 && step < 4 ? (<Button type="button" variant="ghost" onClick={prevStep}><ArrowLeft className="mr-2 h-4 w-4" />Previous</Button>): <div />}</div>
                     <div>{step < totalSteps && (<Button type="button" onClick={nextStep} disabled={step === 3 && !form.watch('disclaimer')}>
                                Next<ArrowRight className="ml-2 h-4 w-4" /></Button>)}
                    </div>
                </CardFooter>
                 <div className="pb-6 text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/login" className="underline">Sign In</Link>
                </div>
            </form>
        </Form>
    </Card>
  );
}
