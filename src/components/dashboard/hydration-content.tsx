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
import { Lock, PlusCircle, X } from 'lucide-react';
import { ClientProfile, UserTier } from '@/types';
import { AppNumberInput } from '../ui/number-input';

interface ContentProps {
    onFormStateChange: (newState: Partial<any>) => void;
    formState: any;
    clientProfile: ClientProfile | null;
}

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

export function HydrationContent({ clientProfile, formState, onFormStateChange }: ContentProps) {
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);

    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value });
    };

    // Correctly identifies if the REMINDERS feature should be locked.
    const isRemindersLocked = clientProfile?.tier === 'free' || clientProfile?.tier === 'ad-free';

    const handleReminderToggle = (checked: boolean) => {
        if (isRemindersLocked) {
            setIsUpgradeModalOpen(true);
            return;
        }
        handleFieldChange('remindersEnabled', checked);
        if (checked && (!formState.reminderTimes || formState.reminderTimes.length === 0)) {
            handleFieldChange('reminderTimes', ['09:00', '12:00', '15:00']);
        }
        if (checked && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    };
    
    const addReminderTime = () => handleFieldChange('reminderTimes', [...(formState.reminderTimes || []), '17:00']);
    
    const removeReminderTime = (index: number) => {
        const newTimes = (formState.reminderTimes || []).filter((_: any, i: number) => i !== index);
        handleFieldChange('reminderTimes', newTimes);
    };
    
    const updateReminderTime = (index: number, value: string) => {
        const newTimes = [...(formState.reminderTimes || [])];
        newTimes[index] = value;
        handleFieldChange('reminderTimes', newTimes);
    };
    
    // **THE FIX**: Use the ideal protein goal (which equals ideal weight in lbs) as the suggested hydration goal in oz.
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
                        />
                         <Select value={formState.unit || 'oz'} onValueChange={value => handleFieldChange('unit', value)}>
                            <SelectTrigger className="w-[80px]">
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
                                        <Input 
                                            type="time" 
                                            value={time} 
                                            onChange={e => updateReminderTime(index, e.target.value)} 
                                            className="flex-1"
                                        />
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReminderTime(index)}>
                                            <X className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" className="w-full" onClick={addReminderTime}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Add Reminder
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
             <UpgradeModal
                isOpen={isUpgradeModalOpen}
                onClose={() => setIsUpgradeModalOpen(false)}
                // **THE FIX**: Use the correct enum syntax for the tier.
                requiredTier={UserTier.Basic}
                featureName="Hydration Reminders"
                reason="Build consistent hydration habits with gentle reminders."
            />
        </>
    );
}
