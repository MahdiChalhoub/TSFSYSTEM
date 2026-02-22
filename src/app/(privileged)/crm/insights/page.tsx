'use client';

import { useState, useEffect, useMemo, useCallback } from "react";
import { TypicalListView, type ColumnDef } from '@/components/common/TypicalListView';
import { TypicalFilter } from '@/components/common/TypicalFilter';
import { useListViewSettings } from '@/hooks/useListViewSettings';
import { useCurrency } from '@/lib/utils/currency';
import { safeDateSort } from '@/lib/utils/safe-date';
import { toast } from 'sonner';
import {
    Users, DollarSign, ShoppingCart, TrendingUp, Search, Star, Crown,
    Lightbulb, BarChart3, Clock, Trophy, Target, ArrowUpRight, Zap, Gem
} from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type EnrichedContact = Record<string, any>;

const TIER_STYLE: Record<string, { label: string; color: string; icon: any }> = {
    Diamond: { label: 'Imperial Diamond', color: 'violet', icon: Gem },
    Gold: { label: 'Elite Gold', color: 'amber', icon: Trophy },
    Silver: { label: 'Preferred Silver', color: 'slate', icon: Star },
    Bronze: { label: 'Standard Bronze', color: 'orange', icon: Target },
};

const ALL_COLUMNS: ColumnDef<EnrichedContact>[] = [
    { key: 'customer', label: 'Client Identity', sortable: true, alwaysVisible: true },
    { key: 'tier', label: 'Priority Tier', sortable: true },
    { key: 'orders', label: 'Stream Volume', align: 'center', sortable: true },
    { key: 'revenue', label: 'Lifetime Value', align: 'right', sortable: true },
    { key: 'recency', label: 'Engagement Pulse', align: 'center' },
    { key: 'last_order', label: 'Last Activity', align: 'right' },
];

