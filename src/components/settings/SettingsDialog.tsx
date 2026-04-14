'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, User, Bell, SlidersHorizontal, Settings as SettingsIcon, CreditCard, LogOut, Trash2, Camera as CameraIcon, Target, Undo2, BrainCircuit, RefreshCw, HelpCircle, FileText, ShieldCheck } from 'lucide-react'; // RENAMED Camera to CameraIcon
import { useAuth } from '@/components/auth/auth-provider';
import { signOut } from 'firebase/auth';
import { auth as clientAuth } from '@/lib/firebase';
import {
    updateUserProfileAction,
    updateUserPasswordAction,
    updateClientProfileAndGoalsAction,
    updateClientSettingsAction,
    // REMOVED: createStripePortalSession as it's no longer used directly
  } from '@/app/client/settings/actions';
import { getSiteSettingsAction, updateSiteSettingsAction } from '@/app/coach/site-settings/actions';
import type { TrackingSettings, ClientProfile, NutritionalGoals } from '@/types';
import { getClientByIdAction } from '@/app/coach/clients/actions';
import { calculateNutritionalGoals, AllGoalSets } from '@/services/goals';
import { cn } from '@/lib/utils';
import Link from 'next/link';

// UI IMPORTS
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // Corrected import
import { Label } from '@/components/ui/label'; // Corrected import
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '../ui/switch';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Separator } from '../ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AppNumberInput } from '../ui/number-input';
import { Slider } from '../ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { BaseModal } from '../ui/base-modal';

// Capacitor Imports
import { Capacitor } from '@capacitor/core';
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from '@capacitor/camera'; // ALIASED Camera as CapacitorCamera
import { Purchases, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Browser } from '@capacitor/browser';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: string;
  defaultAccordion?: string;
}

const accountSchema = z.object({
    fullName: z.string().min(2, "Name is too short."),
    email: z.string().email("Invalid email address."),
    phone: z.string().optional(),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});

const goalsSchema = z.object({
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']),
  calculationMode: z.enum(['ideal', 'actual', 'custom']),
  calorieModifier: z.coerce.number(),
  customMacros: z.object({
    protein: z.coerce.number().positive("Must be > 0").optional().or(z.literal('')),
    fat: z.coerce.number().positive("Must be > 0").optional().or(z.literal('')),
    carbs: z.coerce.number().nonnegative("Cannot be negative").optional().or(z.literal(0)).or(z.literal('')),
  })
});

const siteSettingsSchema = z.object({
  url: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  videoCallLink: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')),
  aiModelSettings: z.object({
      pro: z.string().optional(),
      flash: z.string().optional(),
  }).optional(),
});


const trackingOptions: { id: keyof Omit<TrackingSettings, 'units' | 'reminders'>, label: string }[] = [
    { id: 'nutrition', label: 'Nutrition Tracking' },
    { id: 'hydration', label: 'Hydration Tracking' },
    { id: 'activity', label: 'Activity Tracking' },
    { id: 'sleep', label: 'Sleep Tracking' },
    { id: 'stress', label: 'Stress/Cravings Tracking' },
    { id: 'measurements', label: 'Measurements Tracking' },
];

// ADDED: resizeImage helper function for images
const resizeImage = (dataUrl: string, fileName: string, fileType: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image();
    img.src = dataUrl;
    img.onload = () => {
      const MAX_DIMENSION = 1024; // Max width or height
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL(fileType, 0.8)); // Compress to 80% quality
    };
    img.onerror = (error: any) => reject(error);
  });
};

