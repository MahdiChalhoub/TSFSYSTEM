// @ts-nocheck
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
 Diamond: { label: 'Imperial Diamond', color: 'emerald', icon: Gem },
 Gold: { label: 'Elite Gold', color: 'emerald', icon: Trophy },
 Silver: { label: 'Preferred Silver', color: 'slate', icon: Star },
 Bronze: { label: 'Standard Bronze', color: 'slate', icon: Target },
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
 toast.error("Failed to load data");
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
 <div className="app-page flex items-center gap-4">
 <div className="w-10 h-10 rounded-xl bg-app-background border border-app-border text-app-muted-foreground flex items-center justify-center font-black text-xs shadow-inner">
 {(r.name || '?').charAt(0)}
 </div>
 <div>
 <div className="font-bold text-app-foreground uppercase tracking-tight">{r.name || 'Anonymous Entity'}</div>
 <div className="text-[10px] font-medium text-app-muted-foreground">{r.phone || r.email || 'No Metadata'}</div>
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
 orders: r => <Badge variant="secondary" className="bg-app-surface-2 text-app-muted-foreground border-0 font-black text-[10px]">{r.orderCount} REQ</Badge>,
 revenue: r => <span className="font-black text-app-success tracking-tighter text-[15px]">{fmt(r.totalSpent)}</span>,
 recency: r => {
 const isNever = r.daysSinceLast >= 999;
 const badgeStyle = isNever ? 'bg-rose-100 text-rose-700' :
 r.daysSinceLast < 7 ? 'bg-app-primary-light text-app-success' :
 r.daysSinceLast < 30 ? 'bg-app-warning-bg text-app-warning' : 'bg-app-surface-2 text-app-muted-foreground';
 return (
 <Badge variant="secondary" className={`font-black text-[10px] uppercase tracking-widest border-0 ${badgeStyle}`}>
 {isNever ? 'Dormant' : `${r.daysSinceLast}D AGO`}
 </Badge>
 );
 },
 last_order: r => (
 <div className="flex flex-col items-end">
 <span className="text-xs font-mono font-bold text-app-muted-foreground">
 {r.lastOrderDate ? new Date(r.lastOrderDate).toLocaleDateString() : '—'}
 </span>
 <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Overview</span>
 </div>
 )
 };
 return { ...c, render: renderers[c.key] };
 });

 return (
 <div className="page-container animate-in fade-in duration-700">
 {/* Header: Strategic Intelligence Console */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
          <BarChart3 size={32} className="text-app-primary" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">CRM</p>
          <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
            Customer <span className="text-app-primary">Insights</span>
          </h1>
        </div>
      </div>
    </header>

 {/* Strategic KPIs */}
 <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
 <div className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex items-center gap-6">
 <div className="w-14 h-14 rounded-2xl bg-app-background text-app-muted-foreground flex items-center justify-center shadow-inner shadow-app-border/20 transition-transform group-hover:-rotate-6">
 <Users size={28} />
 </div>
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Total Entities</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter mt-1">{contacts.length}</h2>
 </div>
 </div>
 </div>

 <div className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex items-center gap-6">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:-rotate-6">
 <Zap size={28} />
 </div>
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Active (30D)</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter mt-1">{activeCustomers}</h2>
 </div>
 </div>
 </div>

 <div className="rounded-[2.5rem] bg-app-surface border-0 shadow-2xl shadow-app-border/20 overflow-hidden group hover:scale-[1.02] transition-all duration-500 relative p-8 text-app-foreground min-h-[120px]">
 <div className="absolute top-0 right-0 w-32 h-32 bg-app-primary/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-app-primary/20 transition-colors" />
 <div className="flex items-center gap-6 relative z-10">
 <div className="w-14 h-14 rounded-2xl bg-app-foreground/10 text-app-foreground flex items-center justify-center shadow-2xl backdrop-blur-md">
 <DollarSign size={28} className="text-app-primary" />
 </div>
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Aggregate Revenue</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter mt-1">{fmt(totalRevenue).replace('.00', '')}</h2>
 </div>
 </div>
 </div>

 <div className="card-premium group hover:shadow-2xl hover:shadow-app-primary/20 transition-all duration-500 overflow-hidden relative border-0 p-8">
 <div className="flex items-center gap-6">
 <div className="w-14 h-14 rounded-2xl bg-app-primary-light text-app-primary flex items-center justify-center shadow-inner shadow-emerald-100 transition-transform group-hover:-rotate-6">
 <ArrowUpRight size={28} />
 </div>
 <div>
 <p className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest leading-none mb-1">Avg Yield</p>
 <h2 className="text-4xl font-black text-app-foreground tracking-tighter mt-1">{fmt(avgOrderVal).replace('.00', '')}</h2>
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
 <div className="lg:col-span-1 space-y-8">
 <Card className="rounded-[3rem] border border-app-border bg-app-foreground/70 backdrop-blur-xl shadow-[0_10px_50px_var(--app-border)] overflow-hidden sticky top-6">
 <div className="bg-app-surface-2/50 border-b border-app-border p-8 flex items-center justify-between">
 <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-app-muted-foreground">Equity Tiers</h3>
 <Crown size={16} className="text-app-primary" />
 </div>
 <CardContent className="p-8 space-y-6">
 {['Diamond', 'Gold', 'Silver', 'Bronze'].map(tier => {
 const s = TIER_STYLE[tier] || TIER_STYLE.Bronze;
 const count = enriched.filter(c => c.tier === tier).length;
 const pct = enriched.length > 0 ? (count / enriched.length * 100) : 0;
 const Icon = s.icon;
 const isEmerald = s.color === 'emerald';
 return (
 <div key={tier} className="p-6 rounded-[2rem] bg-app-surface-2/50 border border-app-border/50 group hover:border-app-success hover:bg-app-surface transition-all duration-300">
 <div className="flex items-center justify-between mb-4">
 <div className={`w-12 h-12 rounded-2xl ${isEmerald ? 'bg-app-success' : 'bg-app-border'} text-app-foreground flex items-center justify-center shadow-lg transition-transform group-hover:scale-110`}>
 <Icon size={24} className={isEmerald ? 'text-app-foreground' : 'text-app-muted-foreground'} />
 </div>
 <Badge variant="outline" className="text-[10px] font-black text-app-muted-foreground border-app-border rounded-full py-1 px-3 group-hover:border-app-success/30 group-hover:text-app-primary">
 {pct.toFixed(0)}% SHARE
 </Badge>
 </div>
 <h4 className="text-[11px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{s.label}</h4>
 <p className="text-3xl font-black text-app-foreground tracking-tighter">{count} <span className="text-sm font-black text-app-muted-foreground uppercase tracking-widest ml-1">UNITS</span></p>
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
