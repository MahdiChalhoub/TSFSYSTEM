'use client';
import React from 'react';
import { Search } from 'lucide-react';

export function FieldSearchBar({ value, onChange, placeholder = 'Filter fields...' }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <div className="relative">
            <Search size={9} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-app-muted-foreground/40" />
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="pl-5 pr-2 py-0.5 rounded-md bg-app-background border border-app-border/30 text-[9px] text-app-foreground placeholder:text-app-muted-foreground/30 w-28 focus:w-40 transition-all focus:outline-none focus:ring-1 focus:ring-app-primary/30"
            />
        </div>
    );
}