export function SettingsDialog({ open, onOpenChange, defaultTab, defaultAccordion }: SettingsDialogProps) {
  const { toast } = useToast();
  const { user, isCoach } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<Partial<TrackingSettings>>({});
  const [clientData, setClientData] = useState<ClientProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [displayGoals, setDisplayGoals] = useState<AllGoalSets | null>(null);
  
  const accountForm = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: { fullName: '', email: '', phone: '' },
  });

  const passwordForm = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
  });

   const goalsForm = useForm<z.infer<typeof goalsSchema>>({
    resolver: zodResolver(goalsSchema),
    defaultValues: {
      activityLevel: 'light',
      calculationMode: 'ideal',
      calorieModifier: 0,
      customMacros: { protein: '', fat: '', carbs: '' }, // Corrected syntax
    },
  });

  const siteSettingsForm = useForm<z.infer<typeof siteSettingsSchema>>({
    resolver: zodResolver(siteSettingsSchema),
    defaultValues: { 
        url: '', 
        videoCallLink: '',
        aiModelSettings: {
            pro: '',
            flash: '',
        }
    },
  });

  const watchedGoals = useWatch({ control: goalsForm.control });

    useEffect(() => {
        if (!clientData || !clientData.onboarding || !watchedGoals) {
            return;
        }

        const tempProfileForCalc: ClientProfile = {
            ...clientData,
            customGoals: {
                ...clientData.customGoals,
                activityLevel: watchedGoals.activityLevel ?? 'light',
                calculationMode: watchedGoals.calculationMode ?? 'ideal',
                calorieModifier: watchedGoals.calorieModifier ?? 0,
                protein: typeof watchedGoals.customMacros?.protein === 'number' ? watchedGoals.customMacros.protein : undefined,
                fat: typeof watchedGoals.customMacros?.fat === 'number' ? watchedGoals.customMacros.fat : undefined,
                carbs: watchedGoals.customMacros?.carbs === '' ? undefined : (typeof watchedGoals.customMacros?.carbs === 'number' ? watchedGoals.customMacros.carbs : undefined),
            },
        };
        
        const calculated = calculateNutritionalGoals(tempProfileForCalc);
        setDisplayGoals(calculated);

    }, [clientData, watchedGoals]);
  
  const fetchClientData = useCallback(async () => {
    if (!user || isCoach) return;
    setIsLoading(true);
    try {
        const result = await getClientByIdAction(user.uid);
        if (result.success && result.data) {
            const data = result.data;
            setClientData(data);
            accountForm.reset({ fullName: data.fullName || '', email: data.email || '' });
             setSettings(data.trackingSettings || {});
            
            goalsForm.reset({
              activityLevel: data.customGoals?.activityLevel || data.onboarding?.activityLevel || 'light',
              calculationMode: data.customGoals?.calculationMode || 'ideal',
              calorieModifier: data.customGoals?.calorieModifier || 0,
              customMacros: {
                protein: data.customGoals?.protein || '',
                fat: data.customGoals?.fat || '',
                carbs: data.customGoals?.carbs ?? '', 
              }
            });
        }
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your profile.' });
    } finally {
        setIsLoading(false);
    }
  }, [user, isCoach, accountForm, goalsForm, toast]);


  useEffect(() => {
    const loadCoachData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const result = await getSiteSettingsAction();
        if (result.success && result.data) {
          siteSettingsForm.reset({
            url: result.data.url || '',
            videoCallLink: result.data.videoCallLink || '',
            aiModelSettings: {
              pro: result.data.aiModelSettings?.pro || '',
              flash: result.data.aiModelSettings?.flash || '',
            }
          });
        }
        accountForm.reset({
          fullName: user.displayName || '',
          email: user.email || ''
        });
      } catch (error) {
        console.error("Failed to load site settings:", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Could not load site settings.',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (open && user) {
      if (isCoach) {
        loadCoachData();
      } else {
        fetchClientData();
      }
    }
  }, [user, open, isCoach, accountForm, siteSettingsForm, fetchClientData, toast]);

  const onUpdateAccount = async (data: z.infer<typeof accountSchema>) => {
    if (!user) return;
    setIsSaving(true);
    const result = await updateUserProfileAction(user.uid, data);
    if (result.success) {
      toast({ title: 'Account Updated' });
      await fetchClientData();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSaving(false);
  };
  
  const onUpdatePassword = async (data: z.infer<typeof passwordSchema>) => {
     if (!user) return;
    setIsSaving(true);
    const result = await updateUserPasswordAction(user.uid, data.newPassword);
     if (result.success) {
      toast({ title: 'Password Updated!', description: 'Please log in again with your new password.' });
      await signOut(clientAuth);
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSaving(false);
  };
  
  // MODIFIED: handleFileSelect for web/PWA file input with resizing
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && user) {
        setIsSaving(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const dataUrl = reader.result as string;
                const resizedDataUrl = await resizeImage(dataUrl, file.name, file.type); // Resize the image
                const result = await updateUserProfileAction(user.uid, { photoURL: resizedDataUrl });
                if(result.success) {
                    toast({ title: "Profile picture updated!" });
                    await user.reload();
                    await fetchClientData();
                } else {
                    toast({ variant: 'destructive', title: 'Error', description: result.error });
                }
            };
            reader.readAsDataURL(file);
        } catch (error: any) {
            console.error("Error selecting and resizing file:", error);
            toast({ variant: 'destructive', title: 'Error', description: error.message || "Failed to update profile picture." });
        } finally {
            setIsSaving(false);
        }
    }
  };

  // ADDED: handleCameraCapture for native camera integration with resizing
  const handleCameraCapture = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl, // Get as base64 string
        source: CameraSource.Camera, // Directly open camera
      });

      if (photo.dataUrl) {
        const resizedDataUrl = await resizeImage(photo.dataUrl, "profile_pic.jpeg", "image/jpeg");
        const result = await updateUserProfileAction(user.uid, { photoURL: resizedDataUrl });
        if (result.success) {
          toast({ title: "Profile picture updated!" });
          await user.reload();
          await fetchClientData();
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not capture photo.' });
      }
    } catch (error: any) {
      console.error("Error capturing photo:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || "Failed to capture photo." });
    } finally {
      setIsSaving(false);
    }
  };

  // ADDED: handleGallerySelection for native gallery integration with resizing
  const handleGallerySelection = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const photo = await CapacitorCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl, // Get as base64 string
        source: CameraSource.Photos, // Open gallery
      });

      if (photo.dataUrl) {
        const resizedDataUrl = await resizeImage(photo.dataUrl, "profile_pic.jpeg", "image/jpeg");
        const result = await updateUserProfileAction(user.uid, { photoURL: resizedDataUrl });
        if (result.success) {
          toast({ title: "Profile picture updated!" });
          await user.reload();
          await fetchClientData();
        } else {
          toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
      } else {
        toast({ variant: 'destructive', title: 'Error', description: 'No photo selected.' });
      }
    } catch (error: any) {
      console.error("Error selecting photo from gallery:", error);
      toast({ variant: 'destructive', title: 'Error', description: error.message || "Failed to select photo from gallery." });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleSettingChange = async (key: keyof TrackingSettings, value: any) => {
    if (!user) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings); 

    const result = await updateClientSettingsAction(user.uid, { [key]: value });
    if (!result.success) {
      toast({ variant: "destructive", title: "Error", description: "Could not save your preferences."});
      setSettings(prev => ({...prev, [key]: !value })); 
    }

    if (value === false) {
        localStorage.removeItem(`hasSeen_${key}`);
    }
  };

  const onUpdateGoals = async (data: z.infer<typeof goalsSchema>) => {
    if(!user) return;
    setIsSaving(true);
    try {
        const result = await updateClientProfileAndGoalsAction(user.uid, data);
        if(result.success) {
          toast({ title: "Goals Updated!", description: "Your nutritional targets have been saved." });
          await fetchClientData();
        } else {
          throw new Error(result.error || "An unknown error occurred.");
        }
    } catch (error: any) {
        toast({ variant: "destructive", title: "Error", description: error.message });
    } finally {
        setIsSaving(false);
    }
  };

  const onUpdateSiteSettings = async (data: z.infer<typeof siteSettingsSchema>) => {
    setIsSaving(true);
    const result = await updateSiteSettingsAction(data);
    if (result.success) {
      toast({ title: 'Success!', description: 'Site settings have been updated.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error || 'Failed to update settings.' });
    }
    setIsSaving(false);
  };
  
  const handleLogout = async () => {
    await signOut(clientAuth);
    onOpenChange(false);
    toast({ title: "Logged Out" });
  }

  const handleManageBilling = async () => {
    if (!user) return;
    setIsSaving(true);

    try {
      const rcCustomerInfoWrapper = await Purchases.getCustomerInfo(); 
      const customerInfo: CustomerInfo = rcCustomerInfoWrapper.customerInfo; 
      
      let subscriptionUrl: string | null = null;

      // Prioritize RevenueCat's managementURL if available
      if (customerInfo.managementURL) {
        subscriptionUrl = customerInfo.managementURL;
      } else if (Capacitor.isNativePlatform()) {
        // If on native and no RC management URL, try platform-specific deep links
        const activeEntitlement = Object.values(customerInfo.entitlements.active).find((ent: any) => ent.store !== undefined);
        if (activeEntitlement) {
          const store = activeEntitlement.store as string;
          switch (store) {
            case 'PLAY_STORE':
              const androidPackageName = process.env.NEXT_PUBLIC_ANDROID_PACKAGE_NAME || 'your.app.package.name';
              subscriptionUrl = `https://play.google.com/store/account/subscriptions?package=${androidPackageName}`;
              break;
            case 'APP_STORE':
              subscriptionUrl = `itms-apps://apps.apple.com/account/subscriptions`;
              break;
            // REMOVED: case 'STRIPE' as RevenueCat handles Stripe portal via managementURL
            default:
              console.warn("Unhandled RevenueCat store for active entitlement:", store);
              break;
          }
        }
      }

      if (subscriptionUrl) {
        await Browser.open({ url: subscriptionUrl });
      } else {
        // Fallback if no URL could be determined
        toast({ variant: 'destructive', title: 'Error', description: "Could not determine subscription management URL." });
      }

    } catch (err: any) {
        console.error("Error managing billing:", err);
        toast({ variant: 'destructive', title: 'Error', description: err.message || "An unexpected error occurred." });
    } finally {
      setIsSaving(false);
    }
  }

  
  const calculationMode = watchedGoals.calculationMode;
  
  const goalsToShow = 
    calculationMode === 'ideal' ? displayGoals?.idealGoals :
    calculationMode === 'actual' ? displayGoals?.actualGoals :
    calculationMode === 'custom' ? displayGoals?.customGoals : // FIXED: Typo displayMode to calculationMode
    displayGoals?.customGoals;
  
  const tdee = displayGoals?.actualGoals.tdee;


  const renderAccountTabContent = () => (
    <div className="space-y-6">
        <Form {...accountForm}>
            <form id="account-form" onSubmit={accountForm.handleSubmit(onUpdateAccount)} className="space-y-4">
                <FormField control={accountForm.control} name="fullName" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormField control={accountForm.control} name="email" render={({ field }) => (
                    <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )}/>
                <FormItem>
                    <FormLabel>Profile Picture</FormLabel>
                    <FormControl>
                        <div>
                           {Capacitor.isNativePlatform() ? (
                                <div className="flex flex-col gap-2">
                                    <Button type="button" variant="secondary" size="sm" onClick={handleCameraCapture} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CameraIcon className="mr-2 h-4 w-4"/>}
                                        Take Photo
                                    </Button>
                                    <Button type="button" variant="secondary" size="sm" onClick={handleGallerySelection} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CameraIcon className="mr-2 h-4 w-4"/>}
                                        Choose from Library
                                    </Button>
                                </div>
                           ) : (
                               <>
                                   <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*"/>
                                   <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                                       {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CameraIcon className="mr-2 h-4 w-4"/>}
                                       Change Picture
                                   </Button>
                               </>
                           )}
                        </div>
                    </FormControl>
                </FormItem>
                <Button type="submit" size="sm" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Update Profile
                </Button>
            </form>
        </Form>

        <Separator />

        <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onUpdatePassword)} className="space-y-4">
                 <h3 className="text-lg font-medium">Change Password</h3>
                <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
                    <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
                    <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" size="sm" variant="secondary" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Update Password
                </Button>
            </form>
        </Form>

        <Separator />

        <div className="space-y-2">
            <h3 className="text-lg font-medium">More</h3>
            <Button variant="outline" className="w-full justify-start" asChild><Link href="/support" target="_blank"><HelpCircle className="mr-2 h-4 w-4"/> Help & Support</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link href="/tos" target="_blank"><FileText className="mr-2 h-4 w-4"/> Terms of Service</Link></Button>
            <Button variant="outline" className="w-full justify-start" asChild><Link href="/privacy" target="_blank"><ShieldCheck className="mr-2 h-4 w-4"/> Privacy Policy</Link></Button>
            <Button variant="destructive" className="w-full justify-start" onClick={handleLogout}><LogOut className="mr-2 h-4 w-4"/> Log Out</Button>
        </div>
    </div>
  );

  const renderCoachSettings = () => (
    <Tabs defaultValue={defaultTab || "account"} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">My Account</TabsTrigger>
            <TabsTrigger value="site">Site Settings</TabsTrigger>
        </TabsList>
        <div className="flex-1 min-h-0">
            <TabsContent value="account" className="mt-0">
                {renderAccountTabContent()}
            </TabsContent>
            <TabsContent value="site" className="mt-0 space-y-4">
                <Form {...siteSettingsForm}>
                    <form id="site-settings-form" onSubmit={siteSettingsForm.handleSubmit(onUpdateSiteSettings)} className="space-y-2">
                         <Card>
                            <CardHeader className="p-4">
                                <CardTitle>Global Site Settings</CardTitle>
                                <CardDescription>Set global links for the application.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <FormField control={siteSettingsForm.control} name="url" render={({ field }) => (
                                    <FormItem><FormLabel>Website URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={siteSettingsForm.control} name="videoCallLink" render={({ field }) => (
                                <FormItem><FormLabel>Default Video Call Link</FormLabel><FormControl><Input placeholder="https://zoom.us/j/1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="p-4">
                                <CardTitle className="flex items-center gap-2"><BrainCircuit /> AI Model Configuration</CardTitle>
                                <CardDescription>Define which Google AI models the app should use for various tasks.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 space-y-3">
                                <FormField control={siteSettingsForm.control} name="aiModelSettings.pro" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Pro Model Name</FormLabel>
                                        <FormControl><Input {...field} placeholder="e.g., gemini-pro" /></FormControl>
                                        <FormDescription className="text-xs">Used for complex reasoning and insights.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                <FormField control={siteSettingsForm.control} name="aiModelSettings.flash" render={({ field }) => (
                                <FormItem>
                                     <FormLabel>Flash Model Name</FormLabel>
                                     <FormControl><Input {...field} placeholder="e.g., gemini-flash" /></FormControl>
                                     <FormDescription className="text-xs">Used for faster, simpler tasks.</FormDescription>
                                     <FormMessage />
                                </FormItem>
                                )} />
                            </CardContent>
                        </Card>
                    </form>
                </Form>
                 <Button type="submit" form="site-settings-form" size="sm" disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Save All Site Settings
                </Button>
            </TabsContent>
        </div>
    </Tabs>
  );
  
  const renderClientSettings = () => (
    <Tabs defaultValue={defaultTab || "account"} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="account">My Account</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
        </TabsList>
         <div className="flex-1 min-h-0">
            <TabsContent value="account" className="mt-0">
                <Accordion type="single" collapsible className="w-full space-y-2" defaultValue={defaultAccordion || "goals"}>
                    <AccordionItem value="goals" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <Target className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Goals</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-2">
                           <Form {...goalsForm}>
                            <form id="goals-form" onSubmit={goalsForm.handleSubmit(onUpdateGoals)} className="space-y-3">
                            <FormField 
    control={goalsForm.control} 
    name="calculationMode" 
    render={({ field }) => (
        <FormItem>
            <FormLabel>Calculation Mode</FormLabel>
            <div className="grid grid-cols-3 gap-2">
                <Button
                    type="button"
                    variant={field.value === 'ideal' ? "default" : "outline"}
                    onClick={() => field.onChange('ideal')}
                    className="h-9 text-xs"
                >
                    Ideal
                </Button>
                <Button
                    type="button"
                    variant={field.value === 'actual' ? "default" : "outline"}
                    onClick={() => field.onChange('actual')}
                    className="h-9 text-xs"
                >
                    Actual
                </Button>
                <Button
                    type="button"
                    variant={field.value === 'custom' ? "default" : "outline"}
                    onClick={() => field.onChange('custom')}
                    className="h-9 text-xs"
                >
                    Custom
                </Button>
            </div>
            <FormMessage />
        </FormItem>
    )}
/>

                                <FormField control={goalsForm.control} name="activityLevel" render={({ field }) => (
                                  <FormItem><FormLabel>Activity Level</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                        <SelectItem value="sedentary">Sedentary</SelectItem>
                                        <SelectItem value="light">Lightly Active</SelectItem>
                                        <SelectItem value="moderate">Moderately Active</SelectItem>
                                        <SelectItem value="active">Very Active</SelectItem>
                                        <SelectItem value="very_active">Extra Active</SelectItem>
                                      </SelectContent>
                                    </Select><FormMessage />
                                  </FormItem>
                                )}/>

                                <div className="p-1 rounded-md bg-muted/50 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Est. Maintenance Calories (TDEE)</p>
                                    <p className="text-base font-bold">{tdee?.toLocaleString()}</p>
                                </div>

                                {calculationMode === 'actual' && (
                                    <FormField control={goalsForm.control} name="calorieModifier" render={({ field }) => (
                                        <FormItem><div className="flex justify-between items-baseline"><FormLabel className="text-xs">Calorie Adjustment</FormLabel><span className={cn("font-bold text-sm", field.value < 0 ? 'text-red-400' : 'text-green-400')}>{field.value > 0 ? '+' : ''}{field.value}</span></div>
                                            <FormControl><Slider value={[field.value]} onValueChange={(v) => field.onChange(v[0])} min={-1000} max={1000} step={50} /></FormControl>
                                        </FormItem>
                                    )}/>
                                )}
                                
                                <div className="grid grid-cols-2 gap-2 items-center">
                                   <div className="p-1 rounded-md bg-muted/50 text-center h-full">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Daily Calorie Goal</p>
                                        <p className="font-bold text-base">{Math.round(goalsToShow?.calorieGoal || 0).toLocaleString()}</p>
                                    </div>
                                     <div className="p-1 rounded-md bg-muted/50 text-center h-full">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Goal Range</p>
                                        <p className="font-bold text-base">{Math.round(goalsToShow?.calorieGoalRange?.min || 0).toLocaleString()} - {Math.round(goalsToShow?.calorieGoalRange?.max || 0).toLocaleString()}</p>
                                    </div>
                                </div>

                                {calculationMode !== 'custom' ? (
                                    <div className="pt-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Suggested Daily Macros</h4>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="text-center"><p className="text-[10px] text-muted-foreground">Protein</p><p className="font-bold">{Math.round(goalsToShow?.protein || 0)}g</p></div>
                                            <div className="text-center"><p className="text-[10px] text-muted-foreground">Fat</p><p className="font-bold">{Math.round(goalsToShow?.fat || 0)}g</p></div>
                                            <div className="text-center">
                                                <p className="text-[10px] text-muted-foreground">Carbs</p>
                                                <p className={cn("font-bold", (goalsToShow?.carbs || 0) < 0 && "text-destructive")}>{Math.round(goalsToShow?.carbs || 0)}g</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                     <div className="pt-2">
                                        <h4 className="text-xs font-semibold text-muted-foreground mb-1">Custom Daily Macros</h4>
                                        <div className="grid grid-cols-3 gap-2 pt-1">
                                            <FormField control={goalsForm.control} name="customMacros.protein" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Protein (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={goalsForm.control} name="customMacros.fat" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Fat (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={goalsForm.control} name="customMacros.carbs" render={({ field }) => (
                                                <FormItem><FormLabel className="text-xs">Carbs (g)</FormLabel><FormControl><AppNumberInput {...field} maxLength={3} /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                )}
                            </form>
                           </Form>
                           <Button type="submit" form="goals-form" className="w-full" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                Save Goals
                           </Button>
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="account" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Account</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-3">
                           {renderAccountTabContent()}
                        </AccordionContent>
                    </AccordionItem>
                    
                    <AccordionItem value="tracking" className="border rounded-lg overflow-hidden">
                        <AccordionTrigger className="px-3 py-2 hover:no-underline bg-muted/30">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="h-5 w-5" />
                                <h3 className="font-semibold text-base">Tracking Preferences</h3>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                <Label htmlFor="units">Unit System</Label>
                                <RadioGroup 
                                    defaultValue={settings.units || 'imperial'} 
                                    className="flex"
                                    onValueChange={(value) => handleSettingChange('units', value)}
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="metric" id="r1" /><Label htmlFor="r1">Metric</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="imperial" id="r2" /><Label htmlFor="r2">Imperial</Label></div>
                                </RadioGroup>
                            </div>
                            {trackingOptions.map(option => (
                                 <div key={option.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                                    <Label htmlFor={option.id}>{option.label}</Label>
                                    <Switch
                                        id={option.id}
                                        checked={settings[option.id] !== false}
                                        onCheckedChange={(checked) => handleSettingChange(option.id, checked)}
                                    />
                                </div>
                            ))}
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </TabsContent>
             <TabsContent value="subscription" className="mt-0 space-y-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Subscription & Billing</CardTitle>
                        <CardDescription>Manage your subscription and payment details through our secure portal.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleManageBilling} disabled={isSaving} className="w-full">
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                            Manage Billing
                        </Button>
                    </CardContent>
                </Card>
            </TabsContent>
        </div>
    </Tabs>
  );

  const profileData = {
      photoURL: user?.photoURL,
      displayName: clientData?.fullName || user?.displayName,
  };

  return (
      <BaseModal
          isOpen={open}
          onClose={() => onOpenChange(false)}
          title="Settings"
          description={isCoach ? "Manage account and site settings." : "Manage account and app preferences."}
          profile={profileData}
      >
        {isLoading ? (
              <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
          ) : isCoach ? renderCoachSettings() : renderClientSettings()}
      </BaseModal>
  );
}
