'use client';

import * as React from 'react';
import { Label } from '../ui/label';
import { AppNumberInput } from '../ui/number-input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';

interface ContentProps {
    onFormStateChange: (newState: Partial<any>) => void;
    formState?: any;
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

const activityConfig = {
    cardio: ['Running', 'Walking', 'Cycling', 'Swimming', 'HIIT', 'Elliptical', 'Other'],
    strength: ['Weightlifting', 'Bodyweight', 'Pilates', 'TRX', 'Kettlebell', 'Other'],
    'mind-body': ['Yoga', 'Meditation', 'Stretching', 'Tai Chi', 'Breathwork', 'Other']
};

const intensityLevels = [
    { value: 'very-light', 'label': 'Very Light' },
    { value: 'light', 'label': 'Light' },
    { value: 'moderate', 'label': 'Moderate' },
    { value: 'vigorous', 'label': 'Vigorous' },
    { value: 'maximum', 'label': 'Maximum' }
];

// This component is now correctly "controlled"
export function ActivityContent({ onFormStateChange, formState }: ContentProps) {
    
    // This handler now correctly sends only the changed fields to the parent
    const handleFieldChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value });
        
        // If category changes, also send an update to reset activityType
        if (field === 'category') {
            onFormStateChange({ activityType: '' });
        }
    };

    return (
        <div className="space-y-3 p-1">
            <div className="space-y-2">
                <Tabs value={formState.category} onValueChange={(value) => handleFieldChange('category', value)}>
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="cardio">Cardio</TabsTrigger>
                        <TabsTrigger value="strength">Strength</TabsTrigger>
                        <TabsTrigger value="mind-body">Mind-Body</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {formState.category && (
                <div className="space-y-3">
                    <Select value={formState.activityType} onValueChange={(v) => handleFieldChange('activityType', v)}>
                        {/* FIX: Removed invalid "placeholder" prop from SelectTrigger */}
                        <SelectTrigger>
                            <SelectValue placeholder="Select an activity..." />
                        </SelectTrigger>
                        <SelectContent>
                            {activityConfig[formState.category as keyof typeof activityConfig].map(activity => (
                                <SelectItem key={activity} value={activity}>{activity}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {formState.activityType === 'Other' && (
                        <Input
                            placeholder="Specify other activity"
                            value={formState.otherActivityType}
                            onChange={(e) => handleFieldChange('otherActivityType', e.target.value)}
                        />
                    )}
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <Label>Duration (min)</Label>
                    <AppNumberInput
                        value={formState.duration}
                        onChange={(value) => handleFieldChange('duration', value === '' ? 0 : value)}
                    />
                </div>
                <div className="space-y-1">
                    <Label>Intensity</Label>
                    <Select value={formState.intensity} onValueChange={(v) => handleFieldChange('intensity', v)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Intensity" />
                        </SelectTrigger>
                        <SelectContent>
                            {intensityLevels.map(level => (
                                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                <HungerScaleDropdown value={formState.hungerBefore} onValueChange={(v) => handleFieldChange('hungerBefore', v)} label="Hunger Before" />
                <HungerScaleDropdown value={formState.hungerAfter} onValueChange={(v) => handleFieldChange('hungerAfter', v)} label="Hunger After" />
            </div>
            <Textarea
                value={formState.notes}
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                placeholder="Notes (e.g., felt great, a little tired...)"
            />
        </div>
    );
}
