'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { X, Loader2, Trash2, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format, startOfDay, addHours } from 'date-fns';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useToast } from '@/hooks/use-toast';
import { saveDataAction } from '@/services/firestore';
import { useAuth } from '../auth/auth-provider';
import type { ClientProfile, MealItem, Nutrient } from '@/types';

import { updateClientWthr } from '@/app/coach/clients/actions';
import { getTodaysContextualData, triggerSummaryRecalculation } from '@/app/calendar/actions';
import { BaseModal } from '@/components/ui/base-modal';
import InsightPopup from '@/components/app/InsightPopup';
// import { runProactiveCoachAction } from "@/app/client/actions";
import { NutritionContent } from './nutrition-content';
import { ActivityContent } from './activity-content';
import { SleepContent } from './sleep-content';
import { HydrationContent } from './hydration-content';
import { MeasurementsContent } from './measurements-content';
import { ProtocolContent } from './protocol-content';
import { PlannerContent } from './planner-content';
import { CravingsBingeContent } from './cravings-binge-content';
import { StressReliefContent } from './stress-relief-content';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { ActionableResponseModal } from '../modals/actionable-response-modal';
interface DataEntryDialogProps {
    open: boolean;
    onOpenChange: (wasSaved: boolean) => void;
    pillar: any | null;
    initialData?: any | null;
    onDelete?: () => void;
    userId?: string; 
    clientProfile?: ClientProfile | null;
    onSwitchPillar?: (pillarId: string) => void; 
}

const DateTimePicker = ({ date, setDate }: { date: Date, setDate: (date: Date) => void }) => {
    const isMobile = useIsMobile();

    if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.error("Invalid date passed to DateTimePicker", date);
        return <div>Invalid Date</div>;
    }

    const setTime = (timeValue: string) => {
        const [hours, minutes] = timeValue.split(':').map(Number);
        const newDate = new Date(date);
        newDate.setHours(hours);
        newDate.setMinutes(minutes);
        setDate(newDate);
    };

    const setDateFromInput = (dateValue: string) => {
        const [year, month, day] = dateValue.split('-').map(Number);
        const newDate = new Date(date);
        newDate.setFullYear(year, month - 1, day);
        setDate(newDate);
    }
    
    if (isMobile) {
        return (
             <div className="flex items-center justify-center gap-1">
                <Input 
                    type="date"
                    value={format(date, 'yyyy-MM-dd')}
                    onChange={e => setDateFromInput(e.target.value)}
                    className="w-auto h-8 p-1 text-xs border-input bg-transparent text-white"
                />
                 <div className="h-4 w-px bg-border" />
                <Input 
                    type="time" 
                    value={format(date, 'HH:mm')}
                    onChange={e => setTime(e.target.value)}
                    className="w-auto h-8 p-1 text-xs border-input bg-transparent text-white"
                />
            </div>
        )
    }
    
    return (
        <div className="flex items-center justify-center gap-1 text-xs text-white">
            <Popover>
                <PopoverTrigger asChild>
                    <div className="flex h-7 items-center justify-start gap-1 rounded-md border border-input bg-transparent px-2 text-left font-normal cursor-pointer">
                        <CalendarIcon className="h-3 w-3 text-white" />
                        <span>{format(date, 'MMM d')}</span>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => setDate(d || new Date())}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
            <div className="h-4 w-px bg-border" />
            <div className="relative flex h-7 items-center justify-start gap-1 rounded-md border border-input bg-transparent px-2">
                <Clock className="h-3 w-3 text-white" />
                <Input 
                    type="time" 
                    value={format(date, 'HH:mm')}
                    onChange={e => setTime(e.target.value)}
                    className="h-full w-full appearance-none border-none bg-transparent p-0 focus:ring-0 focus-visible:ring-0"
                />
            </div>
        </div>
    )
}

