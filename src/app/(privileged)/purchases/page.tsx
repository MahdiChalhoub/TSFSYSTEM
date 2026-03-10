import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import {
    Package, Plus, Clock, BarChart3, Receipt, RotateCcw, ScrollText,
    Truck, FileText, TrendingUp, ShoppingBag, AlertTriangle,
    ArrowUpRight, Zap, CheckCircle2, CircleDollarSign,
} from 'lucide-react';
import { getCommercialContext } from '@/app/actions/commercial';
import { PurchasesRegistryClient } from './PurchasesRegistryClient';
import { AutoReplenishButton } from './AutoReplenishButton';

export const dynamic = 'force-dynamic';

async function getPurchaseOrders(searchParams?: { status?: string; query?: string }) {
    try {
        const query = new URLSearchParams();
        if (searchParams?.status) query.append('status', searchParams.status);
        if (searchParams?.query) query.append('query', searchParams.query);
        const url = `purchase-orders/${query.toString() ? `?${query.toString()}` : ''}`;
        return await erpFetch(url);
    } catch { return []; }
}

async function getLegacyPurchases(searchParams?: { status?: string; query?: string }) {
    try {
        const query = new URLSearchParams();
        query.append('type', 'PURCHASE');
        if (searchParams?.status) query.append('status', searchParams.status);
        if (searchParams?.query) query.append('query', searchParams.query);
        const data = await erpFetch(`orders/?${query.toString()}`);
        const results = Array.isArray(data) ? data : (data.results || []);
        return results.map((o: any) => ({
            ...o,
            po_number: o.invoice_number || o.ref_code || `PRCH-${o.id}`,
            supplier_display: o.contact_name || 'Legacy Supplier',
            is_legacy: true,
        }));
    } catch { return []; }
}

async function getPODashboard() {
    try { return await erpFetch('purchase-orders/dashboard/'); } catch { return null; }
}

