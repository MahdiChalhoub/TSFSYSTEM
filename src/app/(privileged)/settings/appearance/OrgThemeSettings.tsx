'use client';
/**
 * OrgThemeSettings — /settings/appearance client component
 * Allows org admins to set a default theme for all users.
 * Requires app.change_theme permission (RBAC gated).
 */

import React, { useState, useTransition } from 'react';
import { APP_THEMES, useAppTheme } from '@/components/app/AppThemeProvider';
import type { AppThemeInfo, AppThemeName } from '@/components/app/AppThemeProvider';
import { setOrgDefaultTheme } from '@/app/actions/settings/theme';
import { useHasPermission, PERMISSIONS } from '@/hooks/use-permissions';
import { Check, Building2, Palette, RotateCcw, Loader2, AlertCircle } from 'lucide-react';

// ── Mini theme card ──────────────────────────────────────────────────────────
function OrgThemeCard({
    info,
    isOrgDefault,
    isUserTheme,
    onSelect,
}: {
    info: AppThemeInfo;
    isOrgDefault: boolean;
    isUserTheme: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            onClick={onSelect}
            aria-label={`Set ${info.label} as org default theme`}
            className="relative flex flex-col gap-2 rounded-xl p-3 border transition-all duration-200 text-left w-full"
            style={{
                background: info.bg,
                borderColor: isOrgDefault ? info.primary : 'rgba(128,128,128,0.2)',
                boxShadow: isOrgDefault
                    ? `0 0 0 2px ${info.primary}44, 0 4px 20px rgba(0,0,0,0.2)`
                    : '0 1px 4px rgba(0,0,0,0.1)',
                transform: isOrgDefault ? 'scale(1.03)' : 'scale(1)',
            }}
        >
            {/* Preview strip */}
            <div
                className="w-full h-12 rounded-lg"
                style={{ background: info.previewGradient, opacity: 0.9 }}
            />

            {/* Labels */}
            <div className="flex items-center justify-between gap-1">
                <div>
                    <p className="text-xs font-black tracking-tight leading-tight" style={{ color: info.primary }}>
                        {info.label}
                    </p>
                    <p className="text-[10px] font-medium opacity-60 leading-tight" style={{ color: info.primary }}>
                        {info.description}
                    </p>
                </div>
                {isOrgDefault && (
                    <div
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: info.primary }}
                    >
                        <Check size={11} color="#fff" strokeWidth={3} />
                    </div>
                )}
            </div>

            {/* Badges */}
            <div className="flex gap-1 flex-wrap">
                {isOrgDefault && (
                    <span
                        className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full flex items-center gap-1"
                        style={{ background: info.primary + '22', color: info.primary }}
                    >
                        <Building2 size={8} /> Org Default
                    </span>
                )}
                {isUserTheme && (
                    <span
                        className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                        style={{ background: 'rgba(128,128,128,0.15)', color: info.primary }}
                    >
                        Your Theme
                    </span>
                )}
                <span
                    className="absolute top-2 right-2 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full"
                    style={{
                        background: info.mode === 'dark' ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.7)',
                        color: info.primary,
                    }}
                >
                    {info.mode}
                </span>
            </div>
        </button>
    );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function OrgThemeSettings({ currentOrgDefault }: { currentOrgDefault: AppThemeName | null }) {
    const { theme: userTheme, themes } = useAppTheme();
    const canManage = useHasPermission(PERMISSIONS.APP.CHANGE_THEME);
    const [orgDefault, setOrgDefault] = useState<AppThemeName | null>(currentOrgDefault);
    const [isPending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    function handleSelect(name: AppThemeName) {
        if (!canManage) return;
        startTransition(async () => {
            setFeedback(null);
            const result = await setOrgDefaultTheme(name);
            if (result.ok) {
                setOrgDefault(name);
                setFeedback({ type: 'success', msg: `"${themes.find(t => t.name === name)?.label}" is now the org default.` });
            } else {
                setFeedback({ type: 'error', msg: result.error ?? 'Failed to update org default theme.' });
            }
        });
    }

    function handleClear() {
        if (!canManage) return;
        startTransition(async () => {
            setFeedback(null);
            const result = await setOrgDefaultTheme(null);
            if (result.ok) {
                setOrgDefault(null);
                setFeedback({ type: 'success', msg: 'Org default theme cleared. Users will fall back to Midnight Pro.' });
            } else {
                setFeedback({ type: 'error', msg: result.error ?? 'Failed to clear org default.' });
            }
        });
    }

    if (!canManage) {
        return (
            <div
                className="rounded-2xl p-6 flex items-center gap-4"
                style={{ background: 'var(--app-surface-2)', border: '1px solid var(--app-border)' }}
            >
                <AlertCircle size={20} style={{ color: 'var(--app-text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>
                    You don't have permission to change themes. Contact your admin.
                </p>
            </div>
        );
    }

    return (
        <div
            className="app-glass rounded-2xl p-6 flex flex-col gap-5"
            style={{ border: '1px solid var(--app-border)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'var(--app-primary-light)' }}
                    >
                        <Building2 size={18} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-sm font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Organisation Default Theme
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                            New users see this theme on first login. Personal picks always override it.
                        </p>
                    </div>
                </div>

                {orgDefault && (
                    <button
                        onClick={handleClear}
                        disabled={isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                        style={{
                            background: 'var(--app-surface-2)',
                            color: 'var(--app-text-muted)',
                            border: '1px solid var(--app-border)',
                        }}
                        title="Remove org default — users fall back to Midnight Pro"
                    >
                        {isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                        Reset to system default
                    </button>
                )}
            </div>

            {/* Priority chain explanation */}
            <div
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-medium"
                style={{ background: 'var(--app-primary-light)', color: 'var(--app-primary)' }}
            >
                <Palette size={13} />
                <span>Priority: <strong>User pick</strong> → <strong>Org default (below)</strong> → System default (Midnight Pro)</span>
            </div>

            {/* Theme grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {themes.map((info) => (
                    <OrgThemeCard
                        key={info.name}
                        info={info}
                        isOrgDefault={orgDefault === info.name}
                        isUserTheme={userTheme === info.name}
                        onSelect={() => handleSelect(info.name)}
                    />
                ))}
            </div>

            {/* Feedback */}
            {isPending && (
                <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--app-text-muted)' }}>
                    <Loader2 size={13} className="animate-spin" /> Saving org default...
                </div>
            )}
            {!isPending && feedback && (
                <div
                    className="flex items-center gap-2 text-xs font-semibold rounded-lg px-3 py-2"
                    style={{
                        background: feedback.type === 'success' ? 'var(--app-primary-light)' : '#fee2e2',
                        color: feedback.type === 'success' ? 'var(--app-primary)' : '#dc2626',
                    }}
                >
                    {feedback.type === 'success' ? <Check size={13} /> : <AlertCircle size={13} />}
                    {feedback.msg}
                </div>
            )}

            {/* Current status */}
            <p className="text-[10px]" style={{ color: 'var(--app-text-faint)' }}>
                {orgDefault
                    ? `Org default: ${themes.find(t => t.name === orgDefault)?.label ?? orgDefault}. Users without a personal pick will see this theme.`
                    : 'No org default set — new users see Midnight Pro.'}
            </p>
        </div>
    );
}
