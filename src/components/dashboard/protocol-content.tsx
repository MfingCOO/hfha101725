'use client';

import * as React from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useProtocolTimerStore } from '@/store/protocol-timer-store';
import { cn } from '@/lib/utils';

// --- PROPS ---
interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
}

// --- HELPERS ---
const numberScale = (start: number, end: number) => Array.from({ length: end - start + 1 }, (_, i) => start + i);

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

// --- SUB-COMPONENTS ---

const Fieldset = ({ legend, children, className }: { legend: string, children: React.ReactNode, className?: string }) => (
    <div className={cn("relative rounded-md border border-neutral-700/60 p-4 pt-6", className)}>
        <legend className="absolute -top-2.5 left-3 bg-neutral-900 px-1 text-xs font-medium text-neutral-400">
            {legend}
        </legend>
        <div className="grid grid-cols-2 gap-4">
            {children}
        </div>
    </div>
);


const HungerScaleDropdown = ({ value, onValueChange, label }: { value: number, onValueChange: (value: number) => void, label: string }) => {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-medium text-neutral-300">{label}</Label>
            <Select value={String(value)} onValueChange={(v) => onValueChange(Number(v))}>
                <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white focus:ring-1 focus:ring-offset-0 focus:ring-offset-neutral-800 focus:ring-neutral-600">
                    <SelectValue placeholder="Select level" />
                </SelectTrigger>
                <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                    {hungerLevels.map(i => <SelectItem key={i.value} value={String(i.value)}>{i.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
    );
};

const TOTAL_TIMER_SECONDS = 1200; // 20 minutes

const TwentyMinuteTimer = () => {
    const { isActive, startTime, pausedElapsed, start, pause, reset } = useProtocolTimerStore();
    const [, setTick] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive) {
            interval = setInterval(() => setTick(t => t + 1), 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive]);

    const getSecondsLeft = () => {
        if (isActive && startTime) {
            const elapsedSinceStart = (Date.now() - startTime) / 1000;
            return Math.max(0, TOTAL_TIMER_SECONDS - (pausedElapsed + elapsedSinceStart));
        }
        return Math.max(0, TOTAL_TIMER_SECONDS - pausedElapsed);
    };

    const secondsLeft = getSecondsLeft();

    useEffect(() => {
        if (secondsLeft <= 0 && isActive) {
            pause();
        }
    }, [secondsLeft, isActive, pause]);

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className="rounded-lg bg-neutral-800/70 border border-neutral-700/60 p-4 space-y-3">
             <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-5xl font-bold text-white tracking-tighter flex-grow">{formatTime(secondsLeft)}</p>
                <div className="flex gap-2">
                    <Button onClick={isActive ? pause : start} variant="ghost" size="icon" className="h-10 w-10 text-neutral-300 hover:text-white hover:bg-neutral-700">
                        {isActive ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                    </Button>
                    <Button onClick={reset} variant="ghost" size="icon" className="h-10 w-10 text-neutral-300 hover:text-white hover:bg-neutral-700">
                        <RotateCcw className="h-5 w-5" />
                    </Button>
                </div>
            </div>
            <p className="text-xs text-center text-neutral-400 px-2">
                Start the timer after eating 75% of your meal and drinking 20oz of water.
            </p>
        </div>
    );
};

// --- MAIN COMPONENT ---

export const ProtocolContent = ({ onFormStateChange, formState }: ContentProps) => {
    const handleChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value,  });
    };

    const {
        mealDescription = '',
        preMealHunger = 5,
        preMealStress = 3,
        postMealHunger = 2,
        percentageEaten = 100,
        notes = '',
    } = formState || {};

    return (
        <div className="space-y-5 p-1">
            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-neutral-300">Meal Description</Label>
                <Input 
                    value={mealDescription} 
                    onChange={e => handleChange('mealDescription', e.target.value)} 
                    placeholder="e.g., Grilled chicken salad"
                    className="bg-neutral-800 border-neutral-700 text-white" 
                />
            </div>

            <Fieldset legend="Pre-Meal">
                <HungerScaleDropdown 
                    value={preMealHunger} 
                    onValueChange={(v) => handleChange('preMealHunger', v)} 
                    label="Hunger" 
                />
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-neutral-300">Stress</Label>
                    <Select value={String(preMealStress)} onValueChange={(v) => handleChange('preMealStress', Number(v))}>
                        <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white focus:ring-1 focus:ring-offset-0 focus:ring-offset-neutral-800 focus:ring-neutral-600">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                            {numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </Fieldset>

            <TwentyMinuteTimer />

            <Fieldset legend="Post-Meal">
                <HungerScaleDropdown 
                    value={postMealHunger} 
                    onValueChange={(v) => handleChange('postMealHunger', v)} 
                    label="Hunger" 
                />
                <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-neutral-300">Total % Eaten</Label>
                    <Select value={String(percentageEaten)} onValueChange={(v) => handleChange('percentageEaten', Number(v))}>
                        <SelectTrigger className="w-full bg-neutral-800 border-neutral-700 text-white focus:ring-1 focus:ring-offset-0 focus:ring-offset-neutral-800 focus:ring-neutral-600">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-neutral-800 border-neutral-700 text-white">
                            {[25, 50, 75, 100].map(i => <SelectItem key={i} value={String(i)}>{`${i}%`}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </Fieldset>

            <div className="space-y-1.5">
                <Label className="text-sm font-medium text-neutral-300">Notes</Label>
                <Textarea 
                    value={notes} 
                    onChange={e => handleChange('notes', e.target.value)} 
                    placeholder="Any reflections on the meal or how you feel?"
                    className="bg-neutral-800 border-neutral-700 text-white"
                />
            </div>
        </div>
    );
}
