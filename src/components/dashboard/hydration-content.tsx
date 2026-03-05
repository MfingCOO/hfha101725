'use client';

import * as React from 'react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Separator } from '../ui/separator';
import { Textarea } from '../ui/textarea';
import { UpgradeModal } from '../modals/upgrade-modal';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Lock, PlusCircle, X, Loader2 } from 'lucide-react';
import { ClientProfile, UserTier } from '@/types';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: Partial<any>) => void;
    formState: any;
    clientProfile: ClientProfile | null;
    handleSaveSettings?: () => void;
    isSaving?: boolean;
}

// --- Time Picker Helpers ---
const parseTime = (time: string) => {
    if (!time) return { hour: '09', minute: '00', ampm: 'AM' };
    const [h, m] = time.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return {
        hour: String(hour).padStart(2, '0'),
        minute: m,
        ampm: ampm
    };
};

const constructTime = (hour: string, minute: string, ampm: string) => {
    let h = parseInt(hour, 10);
    if (ampm === 'PM' && h < 12) {
        h += 12;
    }
    if (ampm === 'AM' && h === 12) {
        h = 0;
    }
    return `${String(h).padStart(2, '0')}:${minute}`;
};

const TimePicker = ({ time, onTimeChange }: { time: string, onTimeChange: (newTime: string) => void }) => {
    const { hour, minute, ampm } = parseTime(time);

    const handleHourChange = (newHour: string) => {
        onTimeChange(constructTime(newHour, minute, ampm));
    };

    const handleMinuteChange = (newMinute: string) => {
        onTimeChange(constructTime(hour, newMinute, ampm));
    };

    const handleAmPmChange = (newAmPm: string) => {
        onTimeChange(constructTime(hour, minute, newAmPm));
    };

    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
    const minutes = ['00', '15', '30', '45'];

    return (
        <div className="flex items-center gap-1.5 grow">
            <Select value={hour} onValueChange={handleHourChange}>
                <SelectTrigger className="min-w-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {hours.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="min-w-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {minutes.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={ampm} onValueChange={handleAmPmChange}>
                <SelectTrigger className="min-w-0">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="AM">AM</SelectItem>
                    <SelectItem value="PM">PM</SelectItem>
                </SelectContent>
            </Select>
        </div>
    );
};

const hungerLevels = [
    { value: 0, label: '0 - Stuffed' },
    { value: 1, label: '1 - Overly Full' },
    { value: 2, label: '2 - Satiated' },
    { value: 3, label: '3 - Barely Satiated' },
    { value: 4, label: '4 - Not Hungry, Not Full' },
    { value: 5, label: '5 - Neutral' },
    { value: 6, label: '6 - Slightly Hungry' },
    { value: 7, label: '7 - Hungry' },
    { value: 8, label: '8 - Very Hungry' },
    { value: 9, label: '9 - Famished' },
    { value: 10, label: '10 - Starving' }
];

const HungerScaleDropdown = ({ value, onValueChange, label = "Hunger Level (0-10)" }: { value: number, onValueChange: (value: number) => void, label?: string }) => {
    return (
        <div className="space-y-1">
            <Label>{label}</Label>
            <Select value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
                <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent>
                    {hungerLevels.map(i => <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
};

export function HydrationContent({ clientProfile, formState, onFormStateChange, handleSaveSettings, isSaving }: ContentProps) {
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value });
    };

    const isRemindersLocked = clientProfile?.tier === 'free' || clientProfile?.tier === 'ad-free';

    const handleReminderToggle = (checked: boolean) => {
        if (isRemindersLocked) {
            setIsUpgradeModalOpen(true);
            return;
        }
        onFormStateChange({ remindersEnabled: checked });
        if (checked && (!formState.reminderTimes || formState.reminderTimes.length === 0)) {
            onFormStateChange({ reminderTimes: ['09:00', '12:00', '15:00'] });
        }
    };

    
    const addReminderTime = () => {
        const newTimes = [...(formState.reminderTimes || []), '17:00'];
        onFormStateChange({ reminderTimes: newTimes });
    };
    
    const removeReminderTime = (index: number) => {
        const newTimes = (formState.reminderTimes || []).filter((_: any, i: number) => i !== index);
        onFormStateChange({ reminderTimes: newTimes });
    };
    
    const updateReminderTime = (index: number, value: string) => {
        const newTimes = [...(formState.reminderTimes || [])];
        newTimes[index] = value;
        onFormStateChange({ reminderTimes: newTimes });
    };
    
    const suggestedGoal = clientProfile?.customGoals?.protein;

    return (
        <>
            <div className="space-y-4 p-1">
                <div className="space-y-2">
                    <Label>How much did you drink?</Label>
                    <div className="flex items-center gap-2">
                        <AppNumberInput
                            value={formState.amount || ''}
                            onChange={value => handleFieldChange('amount', value === '' ? 0 : Number(value))}
                            className="w-24"
                        />
                         <Select value={formState.unit || 'oz'} onValueChange={value => handleFieldChange('unit', value)}>
                            <SelectTrigger className="w-auto">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="oz">oz</SelectItem>
                                <SelectItem value="ml">ml</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="grid grid-cols-4 gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => handleFieldChange('amount', (formState.amount || 0) + 8)}>+8</Button>
                        <Button variant="outline" size="sm" onClick={() => handleFieldChange('amount', (formState.amount || 0) + 12)}>+12</Button>
                        <Button variant="outline" size="sm" onClick={() => handleFieldChange('amount', (formState.amount || 0) + 16)}>+16</Button>
                        <Button variant="outline" size="sm" onClick={() => handleFieldChange('amount', (formState.amount || 0) + 20)}>+20</Button>
                    </div>
                </div>
                <HungerScaleDropdown value={formState.hunger || 5} onValueChange={(v) => handleFieldChange('hunger', v)} />
                <div className="space-y-2">
                    <Textarea value={formState.notes || ''} onChange={(e) => handleFieldChange('notes', e.target.value)} placeholder="Notes" />
                </div>

                <Separator />
                <h4 className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">Hydration Settings</h4>

                 <div className="space-y-2">
                    <Label>Daily Goal ({formState.unit || 'oz'})</Label>
                    <AppNumberInput
                        value={formState.target || ''}
                        onChange={value => handleFieldChange('target', Number(value))}
                        placeholder={suggestedGoal ? `Suggested: ${suggestedGoal} oz` : "Set a daily goal"}
                    />
                </div>
                 <div className="space-y-2">
                     <Label>Reminders</Label>
                     <div className={cn("flex flex-col gap-4 rounded-lg border p-3", isRemindersLocked ? "border-amber-500/50 bg-amber-500/10" : "border-border")}>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="reminders-switch" className="text-sm font-medium">
                                   Enable Drink Reminders
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Get notifications to help you stay hydrated.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isRemindersLocked && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Lock className="h-4 w-4 text-amber-400" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Available on Basic tier and up.</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                              <Switch
                                id="reminders-switch"
                                checked={!!formState.remindersEnabled}
                                onCheckedChange={handleReminderToggle}
                              />
                            </div>
                        </div>
                         {formState.remindersEnabled && !isRemindersLocked && (
                            <div className="space-y-3 pt-2 border-t border-border">
                                {(formState.reminderTimes || []).map((time: string, index: number) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <TimePicker 
                                            time={time} 
                                            onTimeChange={value => updateReminderTime(index, value)} 
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => removeReminderTime(index)}>
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                                <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
    <Button variant="outline" size="sm" className="w-full" onClick={addReminderTime}>
        <PlusCircle className="mr-2 h-4 w-4" /> Add Reminder
    </Button>
    {handleSaveSettings && (
         <Button onClick={handleSaveSettings} size="sm" className="w-full text-white bg-blue-500 hover:bg-blue-600" disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Settings
        </Button>
    )}
</div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
             <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                requiredTier={UserTier.Basic}
                featureName="Hydration Reminders"
                reason="Build consistent hydration habits with gentle reminders."
            />
        </>
    );
}
