'use client';

import { useState, useTransition } from 'react';
import { Building2, ChevronDown, Check, ExternalLink, DoorOpen, Layers } from 'lucide-react';
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

    const label = isSaas ? 'Control Plane' : 'Workspace';
    const name = isSaas ? PLATFORM_CONFIG.name : (activeOrg?.name || 'Platform Root');

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
            {/* ── Trigger ── */}
            <button
                onClick={() => !isLocked && setIsOpen(v => !v)}
                suppressHydrationWarning
                className="flex items-center gap-2.5 h-9 pl-2 pr-3 rounded-xl transition-colors duration-150"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    cursor: isLocked ? 'default' : 'pointer',
                }}
                onMouseEnter={(e) => { if (!isLocked) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-primary)'; }}
                onMouseLeave={(e) => { if (!isLocked) (e.currentTarget as HTMLElement).style.borderColor = 'var(--app-border)'; }}
            >
                {/* Icon */}
                <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--app-primary)', color: 'var(--app-bg)' }}>
                    <Layers size={12} />
                </div>

                {/* Labels */}
                <div className="hidden lg:flex flex-col items-start leading-none gap-0.5">
                    <span className="text-[9px] font-black uppercase tracking-widest"
                        style={{ color: 'var(--app-primary)' }}>
                        {label}
                    </span>
                    <span className="text-xs font-bold truncate max-w-[130px]"
                        style={{ color: 'var(--app-text)' }}>
                        {name}
                    </span>
                </div>

                {/* Chevron */}
                {!isLocked && !isSaas && (
                    <ChevronDown size={13} style={{
                        color: 'var(--app-text-faint)',
                        transform: isOpen ? 'rotate(180deg)' : 'none',
                        transition: 'transform var(--app-transition-fast)',
                        flexShrink: 0,
                    }} />
                )}
            </button>

            {/* ── Dropdown ── */}
            {isOpen && !isSaas && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-76 rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: 'var(--app-shadow-lg)',
                            minWidth: '280px',
                        }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3"
                            style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-surface-2)' }}>
                            <div className="flex items-center gap-2">
                                <Building2 size={12} style={{ color: 'var(--app-primary)' }} />
                                <span className="text-[10px] font-black uppercase tracking-widest"
                                    style={{ color: 'var(--app-text-muted)' }}>
                                    Switch Workspace
                                </span>
                            </div>
                            {showMasterPanel && (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                                    style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}>
                                    Super Admin
                                </span>
                            )}
                        </div>

                        {/* Org list */}
                        <div className="p-2 max-h-72 overflow-y-auto custom-scrollbar">
                            {organizations.filter(o => o.slug !== 'saas').length === 0 && (
                                <p className="text-xs text-center py-8 italic"
                                    style={{ color: 'var(--app-text-faint)' }}>
                                    No organizations found
                                </p>
                            )}
                            {organizations.filter(o => o.slug !== 'saas').map(org => {
                                const isActive = org.slug === currentSlug;
                                return (
                                    <button key={org.id}
                                        onClick={() => handleSwitch(org.slug)}
                                        disabled={isPending}
                                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-150 mb-0.5"
                                        style={{
                                            background: isActive ? 'var(--app-primary)' : 'transparent',
                                            color: isActive ? 'var(--app-bg)' : 'var(--app-text-muted)',
                                        }}
                                        onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--app-surface-2)'; }}
                                        onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                    >
                                        <div className="flex items-center gap-3 text-left min-w-0">
                                            {/* Active indicator dot */}
                                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ background: org.isActive ? 'var(--app-success)' : 'var(--app-text-faint)' }} />
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold truncate">{org.name}</p>
                                                <p className="text-[9px] font-mono opacity-60 truncate">
                                                    {org.slug}{branding.suffix}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                            {isActive
                                                ? <Check size={14} />
                                                : <ExternalLink size={12} style={{ opacity: 0.4 }} />
                                            }
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Master panel link */}
                        {showMasterPanel && (
                            <div className="p-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                                <button
                                    onClick={() => window.location.href = `http://saas.${branding.domain}/dashboard`}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors duration-150 text-[10px] font-black uppercase tracking-widest"
                                    style={{
                                        border: '1px dashed var(--app-border)',
                                        color: 'var(--app-text-faint)',
                                    }}
                                    onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-primary)'; el.style.color = 'var(--app-primary)'; el.style.background = 'var(--app-primary-light)'; }}
                                    onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'var(--app-border)'; el.style.color = 'var(--app-text-faint)'; el.style.background = 'transparent'; }}
                                >
                                    <DoorOpen size={13} />
                                    Master Panel
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
