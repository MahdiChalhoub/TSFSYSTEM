'use client';

import { useAdmin } from '@/context/AdminContext';
import {
    ShoppingCart, Warehouse, Landmark, Users, Globe, Bot,
    Settings, ShoppingBag, Box, Wallet, Tag, BarChart3,
    ShieldCheck, Briefcase, Truck, Zap, LayoutDashboard,
    Star, ArrowRight, Sparkles
} from 'lucide-react';
import React from 'react';

const QUICK_ACCESS = [
    { title: 'POS Terminal', icon: ShoppingCart, path: '/sales', color: '#10B981' },
    { title: 'POS Config', icon: Settings, path: '/sales/pos-settings', color: '#6366F1' },
    { title: 'Products', icon: Tag, path: '/products', color: '#F59E0B' },
    { title: 'Purchases', icon: Wallet, path: '/purchases/purchase-orders', color: '#8B5CF6' },
    { title: 'Warehouses', icon: Box, path: '/inventory/warehouses', color: '#EC4899' },
    { title: 'Accounts', icon: Landmark, path: '/finance/chart-of-accounts', color: '#0EA5E9' },
    { title: 'Contacts', icon: Users, path: '/crm/contacts', color: '#14B8A6' },
    { title: 'Ledger', icon: BarChart3, path: '/finance/ledger', color: '#F97316' },
    { title: 'Orders', icon: ShoppingBag, path: '/sales/quotations', color: '#EF4444' },
    { title: 'HR', icon: ShieldCheck, path: '/hr/employees', color: '#84CC16' },
    { title: 'AI Chat', icon: Bot, path: '/mcp/chat', color: '#A855F7' },
    { title: 'Settings', icon: Settings, path: '/settings', color: '#64748B' },
];

export function Launchpad() {
    const { openTab } = useAdmin();

    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            {/* Header — compact */}
            <div className="text-center mb-5">
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
                    style={{
                        background: 'linear-gradient(135deg, var(--app-primary), var(--app-primary-dark))',
                        boxShadow: '0 4px 16px var(--app-primary-glow)',
                    }}
                >
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-lg font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                    Quick Access
                </h1>
            </div>

            {/* Compact grid — 6 columns on large, 4 on medium, 3 on small */}
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 w-full max-w-3xl">
                {QUICK_ACCESS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.path}
                            onClick={() => openTab(item.title, item.path)}
                            className="group flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]"
                            style={{
                                background: 'var(--app-surface)',
                                borderColor: 'var(--app-border)',
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = item.color + '50';
                                e.currentTarget.style.boxShadow = `0 4px 16px ${item.color}20`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = 'var(--app-border)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-transform group-hover:scale-110"
                                style={{ background: item.color + '18', color: item.color }}
                            >
                                <Icon size={16} />
                            </div>
                            <span className="text-[11px] font-bold tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                                {item.title}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
