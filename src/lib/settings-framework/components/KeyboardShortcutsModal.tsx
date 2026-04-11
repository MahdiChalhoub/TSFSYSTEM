'use client';
import React from 'react';
import { X } from 'lucide-react';
import type { ShortcutDef } from '../hooks/useKeyboardShortcuts';

export function KeyboardShortcutsModal({ shortcuts, onClose }: {
    shortcuts: ShortcutDef[];
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-app-surface border border-app-border rounded-2xl shadow-2xl w-[380px] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-app-border flex items-center justify-between">
                    <span className="text-[11px] font-black text-app-foreground">Keyboard Shortcuts</span>
                    <button type="button" onClick={onClose} className="text-app-muted-foreground hover:text-app-foreground"><X size={14} /></button>
                </div>
                <div className="p-3 space-y-1.5">
                    {shortcuts.map((s, i) => (
                        <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-app-background/50 transition-colors">
                            <span className="text-[10px] text-app-foreground">{s.description}</span>
                            <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-app-background border border-app-border/50 text-app-muted-foreground">
                                {s.ctrl ? 'Ctrl+' : ''}{s.shift ? 'Shift+' : ''}{s.key.toUpperCase()}
                            </kbd>
                        </div>
                    ))}
                    <div className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-app-background/50 transition-colors">
                        <span className="text-[10px] text-app-foreground">Toggle this overlay</span>
                        <kbd className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-app-background border border-app-border/50 text-app-muted-foreground">?</kbd>
                    </div>
                </div>
            </div>
        </div>
    );
}
