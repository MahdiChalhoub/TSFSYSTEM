'use client';
import React from 'react';

export function DraftIndicator({ savedAt }: { savedAt: string | null }) {
    if (!savedAt) return null;
    return (
        <span className="text-[8px] text-app-muted-foreground/50 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            Draft saved {savedAt}
        </span>
    );
}