export function DataEntryDialog({ 
    open, 
    onOpenChange, 
    pillar, 
    initialData, 
    onDelete, 
    userId,
    clientProfile: initialClientProfile,
    onSwitchPillar,
}: DataEntryDialogProps) {
    const { toast } = useToast();
    const { user, userProfile: authUserProfile } = useAuth();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [entryDate, setEntryDate] = useState(new Date());
    const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
    const [isLoadingContent, setIsLoadingContent] = useState(true);
    const [formState, setFormState] = useState<any>({});
    const [insight, setInsight] = useState<string | null>(null);
    const [isInsightOpen, setIsInsightOpen] = useState(false);
    const [isActionableResponseOpen, setIsActionableResponseOpen] = useState(false);
    const [actionableResponseContent, setActionableResponseContent] = useState({ title: '', description: '' });
    const currentUserId = userId || user?.uid;
    const logId = initialData?.id;
    const [userTimezone, setUserTimezone] = useState('');
    useEffect(() => {
        setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }, []);
 
    const onFormStateChange = useCallback((newState: any) => {
        setFormState(prevState => ({ ...prevState, ...newState }));
    }, []);


    const getInitialFormState = useCallback((pillarId: string, initialData: any, contextData: any, clientData: ClientProfile | null) => {
        const { lastNightSleep, todaysHydration } = contextData || {};
        switch (pillarId) {
            case 'hydration':
                return {
                    amount: initialData?.amount || '',
                    hunger: initialData?.hunger || 5,
                    notes: initialData?.notes || '',
                    target: initialData?.target || clientData?.hydrationSettings?.target || 0,
                    unit: initialData?.unit || clientData?.hydrationSettings?.unit || 'oz',
                };
            case 'sleep':
                return {
                    duration: initialData?.duration || 8,
                    quality: initialData?.quality || 4,
                    hunger: initialData?.hunger || 3,
                    wakingStress: initialData?.wakingStress || 3,
                    notes: initialData?.notes || '',
                };
            case 'activity':
                return {
                    category: initialData?.category || 'cardio',
                    activityType: initialData?.activityType || '',
                    otherActivityType: initialData?.activityType === 'Other' ? initialData.activityType : '',
                    duration: initialData?.duration || '',
                    intensity: initialData?.intensity || 'moderate',
                    hungerBefore: initialData?.hungerBefore || 4,
                    hungerAfter: initialData?.hungerAfter || 6,
                    notes: initialData?.notes || '',
                }
            case 'measurements':
                 return {
                    weight: initialData?.weight || '',
                    waist: initialData?.waist || '',
                    notes: initialData?.notes || '',
                }
             case 'protocol':
                return {
                    mealDescription: initialData?.mealDescription || '',
                    preMealHunger: initialData?.preMealHunger || 5,
                    preMealStress: initialData?.preMealStress || 3,
                    sleepLastNight: initialData?.sleepLastNight ?? lastNightSleep ?? 8,
                    hydrationToday: initialData?.hydrationToday ?? todaysHydration ?? 64,
                    postMealHunger: initialData?.postMealHunger || 2,
                    percentageEaten: initialData?.percentageEaten || 100,
                    notes: initialData?.notes || '',
                }
                case 'planner':
                    return {
                        log: {
                            plannedIndulgence: initialData?.plannedIndulgence || '',
                            occasion: initialData?.occasion || '',
                            preDayHydrationGoal: initialData?.preDayHydrationGoal || '',
                            preDayMealPlan: initialData?.preDayMealPlan || '',
                            postIndulgenceMeal: initialData?.postIndulgenceMeal || '',
                            initialHunger: initialData?.initialHunger || 5,
                        }
                    }    
            case 'stress':
                return {
                    activeTab: initialData?.type || 'event',
                    manualSleep: initialData?.sleepLastNight ?? (lastNightSleep ?? ''),
                    manualHydration: initialData?.hydrationToday ?? (todaysHydration ?? ''),
                    stressLevel: initialData?.stressLevel || 5,
                    trigger: initialData?.trigger || '',
                    strategy: initialData?.strategy || '',
                    stressLevelBefore: initialData?.stressLevelBefore || 5,
                    stressLevelAfter: initialData?.stressLevelAfter || 3,
                    hungerLevel: initialData?.hungerLevel || 5,
                    notes: initialData?.notes || '',
                }
            case 'cravings':
                return {
                     activeTab: initialData?.type || "craving",
                     severity: initialData?.severity || 3,
                     stress: initialData?.stress || 5,
                     hunger: initialData?.hunger || 7,
                     manualSleep: initialData?.sleepLastNight ?? (lastNightSleep ?? ''),
                     manualHydration: initialData?.hydrationToday ?? (todaysHydration ?? ''),
                     craving: initialData?.craving || '',
                     outcome: initialData?.outcome || '',
                     bingeFood: initialData?.bingeFood || '',
                     triggers: initialData?.triggers || '',
                }
            case 'nutrition':
                return {
                    mealType: initialData?.mealType || 'snack',
                    hungerBefore: initialData?.hungerBefore || 5,
                    items: initialData?.items || [], 
                    notes: initialData?.notes || '',
                };
            default:
                return {};
        }
    }, []);    

    useEffect(() => {
        if (!open || !pillar) return;
    
        const loadData = async () => {
            setIsLoadingContent(true);
            const effectiveProfile = initialClientProfile || (authUserProfile as ClientProfile | null);
            setClientProfile(effectiveProfile);
            const contextData = await getTodaysContextualData(currentUserId || '');
    
            setFormState(prevState => {
                const isNewPillar = prevState.pillarId !== pillar.id;
                const isNewLog = prevState.logId !== logId;
                
                if (Object.keys(prevState).length === 0 || isNewPillar || isNewLog) {
                    const initialState = getInitialFormState(pillar.id, initialData, contextData, effectiveProfile);
                    return { ...initialState, pillarId: pillar.id, logId: logId };
                }
                
                return prevState;
            });
    
            let newEntryDate = new Date();
            if (logId && initialData?.entryDate) {
                const bedtime = new Date(initialData.entryDate);

                if (pillar.id === 'sleep' && initialData.duration) {
                    newEntryDate = addHours(bedtime, initialData.duration);
                } else {
                   newEntryDate = bedtime;
                }
            }
            setEntryDate(newEntryDate);

            setIsLoadingContent(false);
        };
    
        loadData();
    
    }, [open, pillar?.id, logId, currentUserId, authUserProfile, initialClientProfile, initialData, getInitialFormState]);
    
    const randomQuote = useMemo(() => {
        if (!pillar || !pillar.quotes || pillar.quotes.length === 0) {
            return null;
        }
        const randomIndex = Math.floor(Math.random() * pillar.quotes.length);
        return pillar.quotes[randomIndex];
    }, [pillar]);
    const responseContent = {
        craving: {
          title: "Your Craving Logged – Let's Reflect on This",
          description: "Thanks for noting this – tracking your cravings is a solid way to tune into what your body might be signaling. It could be something like thirst disguising itself as hunger or a bit of stress building up in the background. To ease it, try sipping some water to check if hydration helps clear the signal, or a quick breathing exercise like inhaling for 4 counts and exhaling for 6 to bring some calm. If it feels right, a short walk could also shift your energy and provide a natural lift."
        },
        binge: {
          title: "Your Binge Logged – A Moment to Reset",
          description: "It's a practical step toward understanding patterns and moving ahead. Binges often build from factors like not getting enough rest, being dehydrated, and being placed in stressful situations which can throw off your hunger signals, or accumulated tension making decisions tougher. To help reset, consider drinking some water to rehydrate and steady things out, or try a simple stress relief technique such as progressive muscle relaxation, starting from your toes and working up. Adding a bit of movement, like a casual stroll, could also help release endorphins and bring back some balance."
        },
        stress: {
          title: "Your Stress Logged – Time to Ease In",
          description: "Noting stress levels is a useful way to spot what might be influencing your day. Stress can sometimes heighten hunger feelings or spark cravings by ramping up cortisol, which affects how your body processes signals. To dial it back, try hydrating with a few sips of water to support steady energy, or a quick activity like stretching your arms and shoulders to loosen up. A straightforward breathing method, such as focusing on slow inhales and exhales, could also help bring things back to center."
        }
      };
      
    if (!pillar) return null;
    
    const handleSave = async () => {
        setIsSaving(true);
        if (!currentUserId) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: `Could not verify your user session.` });
            setIsSaving(false);
            return;
        }

        let dataToSave: any = {};
        const now = new Date();

        switch (pillar.id) {
            case 'hydration':
                dataToSave = {
                    amount: formState.amount || 0,
                    hunger: formState.hunger,
                    notes: formState.notes || '',
                    target: formState.target,
                    unit: formState.unit,
                    entryDate: entryDate,
                };
                break;
            
            case 'sleep':
                const wakeUpDateTime = new Date(entryDate);
                dataToSave = {
                    duration: formState.duration,
                    quality: formState.quality,
                    hunger: formState.hunger,
                    wakingStress: formState.wakingStress,
                    notes: formState.notes || '',
                    isNap: false, 
                    wakeUpDay: startOfDay(wakeUpDateTime),
                    entryDate: new Date(wakeUpDateTime.getTime() - (formState.duration || 0) * 60 * 60 * 1000),
                };
                break;

            case 'activity':
                dataToSave = {
                    category: formState.category,
                    activityType: formState.activityType,
                    duration: formState.duration,
                    intensity: formState.intensity,
                    hungerBefore: formState.hungerBefore,
                    hungerAfter: formState.hungerAfter,
                    notes: formState.notes || '',
                    entryDate: entryDate,
                };
                break;
            
                // INSERT THIS NEW, CORRECT CODE

                case 'nutrition':
                    // This new block is "dumber" and more reliable. It does no math.
                    // It just takes the 'mealSummary' object passed up from the child.
                    const mealSummary = formState.mealSummary || {};
                    
                    // This creates the final object to be saved on the individual nutrition log.
                    // This structure guarantees that all the macros you requested are included.
                    const summaryToSave = {
                        totalMealCalories: mealSummary.calories || 0,
                        totalMealUpfCalories: (mealSummary.calories || 0) * ((mealSummary.avgUpf || 0) / 100),
                        allNutrients: mealSummary.fullNutrientProfile || {}
                    };

    
                    dataToSave = {
                        mealType: formState.mealType,
                        hungerBefore: formState.hungerBefore,
                        notes: formState.notes || '',
                        items: (formState.items || []).map((item:any) => { const { portionSizes, ...rest } = item; return rest; }),
                        summary: summaryToSave, // We save the complete summary object.
                        entryDate: entryDate,
                    };
                    break;
    
     

            case 'measurements':
                 dataToSave = {
                    weight: formState.weight,
                    waist: formState.waist,
                    notes: formState.notes || '',
                    entryDate: entryDate,
                 };
                 break;

            case 'protocol':
                 dataToSave = {
                    mealDescription: formState.mealDescription,
                    preMealHunger: formState.preMealHunger,
                    preMealStress: formState.preMealStress,
                    sleepLastNight: formState.sleepLastNight,
                    hydrationToday: formState.hydrationToday,
                    postMealHunger: formState.postMealHunger,
                    percentageEaten: formState.percentageEaten,
                    notes: formState.notes || '',
                    entryDate: entryDate,
                 };
                 break;
            
                 case 'planner':
                    dataToSave = {
                        ...formState.log,
                        indulgenceDate: entryDate, 
                        entryDate: entryDate,
                    };
                    break;
    

             case 'stress':
                dataToSave = {
                    type: formState.activeTab,
                    hungerLevel: formState.hungerLevel,
                    notes: formState.notes,
                    sleepLastNight: formState.manualSleep === '' ? null : Number(formState.manualSleep),
                    hydrationToday: formState.manualHydration === '' ? null : Number(formState.manualHydration),
                    stressLevel: formState.stressLevel,
                    trigger: formState.trigger,
                    strategy: formState.strategy,
                    stressLevelBefore: formState.stressLevelBefore,
                    stressLevelAfter: formState.stressLevelAfter,
                    entryDate: entryDate,
                };
                break;

            case 'cravings':
                dataToSave = {
                    type: formState.activeTab,
                    hunger: formState.hunger,
                    stress: formState.stress,
                    sleepLastNight: formState.manualSleep === '' ? null : Number(formState.manualSleep),
                    hydrationToday: formState.manualHydration === '' ? null : Number(formState.manualHydration),
                    triggers: formState.triggers,
                    severity: formState.severity,
                    craving: formState.craving,
                    outcome: formState.outcome,
                    bingeFood: formState.bingeFood,
                    entryDate: entryDate,
                };
                break;

            default:
                toast({ variant: 'destructive', title: 'Error', description: 'Could not determine the pillar type to save.'});
                setIsSaving(false);
                return;
        }

        dataToSave.uid = currentUserId;
        dataToSave.pillar = pillar.id;
        if (!logId) {
            dataToSave.createdAt = now;
        }

        const dataFields = Object.keys(dataToSave).filter(
            key => !['uid', 'pillar', 'createdAt', 'entryDate', 'wakeUpDay', 'indulgenceDate'].includes(key)
        );

        const hasData = dataFields.some(key => {
            const value = dataToSave[key];
            if (value === null || value === undefined || value === '') return false;
            if (Array.isArray(value) && value.length === 0) return false;
            if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) return false;
            return true; 
        });

        if (!hasData) {
            toast({ title: 'No Data Entered', description: `Please enter a value to save.` });
            setIsSaving(false);
            return;
        }

        try {
            const result = await saveDataAction(pillar.id, { log: dataToSave }, currentUserId, logId);
            if (result.success) {
                toast({ title: `Entry ${logId ? 'Updated' : 'Saved'}!`, description: `${pillar.label} data has been successfully saved.`});
                if (userTimezone && currentUserId) {
                    await triggerSummaryRecalculation(currentUserId, format(entryDate, 'yyyy-MM-dd'), userTimezone, entryDate.getTimezoneOffset());
                }
                router.refresh();
                const responseType = pillar.id === 'cravings'

                    ? formState.activeTab // This will be 'craving' or 'binge'
                    : (pillar.id === 'stress' && formState.activeTab === 'event')
                    ? 'stress'
                    : null;


            if (responseType && responseContent[responseType]) {
                setActionableResponseContent(responseContent[responseType]);
                setIsActionableResponseOpen(true);
            } else {
                onOpenChange(true);
            }
                              
                if (pillar.id === 'measurements' && dataToSave.waist > 0 && currentUserId) {
                    await updateClientWthr(currentUserId, dataToSave.waist);
                }

                                // if (pillar.id === 'cravings' || pillar.id === 'stress') {
                //     toast({ title: "💡", description: "Analyzing your log for insights..." });

                //     try {
                //         const coachResult = await runProactiveCoachAction(currentUserId, { type: formState.activeTab, notes: formState.notes });
                //         if (coachResult.success) {
                //             setInsight(coachResult.coachResponse);
                //             setIsInsightOpen(true);
                //         } else {
                //             throw new Error(coachResult.error);
                //         }
                //     } catch (error) {
                //         console.error("Failed to get AI insight:", error);
                //         toast({ title: "Error", description: "Couldn't get an insight at this time.", variant: "destructive" });
                //     }
                // }


            } else {
                throw new Error(result.error?.toString() || "Failed to save data.");
            }
        } catch (error: any) {
            console.error("Error saving data:", error);
            toast({ variant: 'destructive', title: 'Error Saving Entry', description: `Could not save. Reason: ${error.message || 'Please try again.'}`});
        } finally {
            setIsSaving(false);
        }
    };
    const handlePillarSwitch = (pillarId: string) => {
        if (onSwitchPillar) {
            setIsActionableResponseOpen(false);
            onSwitchPillar(pillarId);
        }
    };

    const contentMap: Record<string, React.FC<any>> = {
        'nutrition': NutritionContent,
        'activity': ActivityContent,
        'sleep': SleepContent,
        'stress': StressReliefContent,
        'hydration': HydrationContent,
        'protocol': ProtocolContent,
        'planner': PlannerContent,
        'cravings': CravingsBingeContent,
        'measurements': MeasurementsContent,
    };

    const CurrentContent = contentMap[pillar.id];
    const isLongForm = ['nutrition', 'hydration', 'protocol', 'planner', 'cravings', 'stress'].includes(pillar.id);

    const dialogTitle = `${logId ? 'Edit' : 'Log'} ${pillar.label}`;
    const dialogDescription = randomQuote || undefined;

    const buttonText = logId 
    ? 'Update Entry' 
    : 'Save Entry';


    const contentProps: any = {
        pillar,
        entryDate,
        initialData,
        clientProfile,
        formState,
        onFormStateChange,
        userId: currentUserId,
    };
    
    const dialogFooter = (
        <div className="flex items-center gap-2 w-full">
            {logId && onDelete && (
                <Button onClick={onDelete} variant="destructive" size="sm" className="flex-shrink-0"><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
            )}
            <div className="flex-1" />
            <Button onClick={() => onOpenChange(false)} variant="outline" size="sm" className="flex-shrink-0">Dismiss</Button>
            <Button onClick={handleSave} size="sm" className="flex-shrink-0 text-white bg-green-500 hover:bg-green-600" disabled={isSaving || isLoadingContent}>
                {(isSaving || isLoadingContent) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {buttonText}
            </Button>
        </div>
    );

    return (
        <>
        <BaseModal
            isOpen={open && !isActionableResponseOpen}
            onClose={() => onOpenChange(false)}
            title={dialogTitle}
            description={dialogDescription}
            className={cn("sm:max-w-lg", isLongForm ? 'h-[90dvh]' : 'h-auto')}
            footer={dialogFooter}
        >
             <div className="space-y-1">
                 {pillar.id !== 'planner' && (
                    <div className="flex-shrink-0 flex justify-center py-1">
                         <Label className="text-xs mr-2">{pillar.id === 'sleep' ? 'Wake Up Time' : 'Entry Time'}</Label>
                        <DateTimePicker date={entryDate} setDate={setEntryDate} />
                    </div>
                )}
                {pillar.id === 'planner' && (
                    <div className="flex-shrink-0 flex justify-center py-1">
                        <Label className="text-xs mr-2">Date of Indulgence</Label>
                        <DateTimePicker date={entryDate} setDate={setEntryDate} />
                    </div>
                )}
                {isLoadingContent ? (
                    <div className="flex-1 flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : CurrentContent ? (
                    <CurrentContent {...contentProps} />
                ) : (
                    <div className="text-center p-8">This form is under construction.</div>
                )}
            </div>
        </BaseModal>
        {insight && isInsightOpen && (
            <InsightPopup
                message={insight}
                onClose={() => setIsInsightOpen(false)}
            />
        )}
        {isActionableResponseOpen && (
            <ActionableResponseModal
                isOpen={isActionableResponseOpen}
                onClose={() => {
                    setIsActionableResponseOpen(false);
                    onOpenChange(false); // Close the whole flow without a data refresh
                }}
                title={actionableResponseContent.title}
                description={actionableResponseContent.description}
                actions={[
                    { label: 'Log Hydration', onClick: () => handlePillarSwitch('hydration'), className: 'bg-blue-400 hover:bg-blue-500 text-white border-transparent' },
                    { label: 'Log Activity', onClick: () => handlePillarSwitch('activity'), className: 'bg-orange-400 hover:bg-orange-500 text-white border-transparent' },
                    { label: 'Log Stress Relief', onClick: () => handlePillarSwitch('stress'), className: 'bg-green-400 hover:bg-green-500 text-white border-transparent' },
                ]}                
            />
        )}

        </>
    );
}
