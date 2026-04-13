'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Check, ExternalLink, DoorOpen, LayoutGrid } from 'lucide-react';
import { PLATFORM_CONFIG, useDynamicBranding } from '@/lib/saas_config';

export function TenantSwitcher({
    organizations,
    forcedSlug,
    user,
}: {
    organizations: Record<string, any>[];
    forcedSlug?: string;
    user?: Record<string, any>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, startTransition] = useTransition();

    const currentSlug = forcedSlug || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '');
    const activeOrg = organizations.find(o => o.slug === currentSlug);
    const branding = useDynamicBranding();
    const showMasterPanel = user?.is_superuser || user?.is_staff;
    const isLocked = organizations.length <= 1 && !showMasterPanel;
    const isSaas = currentSlug === 'saas';
    const name = isSaas ? PLATFORM_CONFIG.name : (activeOrg?.name || 'Workspace');

    const handleSwitch = (slug: string) => {
        startTransition(() => {
            const protocol = window.location.protocol;
            const port = window.location.port;
            const hostname = window.location.hostname.replace(/^(saas\.|[a-z0-9-]+\.)/i, '');
            window.location.href = `${protocol}//${slug}.${hostname}${port ? `:${port}` : ''}`;
        });
    };

    return (
        <div className="relative flex-shrink-0">

            {/* ── Trigger ─────────────────────────────────────────── */}
            <button
                onClick={() => !isLocked && setIsOpen(v => !v)}
                suppressHydrationWarning
                disabled={isLocked}
                className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg transition-colors duration-150"
                style={{
                    background: isOpen ? 'var(--app-surface-2)' : 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--app-text)',
                    cursor: isLocked ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => {
                    if (!isLocked) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'var(--app-surface-2)';
                        el.style.borderColor = 'var(--app-border)';
                    }
                }}
                onMouseLeave={(e) => {
                    if (!isLocked && !isOpen) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'transparent';
                        el.style.borderColor = 'transparent';
                    }
                }}
            >
                {/* Workspace colour dot */}
                <div
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}
                >
                    {name.charAt(0).toUpperCase()}
                </div>

                <span className="hidden sm:block text-sm font-semibold truncate max-w-[120px]">
                    {name}
                </span>

                {!isLocked && !isSaas && (
                    <ChevronDown
                        size={13}
                        className="flex-shrink-0"
                        style={{
                            color: 'var(--app-text-faint)',
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            transition: 'transform var(--app-transition-fast)',
                        }}
                    />
                )}
            </button>

            {/* ── Dropdown ────────────────────────────────────────── */}
            {isOpen && !isSaas && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute top-full left-0 mt-1.5 rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '260px',
                        }}
                    >
                        {/* Header */}
                        <div
                            className="flex items-center justify-between px-3 py-2.5"
                            style={{ borderBottom: '1px solid var(--app-border)' }}
                        >
                            <div className="flex items-center gap-2">
                                <LayoutGrid size={11} style={{ color: 'var(--app-primary)' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                                    Workspaces
                                </span>
                            </div>
                            {showMasterPanel && (
                                <span
                                    className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                                >
                                    Super Admin
                                </span>
                            )}
                        </div>

                        {/* List */}
                        <div className="p-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                            {organizations.filter(o => o.slug !== 'saas').length === 0 && (
                                <p className="text-xs text-center py-6 italic" style={{ color: 'var(--app-text-faint)' }}>
                                    No workspaces found
                                </p>
                            )}
                            {organizations.filter(o => o.slug !== 'saas').map(org => {
                                const isActive = org.slug === currentSlug;
                                return (
                                    <button
                                        key={org.id}
                                        onClick={() => handleSwitch(org.slug)}
                                        disabled={isPending}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-150"
                                        style={{
                                            background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                            color: isActive ? 'var(--app-primary)' : 'var(--app-text-muted)',
                                        }}
                                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        {/* Avatar */}
                                        <div
                                            className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-black"
                                            style={{
                                                background: isActive ? 'var(--app-primary)' : 'var(--app-surface-2)',
                                                color: isActive ? 'var(--app-bg)' : 'var(--app-text-muted)',
                                                border: '1px solid var(--app-border)',
                                            }}
                                        >
                                            {org.name.charAt(0).toUpperCase()}
                                        </div>

                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-xs font-semibold truncate">{org.name}</p>
                                            <p className="text-[9px] font-mono opacity-50 truncate">
                                                {org.slug}{branding.suffix}
                                            </p>
                                        </div>

                                        {isActive
                                            ? <Check size={13} className="flex-shrink-0" />
                                            : <ExternalLink size={11} className="flex-shrink-0 opacity-30" />
                                        }
                                    </button>
                                );
                            })}
                        </div>

                        {/* Master panel */}
                        {showMasterPanel && (
                            <div className="p-1.5" style={{ borderTop: '1px solid var(--app-border)' }}>
                                <button
                                    onClick={() => window.location.href = `http://saas.${branding.domain}/dashboard`}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors duration-150 text-xs font-medium"
                                    style={{ color: 'var(--app-text-faint)' }}
                                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'var(--app-surface-2)'; el.style.color = 'var(--app-text)'; }}
                                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.background = 'transparent'; el.style.color = 'var(--app-text-faint)'; }}
                                >
                                    <DoorOpen size={13} />
                                    Go to Master Panel
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
