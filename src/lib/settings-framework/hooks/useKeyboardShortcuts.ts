'use client';
import { useState, useEffect, useCallback } from 'react';

export interface ShortcutDef {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    label: string;
    description: string;
    action: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutDef[], deps: any[] = []) {
    const [showOverlay, setShowOverlay] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            // ? key for overlay
            if (e.key === '?' && !e.ctrlKey && !e.metaKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
                e.preventDefault();
                setShowOverlay(prev => !prev);
                return;
            }

            for (const shortcut of shortcuts) {
                const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
                const shiftMatch = shortcut.shift ? e.shiftKey : true;
                if (e.key.toLowerCase() === shortcut.key.toLowerCase() && ctrlMatch && shiftMatch) {
                    // Don't intercept in inputs unless it's a ctrl combo
                    if (!shortcut.ctrl && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) continue;
                    e.preventDefault();
                    shortcut.action();
                    return;
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [shortcuts, ...deps]);

    return { showOverlay, setShowOverlay, shortcuts };
}