export default async function PurchaseRegistryPage(props: {
    searchParams: Promise<{ status?: string; query?: string }>;
}) {
    const searchParams = await props.searchParams;
    const [advancedOrders, legacyOrders, dashboard, context] = await Promise.all([
        getPurchaseOrders(searchParams),
        getLegacyPurchases(searchParams),
        getPODashboard(),
        getCommercialContext(),
    ]);

    const normalizedAdvanced = Array.isArray(advancedOrders) ? advancedOrders : (advancedOrders?.results || []);
    const normalizedLegacy = Array.isArray(legacyOrders) ? legacyOrders : [];

    const allOrders = [
        ...normalizedAdvanced,
        ...normalizedLegacy,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const { tradeSubTypesEnabled, currency } = context;

    const rfqCount = (dashboard?.by_status?.DRAFT || 0) + normalizedLegacy.filter((o: any) => o.status === 'DRAFT').length;
    const pendingApproval = (dashboard?.pending_approval || 0) + normalizedLegacy.filter((o: any) => o.status === 'SUBMITTED').length;
    const awaitingReceipt = (dashboard?.awaiting_receipt || 0) + normalizedLegacy.filter((o: any) => ['ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)).length;
    const completedCount = normalizedAdvanced.filter((o: any) => o.status === 'COMPLETED').length + normalizedLegacy.filter((o: any) => o.status === 'COMPLETED').length;
    const legacyTotal = normalizedLegacy.reduce((acc: number, o: any) => acc + parseFloat(String(o.total_amount || 0)), 0);
    const totalValue = (dashboard?.total_value || 0) + legacyTotal;

    const navLinks = [
        { href: '/purchases/purchase-orders', label: 'Purchase Orders', icon: ScrollText, desc: 'Formal POs' },
        { href: '/purchases/new-order', label: 'New Order', icon: Plus, desc: 'Create PO', primary: true },
        { href: '/purchases/invoices', label: 'Invoices', icon: Receipt, desc: 'Supplier bills' },
        { href: '/purchases/receipts', label: 'Receipts', icon: Package, desc: 'Goods received' },
        { href: '/purchases/returns', label: 'Returns', icon: RotateCcw, desc: 'Purchase returns' },
        { href: '/purchases/sourcing', label: 'Sourcing', icon: BarChart3, desc: 'Supplier analytics' },
    ];

    return (
        <main className="animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-6">

                {/* ═══════════════════════════════════════════════════════════════
                    HEADER — Premium glassmorphism with gradient accent
                ═══════════════════════════════════════════════════════════════ */}
                <header className="relative overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-xl">
                    {/* Gradient accent bar */}
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-emerald-500" />

                    <div className="p-6 md:p-8">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10 shrink-0">
                                    <ShoppingBag size={26} className="text-indigo-500" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-app-muted-foreground">
                                        Supply Chain · Procurement
                                    </p>
                                    <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                                        Procurement <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Command</span>
                                    </h1>
                                    <p className="text-xs text-app-muted-foreground mt-0.5 hidden sm:block">
                                        Purchase Orders · Supplier Management · Reception Tracking
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <AutoReplenishButton />
                                <Link
                                    href="/purchases/new-order"
                                    className="flex items-center gap-2 px-6 h-11 rounded-xl font-black text-sm whitespace-nowrap transition-all shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 bg-gradient-to-r from-indigo-500 to-violet-500 text-white"
                                >
                                    <Plus size={16} /> New Purchase Order
                                </Link>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ═══════════════════════════════════════════════════════════════
                    KPI COMMAND STRIP — 4 premium stat cards
                ═══════════════════════════════════════════════════════════════ */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-label="Procurement statistics">
                    {/* Drafts */}
                    <div className="group relative overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-400/30">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-gray-500/10 flex items-center justify-center">
                                <FileText size={18} className="text-gray-500" />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-gray-400 px-2 py-0.5 rounded-full bg-gray-500/10">
                                {rfqCount > 0 ? 'Active' : 'Clear'}
                            </span>
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-black text-app-foreground tracking-tight">{rfqCount}</p>
                            <p className="text-[10px] font-bold text-app-muted-foreground mt-0.5">Draft Orders</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-gray-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Pending Approval */}
                    <div className="group relative overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-amber-400/30">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                                <Clock size={18} className="text-amber-500" />
                            </div>
                            {pendingApproval > 0 && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-amber-600 px-2 py-0.5 rounded-full bg-amber-500/10 animate-pulse">
                                    Action Required
                                </span>
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-black text-app-foreground tracking-tight">{pendingApproval}</p>
                            <p className="text-[10px] font-bold text-app-muted-foreground mt-0.5">Pending Approval</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Incoming Stock */}
                    <div className="group relative overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-400/30">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                                <Truck size={18} className="text-blue-500" />
                            </div>
                            {awaitingReceipt > 0 && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-blue-500 px-2 py-0.5 rounded-full bg-blue-500/10">
                                    In Pipeline
                                </span>
                            )}
                        </div>
                        <div className="mt-4">
                            <p className="text-3xl font-black text-app-foreground tracking-tight">{awaitingReceipt}</p>
                            <p className="text-[10px] font-bold text-app-muted-foreground mt-0.5">Incoming Stock</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Total Procurement */}
                    <div className="group relative overflow-hidden rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-sm p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-emerald-400/30">
                        <div className="flex items-start justify-between">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                                <CircleDollarSign size={18} className="text-emerald-500" />
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500 px-2 py-0.5 rounded-full bg-emerald-500/10">
                                Volume
                            </span>
                        </div>
                        <div className="mt-4">
                            <p className="text-2xl md:text-3xl font-black text-emerald-500 tracking-tight">
                                {Number(totalValue).toLocaleString()} <span className="text-xs font-bold text-app-muted-foreground">{currency}</span>
                            </p>
                            <p className="text-[10px] font-bold text-app-muted-foreground mt-0.5">Total Procurement</p>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-400/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                </section>

                {/* ═══════════════════════════════════════════════════════════════
                    QUICK NAV — Module pill navigation
                ═══════════════════════════════════════════════════════════════ */}
                <nav className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-none" aria-label="Purchase module navigation">
                    {navLinks.map(link => (
                        <Link key={link.href} href={link.href}
                            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all border shrink-0 ${link.primary
                                    ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/20 hover:border-indigo-500/40 hover:shadow-md hover:shadow-indigo-500/10'
                                    : 'bg-app-surface/60 border-app-border/40 hover:border-app-border hover:bg-app-surface hover:shadow-md'
                                }`}
                        >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${link.primary ? 'bg-indigo-500/20' : 'bg-app-background/60'
                                }`}>
                                <link.icon size={13} className={link.primary ? 'text-indigo-500' : 'text-app-muted-foreground group-hover:text-app-foreground transition-colors'} />
                            </div>
                            <div>
                                <div className={`text-[10px] font-black ${link.primary ? 'text-indigo-500' : 'text-app-foreground'}`}>
                                    {link.label}
                                </div>
                                <div className="text-[8px] font-semibold text-app-muted-foreground hidden sm:block">
                                    {link.desc}
                                </div>
                            </div>
                            <ArrowUpRight size={10} className={`ml-1 opacity-0 group-hover:opacity-100 transition-opacity ${link.primary ? 'text-indigo-500' : 'text-app-muted-foreground'}`} />
                        </Link>
                    ))}
                </nav>

                {/* ═══════════════════════════════════════════════════════════════
                    PIPELINE SUMMARY — Quick status strip
                ═══════════════════════════════════════════════════════════════ */}
                {allOrders.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mr-2">Pipeline</span>
                        {[
                            { label: 'Draft', status: 'DRAFT', count: rfqCount, color: 'text-gray-500 bg-gray-500/10 border-gray-500/20' },
                            { label: 'Submitted', status: 'SUBMITTED', count: pendingApproval, color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
                            { label: 'In Transit', status: 'IN_TRANSIT', count: normalizedAdvanced.filter((o: any) => o.status === 'IN_TRANSIT').length, color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
                            { label: 'Received', status: 'RECEIVED', count: normalizedAdvanced.filter((o: any) => o.status === 'RECEIVED').length, color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
                            { label: 'Completed', status: 'COMPLETED', count: completedCount, color: 'text-violet-500 bg-violet-500/10 border-violet-500/20' },
                        ].filter(s => s.count > 0).map(s => (
                            <Link key={s.status} href={`/purchases?status=${s.status}`}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black border transition-all hover:scale-105 ${s.color}`}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                                {s.label}: {s.count}
                            </Link>
                        ))}
                        <span className="text-[9px] font-bold text-app-muted-foreground ml-auto">
                            {allOrders.length} total orders
                        </span>
                    </div>
                )}

                {/* ═══════════════════════════════════════════════════════════════
                    REGISTRY TABLE — Wrapped in premium card
                ═══════════════════════════════════════════════════════════════ */}
                <section className="rounded-2xl border border-app-border/60 bg-app-surface/80 backdrop-blur-sm overflow-hidden"
                    aria-label="Purchase order registry"
                >
                    {/* Card header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-app-border/40 bg-app-background/20">
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                                <ScrollText size={13} className="text-indigo-500" />
                            </div>
                            <div>
                                <h2 className="text-xs font-black text-app-foreground">Order Registry</h2>
                                <p className="text-[8px] font-semibold text-app-muted-foreground">All purchase orders and legacy transactions</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-app-muted-foreground px-2.5 py-1 rounded-lg bg-app-background/60 border border-app-border/40">
                                {normalizedAdvanced.length} POs · {normalizedLegacy.length} Legacy
                            </span>
                        </div>
                    </div>

                    <div className="p-4 md:p-5">
                        <PurchasesRegistryClient
                            orders={allOrders}
                            currency={currency}
                            tradeSubTypesEnabled={tradeSubTypesEnabled}
                        />
                    </div>
                </section>
            </div>
        </main>
    );
}