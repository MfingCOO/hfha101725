'use client';
import { useState } from 'react';
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
import { Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { Progress } from '../ui/progress';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Checkbox } from '../ui/checkbox';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppNumberInput } from '../ui/number-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';


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

// Defines the structure for pricing with corrected values
const prices = {
    'ad-free': { monthly: 1.99, yearly: 19.99 },
    basic: { monthly: 4.99, yearly: 49.99 },
    premium: { monthly: 7.99, yearly: 79.99 },
    coaching: { monthly: 199.99, yearly: 1999.99 },
};

export function OnboardingForm({ onFormSubmit }: OnboardingFormProps) {
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    
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

    const handleSubscriptionClick = async (tier: 'free' | 'ad-free' | 'basic' | 'premium' | 'coaching') => {
        setIsLoading(true);
        const values = form.getValues();
        const submissionData = {
            ...values,
            tier: tier,
            billingCycle: billingCycle
        };
        await onFormSubmit(submissionData);
        // We don't set loading to false because we expect a redirect.
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
                            <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel>Password</FormLabel><FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl><FormMessage /></FormItem>)} />
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
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                 {/* Free Plan */}
                                <Card className="flex flex-col justify-between">
                                    <CardHeader><CardTitle>Free</CardTitle><CardDescription>Basic tracking with ads.</CardDescription></CardHeader>
                                    <CardContent><p className="text-3xl font-bold">Free</p></CardContent>
                                    <CardFooter><Button className="w-full" disabled>Coming Soon</Button></CardFooter>
                                </Card>
                                {/* Ad-Free Plan */}
                                <Card className="flex flex-col justify-between">
                                    <CardHeader><CardTitle>Ad-Free</CardTitle><CardDescription>An uninterrupted experience.</CardDescription></CardHeader>
                                    <CardContent><p className="text-3xl font-bold">${prices['ad-free'][billingCycle]} <span className="text-lg font-normal text-muted-foreground">/ {billingCycle === 'monthly' ? 'mo' : 'yr'}</span></p></CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleSubscriptionClick('ad-free')} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}</Button></CardFooter>
                                </Card>
                                 {/* Basic Plan */}
                                <Card className="flex flex-col justify-between">
                                    <CardHeader><CardTitle>Basic</CardTitle><CardDescription>Core tracking features.</CardDescription></CardHeader>
                                    <CardContent><p className="text-3xl font-bold">${prices.basic[billingCycle]} <span className="text-lg font-normal text-muted-foreground">/ {billingCycle === 'monthly' ? 'mo' : 'yr'}</span></p></CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleSubscriptionClick('basic')} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}</Button></CardFooter>
                                </Card>
                                  {/* Premium Plan */}
                                <Card className="border-primary flex flex-col justify-between">
                                    <CardHeader><CardTitle>Premium</CardTitle><CardDescription>AI insights, challenges, and community.</CardDescription></CardHeader>
                                    <CardContent><p className="text-3xl font-bold">${prices.premium[billingCycle]} <span className="text-lg font-normal text-muted-foreground">/ {billingCycle === 'monthly' ? 'mo' : 'yr'}</span></p></CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleSubscriptionClick('premium')} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}</Button></CardFooter>
                                </Card>
                                 {/* Coaching Plan */}
                                <Card className="flex flex-col justify-between lg:col-span-2">
                                    <CardHeader><CardTitle>Coaching</CardTitle><CardDescription>Premium plus one-on-one coaching.</CardDescription></CardHeader>
                                    <CardContent><p className="text-3xl font-bold">${prices.coaching[billingCycle]} <span className="text-lg font-normal text-muted-foreground">/ {billingCycle === 'monthly' ? 'mo' : 'yr'}</span></p></CardContent>
                                    <CardFooter><Button className="w-full" onClick={() => handleSubscriptionClick('coaching')} disabled={isLoading}>{isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Subscribe'}</Button></CardFooter>
                                </Card>
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div>
                        {step > 1 && step < 4 ? (
                             <Button type="button" variant="ghost" onClick={prevStep}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Previous
                            </Button>
                        ): <div />}
                    </div>
                     <div>
                        {step < totalSteps && (
                            <Button type="button" onClick={nextStep} disabled={step === 3 && !form.watch('disclaimer')}>
                                Next
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </CardFooter>
                 <div className="pb-6 text-center text-sm">
                    Already have an account?{' '}
                    <Link href="/login" className="underline">
                        Sign In
                    </Link>
                </div>
            </form>
        </Form>
    </Card>
  );
}
