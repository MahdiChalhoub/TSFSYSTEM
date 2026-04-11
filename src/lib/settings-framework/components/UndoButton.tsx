'use client';
import React from 'react';
import { Undo2 } from 'lucide-react';

export function UndoButton({ canUndo, depth, onUndo }: {
    canUndo: boolean;
    depth: number;
    onUndo: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-app-background border border-app-border/50 text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title={`Undo last change (${depth} in stack)`}
        >
            <Undo2 size={9} /> Undo
            {depth > 0 && (
                <span className="text-[8px] px-1 rounded bg-app-primary/10 text-app-primary font-black">{depth}</span>
            )}
        </button>
    );
}
