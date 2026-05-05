'use client';
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * AppKpiCard — reusable KPI stat card for Dashboard, Finance, Inventory.
 *
 * Guarantees visual consistency across ALL module pages.
 * Uses only --app-* vars — re-skins with every theme switch.
 *
 * Usage:
 *   <AppKpiCard
 *     label="Total Revenue"
 *     value="₣ 4,280,000"
 *     icon={<DollarSign size={22} />}
 *     trend={{ value: 12.4, direction: 'up', label: 'vs last month' }}
 *     accent="#10B981"
 *   />
 */

interface KpiTrend {
    value: number;    // e.g. 12.4 = 12.4%
    direction: 'up' | 'down' | 'flat';
    label?: string;   // e.g. "vs last month"
}

interface AppKpiCardProps {
    label: string;
    value: string | React.ReactNode;
    icon: React.ReactNode;
    trend?: KpiTrend;
    accent?: string;  // hex color for icon badge bg / glow
    loading?: boolean;
    footnote?: string;
    className?: string;
    onClick?: () => void;
}

const TREND_CONFIG = {
    up: { icon: TrendingUp, color: 'var(--app-success)' },
    down: { icon: TrendingDown, color: 'var(--app-error)' },
    flat: { icon: Minus, color: 'var(--app-muted-foreground)' },
};

export function AppKpiCard({
    label,
    value,
    icon,
    trend,
    accent,
    loading = false,
    footnote,
    className = '',
    onClick,
}: AppKpiCardProps) {
    const iconBg = accent ?? 'var(--app-primary)';
    const iconGlow = accent ? `${accent}40` : 'var(--app-primary-glow)';
    const TrendIcon = trend ? TREND_CONFIG[trend.direction].icon : null;
    const trendColor = trend ? TREND_CONFIG[trend.direction].color : '';

    if (loading) {
        return (
            <div className={`app-kpi-card ${className}`}>
                <div className="app-skeleton w-10 h-10 rounded-xl mb-3" />
                <div className="app-skeleton h-3 w-24 mb-2 rounded" />
                <div className="app-skeleton h-8 w-32 mb-2 rounded" />
                <div className="app-skeleton h-3 w-20 rounded" />
            </div>
        );
    }

    return (
        <div
            className={`app-kpi-card app-card-hover animate-stagger ${onClick ? 'cursor-pointer' : ''} ${className}`}
            onClick={onClick}
        >
            {/* Decorative top-right glow */}
            <div
                className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 pointer-events-none"
                style={{ background: `radial-gradient(circle, ${iconBg} 0%, transparent 70%)` }}
            />

            {/* Icon */}
            <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 flex-shrink-0"
                style={{
                    background: iconBg,
                    boxShadow: `0 4px 14px ${iconGlow}`,
                    color: '#ffffff',
                }}
            >
                {icon}
            </div>

            {/* Label */}
            <p
                className="text-[11px] font-black uppercase tracking-widest mb-1"
                style={{ color: 'var(--app-muted-foreground)' }}
            >
                {label}
            </p>

            {/* Value */}
            <p
                className="text-2xl font-black tracking-tight leading-none mb-2 animate-counter"
                style={{ color: 'var(--app-foreground)', fontFamily: 'var(--app-font)' }}
            >
                {value}
            </p>

            {/* Trend */}
            {trend && TrendIcon && (
                <div className="flex items-center gap-1">
                    <TrendIcon size={12} style={{ color: trendColor, flexShrink: 0 }} />
                    <span
                        className="text-[11px] font-bold"
                        style={{ color: trendColor }}
                    >
                        {trend.direction !== 'flat' && (trend.direction === 'up' ? '+' : '-')}
                        {Math.abs(trend.value).toFixed(1)}%
                    </span>
                    {trend.label && (
                        <span
                            className="text-[11px] font-medium"
                            style={{ color: 'var(--app-muted-foreground)' }}
                        >
                            {trend.label}
                        </span>
                    )}
                </div>
            )}

            {/* Footnote */}
            {footnote && (
                <p
                    className="text-[10px] font-medium mt-1"
                    style={{ color: 'var(--app-muted-foreground)' }}
                >
                    {footnote}
                </p>
            )}
        </div>
    );
}

/**
 * AppKpiRow — standard 4-column KPI row used on every dashboard page.
 * Children should be AppKpiCard components.
 *
 * Usage:
 *   <AppKpiRow>
 *     <AppKpiCard ... />
 *     <AppKpiCard ... />
 *     <AppKpiCard ... />
 *     <AppKpiCard ... />
 *   </AppKpiRow>
 */
export function AppKpiRow({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {React.Children.map(children, (child, i) => {
                if (!React.isValidElement<{ style?: React.CSSProperties }>(child)) return child;
                const prevStyle = (child.props as { style?: React.CSSProperties }).style ?? {};
                return React.cloneElement(child, {
                    style: { ...prevStyle, '--i': i } as React.CSSProperties,
                });
            })}
        </div>
    );
}
