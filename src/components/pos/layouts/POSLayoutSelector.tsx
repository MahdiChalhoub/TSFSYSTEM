'use client';

import { POSLayoutVariant } from '@/types/pos-layout';
import { LayoutGrid, Monitor, Zap } from 'lucide-react';

const MODES: { id: POSLayoutVariant; label: string; icon: typeof LayoutGrid }[] = [
    { id: 'grid', label: 'Grid', icon: LayoutGrid },
    { id: 'kiosk', label: 'Kiosk', icon: Monitor },
    { id: 'express', label: 'Express', icon: Zap },
];

/**
 * Floating pill layout switcher — bottom-center of the POS screen.
 * Allows instant switching between Grid, Kiosk, and Express sub-modes.
 * Uses only --app-* theme variables for full theme compliance.
 */
export function POSLayoutSelector({
    currentLayout,
    onSelect,
}: {
    isOpen?: boolean;       // kept for backwards compat — ignored now
    currentLayout: POSLayoutVariant;
    onSelect: (layout: POSLayoutVariant) => void;
    onClose?: () => void;   // kept for backwards compat — ignored now
}) {
    return (
        <div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1500] flex items-center gap-1 rounded-full px-2 py-1.5"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: 'var(--app-shadow-lg)',
                backdropFilter: 'blur(16px)',
            }}
        >
            {MODES.map((m) => {
                const Icon = m.icon;
                const isActive = currentLayout === m.id;
                return (
                    <button
                        key={m.id}
                        onClick={() => onSelect(m.id)}
                        aria-label={`Switch to ${m.label} layout`}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-200"
                        style={{
                            background: isActive ? 'var(--app-primary)' : 'transparent',
                            color: isActive ? '#fff' : 'var(--app-muted-foreground)',
                            fontFamily: 'var(--app-font-display, inherit)',
                        }}
                    >
                        <Icon size={14} />
                        {m.label}
                    </button>
                );
            })}
        </div>
    );
}
