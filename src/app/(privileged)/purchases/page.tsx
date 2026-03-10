import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import {
    Package, Plus, Clock, BarChart3, Receipt, RotateCcw, ScrollText,
    FileText, Truck, ArrowRight, TrendingUp, AlertTriangle, ShoppingCart,
    DollarSign, Activity, Zap, CheckCircle2
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

    // ── KPI Computation ──
    const draftCount = (dashboard?.by_status?.DRAFT || 0) + normalizedLegacy.filter((o: any) => o.status === 'DRAFT').length;
    const pendingApproval = (dashboard?.pending_approval || 0) + normalizedLegacy.filter((o: any) => o.status === 'SUBMITTED').length;
    const awaitingReceipt = (dashboard?.awaiting_receipt || 0) + normalizedLegacy.filter((o: any) => ['ORDERED', 'PARTIALLY_RECEIVED', 'IN_TRANSIT', 'CONFIRMED'].includes(o.status)).length;
    const completedCount = normalizedAdvanced.filter((o: any) => o.status === 'COMPLETED').length + normalizedLegacy.filter((o: any) => o.status === 'COMPLETED').length;
    const legacyTotal = normalizedLegacy.reduce((acc: number, o: any) => acc + parseFloat(String(o.total_amount || 0)), 0);
    const totalValue = (dashboard?.total_value || 0) + legacyTotal;
    const totalOrders = allOrders.length;

    // ── Pipeline status counts (for the visual pipeline) ──
    const statusCounts: Record<string, number> = {};
    allOrders.forEach((o: any) => {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    });

    const pipelineStages = [
        { key: 'DRAFT', label: 'Draft', color: 'bg-slate-400' },
        { key: 'SUBMITTED', label: 'Pending', color: 'bg-amber-500' },
        { key: 'APPROVED', label: 'Approved', color: 'bg-blue-500' },
        { key: 'ORDERED', label: 'Ordered', color: 'bg-indigo-500' },
        { key: 'IN_TRANSIT', label: 'In Transit', color: 'bg-violet-500' },
        { key: 'RECEIVED', label: 'Received', color: 'bg-emerald-500' },
        { key: 'COMPLETED', label: 'Complete', color: 'bg-emerald-600' },
    ];

    const navLinks = [
        { href: '/purchases/purchase-orders', label: 'Purchase Orders', icon: ScrollText, desc: 'View all POs' },
        { href: '/purchases/new-order', label: 'New Order', icon: Plus, desc: 'Create PO', primary: true },
        { href: '/purchases/invoices', label: 'Invoices', icon: Receipt, desc: 'Supplier invoices' },
        { href: '/purchases/receipts', label: 'Receipts', icon: Package, desc: 'Goods received' },
        { href: '/purchases/returns', label: 'Returns', icon: RotateCcw, desc: 'Supplier returns' },
        { href: '/purchases/sourcing', label: 'Sourcing', icon: BarChart3, desc: 'Supplier sourcing' },
    ];

    return (
        <main className="animate-in fade-in duration-500 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-6">

                {/* ═══════════ HEADER ═══════════ */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/10 flex items-center justify-center shadow-sm border border-indigo-500/15 shrink-0">
                            <Package size={26} className="text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                                Supply Chain
                            </p>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-app-foreground">
                                Procurement <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent">Center</span>
                            </h1>
                            <p className="text-xs text-app-muted-foreground mt-0.5 hidden sm:block">
                                Manage purchase orders, supplier invoices, receipts & returns
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 overflow-x-auto pb-1 lg:pb-0">
                        <AutoReplenishButton />
                        <Link
                            href="/purchases/new-order"
                            className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm whitespace-nowrap transition-all shadow-lg shadow-indigo-500/20 bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:shadow-xl hover:shadow-indigo-500/30"
                        >
                            <Plus size={16} /> New Purchase Order
                        </Link>
                    </div>
                </header>

                {/* ═══════════ QUICK NAV ═══════════ */}
                <nav className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0" aria-label="Purchase module navigation">
                    {navLinks.map(link => (
                        <Link key={link.href} href={link.href}
                            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-[11px] uppercase tracking-wider whitespace-nowrap transition-all border shrink-0 group ${
                                link.primary
                                    ? 'bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/20 hover:border-indigo-500/40 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-app-surface/80 border-app-border/50 hover:border-app-primary/30 hover:bg-app-primary/5 text-app-muted-foreground hover:text-app-foreground'
                            }`}
                        >
                            <link.icon size={14} className={`shrink-0 ${link.primary ? 'text-indigo-500' : 'text-app-primary group-hover:text-app-primary'}`} />
                            {link.label}
                        </Link>
                    ))}
                </nav>

                {/* ═══════════ KPI ROW ═══════════ */}
                <section className="grid grid-cols-2 lg:grid-cols-5 gap-3" aria-label="Procurement statistics">
                    {/* Total Orders */}
                    <div className="bg-app-surface/80 backdrop-blur-sm rounded-2xl border border-app-border/50 p-4 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/5 flex items-center justify-center">
                                <ShoppingCart size={18} className="text-indigo-500" />
                            </div>
                            <Activity size={14} className="text-app-muted-foreground/30 group-hover:text-indigo-500/50 transition-colors" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-0.5">Total Orders</p>
                        <p className="text-2xl font-black text-indigo-500 tracking-tight">{totalOrders}</p>
                    </div>

                    {/* Drafts */}
                    <div className="bg-app-surface/80 backdrop-blur-sm rounded-2xl border border-app-border/50 p-4 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-500/20 to-slate-500/5 flex items-center justify-center">
                                <FileText size={18} className="text-slate-500" />
                            </div>
                            <span className="text-[9px] font-bold text-slate-500/50">DRAFT</span>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-0.5">Drafts</p>
                        <p className="text-2xl font-black text-slate-500 tracking-tight">{draftCount}</p>
                    </div>

                    {/* Pending Approval */}
                    <div className="bg-app-surface/80 backdrop-blur-sm rounded-2xl border border-app-border/50 p-4 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                                <Clock size={18} className="text-amber-500" />
                            </div>
                            {pendingApproval > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-0.5">Pending Approval</p>
                        <p className="text-2xl font-black text-amber-500 tracking-tight">{pendingApproval}</p>
                    </div>

                    {/* Incoming Stock */}
                    <div className="bg-app-surface/80 backdrop-blur-sm rounded-2xl border border-app-border/50 p-4 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
                                <Truck size={18} className="text-blue-500" />
                            </div>
                            {awaitingReceipt > 0 && <span className="text-[9px] font-bold text-blue-500/60">🚚 INCOMING</span>}
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-0.5">Incoming Stock</p>
                        <p className="text-2xl font-black text-blue-500 tracking-tight">{awaitingReceipt}</p>
                    </div>

                    {/* Total Value */}
                    <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-emerald-500/10 via-app-surface/80 to-app-surface/80 backdrop-blur-sm rounded-2xl border border-emerald-500/20 p-4 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg group">
                        <div className="flex items-center justify-between mb-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                                <DollarSign size={18} className="text-emerald-500" />
                            </div>
                            <TrendingUp size={14} className="text-emerald-500/40 group-hover:text-emerald-500/70 transition-colors" />
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-0.5">Total Procurement</p>
                        <p className="text-xl font-black text-emerald-500 tracking-tight">{Number(totalValue).toLocaleString()} <span className="text-xs font-bold text-emerald-500/60">{currency}</span></p>
                    </div>
                </section>

                {/* ═══════════ ORDER PIPELINE ═══════════ */}
                {totalOrders > 0 && (
                    <section className="bg-app-surface/60 backdrop-blur-sm rounded-2xl border border-app-border/40 p-4" aria-label="Order pipeline">
                        <div className="flex items-center gap-2 mb-3">
                            <Zap size={12} className="text-app-primary" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground">Order Pipeline</span>
                        </div>
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                            {pipelineStages.map((stage, i) => {
                                const count = statusCounts[stage.key] || 0;
                                return (
                                    <div key={stage.key} className="flex items-center gap-1.5 shrink-0">
                                        <Link
                                            href={`/purchases?status=${stage.key}`}
                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-[10px] font-bold ${
                                                count > 0
                                                    ? 'bg-app-background/60 border border-app-border/50 hover:border-app-primary/30 text-app-foreground'
                                                    : 'text-app-muted-foreground/40'
                                            }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${stage.color} ${count > 0 ? 'opacity-100' : 'opacity-30'}`} />
                                            <span>{stage.label}</span>
                                            {count > 0 && (
                                                <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-app-foreground/10 text-[9px] font-black">{count}</span>
                                            )}
                                        </Link>
                                        {i < pipelineStages.length - 1 && (
                                            <ArrowRight size={10} className="text-app-muted-foreground/20 shrink-0" />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                )}

                {/* ═══════════ REGISTRY TABLE ═══════════ */}
                <section className="bg-app-surface/80 backdrop-blur-sm rounded-2xl border border-app-border/50 overflow-hidden"
                    aria-label="Purchase order registry"
                >
                    {/* Section header accent */}
                    <div className="h-[2px] bg-gradient-to-r from-indigo-500/60 via-violet-500/40 to-transparent" />
                    <div className="p-4 md:p-6">
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