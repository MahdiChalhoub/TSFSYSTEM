'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * AppPageHeader — standard page header for ALL module pages.
 *
 * Enforces DESIGN_CRITERIA.md Section 2 typography standards.
 * Every module page MUST use this instead of building custom headers.
 *
 * Usage:
 *   <AppPageHeader
 *     icon={<Store size={28} />}
 *     title="Products"
 *     accentWord="Products"
 *     subtitle="Inventory Management Engine"
 *     backHref="/dashboard"
 *     actions={<AppButton>Add Product</AppButton>}
 *   />
 *
 *   // The title renders as: "All <span accent>Products</span>"
 *   // If accentWord is set, that word gets primary color.
 *   // Otherwise the entire title is rendered plainly.
 */

interface AppPageHeaderProps {
    icon: React.ReactNode;
    title: string;
    accentWord?: string;   // The word in the title that gets --app-primary color
    subtitle?: string;
    backHref?: string;
    actions?: React.ReactNode;
    badge?: React.ReactNode;  // e.g. <AppBadge variant="new">NEW</AppBadge>
    className?: string;
}

export function AppPageHeader({
    icon,
    title,
    accentWord,
    subtitle,
    backHref,
    actions,
    badge,
    className = '',
}: AppPageHeaderProps) {
    // Render title with optional accent word
    const renderTitle = () => {
        if (!accentWord) {
            return (
                <span style={{ color: 'var(--app-foreground)' }}>{title}</span>
            );
        }
        const idx = title.indexOf(accentWord);
        if (idx === -1) return <span style={{ color: 'var(--app-foreground)' }}>{title}</span>;
        const before = title.slice(0, idx);
        const after = title.slice(idx + accentWord.length);
        return (
            <>
                {before && <span style={{ color: 'var(--app-foreground)' }}>{before}</span>}
                <span style={{ color: 'var(--app-primary)' }}>{accentWord}</span>
                {after && <span style={{ color: 'var(--app-foreground)' }}>{after}</span>}
            </>
        );
    };

    return (
        <header className={`animate-fade-in-up ${className}`}>
            {/* Back link */}
            {backHref && (
                <Link
                    href={backHref}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4 transition-opacity hover:opacity-70"
                    style={{ color: 'var(--app-muted-foreground)' }}
                >
                    <ArrowLeft size={14} />
                    Back
                </Link>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: icon + title + subtitle */}
                <div className="flex items-center gap-4">
                    {/* Icon badge */}
                    <div
                        className="w-14 h-14 rounded-[var(--app-radius)] flex items-center justify-center flex-shrink-0"
                        style={{
                            background: 'var(--app-primary)',
                            boxShadow: '0 4px 20px var(--app-primary-glow)',
                            color: '#ffffff',
                        }}
                    >
                        {icon}
                    </div>

                    <div>
                        {/* Title */}
                        <h1
                            className="text-4xl font-black tracking-tighter leading-none flex items-center gap-3"
                            style={{ fontFamily: 'var(--app-font-display)' }}
                        >
                            {renderTitle()}
                            {badge}
                        </h1>

                        {/* Subtitle */}
                        {subtitle && (
                            <p
                                className="text-[11px] font-black uppercase tracking-widest mt-1.5"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Right: action buttons */}
                {actions && (
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
