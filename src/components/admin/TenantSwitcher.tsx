'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, Check, ExternalLink, DoorOpen, LayoutGrid, Loader2 } from 'lucide-react';
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

    const currentSlug = forcedSlug
        || (typeof window !== 'undefined' ? window.location.hostname.split('.')[0] : '');
    const activeOrg = organizations.find(o => o.slug === currentSlug);
    const branding = useDynamicBranding();
    const showMasterPanel = user?.is_superuser || user?.is_staff;
    const isLocked = organizations.length <= 1 && !showMasterPanel;
    const isSaas = currentSlug === 'saas';
    const name = isSaas ? PLATFORM_CONFIG.name : (activeOrg?.name || 'Workspace');
    const initial = name.charAt(0).toUpperCase();

    const handleSwitch = (slug: string) => {
        startTransition(() => {
            const { protocol, port, hostname } = window.location;
            const root = hostname.replace(/^(saas\.|[a-z0-9-]+\.)/i, '');
            window.location.href = `${protocol}//${slug}.${root}${port ? `:${port}` : ''}`;
        });
    };

    return (
        <div className="relative flex-shrink-0">

            {/* ── Trigger ── */}
            <button
                onClick={() => !isLocked && setIsOpen(v => !v)}
                suppressHydrationWarning
                disabled={isLocked}
                className="group flex items-center gap-2 h-8 px-2 rounded-lg transition-all duration-150"
                style={{
                    background: isOpen ? 'var(--app-surface)' : 'transparent',
                    border: `1px solid ${isOpen ? 'var(--app-border)' : 'transparent'}`,
                    cursor: isLocked ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => {
                    if (!isLocked) {
                        const el = e.currentTarget as HTMLElement;
                        el.style.background = 'var(--app-surface)';
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
                {/* Avatar */}
                <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 text-[11px] font-black select-none"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}
                >
                    {initial}
                </div>

                {/* Name */}
                <span
                    className="hidden sm:block text-[13px] font-semibold leading-none truncate max-w-[128px]"
                    style={{ color: 'var(--app-text)' }}
                >
                    {name}
                </span>

                {/* Chevron */}
                {!isLocked && !isSaas && (
                    <ChevronDown
                        size={12}
                        className="flex-shrink-0 opacity-40 transition-transform duration-200"
                        style={{
                            transform: isOpen ? 'rotate(180deg)' : 'none',
                            color: 'var(--app-text)',
                        }}
                    />
                )}
            </button>

            {/* ── Dropdown ── */}
            {isOpen && !isSaas && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute top-full left-0 mt-1 z-50 overflow-hidden rounded-xl animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '272px',
                        }}
                    >
                        {/* Title row */}
                        <div
                            className="flex items-center justify-between px-3 pt-3 pb-2"
                        >
                            <span
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: 'var(--app-text-faint)' }}
                            >
                                Switch Workspace
                            </span>
                            {showMasterPanel && (
                                <span
                                    className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md"
                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
                                >
                                    Super Admin
                                </span>
                            )}
                        </div>

                        {/* Org list */}
                        <div className="px-1.5 pb-1.5 max-h-60 overflow-y-auto custom-scrollbar">
                            {organizations.filter(o => o.slug !== 'saas').length === 0 && (
                                <p
                                    className="text-xs text-center py-8"
                                    style={{ color: 'var(--app-text-faint)' }}
                                >
                                    No workspaces found
                                </p>
                            )}
                            {organizations.filter(o => o.slug !== 'saas').map(org => {
                                const isActive = org.slug === currentSlug;
                                return (
                                    <button
                                        key={org.id}
                                        onClick={() => { handleSwitch(org.slug); setIsOpen(false); }}
                                        disabled={isPending}
                                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg transition-colors duration-100"
                                        style={{
                                            background: isActive ? 'var(--app-primary-light)' : 'transparent',
                                            borderLeft: isActive ? '2px solid var(--app-primary)' : '2px solid transparent',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)';
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                        }}
                                    >
                                        {/* Org avatar */}
                                        {org.logo ? (
                                            <img
                                                src={org.logo}
                                                alt={org.name}
                                                className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
                                                style={{ border: '1px solid var(--app-border)' }}
                                            />
                                        ) : (
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
                                        )}

                                        <div className="flex-1 min-w-0 text-left">
                                            <p
                                                className="text-xs font-semibold truncate leading-tight"
                                                style={{ color: isActive ? 'var(--app-primary)' : 'var(--app-text)' }}
                                            >
                                                {org.name}
                                            </p>
                                            <p
                                                className="text-[9px] font-mono truncate leading-tight mt-0.5"
                                                style={{ color: 'var(--app-text-faint)' }}
                                            >
                                                {org.slug}{branding.suffix}
                                            </p>
                                        </div>

                                        <div className="flex-shrink-0">
                                            {isPending
                                                ? <Loader2 size={12} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                                                : isActive
                                                    ? <Check size={13} style={{ color: 'var(--app-primary)' }} />
                                                    : <ExternalLink size={11} style={{ color: 'var(--app-text-faint)', opacity: 0.5 }} />
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Master panel */}
                        {showMasterPanel && (
                            <div
                                className="px-1.5 pb-1.5 pt-1"
                                style={{ borderTop: '1px solid var(--app-border)' }}
                            >
                                <button
                                    onClick={() => window.location.href = `http://saas.${branding.domain}/dashboard`}
                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors duration-100 text-xs"
                                    style={{ color: 'var(--app-text-faint)' }}
                                    onMouseEnter={(e) => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'var(--app-surface-2)';
                                        el.style.color = 'var(--app-text)';
                                    }}
                                    onMouseLeave={(e) => {
                                        const el = e.currentTarget as HTMLElement;
                                        el.style.background = 'transparent';
                                        el.style.color = 'var(--app-text-faint)';
                                    }}
                                >
                                    <DoorOpen size={13} className="flex-shrink-0" />
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
