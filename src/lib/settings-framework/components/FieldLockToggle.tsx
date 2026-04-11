'use client';
import React from 'react';
import { Lock, Unlock } from 'lucide-react';

export function FieldLockToggle({ field, isLocked, onToggle }: {
    field: string;
    isLocked: boolean;
    onToggle: (field: string) => void;
}) {
    return (
        <button
            type="button"
            onClick={() => onToggle(field)}
            className="p-0.5 rounded text-app-muted-foreground/30 hover:text-app-muted-foreground transition-colors"
            title={isLocked ? 'Unlock field' : 'Lock field'}
        >
            {isLocked ? <Lock size={8} /> : <Unlock size={8} />}
        </button>
    );
}
