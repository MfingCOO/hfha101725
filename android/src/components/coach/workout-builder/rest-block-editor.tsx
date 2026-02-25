'use client';

import { useFormContext } from 'react-hook-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField, FormControl, FormItem, FormLabel } from '@/components/ui/form';
import { Trash2 } from 'lucide-react';

interface RestBlockEditorProps {
  blockIndex: number;
  removeBlock: (index: number) => void;
}

export function RestBlockEditor({ blockIndex, removeBlock }: RestBlockEditorProps) {
  const { control } = useFormContext();

  return (
    <Card className="w-full bg-slate-800/60">
      <CardContent className="p-3">
        <div className="flex justify-between items-center">
            <div className="flex-1">
                <FormField
                    control={control}
                    name={`blocks.${blockIndex}.duration`}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rest Period</FormLabel>
                            <div className="flex items-center gap-2">
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        placeholder="e.g., 60" 
                                        {...field} 
                                        className="w-24"
                                        onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)}
                                    />
                                </FormControl>
                                <span>seconds</span>
                            </div>
                        </FormItem>
                    )}
                />
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => removeBlock(blockIndex)} className="ml-2">
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}
