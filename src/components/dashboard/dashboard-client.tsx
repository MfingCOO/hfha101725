'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Apple, Droplet, Flame, Lightbulb, Moon, Salad, Scale, CloudSun, UserCheck, UtensilsCrossed, ArrowRight, Lock, Calendar, RefreshCw, Trophy } from 'lucide-react';
import Image from 'next/image';
import { DataEntryDialog } from '@/components/dashboard/data-entry-dialog';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/auth-provider';
import { ClientProfile, UserTier, Challenge } from '@/types';
import { getUpcomingIndulgences, resetBingeStreakAction } from '@/services/firestore';
import { getLatestChallengeForClient, joinChallengeAction } from '@/app/challenges/actions';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { InsightsDialog } from '../insights/insights-dialog';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';
import { differenceInCalendarDays, format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CalendarDialog } from '../calendar/calendar-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import quotes from '@/lib/quotes.json';

import { LucideIcon } from 'lucide-react';
import { useDataEntryModal } from '@/contexts/DataEntryModalContext';
import { UpgradeModal } from '../modals/upgrade-modal';
import { SettingsDialog } from '../settings/SettingsDialog';
import { UpcomingEventWidget } from '@/components/client/UpcomingEventWidget';
import { ProgramWidget } from '@/components/client/ProgramWidget';
import { ProgramListDialog } from '@/components/programs/program-list-dialog';
import { ProgramHubDialog } from '@/components/client/ProgramHubDialog';
import { useNotificationStore } from '@/store/notification-store';
import { AppointmentDetailDialog } from '../calendar/AppointmentDetailDialog';
import { WorkoutActionDialog } from '../calendar/WorkoutActionDialog';
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { getChatDetailsAction } from '@/app/coach/clients/actions';

export interface Pillar {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  requiredTier: UserTier;
}

const pillarsAndTools: Pillar[] = [
  { id: 'nutrition', label: 'Nutrition', icon: UtensilsCrossed, color: 'text-foreground', bgColor: 'bg-amber-400', borderColor: 'border-amber-600', requiredTier: UserTier.Free },
  { id: 'activity', label: 'Activity', icon: Flame, color: 'text-foreground', bgColor: 'bg-orange-400', borderColor: 'border-orange-600', requiredTier: UserTier.Free },
  { id: 'sleep', label: 'Sleep', icon: Moon, color: 'text-foreground', bgColor: 'bg-indigo-400', borderColor: 'border-indigo-600', requiredTier: UserTier.Free },
  { id: 'stress', label: 'Stress Relief', icon: CloudSun, color: 'text-foreground', bgColor: 'bg-green-400', borderColor: 'border-green-600', requiredTier: UserTier.Basic },
  { id: 'hydration', label: 'Hydration', icon: Droplet, color: 'text-foreground', bgColor: 'bg-blue-400', borderColor: 'border-blue-600', requiredTier: UserTier.Free },
  { id: 'protocol', label: '75/20/20 Protocol', icon: UserCheck, color: 'text-foreground', bgColor: 'bg-teal-400', borderColor: 'border-teal-600', requiredTier: UserTier.Basic },
  { id: 'planner', label: 'Indulgence Planner', icon: Salad, color: 'text-foreground', bgColor: 'bg-lime-400', borderColor: 'border-lime-600', requiredTier: UserTier.Basic },
  { id: 'cravings', label: 'Cravings/Binges', icon: Apple, color: 'text-foreground', bgColor: 'bg-red-400', borderColor: 'border-red-600', requiredTier: UserTier.Basic },
  { id: 'insights', label: 'Insights', icon: Lightbulb, color: 'text-foreground', bgColor: 'bg-yellow-400', borderColor: 'border-yellow-600', requiredTier: UserTier.Basic },
  { id: 'measurements', label: 'Measurements', icon: Scale, color: 'text-foreground', bgColor: 'bg-gray-400', borderColor: 'border-gray-600', requiredTier: UserTier.Free },
];

