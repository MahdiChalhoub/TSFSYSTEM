'use client';
import React from 'react';
import { HelpCircle } from 'lucide-react';

const FIELD_HELP_MAP: Record<string, string> = {};

export function FieldHelp({ field, helpMap }: { field: string; helpMap?: Record<string, string> }) {
    const text = (helpMap || FIELD_HELP_MAP)[field];
    if (!text) return <HelpCircle size={10} className="text-app-muted-foreground/20 cursor-help" />;
    return (
        <span className="relative group">
            <HelpCircle size={10} className="text-app-muted-foreground/30 cursor-help hover:text-app-muted-foreground transition-colors" />
            <span className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-1 rounded-md bg-app-foreground text-app-background text-[8px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity shadow-lg">
                {text}
            </span>
        </span>
    );
}
