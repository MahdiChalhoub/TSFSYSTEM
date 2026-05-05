'use client';
import React from 'react';

/**
 * AppCard — theme-aware card primitive.
 *
 * Variants:
 *   default  → standard raised card (--app-surface + shadow-sm)
 *   glass    → glassmorphism card (backdrop blur — admin use)
 *   glass-soft → low-GPU glass (POS use)
 *   flat     → no shadow, subtle border only
 *   kpi      → stat card with hover lift
 *
 * Usage:
 *   <AppCard>...</AppCard>
 *   <AppCard variant="glass" className="p-6">...</AppCard>
 *   <AppCard as="button" onClick={...}>...</AppCard>
 */

type AppCardVariant = 'default' | 'glass' | 'glass-soft' | 'flat' | 'kpi';

interface AppCardProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: AppCardVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    hoverable?: boolean;
    as?: 'div' | 'section' | 'article' | 'button';
    children: React.ReactNode;
}

const VARIANT_CLASSES: Record<AppCardVariant, string> = {
    default: 'app-card',
    glass: 'app-glass',
    'glass-soft': 'app-glass-soft',
    flat: 'app-card',
    kpi: 'app-kpi-card',
};

const PADDING_CLASSES = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
};

const FLAT_STYLE: React.CSSProperties = {
    boxShadow: 'none',
};

export function AppCard({
    variant = 'default',
    padding = 'md',
    hoverable = false,
    as: Tag = 'div',
    className = '',
    style,
    children,
    ...rest
}: AppCardProps) {
    const classes = [
        VARIANT_CLASSES[variant],
        padding !== 'none' ? PADDING_CLASSES[padding] : '',
        hoverable || variant === 'kpi' ? 'app-card-hover' : '',
        className,
    ].filter(Boolean).join(' ');

    const mergedStyle: React.CSSProperties = {
        ...(variant === 'flat' ? FLAT_STYLE : {}),
        ...style,
    };

    return (
        <Tag className={classes} style={mergedStyle} {...(rest as Record<string, unknown>)}>
            {children}
        </Tag>
    );
}

/**
 * AppSection — labelled section within a page.
 * Renders a header (title + optional description + optional action) + card body.
 */
interface AppSectionProps {
    title: string;
    description?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
    variant?: AppCardVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
}

export function AppSection({
    title,
    description,
    action,
    children,
    variant = 'default',
    padding = 'md',
    className = '',
}: AppSectionProps) {
    return (
        <AppCard variant={variant} padding="none" className={`overflow-hidden ${className}`}>
            {/* Section header */}
            <div
                className="flex items-center justify-between gap-4 px-5 py-4"
                style={{ borderBottom: '1px solid var(--app-border)' }}
            >
                <div>
                    <h3
                        className="text-sm font-black tracking-tight"
                        style={{ color: 'var(--app-foreground)' }}
                    >
                        {title}
                    </h3>
                    {description && (
                        <p
                            className="text-xs font-medium mt-0.5"
                            style={{ color: 'var(--app-muted-foreground)' }}
                        >
                            {description}
                        </p>
                    )}
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
            {/* Section body */}
            <div className={PADDING_CLASSES[padding]}>
                {children}
            </div>
        </AppCard>
    );
}
