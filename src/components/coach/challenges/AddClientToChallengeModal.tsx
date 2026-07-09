'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { addClientToChallenge, searchClients } from '@/app/coach/actions';
import { Loader2, UserPlus } from 'lucide-react';

interface AddClientToChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  challengeId: string;
  challengeName: string;
  onClientAdded?: () => void;
}

export function AddClientToChallengeModal({
  isOpen,
  onClose,
  challengeId,
  challengeName,
  onClientAdded,
}: AddClientToChallengeModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (value: string) => {
    setSearchTerm(value);
    if (value.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const result = await searchClients(value);
    if (result.success) {
      setResults(result.data || []);
    }
    setIsSearching(false);
  };

  const handleSelectClient = async (client: any) => {
    setIsAdding(true);
    const result = await addClientToChallenge(challengeId, client.uid);

    if (result.success) {
      toast({
        title: 'Client Added',
        description: `${client.fullName} has been added to "${challengeName}".`,
      });
      onClientAdded?.();
      onClose();
      setSearchTerm('');
      setResults([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: result.error || 'Failed to add client.',
      });
    }
    setIsAdding(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Client to Challenge</DialogTitle>
          <DialogDescription>
            Search by name or email for <span className="font-medium">{challengeName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            disabled={isAdding}
          />

          {isSearching && <div className="text-sm text-muted-foreground">Searching...</div>}

          {results.length > 0 && (
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {results.map((client) => (
                <div
                  key={client.uid}
                  onClick={() => handleSelectClient(client)}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium">{client.fullName}</div>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
                  </div>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}

          {searchTerm.length >= 2 && results.length === 0 && !isSearching && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No clients found matching "{searchTerm}"
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isAdding}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}