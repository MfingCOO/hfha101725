'use client';
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { useEffect, useState, useMemo, useCallback } from "react";
import type { ClientProfile, UserTier, UserProfile } from "@/types";
import { TIER_ACCESS } from "@/types";
import { Loader2, PlusCircle, User, Check, AlertTriangle, Trophy, Megaphone, Lightbulb, MessageSquare, Image as ImageIcon, Library, Calendar, Database } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getAllAppUsers } from "@/app/coach/dashboard/actions"; // FIX: Import the new authoritative function
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ClientDetailModal } from "@/components/coach/clients/client-detail-modal";
import { CreateClientDialog } from "@/components/coach/clients/create-client-dialog";
import { ManageChallengesDialog } from "@/components/coach/challenges/manage-challenges-dialog";
import { ManagePopupsDialog } from "@/components/coach/popups/manage-popups-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManageLibraryDialog } from "@/components/coach/library/manage-library-dialog";
import { ManageChatsDialog } from "@/components/coach/chats/manage-chats-dialog";
import { differenceInDays, differenceInHours, format } from "date-fns";
import { EmbeddedChatDialog } from '@/components/coach/chats/embedded-chat-dialog';
import { getCoachingChatIdForClient } from "@/app/coach/clients/actions";
import { CoachCalendarDialog } from "@/app/coach/calendar/CoachCalendarDialog";
import { useAuth } from '@/components/auth/auth-provider';
import { ManageFoodCacheDialog } from '@/components/coach/food-cache/manage-food-cache-dialog';

const getMostRecentSummary = (summaries: ClientProfile['dailySummaries']) => {
    if (!summaries) return null;
    const sortedDates = Object.keys(summaries).sort((a, b) => b.localeCompare(a));
    return sortedDates.length > 0 ? summaries[sortedDates[0]] : null;
};

