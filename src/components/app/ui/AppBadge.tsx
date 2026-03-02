'use client';
import React from 'react';

/**
 * AppBadge — theme-aware status pill.
 *
 * Semantic variants: success | warning | error | info | neutral
 * Special variants:  new | locked | final | pending | review
 *
 * Usage:
 *   <AppBadge variant="success">Active</AppBadge>
 *   <AppBadge variant="new">NEW</AppBadge>
 *   <AppBadge variant="error" dot>Failed</AppBadge>
 */

type BadgeVariant =
    | 'success' | 'warning' | 'error' | 'info' | 'neutral'
    | 'new' | 'pending' | 'review' | 'locked' | 'final';

interface AppBadgeProps {
    variant?: BadgeVariant;
    dot?: boolean;
    children: React.ReactNode;
    className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
    success: { background: 'var(--app-success-bg)', color: 'var(--app-success)', borderColor: 'var(--app-success)' },
    warning: { background: 'var(--app-warning-bg)', color: 'var(--app-warning)', borderColor: 'var(--app-warning)' },
    error: { background: 'var(--app-error-bg)', color: 'var(--app-error)', borderColor: 'var(--app-error)' },
    info: { background: 'var(--app-info-bg)', color: 'var(--app-info)', borderColor: 'var(--app-info)' },
    neutral: { background: 'var(--app-surface-2)', color: 'var(--app-text-muted)', borderColor: 'var(--app-border)' },
    // Tagging governance variants (sidebar tags)
    new: { background: 'rgba(59,130,246,0.12)', color: '#3B82F6', borderColor: '#3B82F6' },
    pending: { background: 'rgba(234,179,8,0.12)', color: '#CA8A04', borderColor: '#CA8A04' },
    review: { background: 'rgba(168,85,247,0.12)', color: '#9333EA', borderColor: '#9333EA' },
    locked: { background: 'rgba(239,68,68,0.12)', color: '#DC2626', borderColor: '#DC2626' },
    final: { background: 'rgba(34,197,94,0.12)', color: '#16A34A', borderColor: '#16A34A' },
};

export function AppBadge({
    variant = 'neutral',
    dot = false,
    children,
    className = '',
}: AppBadgeProps) {
    return (
        <span
            className={['app-badge', className].filter(Boolean).join(' ')}
            style={VARIANT_STYLES[variant]}
        >
            {dot && (
                <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: 'currentColor' }}
                />
            )}
            {children}
        </span>
    );
}