const tierRank: UserTier[] = [UserTier.Free, UserTier.AdFree, UserTier.Basic, UserTier.Premium, UserTier.Coaching];

const topRowButtons = pillarsAndTools.slice(0, 5);
const bottomRowButtons = pillarsAndTools.slice(5, 10);

const safeNewDate = (dateSource: any): Date | null => {
    if (!dateSource) return null;
    if (dateSource instanceof Date) return dateSource;
    if (typeof dateSource === 'string' || typeof dateSource === 'number') return new Date(dateSource);
    if (dateSource.toDate && typeof dateSource.toDate === 'function') return dateSource.toDate();
    return null;
}

interface DashboardClientProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export function DashboardClient({ searchParams }: DashboardClientProps) {
  const { onOpenChallenges, onOpenCalendar, isSettingsOpen, onCloseSettings } = useDashboardActions();
  const { user, isCoach, loading } = useAuth();
  const { toast } = useToast();
  const { modalType, closeModal, openModal } = useDataEntryModal();
  const { notificationChatId, notificationAppointmentId, notificationWorkoutId, triggerHydrationModal, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();

  const [dataEntryDialogOpen, setDataEntryDialogOpen] = useState(false);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);

  const [latestChallenge, setLatestChallenge] = useState<Challenge | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(true);
  const [upcomingIndulgences, setUpcomingIndulgences] = useState<any[]>([]);
  const [isLoadingIndulgences, setIsLoadingIndulgences] = useState(true);

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [initialCalendarDate, setInitialCalendarDate] = useState<Date | undefined>(undefined);
  const [highlightedEntryId, setHighlightedEntryId] = useState<string | undefined>(undefined);

  const [isResettingStreak, setIsResettingStreak] = useState(false);
  const [isResetStreakAlertOpen, setIsResetStreakAlertOpen] = useState(false);

