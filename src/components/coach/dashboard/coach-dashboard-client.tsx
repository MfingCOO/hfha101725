'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { ClientProfile, UserProfile } from "@/types";
import { Loader2, PlusCircle, MessageSquare, Trophy, Megaphone, Library, Calendar, Database, AlertTriangle } from "lucide-react";
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
import { ManageLibraryDialog } from "@/components/coach/library/manage-library-dialog";
import { ManageChatsDialog } from "@/components/coach/chats/manage-chats-dialog";
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { getCoachingChatIdForClient } from "@/app/coach/clients/actions";
import { CoachCalendarDialog } from "@/app/coach/calendar/CoachCalendarDialog";
import { ManageFoodCacheDialog } from '@/components/coach/food-cache/manage-food-cache-dialog';
import { getUnreviewedUserFoodCount } from '@/app/coach/food-cache/actions';
import { ModerationDialog } from '@/components/coach/dialogs/ModerationDialog';
import { getPendingReportsCountAction } from '@/app/actions/moderation-actions';

interface CoachDashboardClientProps {
  initialClients: UserProfile[];
  pendingFoodCount: number;
  pendingReportCount: number;
}

export function CoachDashboardClient({ initialClients, pendingFoodCount: initialPendingFoodCount, pendingReportCount: initialPendingReportCount }: CoachDashboardClientProps) {
    const { toast } = useToast();
    const { user } = useAuth();
    const [allClients, setAllClients] = useState<UserProfile[]>(initialClients || []);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('all');

    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [isChallengesOpen, setIsChallengesOpen] = useState(false);
    const [isPopupsOpen, setIsPopupsOpen] = useState(false);
    const [isChatsOpen, setIsChatsOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isFoodCacheOpen, setIsFoodCacheOpen] = useState(false);
    const [isModerationOpen, setIsModerationOpen] = useState(false);
    const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
    const [selectedChatInfo, setSelectedChatInfo] = useState<{ id: string; name: string } | null>(null);
    const [isFetchingChatId, setIsFetchingChatId] = useState(false);
    const [pendingFoodCount, setPendingFoodCount] = useState(initialPendingFoodCount);
    const [pendingReportCount, setPendingReportCount] = useState(initialPendingReportCount);

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await getAllAppUsers();
            if (result.success && result.users) {
                setAllClients(Array.isArray(result.users) ? result.users : []);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'Could not refresh user list.' });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    const refreshPendingFoodCount = useCallback(async () => {
        const count = await getUnreviewedUserFoodCount();
        setPendingFoodCount(count);
    }, []);

    const refreshPendingReportCount = useCallback(async () => {
        if (!user) return;
        const result = await getPendingReportsCountAction(user.uid);
        if (result.success) {
            setPendingReportCount(result.count ?? 0);
        }
    }, [user]);

    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    useEffect(() => {
        if (!isFoodCacheOpen) { refreshPendingFoodCount(); }
    }, [isFoodCacheOpen, refreshPendingFoodCount]);

    useEffect(() => {
        if (!isModerationOpen) { refreshPendingReportCount(); }
    }, [isModerationOpen, refreshPendingReportCount]);

    const handleQuickChatClick = async (client: UserProfile) => {
        if (client.tier !== 'coaching') {
            toast({ variant: 'destructive', title: 'Not a Coaching Client', description: 'Only coaching clients have private chats.' });
            return;
        }
        setIsFetchingChatId(true);
        const result = await getCoachingChatIdForClient(client.uid);
        if (result.success && result.chatId) {
            setSelectedChatInfo({ id: result.chatId, name: `${client.fullName || 'Unnamed User'} Coaching` });
            setIsChatDialogOpen(true);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the coaching chat.' });
        }
        setIsFetchingChatId(false);
    };

    const filteredAndSortedClients = useMemo(() => {
        if (!Array.isArray(allClients)) return [];
        return allClients.filter(client => {
            if (!client || !client.uid) return false;
            const tierMatch = tierFilter === 'all' || client.tier === tierFilter;
            const trimmedSearch = searchTerm.trim().toLowerCase();
            if (!trimmedSearch) return tierMatch;
            if (!client.fullName || typeof client.fullName !== 'string') return false;
            const searchMatch = client.fullName.toLowerCase().includes(trimmedSearch);
            return tierMatch && searchMatch;
        });
    }, [allClients, tierFilter, searchTerm]);

    const ClientListItem = ({ client }: { client: UserProfile }) => (
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
        { label: 'Chats', icon: MessageSquare, action: () => setIsChatsOpen(true) },
        { label: 'Challenges', icon: Trophy, action: () => setIsChallengesOpen(true) },
        { label: 'Pop-ups', icon: Megaphone, action: () => setIsPopupsOpen(true) },
        { label: 'Library', icon: Library, action: () => setIsLibraryOpen(true) },
        { label: 'Calendar', icon: Calendar, action: () => setIsCalendarOpen(true) },
        { label: 'Food Cache', icon: Database, action: () => setIsFoodCacheOpen(true), count: pendingFoodCount },
    ];

    return (
        <>
            <div className="w-full max-w-4xl mx-auto space-y-4">
                <div className="grid grid-cols-3 gap-2">
                    {managementButtons.map(({ label, icon: Icon, action, count }) => (
                        <div key={label} className="relative">
                            <Button variant='outline' className="w-full" onClick={action}>
                                <Icon className="mr-2 h-4 w-4" />
                                {label}
                            </Button>
                            {count !== undefined && count > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2">{count}</Badge>}
                        </div>
                    ))}
                </div>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Input placeholder="Search clients..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="flex-1" />
                            <Select value={tierFilter} onValueChange={setTierFilter}>
                                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tiers</SelectItem>
                                    <SelectItem value="free">Free</SelectItem>
                                    <SelectItem value="ad-free">Ad-Free</SelectItem>
                                    <SelectItem value="basic">Basic</SelectItem>
                                    <SelectItem value="premium">Premium</SelectItem>
                                    <SelectItem value="coaching">Coaching</SelectItem>
                                </SelectContent>
                            </Select>
                            <div className="relative">
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
            {selectedClient && <ClientDetailModal client={selectedClient as ClientProfile} isOpen={!!selectedClient} onClose={() => { setSelectedClient(null); fetchClients(); }} />}
            {selectedChatInfo && <EmbeddedChatDialog isOpen={isChatDialogOpen} onClose={() => setIsChatDialogOpen(false)} chatId={selectedChatInfo.id} chatName={selectedChatInfo.name} />}
            <CreateClientDialog open={isCreateClientOpen} onOpenChange={setIsCreateClientOpen} onClientCreated={() => { setIsCreateClientOpen(false); fetchClients(); }} />
            <ManageChatsDialog open={isChatsOpen} onOpenChange={setIsChatsOpen} />
            <ManageChallengesDialog open={isChallengesOpen} onOpenChange={setIsChallengesOpen} />
            <ManagePopupsDialog open={isPopupsOpen} onOpenChange={setIsPopupsOpen} />
            <ManageLibraryDialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen} />
            <CoachCalendarDialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen} />
            <ManageFoodCacheDialog open={isFoodCacheOpen} onOpenChange={setIsFoodCacheOpen} />
            <ModerationDialog isOpen={isModerationOpen} onClose={() => setIsModerationOpen(false)} />
        </>  
    );
}
