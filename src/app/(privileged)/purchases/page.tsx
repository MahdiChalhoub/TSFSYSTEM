import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import { CheckCircle2, Truck, FileText, Package, Plus, Clock, BarChart3 } from 'lucide-react';
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

export default async function PurchaseRegistryPage({
    searchParams,
}: {
    searchParams: { status?: string; query?: string };
}) {
    const [advancedOrders, legacyOrders, dashboard, context] = await Promise.all([
        getPurchaseOrders(searchParams),
        getLegacyPurchases(searchParams),
        getPODashboard(),
        getCommercialContext(),
    ]);

    const allOrders = [
        ...(Array.isArray(advancedOrders) ? advancedOrders : advancedOrders?.results || []),
        ...legacyOrders,
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const { tradeSubTypesEnabled, currency } = context;

    const rfqCount = (dashboard?.by_status?.DRAFT || 0) + legacyOrders.filter((o: any) => o.status === 'DRAFT').length;
    const pendingApproval = (dashboard?.pending_approval || 0) + legacyOrders.filter((o: any) => o.status === 'SUBMITTED').length;
    const awaitingReceipt = (dashboard?.awaiting_receipt || 0) + legacyOrders.filter((o: any) => ['ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)).length;
    const legacyTotal = legacyOrders.reduce((acc: number, o: any) => acc + parseFloat(String(o.total_amount || 0)), 0);
    const totalValue = (dashboard?.total_value || 0) + legacyTotal;

    const kpis = [
        { label: 'Drafts', value: rfqCount, icon: FileText, color: 'var(--app-muted-foreground)' },
        { label: 'Pending Approval', value: pendingApproval, icon: Clock, color: 'var(--app-warning)' },
        { label: 'Incoming Stock', value: awaitingReceipt, icon: Truck, color: 'var(--app-info)' },
        { label: 'Total Procurement', value: `${Number(totalValue).toLocaleString()} ${currency}`, icon: Package, color: 'var(--app-primary)' },
    ];

    return (
        <div className="app-page">
            <div className="min-h-screen p-5 md:p-6 space-y-6 max-w-[1400px] mx-auto">
                {/* ── Header ────────────────────────────── */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 bg-app-primary/10 border border-app-primary/20">
                            <Package size={32} className="text-app-primary" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">
                                Supply Chain
                            </p>
                            <h1 className="text-4xl font-black tracking-tight text-app-foreground italic">
                                Procurement <span className="text-app-primary">Center</span>
                            </h1>
                            <p className="text-sm mt-0.5 font-medium text-app-muted-foreground">
                                Manage RFQs, Purchase Orders & Reception
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/purchases/sourcing"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-app-surface border border-app-border text-app-muted-foreground hover:bg-app-surface-hover hover:text-app-foreground transition-all shadow-sm"
                        >
                            <BarChart3 size={16} /> Sourcing Hub
                        </Link>
                        <AutoReplenishButton />
                        <Link
                            href="/purchases/new-order"
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-app-primary hover:bg-app-primary-hover text-app-primary-foreground transition-all shadow-lg shadow-app-primary/20"
                        >
                            <Plus size={16} /> New Purchase Order
                        </Link>
                    </div>
                </header>

                {/* ── KPI Row ───────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up" style={{ animationDelay: '60ms' }}>
                    {kpis.map((kpi, i) => (
                        <div key={i} className="app-glass p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                            <div className="flex items-start justify-between mb-4">
                                <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0"
                                    style={{
                                        background: kpi.color === 'var(--app-muted-foreground)' ? 'var(--app-surface-2)' : kpi.color + '10',
                                        color: kpi.color === 'var(--app-muted-foreground)' ? 'var(--app-muted-foreground)' : kpi.color,
                                        borderColor: kpi.color === 'var(--app-muted-foreground)' ? 'var(--app-border)' : kpi.color + '30',
                                        boxShadow: kpi.color === 'var(--app-muted-foreground)' ? 'none' : `0 4px 14px ${kpi.color}20`
                                    }}
                                >
                                    <kpi.icon size={22} />
                                </div>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground mb-1">
                                {kpi.label}
                            </p>
                            <p className="text-3xl font-black tracking-tight text-app-foreground italic" style={{ color: kpi.color === 'var(--app-muted-foreground)' ? 'var(--app-foreground)' : kpi.color }}>
                                {kpi.value}
                            </p>
                        </div>
                    ))}
                </div>

                {/* ── Registry Table ────────────────────── */}
                <div className="app-glass p-6 rounded-[2rem] fade-in-up" style={{ animationDelay: '100ms' }}>
                    <PurchasesRegistryClient
                        orders={allOrders}
                        currency={currency}
                        tradeSubTypesEnabled={tradeSubTypesEnabled}
                    />
                </div>
            </div>
        </div>
    );
}