  const [liveBingeFreeSince, setLiveBingeFreeSince] = useState<any>(null);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);

  const [isMounted, setIsMounted] = useState(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const [isProgramListOpen, setIsProgramListOpen] = useState(false);
  const [isProgramHubOpen, setIsProgramHubOpen] = useState(false);
  const [isJoiningChallenge, setIsJoiningChallenge] = useState(false);

  const [isAppointmentDetailOpen, setIsAppointmentDetailOpen] = useState(false);
  const [isWorkoutActionOpen, setIsWorkoutActionOpen] = useState(false);
  const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
  const [selectedChatInfo, setSelectedChatInfo] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Effect to process incoming searchParams from notifications and set global state
  useEffect(() => {
    if (!searchParams) return;

    const openChatId = String(searchParams.openChatId || '');
    const openWorkoutId = String(searchParams.openWorkoutId || '');
    const openAppointmentId = String(searchParams.openAppointmentId || '');
    const openHydration = String(searchParams.openHydration || 'false');
    const notificationType = String(searchParams.notificationType || '');

    // Surgical Fix 1 (Client Dashboard): Defer processing if authentication is still loading
    if (loading) return; 

    // Chat notifications are working and are explicitly NOT modified here.
    if (notificationType === 'chat' && openChatId) {
      setNotificationChatId(openChatId);
    } 
    // Workout notifications (ORIGINAL LOGIC - UNTOUCHED)
    else if (notificationType === 'workout_reminder' && openWorkoutId) {
      setNotificationWorkoutId(openWorkoutId);
    } 
    // Appointment notifications (TARGETED FIX)
    else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && openAppointmentId) {
      // Surgical Fix 2 (Client Dashboard): Check for authenticated user BEFORE setting notification ID
      if (!user) { 
        toast({
          variant: 'destructive',
          title: 'Authentication Required',
          description: 'Please log in to view appointment details.',
        });
        return; // Prevent setting ID if unauthenticated
      }
      setNotificationAppointmentId(openAppointmentId);
    } 
    // Hydration notifications (ORIGINAL LOGIC - UNTOUCHED)
    else if (notificationType === 'hydration' && openHydration === 'true') {
      setTriggerHydrationModal(true);
    }
  }, [searchParams, loading, user, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, toast]);

  // Effect to open dialogs based on notification store state
  useEffect(() => {
    const handleChatNotification = async (chatId: string) => {
        const result = await getChatDetailsAction(chatId);
        if (result.success && result.data) {
            setSelectedChatInfo(result.data);
            setIsChatDialogOpen(true);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not open the specified chat.' });
            setNotificationChatId(''); // Clear the bad ID
        }
    };

    if (notificationChatId) {
        handleChatNotification(notificationChatId);
    }
    // Appointment notifications (TARGETED FIX)
    if (notificationAppointmentId && user) { // Surgical Fix 3 (Client Dashboard): Only open AppointmentDetailDialog if user is authenticated
      setIsAppointmentDetailOpen(true);
    }
    // Workout dialog (ORIGINAL LOGIC - UNTOUCHED)
    if (notificationWorkoutId) { 
      setIsWorkoutActionOpen(true);
    }
    // Hydration modal (ORIGINAL LOGIC - UNTOUCHED)
    if (triggerHydrationModal) { 
      openModal('hydration');
      setTriggerHydrationModal(false);
    }
  }, [notificationChatId, notificationAppointmentId, notificationWorkoutId, triggerHydrationModal, openModal, setTriggerHydrationModal, setNotificationChatId, toast, user]);

  const executePillarAction = (pillar: Pillar) => {
    if (pillar.id === 'insights') {
      setInsightsDialogOpen(true);
    }
    else {
      setActivePillar(pillar);
      setDataEntryDialogOpen(true);
    }
  }

  const handlePillarClick = (pillar: Pillar) => {
    if (!clientProfile || !isMounted) return;

    const currentTierIndex = tierRank.indexOf(clientProfile.tier || UserTier.Free);
    const requiredTierIndex = tierRank.indexOf(pillar.requiredTier);

    if (currentTierIndex < requiredTierIndex) {
        setActivePillar(pillar);
        setIsUpgradeModalOpen(true);
        return;
    }

    executePillarAction(pillar);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;

    setIsLoadingChallenge(true);
    setIsLoadingIndulgences(true);

    getLatestChallengeForClient().then(result => {
      if (result.success && result.data) {
        setLatestChallenge(result.data as Challenge);
      }
      else if (result.error && result.error !== 'not-found') {
        toast({ variant: 'destructive', title: 'Error', description: `Could not load challenge: ${result.error}` });
      }
      setIsLoadingChallenge(false);
    });

    getUpcomingIndulgences(user.uid).then(result => {
      if (result.success && result.data) setUpcomingIndulgences(result.data);
      setIsLoadingIndulgences(false);
    });
  }, [user, toast]);

  useEffect(() => {
    if (loading) return;

    if (user) {
      fetchDashboardData();
    }

    if (user?.uid && !isCoach) {
      const docRef = doc(db, 'clients', user.uid);
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ClientProfile;
          setClientProfile(data);
          if (data.bingeFreeSince) {
            setLiveBingeFreeSince(data.bingeFreeSince);
          }
        }
      });
      return () => unsubscribe();
    }
  }, [user, isCoach, loading, fetchDashboardData]);

  useEffect(() => {
    if (onOpenCalendar) {
        (onOpenCalendar as any)._open = () => {
            setInitialCalendarDate(new Date());
            setHighlightedEntryId(undefined);
            setIsCalendarOpen(true);
        }
    }
  }, [onOpenCalendar]);

  useEffect(() => {
    if (modalType) {
      const pillarToOpen = pillarsAndTools.find(p => p.id === modalType);
      if (pillarToOpen) {
        setActivePillar(pillarToOpen);
        setDataEntryDialogOpen(true);
      }
    }
  }, [modalType]);

  const handleDataEntryDialogClose = (wasSaved: boolean) => {
    setDataEntryDialogOpen(false);
    setActivePillar(null);
    closeModal();
    // Clear notification states when closing data entry dialog to prevent re-opening
    setNotificationAppointmentId('');
    setNotificationWorkoutId('');
    setTriggerHydrationModal(false);
    setNotificationChatId('');
    if (wasSaved) {
      fetchDashboardData();
    }
  }

  const handleSwitchPillar = (pillarId: string) => {
    const pillarToSwitch = pillarsAndTools.find(p => p.id === pillarId);
    if (pillarToSwitch) {
      setActivePillar(pillarToSwitch);
      setDataEntryDialogOpen(true);
    }
  };

  const handleResetStreak = async () => {
    if (!user) return;
    setIsResettingStreak(true);
    try {
        const result = await resetBingeStreakAction(user.uid);
        if (result.success) {
            toast({ title: 'Streak Reset', description: 'Your binge-free streak has been reset to 0 days.' });
        } else {
            throw new Error(result.error || 'Failed to reset streak.');
        }
    }
    catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
    finally {
      setIsResettingStreak(false);
      setIsResetStreakAlertOpen(false);
    }
  };

  const handleOpenProgramList = () => {
    setIsProgramListOpen(true);
  };

  const handleOpenCurrentProgram = () => {
    setIsProgramHubOpen(true);
  };

  const bingeFreeSinceDate = useMemo(() => {
      const source = liveBingeFreeSince || clientProfile?.bingeFreeSince;
      return safeNewDate(source);
  }, [liveBingeFreeSince, clientProfile]);

  const bingeFreeDays = useMemo(() => {
    if (!bingeFreeSinceDate) return 0;
    return differenceInCalendarDays(new Date(), bingeFreeSinceDate);
  }, [bingeFreeSinceDate]);

    const getDayOfYear = () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - start.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    };

    const dayOfYear = getDayOfYear();
    const quoteOfTheDay = quotes[dayOfYear % quotes.length];

  const handleJoinChallenge = async (challengeId: string) => {
    if (!user) return;
    setIsJoiningChallenge(true);
    try {
        const result = await joinChallengeAction(challengeId, user.uid);
        if (result.success) {
            toast({ title: 'Challenge Joined!', description: 'You have successfully joined the challenge.' });
            fetchDashboardData();
        } else {
            throw new Error(result.error || 'Failed to join challenge.');
        }
    }
    catch (error: any) {
        toast({ variant: 'destructive', title: 'Error Joining Challenge', description: error.message });
    }
    finally {
        setIsJoiningChallenge(false);
    }
  };

  const renderPillarButton = (pillar: Pillar) => {
    const Icon = pillar.icon;
    const currentTierIndex = clientProfile ? tierRank.indexOf(clientProfile.tier || UserTier.Free) : 0;
    const requiredTierIndex = tierRank.indexOf(pillar.requiredTier);
    const isLocked = currentTierIndex < requiredTierIndex;

    return (
        <button
          key={pillar.id}
          onClick={() => handlePillarClick(pillar)}
          className={cn(
            "group relative flex flex-col items-center justify-center w-14 h-14 sm:w-20 sm:h-20 rounded-full text-center transition-all shadow-sm btn-3d",
            pillar.bgColor,
            pillar.color,
            pillar.borderColor
          )}
        >
          {isLocked && <div className="absolute inset-0 bg-black/50 rounded-full" />}
          <Icon className={cn("h-7 w-7 sm:h-10 transition-transform group-hover:scale-110", isLocked && "opacity-50")} />
          {isLocked && <Lock className="h-4 w-4 absolute top-1 right-1 sm:top-3 sm:right-3 text-white/70" />}
        </button>
      )
  }

  const renderChallengeSection = () => {
    if (isLoadingChallenge) {
      return <Skeleton className="h-40 w-full rounded-xl" />;
    }

    if (!latestChallenge) {
      return (
         <Card className="bg-primary/10 border-primary/20 hover:border-primary/40 transition-all">
            <CardContent className="p-3 flex items-center gap-3">
            <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-primary/20 flex items-center justify-center">
                <Trophy className="w-10 h-10 text-primary/50" />
            </div>
            <div className="flex-1 space-y-1">
                <div>
                <h3 className="font-bold text-base text-card-foreground leading-tight">No Active Challenges</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">Check back soon for the next community challenge.</p>
                </div>
                <Button size="xs" className="w-full sm:w-auto" onClick={onOpenChallenges}>
                    View All Challenges <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </div>
            </CardContent>
        </Card>
      )
    }

    const isParticipant = latestChallenge.participants.includes(user?.uid || '');
    const now = new Date();
    const challengeStartDate = safeNewDate(latestChallenge.dates.from);
    if(!challengeStartDate) return null;
    const isUpcoming = challengeStartDate > now;
    const canJoin = !isParticipant && tierRank.indexOf(clientProfile?.tier || UserTier.Free) >= tierRank.indexOf(UserTier.Premium);
    const needsUpgrade = !isParticipant && tierRank.indexOf(clientProfile?.tier || UserTier.Free) < tierRank.indexOf(UserTier.Premium);

    let badgeText = "";
    let badgeVariant: "secondary" | "default" | "destructive" | "outline" | null | undefined = "secondary";
    if (isParticipant) {
        badgeText = isUpcoming ? "Registered" : "Active Now";
    }
    else if (isUpcoming) {
        badgeText = "Starts Soon";
    }
    else {
        badgeText = "New Challenge!"
    }

    return (
       <Card className="bg-primary/10 border-primary/20 hover:border-primary/40 transition-all">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image src={latestChallenge.thumbnailUrl || "https://placehold.co/400x400.png"} alt={latestChallenge.name} fill className="object-cover" unoptimized/>
          </div>
          <div className="flex-1 space-y-1">
            <div>
              <Badge variant={badgeVariant} className="mb-1 text-xs">{badgeText}</Badge>
              <h3 className="font-bold text-base text-card-foreground leading-tight">{latestChallenge.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{latestChallenge.description}</p>
            </div>
            {isParticipant ? (
                 <Button size="xs" className="w-full sm:w-auto" onClick={onOpenChallenges}>
                    View Challenge <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            ) : canJoin ? (
                <Button size="xs" className="w-full sm:w-auto" onClick={() => handleJoinChallenge(latestChallenge.id)} disabled={isJoiningChallenge}>
                    {isJoiningChallenge && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Join Challenge <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            ) : needsUpgrade ? (
                <Button size="xs" className="w-full sm:w-auto" onClick={() => setIsUpgradeModalOpen(true)}>
                    Upgrade to Join <Lock className="ml-2 h-4 w-4" />
                </Button>
            ) : (
                 <Button size="xs" className="w-full sm:w-auto" onClick={onOpenChallenges}>
                    View Details <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6 pb-10">
        <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome, {clientProfile?.fullName?.split(' ')[0]}!</h2>
            <p className="text-base sm:text-lg text-muted-foreground">
            &ldquo;{quoteOfTheDay}&rdquo;
            </p>
        </div>

      <div className="flex justify-around">
        {topRowButtons.map(renderPillarButton)}
      </div>

      <div className="flex justify-around mt-4">
        {bottomRowButtons.map(renderPillarButton)}
      </div>

      {renderChallengeSection()}

      <ProgramWidget
        clientProfile={clientProfile}
        onOpenProgramList={handleOpenProgramList}
        onOpenCurrentProgram={handleOpenCurrentProgram}
      />

      <UpcomingEventWidget
        clientProfile={clientProfile}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
      />

      {isLoadingIndulgences ? (
          <Skeleton className="h-24 w-full" />
      ) : upcomingIndulgences.length > 0 && (
         <Card className="p-3">
          <CardContent className="p-0">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <Salad className="h-5 w-5 text-lime-400" />
              Upcoming Planned Indulgences
            </h3>
            <div className="spacey-1">
              {upcomingIndulgences.map(plan => {
                const indulgenceDate = safeNewDate(plan.indulgenceDate);
                if (!indulgenceDate) return null;

                return (
                  <div
                   key={plan.id}
                   className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-xs w-full"
                  >
                   <p className="font-medium">{plan.plannedIndulgence}</p>
                   <p className="text-muted-foreground">{format(indulgenceDate, 'MMM d')}</p>
                  </div>

                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {clientProfile && bingeFreeSinceDate && (
        <Card className="p-3">
            <CardContent className="p-0 flex items-center justify-between gap-4">
                <div className="flex-1">
                    <p className="text-sm font-semibold text-green-400">Binge-Free Streak</p>
                     <p className="text-xs text-muted-foreground">
                        {`Last binge: ${format(bingeFreeSinceDate, 'MMM d, yyyy')}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-baseline gap-1 text-right">
                        <p className="text-4xl font-bold text-white">{bingeFreeDays}</p>
                        <p className="text-lg text-muted-foreground">Days</p>
                    </div>
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsResetStreakAlertOpen(true)}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
      )}

      <ProgramListDialog
        isOpen={isProgramListOpen}
        onClose={() => setIsProgramListOpen(false)}
        userProfile={clientProfile}
        onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
      />

      <ProgramHubDialog
        isOpen={isProgramHubOpen}
        onClose={() => setIsProgramHubOpen(false)}
      />

      {activePillar && (
        <DataEntryDialog
          open={dataEntryDialogOpen}
          onOpenChange={handleDataEntryDialogClose}
          pillar={activePillar}
          clientProfile={clientProfile}
          onSwitchPillar={handleSwitchPillar}
        />
      )}

      <InsightsDialog
        isOpen={insightsDialogOpen}
        onClose={() => setInsightsDialogOpen(false)}
      />

      <SettingsDialog
        open={isSettingsOpen}
        onOpenChange={onCloseSettings}
      />

      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
            setIsUpgradeModalOpen(false);
            setActivePillar(null);
        }}
        requiredTier={activePillar?.requiredTier || UserTier.Premium}
        featureName={activePillar?.label || 'Premium Features'}
        reason={activePillar ? `Access to the ${activePillar.label} pillar requires a subscription.` : 'Access to this feature requires an upgrade.'}
      />

       {clientProfile && (
        <CalendarDialog
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            client={clientProfile as ClientProfile}
            initialDate={initialCalendarDate}
            highlightedEntryId={highlightedEntryId}
        />
       )}

        <AlertDialog open={isResetStreakAlertOpen} onOpenChange={setIsResetStreakAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will reset your binge-free streak to 0 days. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetStreak} disabled={isResettingStreak}>
                         {isResettingStreak && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Reset Streak
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {selectedChatInfo && (
            <EmbeddedChatDialog
                isOpen={isChatDialogOpen}
                onClose={() => {
                    setIsChatDialogOpen(false);
                    setSelectedChatInfo(null);
                    setNotificationChatId(''); // Clear from store
                }}
                chatId={selectedChatInfo.id}
                chatName={selectedChatInfo.name}
            />
        )}

        {clientProfile && notificationAppointmentId && user && (
            <AppointmentDetailDialog
                isOpen={isAppointmentDetailOpen}
                onClose={() => {
                    setIsAppointmentDetailOpen(false);
                    setNotificationAppointmentId('');
                }}
                appointmentId={notificationAppointmentId}
                client={clientProfile}
            />
        )}

        {clientProfile && notificationWorkoutId && (
            <WorkoutActionDialog
                isOpen={isWorkoutActionOpen}
                onClose={() => {
                    setIsWorkoutActionOpen(false);
                    setNotificationWorkoutId('');
                }}
                workoutId={notificationWorkoutId}
                client={clientProfile}
                onWorkoutStarted={() => {
                    setIsWorkoutActionOpen(false);
                    setNotificationWorkoutId('');
                }}
            />
        )}

        {clientProfile && triggerHydrationModal && (
             <DataEntryDialog
                open={triggerHydrationModal}
                onOpenChange={handleDataEntryDialogClose}
                pillar={pillarsAndTools.find(p => p.id === 'hydration')!}
                clientProfile={clientProfile}
                onSwitchPillar={handleSwitchPillar}
            />
        )}
    </div>
  );
}
