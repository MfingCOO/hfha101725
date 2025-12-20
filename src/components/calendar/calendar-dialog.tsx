'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ClientProfile, NutritionalGoals } from '@/types';
import { DayView } from './day-view';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';
import { getCalendarDataForDay, triggerSummaryRecalculation } from '@/app/calendar/actions';
import { getScheduledEventsAction } from '@/app/client/actions';
import { ScheduledEvent } from '@/types/event';
import { UtensilsCrossed, Droplet, Moon, Flame, ShieldAlert, ClipboardList, Pencil } from 'lucide-react';
import { Button } from '../ui/button';
import { BaseModal } from '../ui/base-modal';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Progress } from '../ui/progress';
import { rda } from '@/lib/rda';
import { getClientByIdAction } from '@/app/coach/clients/actions';
import { useToast } from '@/hooks/use-toast';
import { SettingsDialog } from '../settings/SettingsDialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const NutrientRow = ({ name, value, unit, goal, isTrackOnly = false }: { name: string, value: number, unit: string, goal: number, isTrackOnly?: boolean }) => {
    const percentage = goal > 0 && !isTrackOnly ? (value / goal) * 100 : value > 0 ? 100 : 0;
    const isOver = value > goal && !isTrackOnly;

    return (
        <div className="space-y-1">
            <div className="flex justify-between items-baseline">
                <p className="text-sm font-medium">{name.split(',')[0]}</p>
                <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{value.toFixed(isTrackOnly ? 1 : 0)}</span>
                    {!isTrackOnly && ` / ${goal.toFixed(0)}`}
                    <span className="text-xs"> {unit}</span>
                </p>
            </div>
            <Progress value={isOver ? 100 : percentage} />
        </div>
    )
}

const NutritionalSummaryDialog = ({ isOpen, onClose, summary, client, onEditGoals }: { isOpen: boolean, onClose: () => void, summary: any, client: ClientProfile | null, onEditGoals: () => void }) => {
    if (!summary?.allNutrients || !client) return null;
    
    const nutrientCategories = useMemo(() => {
        const macros = {
            'Energy': { unit: 'kcal' },
            'Protein': { unit: 'g' },
            'Total lipid (fat)': { unit: 'g' },
            'Carbohydrate, by difference': { unit: 'g' },
            'Fiber, total dietary': { unit: 'g' },
            'Sugars, added': { unit: 'g' }
        };
        const vitamins: Record<string, any> = {};
        const minerals: Record<string, any> = {};
        
        for (const key in rda) {
            if (!macros[key as keyof typeof macros]) {
                if (key.toLowerCase().includes('vitamin') || ['Thiamin', 'Riboflavin', 'Niacin', 'Folate, total'].includes(key)) {
                    vitamins[key] = rda[key as keyof typeof rda];
                } else {
                    minerals[key] = rda[key as keyof typeof rda];
                }
            }
        }
        return { macros, vitamins, minerals };
    }, []);

    const goals = client.customGoals;
    
    const renderSection = (title: string, keys: Record<string, any>) => (
        <AccordionItem value={title.toLowerCase()}>
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent className="space-y-3">
                {Object.keys(keys).map(key => {
                    const nutrientData = summary.allNutrients[key];
                    const value = nutrientData?.value || 0;
                    const goal = goals?.[key as keyof NutritionalGoals] as number || rda[key as keyof typeof rda]?.value || 0;
                    const unit = keys[key]?.unit || 'g';
                    
                    return <NutrientRow key={key} name={key} value={value} unit={unit} goal={goal} />;
                })}
            </AccordionContent>
        </AccordionItem>
    );

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Daily Nutritional Summary" description="A detailed breakdown of your nutrient intake for the day." className="max-w-lg">
             <div className="max-h-[60vh] overflow-y-auto pr-6 -mr-6 space-y-4">
                <Accordion type="multiple" defaultValue={['macros', 'vitamins']} className="w-full">
                    <AccordionItem value="macros">
                         <AccordionTrigger>Macronutrients</AccordionTrigger>
                         <AccordionContent className="space-y-3">
                             <div className="p-2 rounded-md bg-muted/50 text-center relative">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Recommended Daily Calorie Range</p>
                                <p className="font-bold text-base">{Math.round((goals?.calorieGoalRange as any)?.min || 0).toLocaleString()} - {Math.round((goals?.calorieGoalRange as any)?.max || 0).toLocaleString()}</p>
                                 <Button variant="ghost" size="icon" className="absolute top-1/2 right-1 -translate-y-1/2 h-7 w-7 text-muted-foreground" onClick={onEditGoals}><Pencil className="h-4 w-4" /></Button>
                            </div>
                            <NutrientRow name="Energy" value={summary.allNutrients['Energy']?.value || 0} unit="kcal" goal={goals?.calorieGoal || 0} />
                            <NutrientRow name="Protein" value={summary.allNutrients['Protein']?.value || 0} unit="g" goal={goals?.protein || 0} />
                            <NutrientRow name="Total lipid (fat)" value={summary.allNutrients['Total lipid (fat)']?.value || 0} unit="g" goal={goals?.fat || 0} />
                            <NutrientRow name="Carbohydrate" value={summary.allNutrients['Carbohydrate, by difference']?.value || 0} unit="g" goal={goals?.carbs || 0} />
                            <NutrientRow name="Fiber, total dietary" value={summary.allNutrients['Fiber, total dietary']?.value || 0} unit="g" goal={goals?.fiber || 35} isTrackOnly={true} />
                            <NutrientRow name="Sugars, added" value={summary.allNutrients['Sugars, added']?.value || 0} unit="g" goal={0} isTrackOnly={true} />
                         </AccordionContent>
                    </AccordionItem>
                    {renderSection('Vitamins', nutrientCategories.vitamins)}
                    {renderSection('Minerals', nutrientCategories.minerals)}
                </Accordion>
            </div>
        </BaseModal>
    );
}

