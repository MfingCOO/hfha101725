'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Report } from '@/app/actions/moderation-actions';
import { getPendingReportsAction, dismissReportAction, deleteMessageAndResolveReportAction, banUserAndResolveReportAction } from "@/app/actions/moderation-actions";
import { useAuth } from '@/components/auth/auth-provider';
import { Loader2, Trash2, UserX } from 'lucide-react';

interface ModerationDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ModerationDialog({ isOpen, onClose }: ModerationDialogProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [reports, setReports] = useState<Report[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isActing, setIsActing] = useState<string | null>(null); // Use report ID to track action

    const fetchReports = async () => {
        if (!user) return;
        setIsLoading(true);
        setReports([]); // Clear previous reports
        try {
            const result = await getPendingReportsAction(user.uid);
            if (result.success && result.data) {
                setReports(result.data);
            } else {
                toast({ variant: "destructive", title: "Error loading reports", description: result.error });
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchReports();
        }
    }, [isOpen]);

    const handleDismiss = async (reportId: string) => {
        if (!user) return;
        setIsActing(reportId);
        const result = await dismissReportAction(user.uid, reportId);
        if (result.success) {
            setReports(prev => prev.filter(r => r.id !== reportId));
            toast({ title: "Report Dismissed" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsActing(null);
    };

    const handleDeleteMessage = async (report: Report) => {
        if (!user) return;
        setIsActing(report.id);
        const result = await deleteMessageAndResolveReportAction(user.uid, report.id, report.chatId, report.messageId);
        if (result.success) {
            setReports(prev => prev.filter(r => r.id !== report.id));
            toast({ title: "Message Deleted & Report Resolved" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsActing(null);
    };

    const handleBanUser = async (report: Report) => {
        if (!user) return;
        setIsActing(report.id);
        const result = await banUserAndResolveReportAction(user.uid, report.id, report.reportedUserId);
        if (result.success) {
            setReports(prev => prev.filter(r => r.id !== report.id));
            toast({ title: "User Banned & Report Resolved" });
        } else {
            toast({ variant: "destructive", title: "Error", description: result.error });
        }
        setIsActing(null);
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Pending Message Reports</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : reports.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">No pending reports.</p>
                    ) : (
                        <div className="space-y-4">
                            {reports.map((report) => (
                                <div key={report.id} className="border rounded-lg p-3 text-sm">
                                    <p className="font-bold italic bg-muted p-2 rounded">"{report.messageContent}"</p>
                                    <div className="grid grid-cols-2 gap-x-4 mt-2 text-xs">
                                        <p><span className="font-semibold text-muted-foreground">Reported User:</span> {report.reportedUserName || report.reportedUserId}</p>
                                        <p><span className="font-semibold text-muted-foreground">Reporting User:</span> {report.reportingUserName || report.reportingUserId}</p>
                                        <p><span className="font-semibold text-muted-foreground">Chat:</span> {report.chatName || report.chatId}</p>
                                        <p><span className="font-semibold text-muted-foreground">Reported At:</span> {new Date(report.timestamp).toLocaleString()}</p>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                        {isActing === report.id ? (
                                            <Button disabled size="sm"><Loader2 className="h-4 w-4 animate-spin" />Processing...</Button>
                                        ) : (
                                            <>
                                                <Button size="sm" variant="outline" onClick={() => handleDismiss(report.id)}>Dismiss</Button>
                                                <Button size="sm" variant="destructive" onClick={() => handleDeleteMessage(report)}><Trash2 className="h-4 w-4 mr-2"/>Delete Message</Button>
                                                <Button size="sm" variant="destructive" className="bg-red-700 hover:bg-red-800" onClick={() => handleBanUser(report)}><UserX className="h-4 w-4 mr-2"/>Ban User</Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
