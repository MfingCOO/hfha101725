'use client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateClientForm, type CreateClientValues } from '@/components/coach/clients/create-client-form';
import { useToast } from '@/hooks/use-toast';
import { createClientByCoachAction } from '@/app/coach/clients/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/auth/auth-provider';
import type { CreateClientInput } from '@/types';

interface CreateClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClientCreated: () => void;
}

export function CreateClientDialog({ open, onOpenChange, onClientCreated }: CreateClientDialogProps) {
    const { toast } = useToast();
    const { user } = useAuth(); 

    const handleCreateClient = async (data: CreateClientValues) => {
        if (!user) {
            toast({
                variant: 'destructive',
                title: 'Authentication Error',
                description: 'You must be logged in to create a client.',
            });
            return { success: false, error: { message: "User not authenticated" } };
        }

        // SURGICAL FIX: Assert the type to CreateClientInput, trusting form validation.
        const clientData = {
            ...data,
            coachId: user.uid,
        } as CreateClientInput;

        try {
            const result = await createClientByCoachAction(clientData);
            if (result.success) {
                toast({
                    title: 'Client Created Successfully!',
                    description: `${data.fullName} has been added and their private chat has been initiated.`,
                });
                onClientCreated();
                return { success: true };
            } else {
                throw new Error(result.error?.message || "An unknown error occurred.");
            }
        } catch (error: any) {
            console.error("Client creation failed:", error);
            let errorMessage = error.message || "An unexpected error occurred during sign up.";
            if (errorMessage.includes('email-already-in-use') || errorMessage.includes('EMAIL_EXISTS')) {
                errorMessage = "This email address is already in use by another account.";
            }
            toast({
                variant: 'destructive',
                title: 'Client Creation Failed',
                description: errorMessage,
            });
            return { success: false, error: { message: errorMessage } };
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[90vw] h-[90dvh] max-w-4xl flex flex-col">
                 <DialogHeader>
                    <DialogTitle srOnly>Onboard New Client</DialogTitle>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full pr-6 -mr-6">
                        <CreateClientForm onFormSubmit={handleCreateClient} onCancel={() => onOpenChange(false)} />
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    )
}
