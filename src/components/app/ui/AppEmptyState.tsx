'use client';
import React from 'react';

/**
 * AppEmptyState — standardised empty state for every list page.
 *
 * Every module using this ensures:
 *   - same layout geometry across Finance / Inventory / CRM empty states
 *   - same icon size (48px)
 *   - same typography hierarchy
 *   - theme-aware colors
 *
 * Usage:
 *   <AppEmptyState
 *     icon={<Package size={48} />}
 *     title="No products yet"
 *     description="Add your first product to get started."
 *     action={<AppButton>Add Product</AppButton>}
 *   />
 *
 *   // With illustration image:
 *   <AppEmptyState
 *     illustration="/assets/empty-orders.svg"
 *     title="No orders"
 *   />
 */

interface AppEmptyStateProps {
    icon?: React.ReactNode;
    illustration?: string;  // URL to SVG/PNG illustration
    title: string;
    description?: string;
    action?: React.ReactNode;
    compact?: boolean;      // reduce padding for use inside panels
    className?: string;
}

export function AppEmptyState({
    icon,
    illustration,
    title,
    description,
    action,
    compact = false,
    className = '',
}: AppEmptyStateProps) {
    return (
        <div
            className={[
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-10 px-6' : 'py-20 px-8',
                className,
            ].join(' ')}
        >
            {/* Illustration or icon */}
            {illustration ? (
                <img
                    src={illustration}
                    alt=""
                    className={compact ? 'w-24 h-24 mb-4' : 'w-36 h-36 mb-6'}
                    style={{ opacity: 0.7 }}
                />
            ) : icon ? (
                <div
                    className={[
                        'flex items-center justify-center rounded-2xl mb-4 flex-shrink-0',
                        compact ? 'w-12 h-12' : 'w-16 h-16',
                    ].join(' ')}
                    style={{
                        background: 'var(--app-primary-light)',
                        color: 'var(--app-primary)',
                    }}
                >
                    {icon}
                </div>
            ) : null}

            {/* Title */}
            <h3
                className={compact ? 'text-sm font-black tracking-tight mb-1' : 'text-lg font-black tracking-tight mb-2'}
                style={{ color: 'var(--app-text)' }}
            >
                {title}
            </h3>

            {/* Description */}
            {description && (
                <p
                    className={compact ? 'text-xs font-medium mb-4 max-w-xs' : 'text-sm font-medium mb-6 max-w-sm'}
                    style={{ color: 'var(--app-text-muted)' }}
                >
                    {description}
                </p>
            )}

            {/* Action */}
            {action && (
                <div className={compact ? 'mt-3' : 'mt-4'}>
                    {action}
                </div>
            )}
        </div>
    );
}