export function CoachDashboardClient({ initialClients }: { initialClients: UserProfile[] }) {
    const { toast } = useToast();
    const [allClients, setAllClients] = useState<UserProfile[]>(initialClients);
    const [isLoading, setIsLoading] = useState(false); 
    const [selectedClient, setSelectedClient] = useState<UserProfile | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [tierFilter, setTierFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('at-risk');

    const [isCreateClientOpen, setIsCreateClientOpen] = useState(false);
    const [isChallengesOpen, setIsChallengesOpen] = useState(false);
    const [isPopupsOpen, setIsPopupsOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isChatsOpen, setIsChatsOpen] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [isFoodCacheOpen, setIsFoodCacheOpen] = useState(false); 
    const [isChatDialogOpen, setIsChatDialogOpen] = useState(false);
    const [selectedChatInfo, setSelectedChatInfo] = useState<{id: string, name: string} | null>(null);
    const [isFetchingChatId, setIsFetchingChatId] = useState(false);

    const fetchClients = useCallback(async () => {
        setIsLoading(true);
        try {
            // FIX: Call the new authoritative function to get ALL users
            const result = await getAllAppUsers();
            if (result.success && result.users) {
                setAllClients(result.users);
            } else {
                toast({ variant: 'destructive', title: 'Error', description: result.error || 'Could not refresh user list.' });
            }
        } catch(e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);
    
    useEffect(() => {
        fetchClients();
    }, [fetchClients]);

    const handleQuickChatClick = async (client: UserProfile) => {
        if(client.tier !== 'coaching') {
            toast({
                variant: 'destructive',
                title: 'Not a Coaching Client',
                description: 'Only clients on the coaching tier have private chats.',
            });
            return;
        }
        setIsFetchingChatId(true);
        const result = await getCoachingChatIdForClient(client.uid);
        if (result.success && result.chatId) {
            setSelectedChatInfo({ id: result.chatId, name: `${client.fullName} Coaching` });
            setIsChatDialogOpen(true);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not find the coaching chat for this client.' });
        }
        setIsFetchingChatId(false);
    }

    const filteredAndSortedClients = useMemo(() => {
        let clientsToShow: UserProfile[] = allClients;

        if (searchTerm) {
             clientsToShow = allClients.filter(client => 
                client.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        } else {
            if (tierFilter !== 'all') {
                clientsToShow = clientsToShow.filter(client => client.tier === tierFilter);
            }

            if (statusFilter === 'at-risk') {
                 const atRiskClients: (UserProfile & { reason: string; atRiskScore: number })[] = [];
                 clientsToShow.forEach(client => {
                    const summary = getMostRecentSummary(client.dailySummaries);
                    if (!summary) return;

                    let reason = '';
                    let score = 0;

                    if ((summary.binges ?? 0) > 0) {
                        reason = 'Recent Binge';
                        score = 3;
                    } else if ((summary.cravings ?? 0) > 1) {
                        reason = 'Multiple Cravings';
                        score = 2;
                    } else if ((summary.stressEvents ?? 0) > 1) {
                        reason = 'Multiple Stress Events';
                        score = 1;
                    }
                    
                    if (reason) {
                        atRiskClients.push({ ...client, reason, atRiskScore: score });
                    }
                });

                atRiskClients.sort((a, b) => b.atRiskScore - a.atRiskScore);
                clientsToShow = atRiskClients;
            }
        }
        
        if (statusFilter !== 'at-risk') {
            clientsToShow.sort((a, b) => {
                const summaryA = getMostRecentSummary(a.dailySummaries);
                const summaryB = getMostRecentSummary(b.dailySummaries);
                const dateA = summaryA?.lastUpdated ? new Date(summaryA.lastUpdated as string).getTime() : 0;
                const dateB = summaryB?.lastUpdated ? new Date(summaryB.lastUpdated as string).getTime() : 0;
                return dateB - dateA;
            });
        }

        return clientsToShow;
    }, [allClients, tierFilter, statusFilter, searchTerm]);
    
    const ClientListItem = ({ client }: { client: UserProfile & { reason?: string }}) => (
        <div 
            className="w-full text-left p-1.5 pr-3 rounded-md border bg-card hover:bg-muted transition-colors flex items-center gap-2 text-sm"
        >
            <div className="flex-1 flex items-center gap-2 min-w-0 cursor-pointer" onClick={() => setSelectedClient(client)}>
                <Avatar className="h-6 w-6 border">
                    <AvatarImage src={client.photoURL || `https://placehold.co/100x100.png`} alt={client.fullName} data-ai-hint="person portrait"/>
                    <AvatarFallback className="text-xs">{client.fullName?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="font-semibold truncate text-xs">{client.fullName}</span>
                    {client.reason && <Badge variant={client.reason === 'Recent Binge' ? 'destructive' : 'secondary'} className="flex-shrink-0">{client.reason}</Badge>}
                </div>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleQuickChatClick(client)} disabled={isFetchingChatId}>
                <MessageSquare className="h-3.5 w-3.5" />
            </Button>
        </div>
    );

    const mobileButtons = [
        { label: 'Chats', icon: MessageSquare, action: () => setIsChatsOpen(true) },
        { label: 'Challenges', icon: Trophy, action: () => setIsChallengesOpen(true) },
        { label: 'Pop-ups', icon: Megaphone, action: () => setIsPopupsOpen(true) },
        { label: 'Library', icon: Library, action: () => setIsLibraryOpen(true) },
        { label: 'Calendar', icon: Calendar, action: () => setIsCalendarOpen(true) },
        { label: 'Food Cache', icon: Database, action: () => setIsFoodCacheOpen(true) },
    ];


    return (
        <>
            <div className="w-full max-w-4xl mx-auto space-y-4">
                {/* Mobile-Only Button Grid */}
                <div className="grid grid-cols-6 gap-2 md:hidden">
                    {mobileButtons.map(({ label, icon: Icon, action }) => (
                         <Button key={label} variant="outline" className="flex flex-col h-16 items-center justify-center" onClick={action}>
                            <Icon className="h-7 w-7" />
                         </Button>
                    ))}
                </div>

                {/* Desktop-Only Button Row */}
                <div className="hidden md:flex md:flex-wrap gap-2 justify-between">
                    <Button variant="outline" onClick={() => setIsChatsOpen(true)}><MessageSquare /> Chats</Button>
                    <Button variant="outline" onClick={() => setIsChallengesOpen(true)}><Trophy/> Challenges</Button>
                    <Button variant="outline" onClick={() => setIsPopupsOpen(true)}><Megaphone /> Pop-ups</Button>
                    <Button variant="outline" onClick={() => setIsLibraryOpen(true)}><Library /> Library</Button>
                    <Button variant="outline" onClick={() => setIsCalendarOpen(true)}><Calendar /> Calendar</Button>
                    <Button variant="outline" onClick={() => setIsFoodCacheOpen(true)}><Database /> Food Cache</Button>
                </div>
                
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Input 
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="flex-1"
                            />
                            <Select value={tierFilter} onValueChange={setTierFilter}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Filter by tier" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Tiers</SelectItem>
                                    {TIER_ACCESS.map(tier => (
                                        <SelectItem key={tier} value={tier} className="capitalize">{tier}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="icon"
                                className="bg-yellow-400 text-black hover:bg-yellow-500 flex-shrink-0"
                                onClick={() => setIsCreateClientOpen(true)}
                            >
                                <PlusCircle className="h-5 w-5" />
                            </Button>
                        </div>

                         <Tabs defaultValue="at-risk" onValueChange={setStatusFilter} className="w-full mb-2">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="at-risk">At-Risk Feed</TabsTrigger>
                                <TabsTrigger value="all">All Clients</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        
                         {isLoading ? (
                             <div className="flex items-center justify-center p-24">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            </div>
                         ) : (
                             <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-muted-foreground px-1">
                                    {searchTerm ? `Search Results (${filteredAndSortedClients.length})` : 
                                     statusFilter === 'at-risk' ? `At-Risk Client Feed (${filteredAndSortedClients.length})` :
                                     `All Clients (${filteredAndSortedClients.length})`}
                                </h3>
                                 {filteredAndSortedClients.length > 0 ? (
                                    filteredAndSortedClients.map(client => <ClientListItem key={client.uid} client={client as any} />)
                                 ) : (
                                    <div className="text-center text-muted-foreground p-8">
                                         <Check className="h-10 w-10 mx-auto text-green-500 mb-2" />
                                        <p className="font-semibold">All Quiet!</p>
                                        <p>No clients match your current filters.</p>
                                    </div>
                                 )}
                             </div>
                         )}

                    </CardContent>
                </Card>
            </div>
             {selectedClient && (
                <ClientDetailModal
                    client={selectedClient as ClientProfile}
                    isOpen={!!selectedClient}
                    onClose={() => {
                        setSelectedClient(null);
                        fetchClients();
                    }}
                />
            )}
             {selectedChatInfo && (
                <EmbeddedChatDialog 
                    isOpen={isChatDialogOpen}
                    onClose={() => setIsChatDialogOpen(false)}
                    chatId={selectedChatInfo.id}
                    chatName={selectedChatInfo.name}
                />
            )}
            <CreateClientDialog
                open={isCreateClientOpen}
                onOpenChange={setIsCreateClientOpen}
                onClientCreated={() => {
                    setIsCreateClientOpen(false);
                    fetchClients();
                }}
            />
            <ManageChatsDialog 
                open={isChatsOpen}
                onOpenChange={setIsChatsOpen}
            />
            <ManageChallengesDialog 
                open={isChallengesOpen}
                onOpenChange={setIsChallengesOpen}
            />
            <ManagePopupsDialog
                open={isPopupsOpen}
                onOpenChange={setIsPopupsOpen}
            />
             <ManageLibraryDialog
                open={isLibraryOpen}
                onOpenChange={setIsLibraryOpen}
            />
            <CoachCalendarDialog
                open={isCalendarOpen}
                onOpenChange={setIsCalendarOpen}
            />
            {/* Render the new modal */}
            <ManageFoodCacheDialog
                open={isFoodCacheOpen}
                onOpenChange={setIsFoodCacheOpen}
            />
        </>
    );
}
