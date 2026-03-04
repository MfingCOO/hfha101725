'use client';

import { useState } from 'react';
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
import { Loader2, ArrowLeft, ArrowRight, Star, Gem, Award, ShieldOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { UserTier } from '@/types';
import { TIER_ACCESS } from '@/types'; 
import { AppNumberInput } from '@/components/ui/number-input';

// Define the missing interface
interface CreateClientFormProps {
    onFormSubmit: (values: CreateClientValues) => Promise<void>;
    onCancel: () => void;
}

const tierDetails: Record<string, { name: string; price: string; yearPrice: string; features: string[], icon: React.ElementType, cta: string, highlight?: boolean }> = {
    free: { name: "Free", price: "$0", yearPrice: "", features: ["Core Pillar Tracking (Nutrition, Activity, Sleep, Hydration)", "Limited Insights", "Ad-Supported"], icon: Star, cta: "Start for Free" },
    'ad-free': { name: "Ad-Free", price: "$1.99/mo", yearPrice: "$19.99/yr", features: ["Everything in Free", "Ad-Free Experience"], icon: ShieldOff, cta: "Go Ad-Free" },
    basic: { name: "Basic", price: "$4.99/mo", yearPrice: "$49.99/yr", features: ["Everything in Ad-Free", "Full Biometric & Habit Tracking", "75/20/20 Protocol & Planner Tools", "Personalized Insights & Trends"], icon: Star, cta: "Choose Basic" },
    premium: { name: "Premium", price: "$7.99/mo", yearPrice: "$79.99/yr", features: ["Everything in Basic", "Community Challenges", "Group Messaging"], icon: Gem, cta: "Go Premium", highlight: true },
    coaching: { name: "Coaching", price: "$199.99/mo", yearPrice: "", features: ["Everything in Premium", "1-on-1 Human Coaching", "Personalized Meal & Activity Plans", "Priority Support"], icon: Award, cta: "Start Coaching" }
};

const createClientSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    fullName: z.string().min(2, "Please enter client's full name."),
    tier: z.string(), 
    birthdate: z.string().refine((val) => val ? new Date(val) < new Date() : true, { message: "Birthdate must be in the past." }),
    sex: z.enum(['male', 'female', 'unspecified']),
    units: z.enum(['imperial', 'metric']),
    height: z.coerce.number().positive(),
    weight: z.coerce.number().positive(),
    waist: z.coerce.number().positive(),
    zipCode: z.string().regex(/^\d{5}$/, "Please enter a valid 5-digit zip code."),
    activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
    wakeTime: z.string(),
    sleepTime: z.string(),
});

export type CreateClientValues = z.infer<typeof createClientSchema>;

export function CreateClientForm({ onFormSubmit, onCancel }: CreateClientFormProps) {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    
    const form = useForm<CreateClientValues>({
        resolver: zodResolver(createClientSchema),
        defaultValues: {
            email: "",
            password: "",
            fullName: "",
            tier: 'basic', 
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
        },
    });

    const totalSteps = 3;
    const progress = (step / totalSteps) * 100;

    const nextStep = async () => {
        let fieldsToValidate: (keyof CreateClientValues)[] = [];
        if (step === 1) fieldsToValidate = ['email', 'password', 'fullName', 'tier'];
        if (step === 2) fieldsToValidate = ['birthdate', 'sex', 'units', 'height', 'weight', 'waist', 'zipCode'];
        
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) setStep(s => s + 1);
    };

    const onSubmit = async (values: CreateClientValues) => {
        setIsLoading(true);
        try {
            await onFormSubmit(values);
        } catch (error) {
            toast({ title: "Error", description: "Failed to create client.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full shadow-none border-none">
            <CardHeader>
                <CardTitle className="text-2xl text-center">Onboard New Client</CardTitle>
                <CardDescription className="text-center">Complete the client's profile. (Step {step} of {totalSteps})</CardDescription>
                <Progress value={progress} className="mt-4" />
            </CardHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <CardContent className="space-y-6">
                        {step === 1 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Account Details</h3>
                                <FormField
                                    control={form.control}
                                    name="fullName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Client's Full Name</FormLabel>
                                            <FormControl><Input placeholder="Jane Doe" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address</FormLabel>
                                            <FormControl><Input type="email" placeholder="client@example.com" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Initial Password</FormLabel>
                                            <FormControl><Input type="password" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="tier"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Assign Tier</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select a tier" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {TIER_ACCESS.map((tier) => {
                                                        const detail = tierDetails[tier.toLowerCase()];
                                                        const Icon = detail?.icon || Star;
                                                        return (
                                                            <SelectItem key={tier} value={tier.toLowerCase()}>
                                                                <div className="flex items-center gap-2">
                                                                    <Icon className="h-4 w-4" />
                                                                    <span className="capitalize">{tier}</span>
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Biometrics & Demographics</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="birthdate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Birthdate</FormLabel>
                                                <FormControl><Input type="date" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="zipCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Zip Code</FormLabel>
                                                <FormControl><Input placeholder="90210" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormField
                                    control={form.control}
                                    name="sex"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Biological Sex</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="male" id="male" />
                                                        <FormLabel htmlFor="male" className="font-normal">Male</FormLabel>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <RadioGroupItem value="female" id="female" />
                                                        <FormLabel htmlFor="female" className="font-normal">Female</FormLabel>
                                                    </div>
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-3 gap-4">
                                    <FormField control={form.control} name="height" render={({ field }) => (
                                        <FormItem><FormLabel>Height</FormLabel><AppNumberInput {...field} /><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="weight" render={({ field }) => (
                                        <FormItem><FormLabel>Weight</FormLabel><AppNumberInput {...field} /><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="waist" render={({ field }) => (
                                        <FormItem><FormLabel>Waist</FormLabel><AppNumberInput {...field} /><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in fade-in">
                                <h3 className="font-semibold text-lg">Lifestyle & Schedule</h3>
                                <FormField
                                    control={form.control}
                                    name="activityLevel"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Activity Level</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="sedentary">Sedentary</SelectItem>
                                                    <SelectItem value="light">Lightly Active</SelectItem>
                                                    <SelectItem value="moderate">Moderately Active</SelectItem>
                                                    <SelectItem value="active">Very Active</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="wakeTime" render={({ field }) => (
                                        <FormItem><FormLabel>Wake Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={form.control} name="sleepTime" render={({ field }) => (
                                        <FormItem><FormLabel>Sleep Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex justify-between border-t pt-6">
                        <Button type="button" variant="ghost" onClick={step === 1 ? onCancel : () => setStep(s => s - 1)}>
                            {step === 1 ? 'Cancel' : <><ArrowLeft className="mr-2 h-4 w-4" /> Previous</>}
                        </Button>
                        {step < totalSteps ? (
                            <Button type="button" onClick={nextStep}>
                                Next <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Client Account
                            </Button>
                        )}
                    </CardFooter>
                </form>
            </Form>
        </Card>
    );
}