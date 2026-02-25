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

interface ContentProps {
    onFormStateChange: (newState: any) => void;
    formState?: any;
}

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

const TOTAL_TIMER_SECONDS = 1200; // 20 minutes

const TwentyMinuteTimer = () => {
    const { isActive, startTime, pausedElapsed, start, pause, reset } = useProtocolTimerStore();
    const [, setTick] = useState(0); // A dummy state to force re-renders

    useEffect(() => {
        let interval: NodeJS.Timeout | null = null;
        if (isActive) {
            // If the timer is active, set up an interval to re-render the component every second.
            interval = setInterval(() => {
                setTick(t => t + 1);
            }, 1000);
        }
        // Clean up the interval when the component unmounts or isActive changes.
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActive]);

    // This function calculates the remaining time on every single render.
    // This is the core of the fix: the UI is always derived from the persistent store state.
    const getSecondsLeft = () => {
        if (isActive && startTime) {
            // Timer is currently running.
            const elapsedSinceStart = (Date.now() - startTime) / 1000;
            return Math.max(0, TOTAL_TIMER_SECONDS - (pausedElapsed + elapsedSinceStart));
        }
        // Timer is paused or in its initial state.
        return Math.max(0, TOTAL_TIMER_SECONDS - pausedElapsed);
    };

    const secondsLeft = getSecondsLeft();

    // This effect runs when secondsLeft changes.
    useEffect(() => {
        if (secondsLeft <= 0 && isActive) {
            // When the timer hits zero, automatically pause it.
            // You could also add a sound effect here.
            pause();
        }
    }, [secondsLeft, isActive, pause]);

    const formatTime = (totalSeconds: number) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    // The buttons are now connected to the global store's actions.
    return (
        <div className="rounded-lg bg-muted p-2 flex items-center justify-between gap-2">
            <p className="font-mono text-3xl font-bold tracking-widest">{formatTime(secondsLeft)}</p>
            <div className="flex gap-2">
                <Button onClick={isActive ? pause : start} variant="secondary" size="sm" className="h-8 w-[90px]">
                    {isActive ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {isActive ? 'Pause' : (pausedElapsed > 0 ? 'Resume' : 'Start')}
                </Button>
                <Button onClick={reset} variant="destructive" size="sm" className="h-8">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                </Button>
            </div>
        </div>
    );
};

export const ProtocolContent = ({ onFormStateChange, formState }: Omit<ContentProps, 'pillar' | 'entryDate' | 'clientProfile'>) => {
    const handleChange = (field: string, value: any) => {
        onFormStateChange({ [field]: value });
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
        <div className="space-y-4">
            <Input value={mealDescription} onChange={e => handleChange('mealDescription', e.target.value)} placeholder="Meal Description" />

            <div className="grid grid-cols-2 gap-4">
                <HungerScaleDropdown value={preMealHunger} onValueChange={(v) => handleChange('preMealHunger', v)} label="Pre-Meal Hunger" />
                <div className="space-y-1">
                    <Label>Pre-Meal Stress</Label>
                    <Select value={String(preMealStress)} onValueChange={(v) => handleChange('preMealStress', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{numberScale(1, 10).map(i => <SelectItem key={i} value={String(i)}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <p className="text-xs text-center text-muted-foreground pt-2">Start Timer After Eating 75% of Your Plated Portion and Then Drinking 20 oz of Water</p>

            <TwentyMinuteTimer />

            <div className="grid grid-cols-2 gap-4">
                <HungerScaleDropdown value={postMealHunger} onValueChange={(v) => handleChange('postMealHunger', v)} label="Post-Meal Hunger" />
                <div className="space-y-1">
                    <Label>Total % Eaten</Label>
                    <Select value={String(percentageEaten)} onValueChange={(v) => handleChange('percentageEaten', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{[25, 50, 75, 100].map(i => <SelectItem key={i} value={String(i)}>{i}%</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <Textarea value={notes} onChange={e => handleChange('notes', e.target.value)} placeholder="Notes"/>
        </div>
    );
}