const DailySummaryBar = ({ summary, onSummaryClick }: { summary: any, onSummaryClick: () => void }) => {
    const displaySummary = {
        calories: summary?.calories || 0,
        hydration: summary?.hydration || 0,
        sleep: summary?.sleep || 0,
        activity: summary?.activity || 0,
        upf: summary?.upf || 0
    };

    return (
        <div className="flex-shrink-0 p-2 border-b bg-background/50 flex items-center justify-between gap-2">
            <div className="grid grid-cols-5 gap-1 text-center flex-1">
                <div className="flex flex-col items-center">
                    <UtensilsCrossed className="h-4 w-4 text-amber-400" />
                    <span className="text-xs font-bold">{displaySummary.calories.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">kcal</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Droplet className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-bold">{displaySummary.hydration.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">oz</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Moon className="h-4 w-4 text-indigo-400" />
                    <span className="text-xs font-bold">{displaySummary.sleep.toFixed(1)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">hr</span>
                </div>
                 <div className="flex flex-col items-center">
                    <Flame className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-bold">{displaySummary.activity.toFixed(0)}</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">min</span>
                </div>
                 <div className="flex flex-col items-center">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-bold">{displaySummary.upf.toFixed(0)}%</span>
                    <span className="text-[10px] text-muted-foreground -mt-1">UPF</span>
                </div>
            </div>
            <div className="flex-shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onSummaryClick}><ClipboardList className="h-5 w-5 text-muted-foreground" /></Button>
            </div>
        </div>
    )
}

interface CalendarDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientProfile;
  initialDate?: Date;
  highlightedEntryId?: string; 
}

export function CalendarDialog({ isOpen, onClose, client: initialClient, initialDate, highlightedEntryId }: CalendarDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'day' | 'week' | 'month'>('day');
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [fullClientProfile, setFullClientProfile] = useState<ClientProfile | null>(initialClient);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState('account');
  const [settingsDefaultAccordion, setSettingsDefaultAccordion] = useState<string | undefined>(undefined);
  const [userTimezone, setUserTimezone] = useState<string>('');

  useEffect(() => {
      setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
    }
  }, [initialDate]);

  const fetchClientProfile = useCallback(async () => {
    if (!initialClient.uid) return;
    const result = await getClientByIdAction(initialClient.uid);
    if (result.success && result.data) {
        setFullClientProfile(result.data);
    } else {
        setFullClientProfile(initialClient);
    }
  }, [initialClient]);
  
  useEffect(() => {
    if (isOpen) {
      fetchClientProfile();
    }
  }, [isOpen, fetchClientProfile]);

  useEffect(() => {
      if (!isSettingsOpen) {
          fetchClientProfile();
      }
  }, [isSettingsOpen, fetchClientProfile]);

  const dateString = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);
  
  const timezoneOffset = selectedDate.getTimezoneOffset();
  
  const { data: calendarData, isLoading: isLoadingCalendar } = useQuery({
      queryKey: ['calendarData', dateString, initialClient.uid, userTimezone, timezoneOffset],
      queryFn: async () => {
          const result = await getCalendarDataForDay(initialClient.uid, dateString, userTimezone, timezoneOffset);
          if ('error' in result) {
              console.error("Failed to fetch calendar data:", result.error);
              toast({ variant: 'destructive', title: 'Error', description: 'Could not load calendar data.' });
              return { data: [], summary: null };
          }
          return result;
      },
      enabled: isOpen && !!initialClient.uid && !!userTimezone
  });

  const { data: scheduledEvents, isLoading: isLoadingEvents } = useQuery({
    queryKey: ['scheduledEvents', initialClient.uid],
    queryFn: async () => {
        const result = await getScheduledEventsAction(initialClient.uid);
        if ('error' in result) {
            console.error("Failed to fetch scheduled events:", result.error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load scheduled workouts.' });
            return [];
        } 
        return result.data;
    },
    enabled: isOpen && !!initialClient.uid
  });

 const allEntries = useMemo(() => {
    const regularEntries = calendarData?.data || [];
    const workoutEvents = (scheduledEvents || []).map((event: ScheduledEvent) => ({
        ...event,
        start: new Date(event.startTime),
        end: new Date(event.endTime),
        allDay: false, // Or determine based on event properties
        __TYPE: 'workout'
    }));
    return [...regularEntries, ...workoutEvents];
}, [calendarData, scheduledEvents]);

  const isLoading = isLoadingCalendar || isLoadingEvents;

  const handleEntryChange = async () => {
      await triggerSummaryRecalculation(initialClient.uid, dateString, userTimezone, timezoneOffset);
      queryClient.invalidateQueries({ queryKey: ['calendarData', dateString, initialClient.uid, userTimezone, timezoneOffset] });
      queryClient.invalidateQueries({ queryKey: ['scheduledEvents', initialClient.uid]});
  };

  const handleEditGoals = () => {
    setIsSummaryOpen(false);
    setTimeout(() => {
        setSettingsDefaultTab('account');
        setSettingsDefaultAccordion('goals');
        setIsSettingsOpen(true);
    }, 150);
  };

  const handleSummaryClick = () => {
    if (fullClientProfile?.trackingSettings?.nutrition === false) {
        toast({ title: "Nutrition Tracking Disabled", description: "Please enable nutrition tracking in your settings to view the summary." });
        return;
    }
    setIsSummaryOpen(true);
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-7xl h-[90dvh] flex flex-col p-0">
         <DialogHeader className="p-0 -m-2"><DialogTitle srOnly>{initialClient.fullName}&apos;s Calendar</DialogTitle><DialogDescription srOnly>View and manage calendar entries.</DialogDescription></DialogHeader>
        
        <div className="flex flex-col h-full w-full">
            <div className="flex-shrink-0">
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
                    <div className="p-2 border-b"><TabsList className="grid w-full grid-cols-3 mx-auto max-w-xs"><TabsTrigger value="day">Day</TabsTrigger><TabsTrigger value="week">Week</TabsTrigger><TabsTrigger value="month">Month</TabsTrigger></TabsList></div>
                </Tabs>
                {activeTab === 'day' && <DailySummaryBar summary={calendarData?.summary} onSummaryClick={handleSummaryClick} />}
            </div>
            <div className="flex-1 min-h-0">
              {activeTab === 'day' && <DayView client={initialClient} selectedDate={selectedDate} entries={allEntries} isLoading={isLoading} onDateChange={setSelectedDate} onEntryChange={handleEntryChange} highlightedEntryId={highlightedEntryId} />}
              {activeTab === 'week' && <WeekView client={initialClient} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setActiveTab={setActiveTab} onDateChange={setSelectedDate} entries={allEntries} isLoading={isLoading} />}
              {activeTab === 'month' && <MonthView client={initialClient} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setActiveTab={setActiveTab} onDateChange={setSelectedDate} entries={allEntries} isLoading={isLoading} />}
            </div>
        </div>
      </DialogContent>
    </Dialog>
    <NutritionalSummaryDialog isOpen={isSummaryOpen} onClose={() => setIsSummaryOpen(false)} summary={calendarData?.summary} client={fullClientProfile} onEditGoals={handleEditGoals} />
    <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} defaultTab="account" defaultAccordion={settingsDefaultAccordion} />
    </>
  );
}
