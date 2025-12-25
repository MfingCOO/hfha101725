'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isToday,
  getDay,
  isSameMonth,
} from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import type { ClientProfile } from '@/types';

const safeParseDate = (dateSource: any): Date | null => {
    if (!dateSource) return null;
    if (typeof dateSource.toDate === 'function') return dateSource.toDate();
    const date = new Date(dateSource);
    if (isNaN(date.getTime())) return null;
    return date;
};

interface MonthViewProps {
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

export function MonthView({ client, selectedDate, setSelectedDate, setActiveTab, entries, isLoading, onDateChange }: MonthViewProps) {
  const [userTimezone, setUserTimezone] = useState('');

  useEffect(() => {
    setUserTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  const currentMonth = useMemo(() => startOfMonth(selectedDate), [selectedDate]);

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);
  
  const startingDayIndex = getDay(daysInMonth[0]);

  const changeMonth = (direction: 'next' | 'prev') => {
    const newMonth = direction === 'next' ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1);
    onDateChange(newMonth);
  };
  
  const entriesByDay = useMemo(() => {
    if (!userTimezone) return new Map<string, any[]>();
    const map = new Map<string, any[]>();
    for (const entry of entries) {
      const entryDate = safeParseDate(entry.start || entry.startTime || entry.entryDate || entry.wakeUpDay);
      if (entryDate) {
        const zonedDate = toZonedTime(entryDate, userTimezone);
        const entryDateStr = format(zonedDate, 'yyyy-MM-dd');
        if (!map.has(entryDateStr)) {
          map.set(entryDateStr, []);
        }
        map.get(entryDateStr)!.push(entry);
      }
    }
    return map;
  }, [entries, userTimezone]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setActiveTab('day');
  };

  return (
    <div className="flex flex-col h-full p-2">
      <div className="flex justify-between items-center mb-2 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={() => changeMonth('prev')}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h3 className="text-base font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => changeMonth('next')}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

       <div className="grid grid-cols-7 text-center text-xs text-muted-foreground pb-2 border-b mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
      <div className="grid grid-cols-7 gap-1 flex-1">
        {Array.from({ length: startingDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="border-b" />
        ))}
        {daysInMonth.map((day) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const dayEntries = entriesByDay.get(dayKey) || [];
          const pillarDots = Array.from(new Set(dayEntries.map(e => e.displayPillar || e.pillar).filter(Boolean)));

          return (
            <div
              key={dayKey}
              onClick={() => handleDayClick(day)}
              className={cn(
                'flex flex-col border-b p-1.5 cursor-pointer hover:bg-muted/50 transition-colors h-20',
                 !isSameMonth(day, currentMonth) && 'text-muted-foreground'
              )}
            >
              <span className={cn(
                  'font-semibold text-xs',
                  isToday(day) && 'bg-primary text-primary-foreground rounded-full flex items-center justify-center h-5 w-5'
              )}>
                  {format(day, 'd')}
              </span>
              <div className="flex-1 mt-1 overflow-hidden">
                <div className="flex flex-wrap gap-0.5">
                    {pillarDots.slice(0, 9).map((pillar, index) => (
                         <div key={`${pillar}-${index}`} title={pillar as string} className={cn("h-1 w-1 rounded-full", pillarDotColors[pillar as string] || pillarDotColors.default)} />
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