export default function StrategicRelationshipIntelligencePage() {
    const { fmt } = useCurrency();
    const settings = useListViewSettings('crm_insights_v3', {
        columns: ALL_COLUMNS.map(c => c.key),
        pageSize: 25,
        sortKey: 'revenue',
        sortDir: 'desc',
    });

    const [contacts, setContacts] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => { loadData() }, []);

    async function loadData() {
        setLoading(true);
        try {
            const { erpFetch } = await import("@/lib/erp-api");
            const [contactsData, ordersData] = await Promise.all([
                erpFetch('crm/contacts/'),
                erpFetch('pos/pos/'),
            ]);
            setContacts((Array.isArray(contactsData) ? contactsData : contactsData.results || [])
                .filter((c: any) => c.type === 'CLIENT' || c.type === 'CUSTOMER' || c.type === 'BOTH'));
            setOrders(Array.isArray(ordersData) ? ordersData : ordersData.results || []);
        } catch {
            toast.error("Relationship intelligence sync failed");
        } finally {
            setLoading(false);
        }
    }

    const enriched = useMemo(() => {
        return contacts.map(c => {
            const cOrders = orders.filter(o =>
                (o.contact === c.id || o.contact_id === c.id) && o.type === 'SALE'
            );
            const totalSpent = cOrders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
            const lastOrder = cOrders.sort((a, b) => (safeDateSort(b.created_at)) - (safeDateSort(a.created_at)))[0];

            const lastDate = lastOrder?.created_at ? new Date(lastOrder.created_at) : null;
            const daysSinceLast = lastDate ? Math.floor((Date.now() - lastDate.getTime()) / 86400000) : 999;

            let tier = 'Bronze';
            if (totalSpent > 5000000) tier = 'Diamond';
            else if (totalSpent > 2000000) tier = 'Gold';
            else if (totalSpent > 500000) tier = 'Silver';

            return {
                ...c,
                orderCount: cOrders.length,
                totalSpent,
                avgOrderValue: cOrders.length > 0 ? totalSpent / cOrders.length : 0,
                lastOrderDate: lastOrder?.created_at,
                daysSinceLast,
                tier,
            };
        });
    }, [contacts, orders]);

    const filtered = useMemo(() => {
        if (!search) return enriched;
        const s = search.toLowerCase();
        return enriched.filter(c =>
            (c.name || '').toLowerCase().includes(s) ||
            (c.email || '').toLowerCase().includes(s) ||
            (c.phone || '').toLowerCase().includes(s)
        );
    }, [enriched, search]);

    const totalRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0);
    const activeCustomers = enriched.filter(c => c.daysSinceLast < 30).length;
    const avgOrderVal = enriched.length > 0 ? enriched.reduce((s, c) => s + c.avgOrderValue, 0) / (enriched.filter(c => c.orderCount > 0).length || 1) : 0;

    const columns: ColumnDef<EnrichedContact>[] = ALL_COLUMNS.map(c => {
        const renderers: Record<string, (r: EnrichedContact) => React.ReactNode> = {
            customer: r => (
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-black text-xs">
                        {(r.name || '?').charAt(0)}
                    </div>
                    <div>
                        <div className="font-bold text-gray-900 uppercase tracking-tight">{r.name || 'Anonymous Entity'}</div>
                        <div className="text-[10px] font-medium text-gray-400">{r.phone || r.email || 'No Metadata'}</div>
                    </div>
                </div>
            ),
            tier: r => {
                const s = TIER_STYLE[r.tier] || TIER_STYLE.Bronze;
                const Icon = s.icon;
                return (
                    <Badge variant="outline" className={`border-0 bg-${s.color}-50 text-${s.color}-600 font-black text-[10px] uppercase tracking-tighter flex items-center gap-1.5`}>
                        <Icon size={12} className={`text-${s.color}-500`} />
                        {s.label}
                    </Badge>
                );
            },
            orders: r => <Badge variant="secondary" className="bg-stone-100 text-stone-600 border-0 font-black text-[10px]">{r.orderCount} REQ</Badge>,
            revenue: r => <span className="font-black text-amber-600">{fmt(r.totalSpent)}</span>,
            recency: r => {
                const isNever = r.daysSinceLast >= 999;
                const badgeStyle = isNever ? 'bg-rose-100 text-rose-700' :
                    r.daysSinceLast < 7 ? 'bg-emerald-100 text-emerald-700' :
                        r.daysSinceLast < 30 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600';
                return (
                    <Badge variant="secondary" className={`font-black text-[10px] uppercase tracking-widest border-0 ${badgeStyle}`}>
                        {isNever ? 'Dormant' : `${r.daysSinceLast}D AGO`}
                    </Badge>
                );
            },
            last_order: r => (
                <div className="flex flex-col items-end">
                    <span className="text-xs font-mono font-bold text-gray-500">
                        {r.lastOrderDate ? new Date(r.lastOrderDate).toLocaleDateString() : '—'}
                    </span>
                    <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest">Global Protocol</span>
                </div>
            )
        };
        return { ...c, render: renderers[c.key] };
    });

    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-200">
                            <Lightbulb size={28} className="text-white" />
                        </div>
                        Strategic <span className="text-amber-600">Intelligence</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Global Relationship Equity & Analytics</p>
                </div>
                <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    <span className="text-[10px] font-black uppercase text-amber-700 tracking-widest">Cognitive Engine Online</span>
                </div>
            </header>

            {/* Strategic KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Users size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Total Entities</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{contacts.length}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <Zap size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Active (30D)</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{activeCustomers}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <DollarSign size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Aggregate Revenue</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(totalRevenue)}</h2>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all">
                    <CardContent className="p-6 flex items-center gap-5">
                        <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <ArrowUpRight size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider text-left">Avg Yield</p>
                            <h2 className="text-3xl font-black text-gray-900 mt-0.5">{fmt(avgOrderVal)}</h2>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-6">
                    <Card className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden sticky top-6">
                        <CardHeader className="bg-stone-50/50 border-b border-stone-100 p-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-stone-400">Equity Tiers</CardTitle>
                            <Crown size={14} className="text-stone-300" />
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {['Diamond', 'Gold', 'Silver', 'Bronze'].map(tier => {
                                const s = TIER_STYLE[tier] || TIER_STYLE.Bronze;
                                const count = enriched.filter(c => c.tier === tier).length;
                                const pct = enriched.length > 0 ? (count / enriched.length * 100) : 0;
                                const Icon = s.icon;
                                return (
                                    <div key={tier} className="p-4 rounded-[2rem] bg-gray-50 border border-gray-100 group hover:border-amber-200 transition-all">
                                        <div className="flex items-center justify-between mb-3">
                                            <div className={`w-10 h-10 rounded-xl bg-${s.color}-100 text-${s.color}-600 flex items-center justify-center`}>
                                                <Icon size={20} />
                                            </div>
                                            <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{pct.toFixed(0)}% SHARE</span>
                                        </div>
                                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-1">{s.label}</h4>
                                        <p className="text-2xl font-black text-stone-700">{count} <span className="text-xs text-stone-300">UNITS</span></p>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-3 space-y-6">
                    <TypicalListView<EnrichedContact>
                        title="Equity Ledger"
                        data={filtered}
                        loading={loading}
                        getRowId={r => r.id}
                        columns={columns}
                        visibleColumns={settings.visibleColumns}
                        onToggleColumn={settings.toggleColumn}
                        className="rounded-[2.5rem] border-0 shadow-sm overflow-hidden"
                        pageSize={settings.pageSize}
                        onPageSizeChange={settings.setPageSize}
                        sortKey={settings.sortKey}
                        sortDir={settings.sortDir}
                        onSort={k => settings.setSort(k)}
                        actions={{
                            onEdit: (r) => toast.info(`Diving into cognitive insights for ${r.name}`),
                        }}
                    >
                        <TypicalFilter
                            search={{ placeholder: 'Search Client Identities or Tiers...', value: search, onChange: setSearch }}
                        />
                    </TypicalListView>
                </div>
            </div>
        </div>
    );
}
