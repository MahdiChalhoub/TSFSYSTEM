'use client';

import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { getChartOfAccountsList } from '@/app/(privileged)/finance/accounts/picker-actions';

export function ChartOfAccountPicker({ value, onChange, disabled = false, filterType }: {
    value?: number,
    onChange: (id: number) => void,
    disabled?: boolean,
    filterType?: string
}) {
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoading(true);
            try {
                const data = await getChartOfAccountsList();
                if (mounted) {
                    setAccounts(data);
                }
            } catch (error) {
                console.error("Failed to load COA", error);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const selectedAccount = accounts.find(a => a.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={disabled || loading}
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                        </div>
                    ) : value ? (
                        selectedAccount ? `${selectedAccount.code} - ${selectedAccount.name}` : "Unknown Account"
                    ) : (
                        "Select Ledger Account..."
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search account code or name..." />
                    <CommandList>
                        <CommandEmpty>No account found.</CommandEmpty>
                        <CommandGroup>
                            {accounts
                                .filter(a => !filterType || a.type === filterType)
                                .map((account) => (
                                    <CommandItem
                                        key={account.id}
                                        value={`${account.code} ${account.name}`}
                                        onSelect={() => {
                                            onChange(account.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === account.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        <span className="font-mono mr-2 text-muted-foreground">{account.code}</span>
                                        {account.name}
                                    </CommandItem>
                                ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
