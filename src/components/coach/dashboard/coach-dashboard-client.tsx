'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { ClientProfile } from "@/types";
import { Loader2, PlusCircle, MessageSquare, Trophy, Megaphone, Library, Calendar, Database, AlertTriangle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getAllAppUsers } from "@/app/coach/dashboard/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/auth/auth-provider";
import { ClientDetailModal } from "@/components/coach/clients/client-detail-modal";
import { CreateClientDialog } from "@/components/coach/clients/create-client-dialog";
import { ManageChallengesDialog } from "@/components/coach/challenges/manage-challenges-dialog";
import { ManagePopupsDialog } from "@/components/coach/popups/manage-popups-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManageChatsDialog } from "@/components/coach/chats/manage-chats-dialog";
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { getCoachingChatIdForClient } from "@/app/coach/clients/actions";
import { CoachCalendarDialog } from "@/app/coach/calendar/CoachCalendarDialog";
import { ManageFoodCacheDialog } from '@/components/coach/food-cache/manage-food-cache-dialog';
import { getUnreviewedUserFoods } from '@/app/coach/food-cache/actions';
import { ModerationDialog } from '@/components/coach/dialogs/ModerationDialog';
import { getPendingReportsCountAction } from '@/app/actions/moderation-actions';
import { getUnreadChatCountForCoach } from "@/app/chats/actions";
import { useNotificationStore } from '@/store/notification-store'; // ADDED: Import useNotificationStore

interface CoachDashboardClientProps {
    initialClients: ClientProfile[];
    pendingFoodCount: number;
    pendingReportCount: number;
    searchParams?: { [key: string]: string | string[] | undefined }; // ADDED: Define searchParams prop
}

