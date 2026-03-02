'use client';

/**
 * SalesWidgets — themed widget components for Sales module
 * =========================================================
 * All components use --app-* CSS variables for full theme-engine
 * compatibility (5 themes: Midnight, Ivory, Neon, Savane, Arctic).
 *
 * Exports:
 *   SalesStatsWidget        — Total Sales KPI card
 *   SalesActiveOrdersWidget — Active Orders KPI card
 *   SalesRecentActivity     — Scrollable recent sales feed
 *   POSQuickAction          — CTA banner linking to the POS terminal
 */

import React from 'react';
import { ShoppingCart, TrendingUp, DollarSign, Clock, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// ─── SalesStatsWidget ────────────────────────────────────────────────────────

export const SalesStatsWidget = ({ data }: { data: Record<string, any> }) => {
    const value = data?.totalSales || 0;
    return (
        <div
            className="p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden rounded-2xl transition-all hover:shadow-lg"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 1px 4px var(--app-shadow)',
            }}
        >
            <div className="flex justify-between items-start z-10">
                <div>
                    <p
                        className="text-sm font-medium mb-2"
                        style={{ color: 'var(--app-text-muted)' }}
                    >
                        Total Sales
                    </p>
                    <h3
                        className="text-3xl font-bold tracking-tight"
                        style={{ color: 'var(--app-text)' }}
                    >
                        ${value.toLocaleString()}
                    </h3>
                </div>
                <div
                    className="p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300"
                    style={{
                        background: 'var(--app-accent-soft)',
                        color: 'var(--app-accent)',
                    }}
                >
                    <DollarSign size={24} />
                </div>
            </div>
            <div
                className="mt-4 flex items-center text-sm font-medium z-10"
                style={{ color: 'var(--app-accent)' }}
            >
                <TrendingUp size={16} className="mr-1.5" />
                <span>Real-time tracking</span>
            </div>
            {/* Decorative glow */}
            <div
                className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl"
                style={{ background: 'var(--app-accent)' }}
            />
        </div>
    );
};

// ─── SalesActiveOrdersWidget ─────────────────────────────────────────────────

export const SalesActiveOrdersWidget = ({ data }: { data: Record<string, any> }) => {
    const value = data?.activeOrders || 0;
    return (
        <div
            className="p-6 flex flex-col justify-between group cursor-default min-h-[160px] relative overflow-hidden rounded-2xl transition-all hover:shadow-lg"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 1px 4px var(--app-shadow)',
            }}
        >
            <div className="flex justify-between items-start z-10">
                <div>
                    <p
                        className="text-sm font-medium mb-2"
                        style={{ color: 'var(--app-text-muted)' }}
                    >
                        Active Orders
                    </p>
                    <h3
                        className="text-3xl font-bold tracking-tight"
                        style={{ color: 'var(--app-text)' }}
                    >
                        {value.toLocaleString()}
                    </h3>
                </div>
                <div
                    className="p-3 rounded-2xl transition-transform group-hover:scale-110 duration-300"
                    style={{
                        background: 'var(--app-secondary-soft, color-mix(in srgb, var(--app-accent) 15%, var(--app-surface)))',
                        color: 'var(--app-secondary, var(--app-accent))',
                    }}
                >
                    <ShoppingCart size={24} />
                </div>
            </div>
            <div
                className="mt-4 flex items-center text-sm font-medium z-10"
                style={{ color: 'var(--app-secondary, var(--app-accent))' }}
            >
                <TrendingUp size={16} className="mr-1.5" />
                <span>Processing now</span>
            </div>
            {/* Decorative glow */}
            <div
                className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full opacity-10 blur-2xl"
                style={{ background: 'var(--app-secondary, var(--app-accent))' }}
            />
        </div>
    );
};

// ─── SalesRecentActivity ─────────────────────────────────────────────────────

export const SalesRecentActivity = ({ data }: { data: Record<string, any> }) => {
    const validSales = Array.isArray(data?.latestSales) ? data.latestSales : [];

    return (
        <div
            className="p-0 overflow-hidden h-full min-h-[400px] flex flex-col rounded-2xl"
            style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
                boxShadow: '0 1px 4px var(--app-shadow)',
            }}
        >
            {/* Header */}
            <div
                className="p-5 flex justify-between items-center"
                style={{
                    borderBottom: '1px solid var(--app-border)',
                    background: 'var(--app-surface-raised, var(--app-surface))',
                }}
            >
                <div className="flex items-center gap-2">
                    <Clock size={16} style={{ color: 'var(--app-accent)' }} />
                    <span
                        className="font-bold text-sm"
                        style={{ color: 'var(--app-text)' }}
                    >
                        Recent Sales
                    </span>
                </div>
            </div>

            {/* Feed */}
            <div className="overflow-y-auto p-2 space-y-1 flex-1">
                {validSales.map((sale: Record<string, any>, i: number) => (
                    <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-xl group cursor-pointer transition-colors"
                        style={{ ['--hover-bg' as string]: 'var(--app-surface-raised)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--app-surface-raised, #f9f9f9)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform"
                                style={{
                                    background: 'var(--app-accent-soft)',
                                    color: 'var(--app-accent)',
                                }}
                            >
                                #{sale.id}
                            </div>
                            <div>
                                <p
                                    className="text-sm font-bold"
                                    style={{ color: 'var(--app-text)' }}
                                >
                                    {sale.contact?.name || 'Walk-in Customer'}
                                </p>
                                <p
                                    className="text-xs"
                                    style={{ color: 'var(--app-text-muted)' }}
                                >
                                    {new Date(sale.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p
                                className="text-sm font-bold"
                                style={{ color: 'var(--app-text)' }}
                            >
                                ${Number(sale.totalAmount).toFixed(2)}
                            </p>
                            <div
                                className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ml-auto w-fit font-medium"
                                style={{
                                    background: 'var(--app-accent-soft)',
                                    color: 'var(--app-accent)',
                                }}
                            >
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: 'var(--app-accent)' }}
                                />
                                {sale.status}
                            </div>
                        </div>
                    </div>
                ))}

                {validSales.length === 0 && (
                    <div
                        className="text-center py-10 text-sm"
                        style={{ color: 'var(--app-text-muted)' }}
                    >
                        No recent sales recorded.
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── POSQuickAction ───────────────────────────────────────────────────────────

export const POSQuickAction = () => {
    return (
        <Link href="/sales" className="block w-full group">
            <div
                className="relative overflow-hidden rounded-3xl p-8 text-white shadow-xl transition-all hover:shadow-2xl hover:scale-[1.01]"
                style={{ background: 'linear-gradient(135deg, var(--app-accent), color-mix(in srgb, var(--app-accent) 70%, #059669))' }}
            >
                <div className="relative z-10 flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                                <ShoppingCart size={24} className="text-white" />
                            </div>
                            <h3 className="text-2xl font-bold">Open POS Terminal</h3>
                        </div>
                        <p className="text-white/80 max-w-xl text-lg font-medium">
                            Start a new sales session, manage checkout, and process transactions efficiently.
                        </p>
                    </div>
                    <div className="bg-white/20 p-3 rounded-full backdrop-blur-md transition-transform group-hover:translate-x-1">
                        <ChevronRight size={24} />
                    </div>
                </div>
                {/* Decorative overlays */}
                <div className="absolute top-0 right-0 h-full w-1/2 bg-gradient-to-l from-white/10 to-transparent" />
                <div className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            </div>
        </Link>
    );
};