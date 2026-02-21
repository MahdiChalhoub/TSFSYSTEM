'use client';

import { useEffect, useState } from 'react';
import { BarChart3, ShoppingCart, Eye, DollarSign, TrendingUp, Package } from 'lucide-react';

interface Stats {
    total_orders: number;
    monthly_orders: number;
    monthly_revenue: string;
    pending: number;
    processing: number;
    shipped: number;
    delivered: number;
}

export default function EcommerceDashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);

    useEffect(() => {
        // Stats would come from the ecommerce API once fully wired
        setStats({
            total_orders: 0,
            monthly_orders: 0,
            monthly_revenue: '0.00',
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
        });
    }, []);

    const cards = [
        { title: 'Total Orders', value: stats?.total_orders ?? 0, icon: ShoppingCart, color: '#10b981' },
        { title: 'Monthly Revenue', value: `$${stats?.monthly_revenue ?? '0.00'}`, icon: DollarSign, color: '#6366f1' },
        { title: 'Pending', value: stats?.pending ?? 0, icon: Package, color: '#f59e0b' },
        { title: 'Processing', value: stats?.processing ?? 0, icon: TrendingUp, color: '#3b82f6' },
        { title: 'Shipped', value: stats?.shipped ?? 0, icon: Eye, color: '#8b5cf6' },
        { title: 'Delivered', value: stats?.delivered ?? 0, icon: BarChart3, color: '#10b981' },
    ];

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Storefront Overview</h1>
                <p style={{ color: '#64748b', marginTop: '0.25rem' }}>Monitor your eCommerce performance and storefront activity.</p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '1.25rem',
            }}>
                {cards.map((card) => (
                    <div key={card.title} style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 500 }}>{card.title}</span>
                            <card.icon size={20} color={card.color} />
                        </div>
                        <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{card.value}</span>
                    </div>
                ))}
            </div>

            <div style={{
                marginTop: '2rem',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '2rem',
                textAlign: 'center',
                color: '#94a3b8',
            }}>
                <BarChart3 size={48} style={{ margin: '0 auto 1rem' }} />
                <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>Analytics Coming Soon</p>
                <p>Order trends, conversion rates, and revenue charts will appear here.</p>
            </div>
        </div>
    );
}
