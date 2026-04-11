'use client';
import React from 'react';
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';

export function CollapsibleCard({ id, title, subtitle, icon, isCollapsed, onToggle, onReset, children, className = '' }: {
    id: string;
    title: string;
    subtitle?: string;
    icon?: React.ReactNode;
    isCollapsed: boolean;
    onToggle: (id: string) => void;
    onReset?: () => void;
    children: React.ReactNode;
    className?: string;
}) {
    const card = 'rounded-xl border border-app-border/40 bg-app-surface/80 backdrop-blur-sm shadow-sm overflow-hidden';
    const cardHeader = 'flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-app-background/30 transition-colors';
    const cardTitle = 'text-[11px] font-black text-app-foreground tracking-wide';
    const cardBody = 'px-3 py-3 border-t border-app-border/20 grid grid-cols-1 sm:grid-cols-2 gap-3';

    return (
        <div className={`${card} ${className}`}>
            <div className={cardHeader} onClick={() => onToggle(id)}>
                {icon}
                <div className="flex-1">
                    <h3 className={cardTitle}>{title}</h3>
                    {subtitle && <p className="text-[10px] text-app-muted-foreground">{subtitle}</p>}
                </div>
                {onReset && (
                    <button
                        type="button"
                        onClick={e => { e.stopPropagation(); onReset(); }}
                        className="text-[8px] px-1.5 py-0.5 rounded bg-app-muted-foreground/5 border border-app-border/30 text-app-muted-foreground hover:text-app-foreground hover:border-app-border transition-all"
                        title="Reset this section to defaults"
                    >
                        Reset
                    </button>
                )}
                {isCollapsed ? <ChevronRight size={14} className="text-app-muted-foreground" /> : <ChevronDown size={14} className="text-app-muted-foreground" />}
            </div>
            {!isCollapsed && <div className={cardBody}>{children}</div>}
        </div>
    );
}
