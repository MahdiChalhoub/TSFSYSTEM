'use client';

import { useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { useSupermarcheTheme } from './ThemeProvider';
import type { ThemeName, SupermarcheThemeTokens } from './themes';

// ── Theme Preview Card ─────────────────────────────────────
function ThemeCard({
    themeData,
    isActive,
    isChanging,
    onClick,
}: {
    themeData: SupermarcheThemeTokens;
    isActive: boolean;
    isChanging: boolean;
    onClick: () => void;
}) {
    const { preview } = themeData;

    return (
        <button
            onClick={onClick}
            disabled={isChanging}
            aria-pressed={isActive}
            aria-label={`Switch to ${themeData.label} theme`}
            className="group relative flex flex-col gap-2 rounded-xl p-1 transition-all duration-200 focus:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
            {/* Visual swatch */}
            <div
                className="relative w-full h-20 rounded-lg overflow-hidden border-2 transition-all duration-200 group-hover:scale-[1.02]"
                style={{
                    background: preview.bg,
                    borderColor: isActive ? preview.primary : 'transparent',
                    boxShadow: isActive ? `0 0 0 1px ${preview.primary}, 0 4px 16px rgba(0,0,0,0.2)` : '0 2px 8px rgba(0,0,0,0.15)',
                }}
            >
                {/* Mini layout mockup */}
                <div className="absolute inset-0 p-2 flex gap-1.5">
                    {/* Left column */}
                    <div className="flex flex-col gap-1 w-1/3">
                        <div className="rounded h-2 w-full opacity-40" style={{ background: preview.primary }} />
                        <div className="rounded h-2 w-3/4 opacity-20" style={{ background: preview.text }} />
                        <div className="rounded h-2 w-4/5 opacity-20" style={{ background: preview.text }} />
                    </div>
                    {/* Center */}
                    <div className="flex-1 flex flex-col gap-1">
                        <div className="rounded h-3 w-full opacity-60" style={{ background: preview.surface, border: `1px solid ${preview.primary}40` }} />
                        <div className="grid grid-cols-2 gap-1 flex-1">
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="rounded" style={{ background: preview.surface, opacity: 0.7 }} />
                            ))}
                        </div>
                    </div>
                    {/* Right panel */}
                    <div className="w-1/4 flex flex-col gap-1">
                        <div className="rounded-md flex-1" style={{ background: preview.surface, opacity: 0.8 }} />
                        <div className="rounded h-3" style={{ background: preview.primary }} />
                    </div>
                </div>

                {/* Active checkmark */}
                {isActive && (
                    <div
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: preview.primary }}
                    >
                        <Check size={11} color="#fff" strokeWidth={3} />
                    </div>
                )}
            </div>

            {/* Label */}
            <div className="px-1 text-left">
                <p
                    className="text-xs font-semibold truncate"
                    style={{ color: isActive ? preview.primary : 'var(--sm-text)' }}
                >
                    {themeData.label}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--sm-text-muted)' }}>
                    {themeData.description}
                </p>
            </div>
        </button>
    );
}

// ── ThemeSelector Panel ────────────────────────────────────
interface ThemeSelectorProps {
    /** If true, renders as a floating panel. If false, renders inline. */
    floating?: boolean;
    onClose?: () => void;
}

export function ThemeSelector({ floating = false, onClose }: ThemeSelectorProps) {
    const { theme, allThemes, setTheme, isChanging } = useSupermarcheTheme();

    const handleSelect = (name: ThemeName) => {
        setTheme(name);
        if (onClose) setTimeout(onClose, 300);
    };

    return (
        <div
            className="supermarche-root"
            style={{
                background: floating ? 'var(--sm-surface)' : 'transparent',
                borderRadius: floating ? 'var(--sm-radius-lg)' : undefined,
                padding: '1rem',
                border: floating ? '1px solid var(--sm-border)' : undefined,
                boxShadow: floating ? 'var(--sm-shadow)' : undefined,
                backdropFilter: floating ? 'var(--sm-backdrop)' : undefined,
                minWidth: 320,
            }}
        >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
                <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--sm-primary-glow)' }}
                >
                    <Palette size={14} style={{ color: 'var(--sm-primary)' }} />
                </div>
                <div>
                    <p className="text-sm font-bold" style={{ color: 'var(--sm-text)', fontFamily: 'var(--sm-font)' }}>
                        Theme Studio
                    </p>
                    <p className="text-xs" style={{ color: 'var(--sm-text-muted)', fontFamily: 'var(--sm-font)' }}>
                        {allThemes.length} visual concepts
                    </p>
                </div>
            </div>

            {/* Theme grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {allThemes.map((t) => (
                    <ThemeCard
                        key={t.name}
                        themeData={t}
                        isActive={theme === t.name}
                        isChanging={isChanging}
                        onClick={() => handleSelect(t.name)}
                    />
                ))}
            </div>

            {/* Current theme info */}
            <div
                className="mt-3 rounded-lg px-3 py-2 flex items-center justify-between"
                style={{ background: 'var(--sm-surface-2)', border: '1px solid var(--sm-border)' }}
            >
                <p className="text-xs" style={{ color: 'var(--sm-text-muted)', fontFamily: 'var(--sm-font)' }}>
                    Active theme
                </p>
                <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                        background: 'var(--sm-primary-glow)',
                        color: 'var(--sm-primary)',
                        fontFamily: 'var(--sm-font)',
                    }}
                >
                    {allThemes.find(t => t.name === theme)?.label}
                </span>
            </div>
        </div>
    );
}

// ── Trigger Button (to open the floating ThemeSelector) ────
export function ThemeSelectorTrigger() {
    const [open, setOpen] = useState(false);
    const { themeData } = useSupermarcheTheme();

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                aria-label="Open theme selector"
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg sm-btn-ghost text-sm font-medium"
                style={{ fontFamily: 'var(--sm-font)' }}
            >
                {/* Color dot preview */}
                <span
                    className="w-3.5 h-3.5 rounded-full border-2"
                    style={{
                        background: themeData.preview.primary,
                        borderColor: 'var(--sm-border-strong)',
                    }}
                />
                <Palette size={14} />
                <span className="hidden sm:inline">{themeData.label}</span>
            </button>

            {open && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                    />
                    {/* Panel */}
                    <div className="absolute top-full right-0 mt-2 z-50 sm-anim-fade-in">
                        <ThemeSelector floating onClose={() => setOpen(false)} />
                    </div>
                </>
            )}
        </div>
    );
}
