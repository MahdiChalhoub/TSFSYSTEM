import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import { CheckCircle2, Truck, FileText, Package, Plus, Clock, BarChart3, Receipt, RotateCcw, ScrollText } from 'lucide-react';
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
    const legacyTotal = normalizedLegacy.reduce((acc: number, o: any) => acc + parseFloat(String(o.total_amount || 0)), 0);
    const totalValue = (dashboard?.total_value || 0) + legacyTotal;

    const kpis = [
        { label: 'Drafts', value: rfqCount, icon: FileText, accent: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' },
        { label: 'Pending Approval', value: pendingApproval, icon: Clock, accent: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/30' },
        { label: 'Incoming Stock', value: awaitingReceipt, icon: Truck, accent: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/30' },
        { label: 'Total Procurement', value: `${Number(totalValue).toLocaleString()} ${currency}`, icon: Package, accent: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/30' },
    ];

    const navLinks = [
        { href: '/purchases/purchase-orders', label: 'Purchase Orders', icon: ScrollText },
        { href: '/purchases/invoices', label: 'Invoices', icon: Receipt },
        { href: '/purchases/receipts', label: 'Receipts', icon: Package },
        { href: '/purchases/returns', label: 'Returns', icon: RotateCcw },
        { href: '/purchases/quotations', label: 'Quotations', icon: FileText },
        { href: '/purchases/sourcing', label: 'Sourcing', icon: BarChart3 },
    ];

    return (
        <main className="space-y-[var(--layout-section-spacing)] animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            <div className="layout-container-padding max-w-[1600px] mx-auto space-y-[var(--layout-section-spacing)]">
                {/* ── Header ────────────────────────────── */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 md:gap-6">
                    <div className="flex items-center gap-3 md:gap-4">
                        <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl flex items-center justify-center shrink-0"
                            style={{ background: 'color-mix(in srgb, var(--theme-primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--theme-primary) 20%, transparent)' }}>
                            <Package size={28} className="theme-primary hidden md:block" />
                            <Package size={22} className="theme-primary md:hidden" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest theme-text-muted">
                                Supply Chain
                            </p>
                            <h1 className="text-2xl md:text-4xl font-black tracking-tight theme-text">
                                Procurement <span className="theme-primary">Center</span>
                            </h1>
                            <p className="text-xs md:text-sm mt-0.5 font-medium theme-text-muted hidden sm:block">
                                Manage RFQs, Purchase Orders & Reception
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 overflow-x-auto pb-2 lg:pb-0">
                        <AutoReplenishButton />
                        <Link
                            href="/purchases/new-order"
                            className="flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap min-h-[44px] md:min-h-[36px] transition-all shadow-lg"
                            style={{ background: 'var(--theme-primary)', color: 'white' }}
                        >
                            <Plus size={16} /> New Purchase Order
                        </Link>
                    </div>
                </header>

                {/* ── Quick Nav (mobile horizontal scroll, desktop grid) ── */}
                <nav className="flex gap-2 overflow-x-auto pb-2 md:pb-0 md:grid md:grid-cols-3 lg:grid-cols-6 -mx-4 px-4 md:mx-0 md:px-0" aria-label="Purchase module navigation">
                    {navLinks.map(link => (
                        <Link key={link.href} href={link.href}
                            className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-wider whitespace-nowrap min-h-[44px] md:min-h-[36px] transition-all theme-surface hover:opacity-80"
                            style={{ border: '1px solid var(--theme-border)' }}
                        >
                            <link.icon size={14} className="theme-primary shrink-0" />
                            <span className="theme-text-muted">{link.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* ── KPI Row (2-col mobile, 4-col desktop) ── */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-[var(--layout-element-gap)]" aria-label="Procurement statistics">
                    {kpis.map((kpi, i) => (
                        <div key={i}
                            className="layout-card p-4 md:p-5 flex flex-col justify-between transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg theme-surface"
                            style={{ border: '1px solid var(--theme-border)', borderRadius: 'var(--layout-card-radius)' }}
                        >
                            <div className="flex items-start justify-between mb-3 md:mb-4">
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 ${kpi.bg}`}>
                                    <kpi.icon size={20} className={kpi.accent} />
                                </div>
                            </div>
                            <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest theme-text-muted mb-1">
                                {kpi.label}
                            </p>
                            <p className={`text-xl md:text-3xl font-black tracking-tight ${kpi.accent}`}>
                                {kpi.value}
                            </p>
                        </div>
                    ))}
                </section>

                {/* ── Registry Table ────────────────────── */}
                <section className="theme-surface p-4 md:p-6"
                    style={{ border: '1px solid var(--theme-border)', borderRadius: 'var(--layout-card-radius)' }}
                    aria-label="Purchase order registry"
                >
                    <PurchasesRegistryClient
                        orders={allOrders}
                        currency={currency}
                        tradeSubTypesEnabled={tradeSubTypesEnabled}
                    />
                </section>
            </div>
        </main>
    );
}