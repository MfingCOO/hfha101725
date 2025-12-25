'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  subDays,
  format,
  isToday,
} from 'date-fns';
import { cn } from '@/lib/utils';
import type { ClientProfile } from '@/types';

// DEFINITIVE FIX: Add a robust date parsing utility to prevent crashes.
const safeParseDate = (dateSource: any): Date | null => {
    if (!dateSource) return null;
    if (typeof dateSource.toDate === 'function') return dateSource.toDate();
    const date = new Date(dateSource);
    if (isNaN(date.getTime())) return null;
    return date;
};

interface WeekViewProps {
  client: ClientProfile;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  setActiveTab: (tab: 'day' | 'week' | 'month') => void;
  entries: any[];
  isLoading: boolean;
  onDateChange: (date: Date) => void;
}

const pillarDotColors: Record<string, string> = {
  nutrition: 'bg-amber-500',
  activity: 'bg-orange-500',
  sleep: 'bg-indigo-500',
  hydration: 'bg-blue-500',
  stress: 'bg-red-600',
  relief: 'bg-green-500',
  measurements: 'bg-gray-500',
  protocol: 'bg-teal-500',
  planner: 'bg-lime-500',
  craving: 'bg-orange-600',
  binge: 'bg-red-600',
  habit: 'bg-yellow-500',
  default: 'bg-gray-400',
};

export function WeekView({ client, selectedDate, setSelectedDate, setActiveTab, entries, isLoading, onDateChange }: WeekViewProps) {
  
  const week = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(selectedDate),
      end: endOfWeek(selectedDate),
    });
  }, [selectedDate]);

  const changeWeek = (direction: 'next' | 'prev') => {
    const newDate = direction === 'next' ? addDays(selectedDate, 7) : subDays(selectedDate, 7);
    onDateChange(newDate);
  };

  // DEFINITIVE FIX: Use safeParseDate and check multiple date fields to group entries reliably.
  const entriesByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const entry of entries) {
      const entryDate = safeParseDate(entry.start || entry.startTime || entry.entryDate || entry.wakeUpDay);
      if (entryDate) {
        const entryDateStr = format(entryDate, 'yyyy-MM-dd');
        if (!map.has(entryDateStr)) {
          map.set(entryDateStr, []);
        }
        map.get(entryDateStr)!.push(entry);
      }
    }
    return map;
  }, [entries]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setActiveTab('day');
  };

  return (
    <div className="flex flex-col h-full p-2">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => changeWeek('prev')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">
          {format(week[0], 'MMM d')} - {format(week[6], 'MMM d, yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => changeWeek('next')}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
      <div className="grid grid-cols-7 gap-1 flex-1">
        {week.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEntries = entriesByDay.get(dayKey) || [];
          const pillarDots = Array.from(new Set(dayEntries.map(e => e.displayPillar || e.pillar).filter(Boolean)));

          return (
            <div
              key={dayKey}
              onClick={() => handleDayClick(day)}
              className={cn(
                'flex flex-col border rounded-md p-1.5 cursor-pointer hover:bg-muted/50 transition-colors',
                isToday(day) && 'bg-primary/10 border-primary/30'
              )}
            >
              <div className="flex justify-between items-center text-xs">
                <span className={cn('font-semibold', isToday(day) ? 'text-primary' : 'text-muted-foreground')}>
                    {format(day, 'EEE')}
                </span>
                <span className={cn(
                    'flex items-center justify-center h-5 w-5 rounded-full',
                    isToday(day) && 'bg-primary text-primary-foreground font-bold'
                )}>
                    {format(day, 'd')}
                </span>
              </div>
              <div className="flex-1 mt-2">
                <div className="flex flex-wrap gap-1">
                    {/* DEFINITIVE FIX: Add index to key to prevent React warnings */}
                    {pillarDots.map((pillar, index) => (
                         <div key={`${pillar}-${index}`} title={pillar as string} className={cn("h-1.5 w-1.5 rounded-full", pillarDotColors[pillar as string] || pillarDotColors.default)} />
                    ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
