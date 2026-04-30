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
import { getAllChallengesForClient, joinChallengeAction } from '@/app/challenges/actions';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import { InsightsDialog } from '../insights/insights-dialog';
import { useDashboardActions } from '@/contexts/DashboardActionsContext';
import { differenceInCalendarDays, format, isPast, isFuture, endOfDay } from 'date-fns';
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
  AlertDialogTitle 
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
import { useAdBanner } from '../providers/AdBannerProvider';
import { ChallengesDialog } from '@/components/challenges/challenges-dialog';   // ← Added

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
  { id: 'insights', label: 'Insights', icon: Lightbulb, color: 'text-foreground', bgColor: 'bg-yellow-400', borderColor: 'border-yellow-600', requiredTier: UserTier.Free },
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

  // Expanded notification store destructuring
  const { 
    notificationChatId, 
    notificationAppointmentId, 
    notificationWorkoutId, 
    triggerHydrationModal, 
    openChallengeList,
    setNotificationChatId, 
    setNotificationAppointmentId, 
    setNotificationWorkoutId, 
    setTriggerHydrationModal,
    setOpenChallengeList 
  } = useNotificationStore();

  const { adBannerHeight } = useAdBanner();

  const [dataEntryDialogOpen, setDataEntryDialogOpen] = useState(false);
  const [insightsDialogOpen, setInsightsDialogOpen] = useState(false);
  const [activePillar, setActivePillar] = useState<Pillar | null>(null);

  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
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

  // NEW: Challenge list modal state
  const [isChallengeListOpen, setIsChallengeListOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Process URL searchParams from notifications
  useEffect(() => {
    if (!searchParams || loading) return;

    const openChatId = String(searchParams.openChatId || '');
    const openWorkoutId = String(searchParams.openWorkoutId || '');
    const openAppointmentId = String(searchParams.openAppointmentId || '');
    const openHydration = String(searchParams.openHydration || 'false');
    const notificationType = String(searchParams.notificationType || '');

    if (notificationType === 'chat' && openChatId) {
        setNotificationChatId(openChatId);
    } 
    else if (notificationType === 'workout_reminder' && openWorkoutId) {
        setNotificationWorkoutId(openWorkoutId);
    } 
    else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && openAppointmentId) {
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Required', description: 'Please log in to view appointment details.' });
            return;
        }
        setNotificationAppointmentId(openAppointmentId);
    } 
    else if (notificationType === 'hydration' && openHydration === 'true') {
        setTriggerHydrationModal(true);
    }
  }, [searchParams, loading, user, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, toast]);

  // Handle non-chat notifications (appointment, workout, hydration, challenge)
  useEffect(() => {
    if (notificationAppointmentId && user) {
      setIsAppointmentDetailOpen(true);
      setIsCalendarOpen(true)
    }
    if (notificationWorkoutId) {
      setIsWorkoutActionOpen(true);
    }
    if (triggerHydrationModal) {
      openModal('hydration');
    }
  }, [notificationAppointmentId, notificationWorkoutId, triggerHydrationModal, openModal, setTriggerHydrationModal, user]);

  // NEW: Handle challenge list modal from notifications
  useEffect(() => {
    if (openChallengeList) {
      setIsChallengeListOpen(true);
      setOpenChallengeList(false); // reset store flag
    }
  }, [openChallengeList, setOpenChallengeList]);

  const executePillarAction = (pillar: Pillar) => {
    if (pillar.id === 'insights') {
      setInsightsDialogOpen(true);
    } else {
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

    getAllChallengesForClient().then(result => {
      if (result.success && result.data) {
        setAllChallenges(result.data as Challenge[]);
      }
      else if (result.error && result.error !== 'not-found') {
        toast({ variant: 'destructive', title: 'Error', description: `Could not load challenges: ${result.error}` });
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
    setNotificationAppointmentId(null);
    setNotificationWorkoutId(null);
    setTriggerHydrationModal(false);
    setNotificationChatId(null);
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
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsResettingStreak(false);
      setIsResetStreakAlertOpen(false);
    }
  };

  const handleOpenProgramList = () => setIsProgramListOpen(true);
  const handleOpenCurrentProgram = () => setIsProgramHubOpen(true);

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
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error Joining Challenge', description: error.message });
    } finally {
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

    const isParticipant = (c: Challenge) => c.participants?.includes(user?.uid || '');
    const isPastChallenge = (c: Challenge) => c.dates?.to && isPast(endOfDay(new Date(c.dates.to)));
    const isActiveChallenge = (c: Challenge) => c.dates?.from && !isFuture(new Date(c.dates.from));

    const relevantChallenges = allChallenges
        .filter(c => !isPastChallenge(c))
        .sort((a, b) => {
            const aIsActive = isActiveChallenge(a);
            const bIsActive = isActiveChallenge(b);
            if (aIsActive && !bIsActive) return -1;
            if (!aIsActive && bIsActive) return 1;
            return new Date(a.dates.from).getTime() - new Date(b.dates.from).getTime();
        });

    const challengeToShow = 
        relevantChallenges.find(c => isParticipant(c) && isActiveChallenge(c)) ||
        relevantChallenges.find(c => isParticipant(c)) ||
        relevantChallenges.find(c => isActiveChallenge(c)) ||
        relevantChallenges[0];

    if (!challengeToShow) {
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

    const isUserParticipant = isParticipant(challengeToShow);
    const isChallengeUpcoming = isFuture(new Date(challengeToShow.dates.from));
    const canJoin = !isUserParticipant && tierRank.indexOf(clientProfile?.tier || UserTier.Free) >= tierRank.indexOf(UserTier.Premium);
    const needsUpgrade = !isUserParticipant && tierRank.indexOf(clientProfile?.tier || UserTier.Free) < tierRank.indexOf(UserTier.Premium);

    let badgeText = "";
    let badgeVariant: "secondary" | "default" | "destructive" | "outline" | null | undefined = "secondary";
    if (isUserParticipant) {
      badgeText = isChallengeUpcoming ? "Registered" : "Active Now";
    } else if (isChallengeUpcoming) {
      badgeText = "Starts Soon";
    } else {
      badgeText = "New Challenge!"
    }

    return (
      <Card className="bg-primary/10 border-primary/20 hover:border-primary/40 transition-all">
        <CardContent className="p-3 flex items-center gap-3">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image src={challengeToShow.thumbnailUrl || "https://placehold.co/400x400.png"} alt={challengeToShow.name} fill className="object-cover" unoptimized/>
          </div>
          <div className="flex-1 space-y-1">
            <div>
              <Badge variant={badgeVariant} className="mb-1 text-xs">{badgeText}</Badge>
              <h3 className="font-bold text-base text-card-foreground leading-tight">{challengeToShow.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-1">{challengeToShow.description}</p>
            </div>
            {isUserParticipant ? (
              <Button size="xs" className="w-full sm:w-auto" onClick={onOpenChallenges}>
                View Challenge <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : canJoin ? (
              <Button size="xs" className="w-full sm:w-auto" onClick={() => handleJoinChallenge(challengeToShow.id)} disabled={isJoiningChallenge}>
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
    <div 
      className="space-y-6" 
      style={{ paddingBottom: `${adBannerHeight + 80}px` }}
    >
      <div> 
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Welcome, {clientProfile?.fullName?.split(' ')[0]}!</h2> 
        <p className="text-base sm:text-lg text-muted-foreground"> “{quoteOfTheDay}” </p> 
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
              <div className="space-y-1">
                {upcomingIndulgences.map(plan => {
                  const indulgenceDate = safeNewDate(plan.indulgenceDate);
                  if (!indulgenceDate) return null;
                  return (
                    <div key={plan.id} className="flex items-center justify-between p-1.5 rounded-md bg-muted/50 text-xs w-full">
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

      {clientProfile && notificationAppointmentId && user && (
          <AppointmentDetailDialog
              isOpen={isAppointmentDetailOpen}
              onClose={() => {
                  setIsAppointmentDetailOpen(false);
                  setNotificationAppointmentId(null);
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
                  setNotificationWorkoutId(null);
              }}
              workoutId={notificationWorkoutId}
              client={clientProfile}
              onWorkoutStarted={() => {
                  setIsWorkoutActionOpen(false);
                  setNotificationWorkoutId(null);
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

      {/* NEW: Challenge List Modal - This makes challenge notifications work */}
      {clientProfile && (
        <ChallengesDialog
          isOpen={isChallengeListOpen}
          onClose={() => {
            setIsChallengeListOpen(false);
            setOpenChallengeList(false);
          }}
          challenges={allChallenges}
          userProfile={clientProfile}
          isLoading={isLoadingChallenge}
        />
      )}
    </div>
  );
}
