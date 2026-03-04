'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, Sparkles, CheckCircle, X, TrendingUp, HeartCrack, Scale } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogClose 
} from '@/components/ui/dialog';
import { useAuth } from '@/components/auth/auth-provider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getHighWtHRClients, generatePopulationInsights, PopulationInsight } from "@/app/coach/insights/actions";
import { ClientProfile } from '@/types';
import { ClientDetailModal } from '@/components/coach/clients/client-detail-modal';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ManageInsightsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageInsightsDialog({ open, onOpenChange }: ManageInsightsDialogProps) {
    const { user } = useAuth();
    
    const [highWtHR, setHighWtHR] = useState<ClientProfile[]>([]);
    const [populationInsight, setPopulationInsight] = useState<PopulationInsight | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingInsight, setIsLoadingInsight] = useState(true);
    const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
    const [highWtHRFilter, setHighWtHRFilter] = useState('all');

    const fetchData = useCallback(async () => {
        if (!user?.uid) return;
        
        setIsLoading(true);
        setIsLoadingInsight(true);
        try {
            const [highWtHRRes, insightRes] = await Promise.all([
                getHighWtHRClients(),
                generatePopulationInsights(),
            ]);

            if (highWtHRRes.success) setHighWtHR(highWtHRRes.data || []);
            if (insightRes.success) setPopulationInsight(insightRes.data || null);
            
        } catch (error) {
            console.error("Failed to load insights data", error);
        } finally {
            setIsLoading(false);
            setIsLoadingInsight(false);
        }
    }, [user?.uid]);

    useEffect(() => {
        if(open) {
            fetchData();
        }
    }, [open, fetchData]);
    
    const filteredHighWtHR = useMemo(() => {
        if (highWtHRFilter === 'all') return highWtHR;
        return highWtHR.filter(client => client.tier === highWtHRFilter);
    }, [highWtHR, highWtHRFilter]);

    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] max-w-4xl max-h-[85dvh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Insights Dashboard</DialogTitle>
                     <DialogDescription>
                        Review AI-powered population trends and identify at-risk clients.
                    </DialogDescription>
                    <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100">
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </DialogClose>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full pr-2">
                        {isLoading ? (
                            <div className="flex justify-center items-center h-96">
                                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                            </div>
                        ) : (
                        <Accordion type="multiple" defaultValue={['ai-insight']} className="w-full space-y-4">
                            <AccordionItem value="ai-insight" className="border-b-0 rounded-lg bg-card overflow-hidden">
                                <AccordionTrigger className="p-4 hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        <TrendingUp className="h-5 w-5 text-primary" />
                                        <div className="text-left">
                                            <h3 className="font-semibold text-base">AI Population Insight</h3>
                                            <p className="text-sm text-muted-foreground">AI-powered trends across your client base.</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                     <ScrollArea className="max-h-96">
                                     {isLoadingInsight ? (
                                         <div className="flex flex-col items-center justify-center p-8 rounded-lg bg-background/20 text-center">
                                            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                            <p className="text-sm font-semibold">Generating population insight...</p>
                                        </div>
                                    ) : populationInsight ? (
                                         <div className="rounded-lg bg-background/50 p-4 space-y-3 animate-in fade-in-50">
                                            <div>
                                                <h4 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Finding:</h4>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{populationInsight.finding}</p>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-primary" /> Explanation:</h4>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{populationInsight.explanation}</p>
                                            </div>
                                            <Alert>
                                                <CheckCircle className="h-4 w-4" />
                                                <AlertTitle className="font-semibold">Suggestion for Coaches</AlertTitle>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{populationInsight.suggestion}</p>
                                            </Alert>
                                        </div>
                                    ) : (
                                        <div className="text-center text-muted-foreground p-12">
                                            <p className="font-semibold text-lg">No Data Available</p>
                                            <p className="text-sm">Not enough data to generate population insights yet.</p>
                                        </div>
                                    )}
                                    </ScrollArea>
                                </AccordionContent>
                            </AccordionItem>
                            
                             <AccordionItem value="high-wthr" className="border-b-0 rounded-lg bg-card overflow-hidden">
                                <AccordionTrigger className="p-4 hover:no-underline">
                                    <div className="flex items-center gap-3">
                                        <Scale className="h-5 w-5 text-amber-500" />
                                        <div className="text-left">
                                            <h3 className="font-semibold text-base">High WtHR Clients</h3>
                                            {/* THE FIX: Escaped the > symbol using &gt; */}
                                            <p className="text-sm text-muted-foreground">Waist-to-Height Ratio risk alerts (&gt; 0.5).</p>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-4 pb-4">
                                    <Tabs value={highWtHRFilter} onValueChange={setHighWtHRFilter}>
                                        <TabsList className="grid w-full grid-cols-4 h-8 text-xs">
                                            <TabsTrigger value="all">All</TabsTrigger>
                                            <TabsTrigger value="basic">Basic</TabsTrigger>
                                            <TabsTrigger value="premium">Premium</TabsTrigger>
                                            <TabsTrigger value="coaching">Coaching</TabsTrigger>
                                        </TabsList>
                                    </Tabs>
                                    <div className="space-y-2 mt-4">
                                        {filteredHighWtHR.length > 0 ? (
                                            filteredHighWtHR.map(client => (
                                                <ClientListItem key={client.uid} client={client} onClick={() => setSelectedClient(client)}>
                                                    {client.dailySummary?.currentWthr && (
                                                        <Badge variant="secondary" className="text-amber-600 bg-amber-100 border-amber-300">
                                                            {client.dailySummary.currentWthr.toFixed(2)} WtHR
                                                        </Badge>
                                                    )}
                                                </ClientListItem>
                                            ))
                                        ) : (
                                            <div className="text-center text-muted-foreground p-8">
                                                <HeartCrack className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                                <p className="text-sm">No clients currently at risk levels. Great!</p>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>

        {selectedClient && (
            <ClientDetailModal
                client={selectedClient}
                isOpen={!!selectedClient}
                onClose={() => {
                    setSelectedClient(null);
                    fetchData();
                }}
            />
        )}
        </>
    );
}

function ClientListItem({ client, children, onClick }: { client: ClientProfile, children?: React.ReactNode, onClick: () => void }) {
    return (
         <div className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full h-auto justify-between p-2 space-x-2 cursor-pointer"
        )} onClick={onClick}>
             <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="h-8 w-8 border">
                    <AvatarImage src={client.photoURL || undefined} alt={client.fullName} />
                    <AvatarFallback>{client.fullName?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="text-left flex-1 min-w-0">
                    <p className="font-semibold text-sm line-clamp-1">{client.fullName}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {children}
                 <Button variant="secondary" size="sm" className="h-7">View</Button>
            </div>
        </div>
    )
}