export function CoachDashboardClient({ initialClients, pendingFoodCount: initialPendingFoodCount, pendingReportCount: initialPendingReportCount, searchParams }: CoachDashboardClientProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    // ADDED: Destructure notification store setters
    const { setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal } = useNotificationStore();

    const [allClients, setAllClients] = useState<ClientProfile[]>(initialClients || []);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [hasSearched, setHasSearched] = useState(false);
    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [isChallengesOpen, setIsChallengesOpen] = useState(false);
    const [isPopupsOpen, setIsPopupsOpen] = useState(false);
    const [isChatsOpen, setIsChatsOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isFoodCacheOpen, setIsFoodCacheOpen] = useState(false);
    const [isModerationOpen, setIsModerationOpen] = useState(false);
    const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
    const [selectedChatInfo, setSelectedChatInfo] = useState<{ id: string; name: string } | null>(null);
    const [isFetchingChatId, setIsFetchingChatId] = useState(false);
    const [pendingFoodCount, setPendingFoodCount] = useState(initialPendingFoodCount);
    const [pendingReportCount, setPendingReportCount] = useState(initialPendingReportCount);
    const [unreadChatCount, setUnreadChatCount] = useState(0);

    // ADDED: useEffect to handle searchParams for notifications
    useEffect(() => {
        if (!searchParams) return;

        const openChatId = String(searchParams.openChatId || '');
        const openWorkoutId = String(searchParams.openWorkoutId || '');
        const openAppointmentId = String(searchParams.openAppointmentId || '');
        const openHydration = String(searchParams.openHydration || 'false'); // For completeness, though coach doesn't use hydration modal
        const notificationType = String(searchParams.notificationType || '');

        console.log('CoachDashboardClient: Received searchParams for notification handling:', searchParams);

        if (notificationType === 'chat' && openChatId) {
            setNotificationChatId(openChatId);
            setIsChatsOpen(true); // Open the ManageChatsDialog
        } else if (notificationType === 'workout_reminder' && openWorkoutId) {
            setNotificationWorkoutId(openWorkoutId);
            setIsCalendarOpen(true); // Assuming workouts are shown in calendar
        } else if (['appointment_reminder', 'appointment_booked'].includes(notificationType) && openAppointmentId) {
            setNotificationAppointmentId(openAppointmentId);
            setIsCalendarOpen(true); // Open the CoachCalendarDialog
        } else if (notificationType === 'hydration' && openHydration === 'true') {
            // Coach does not have hydration modal, but setting state for consistency if logic changes
            setTriggerHydrationModal(true);
        }

        // You might want to add logic here to clear the URL search params after processing
        // if you don't want them to persist. This usually involves router.replace from the parent.

    }, [searchParams, setNotificationChatId, setNotificationAppointmentId, setNotificationWorkoutId, setTriggerHydrationModal, setIsChatsOpen, setIsCalendarOpen]);

    const fetchClients = useCallback(async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Authentication Error', description: 'User not found, please try again.' });
            return;
        }
        setIsLoading(true);
        setHasSearched(true);
        try {
            const result = await getAllAppUsers(user.uid, searchTerm, tierFilter);
            if (result.success && result.clients) {
                setAllClients(Array.isArray(result.clients) ? result.clients : []);
            } else {
                toast({ variant: 'destructive', title: 'Action Required', description: 'A database index is required.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [user, toast, searchTerm, tierFilter]);

    const refreshPendingFoodCount = useCallback(async () => {
        const unreviewedFoods = await getUnreviewedUserFoods();
        setPendingFoodCount(unreviewedFoods.length);
    }, []);

    const refreshPendingReportCount = useCallback(async () => {
        if (!user) return;
        const result = await getPendingReportsCountAction(user.uid);
        if (result.success) {
            setPendingReportCount(result.count ?? 0);
        }
    }, [user]);

    useEffect(() => {
        refreshPendingFoodCount();
    }, [refreshPendingFoodCount]);

    useEffect(() => {
        if (!isModerationOpen) { refreshPendingReportCount(); }
    }, [isModerationOpen, refreshPendingReportCount]);

    useEffect(() => {
        if (!user) return;
        const fetchUnreadCount = async () => {
            const result = await getUnreadChatCountForCoach(user.uid);
            if (result.success && typeof result.count !== 'undefined') {
                setUnreadChatCount(result.count);
            }
        };
        fetchUnreadCount();
        const intervalId = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(intervalId);
    }, [user]);

    const handleQuickChatClick = async (client: ClientProfile) => {
        if (client.tier !== 'coaching') {
            toast({ variant: 'destructive', title: 'Not a Coaching Client', description: 'Only coaching clients have private chats.' });
            return;
        }
        setIsFetchingChatId(true);
        const result = await getCoachingChatIdForClient(client.uid);
        if (result.success && result.chatId) {
            setSelectedChatInfo({ id: result.chatId, name: `${client.fullName || 'Unnamed User'} Coaching` });
            setIsChatDialogOpen(true);
        }
        setIsFetchingChatId(false);
    };

    const filteredAndSortedClients = useMemo(() => allClients, [allClients]);

    const ClientListItem = ({ client }: { client: ClientProfile }) => (
        <div className="w-full text-left p-1.5 pr-3 rounded-md border bg-card hover:bg-muted transition-colors flex items-center gap-2 text-sm">
            <div className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setSelectedClient(client)}>
                <Avatar className="h-6 w-6 border">
                    <AvatarImage src={client.photoURL || undefined} />
                    <AvatarFallback>{client.fullName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <span className="font-semibold truncate text-xs">{client.fullName || 'Unnamed User'}</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQuickChatClick(client)} disabled={isFetchingChatId}>
                <MessageSquare className="h-3.5 w-3.5" />
            </Button>
        </div>
    );

    const managementButtons = [
        { label: 'Chats', icon: MessageSquare, action: () => setIsChatsOpen(true), count: unreadChatCount },
        { label: 'Challenges', icon: Trophy, action: () => setIsChallengesOpen(true) },
        { label: 'Pop-ups', icon: Megaphone, action: () => setIsPopupsOpen(true) },
        { label: 'Future', icon: Library, action: () => {} }, 
        { label: 'Calendar', icon: Calendar, action: () => setIsCalendarOpen(true) },
        { label: 'Food Cache', icon: Database, action: () => setIsFoodCacheOpen(true), count: pendingFoodCount },
    ];

    return (
        <>
            <div className="w-full max-w-4xl mx-auto space-y-4 p-4">
                <div className="grid grid-cols-6 gap-2">
                    {managementButtons.map(({ label, icon: Icon, action, count }) => (
                        <div key={label} className="relative">
                            <Button variant='outline' size="icon" className="w-full h-12" onClick={action} title={label}>
                                <Icon className="h-5 w-5" />
                            </Button>
                            {count !== undefined && count > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1">{count}</Badge>}
                        </div>
                    ))}
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-4">
                            <Input placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1 min-w-[150px]" />
                            <Select value={tierFilter} onValueChange={setTierFilter}>
                                <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tiers</SelectItem>
                                    <SelectItem value="free">Free</SelectItem>
                                    <SelectItem value="ad-free">Ad-Free</SelectItem>
                                    <SelectItem value="basic">Basic</SelectItem>
                                    <SelectItem value="premium">Premium</SelectItem>
                                    <SelectItem value="coaching">Coaching</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button onClick={fetchClients} className="w-full sm:w-auto"><Search className="mr-2 h-4 w-4"/>Search</Button>
                            <div className="relative ml-auto">
                                <Button variant='destructive' onClick={() => setIsModerationOpen(true)}>
                                    <AlertTriangle className="mr-2 h-4 w-4" /> Reports
                                </Button>
                                {pendingReportCount > 0 && <Badge variant="default" className="absolute -top-2 -right-2">{pendingReportCount}</Badge>}
                            </div>
                            <Button onClick={() => setIsCreateClientOpen(true)} size="icon" className="bg-yellow-500 hover:bg-yellow-600"><PlusCircle /></Button>
                        </div>
                        {isLoading ? (
                            <div className="flex justify-center p-24"><Loader2 className="h-12 w-12 animate-spin" /></div>
                        ) : (
                            <div className="space-y-2">
                                {filteredAndSortedClients.map(client => <ClientListItem key={client.uid} client={client} />)}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Dialogs Section */}
            {selectedClient && <ClientDetailModal client={selectedClient} isOpen={!!selectedClient} onClose={() => { setSelectedClient(null); fetchClients(); }} />}
            {selectedChatInfo && <EmbeddedChatDialog isOpen={isChatDialogOpen} onClose={() => setIsChatDialogOpen(false)} chatId={selectedChatInfo.id} chatName={selectedChatInfo.name} />}
            <CreateClientDialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen} onClientCreated={() => { setIsCreateClientOpen(false); fetchClients(); }} />
            <ManageChatsDialog open={isChatsOpen} onOpenChange={setIsChatsOpen} />
            <ManageChallengesDialog open={isChallengesOpen} onOpenChange={setIsChallengesOpen} />
            <ManagePopupsDialog open={isPopupsOpen} onOpenChange={setIsPopupsOpen} />
            <CoachCalendarDialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen} />
            <ManageFoodCacheDialog open={isFoodCacheOpen} onOpenChange={setIsFoodCacheOpen} />
            <ModerationDialog isOpen={isModerationOpen} onClose={() => setIsModerationOpen(false)} />
        </>
    );
}