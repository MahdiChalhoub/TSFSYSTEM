'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * AppButton — theme-aware button primitive.
 *
 * Variants:
 *   primary  → filled accent CTA
 *   ghost    → outlined, muted
 *   danger   → destructive action (uses --app-error)
 *   link     → text-only, no background
 *
 * Sizes: sm | md | lg
 *
 * Usage:
 *   <AppButton>Save</AppButton>
 *   <AppButton variant="ghost" size="sm">Cancel</AppButton>
 *   <AppButton loading>Processing...</AppButton>
 *   <AppButton variant="danger" icon={<Trash size={16} />}>Delete</AppButton>
 */

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'link';
type ButtonSize = 'sm' | 'md' | 'lg';

interface AppButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    icon?: React.ReactNode;
    iconRight?: React.ReactNode;
    fullWidth?: boolean;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-sm gap-2',
};

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
        background: 'var(--app-primary)',
        color: '#ffffff',
        border: 'none',
        boxShadow: '0 2px 8px var(--app-primary-glow)',
    },
    ghost: {
        background: 'transparent',
        color: 'var(--app-text-muted)',
        border: '1px solid var(--app-border)',
    },
    danger: {
        background: 'var(--app-error-bg)',
        color: 'var(--app-error)',
        border: '1px solid var(--app-error)',
    },
    link: {
        background: 'transparent',
        color: 'var(--app-primary)',
        border: 'none',
        padding: 0,
        boxShadow: 'none',
    },
};

export function AppButton({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    iconRight,
    fullWidth = false,
    disabled,
    className = '',
    children,
    style,
    ...rest
}: AppButtonProps) {
    const isDisabled = disabled || loading;

    return (
        <button
            className={[
                'inline-flex items-center justify-center font-bold rounded-[var(--app-radius-sm)]',
                'transition-all duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-primary)] focus-visible:ring-offset-2',
                SIZE_CLASSES[size],
                fullWidth ? 'w-full' : '',
                isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.98]',
                variant === 'primary' && !isDisabled ? 'hover:-translate-y-px hover:shadow-lg' : '',
                className,
            ].filter(Boolean).join(' ')}
            style={{ ...VARIANT_STYLES[variant], fontFamily: 'var(--app-font)', ...style }}
            disabled={isDisabled}
            {...rest}
        >
            {loading ? (
                <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin flex-shrink-0" />
            ) : (
                icon && <span className="flex-shrink-0">{icon}</span>
            )}
            {children && <span>{children}</span>}
            {iconRight && !loading && <span className="flex-shrink-0">{iconRight}</span>}
        </button>
    );
}
