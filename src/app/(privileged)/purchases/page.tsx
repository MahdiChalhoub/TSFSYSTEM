import { erpFetch } from '@/lib/erp-api';
import Link from 'next/link';
import { CheckCircle2, Truck, FileText, Package, Plus, Clock, BarChart3 } from 'lucide-react';
import { getCommercialContext } from '@/app/actions/commercial';
import { PurchasesRegistryClient } from './PurchasesRegistryClient';

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
 { label: 'Drafts', value: rfqCount, icon: FileText, color: 'var(--app-text-muted)' },
 { label: 'Pending Approval', value: pendingApproval, icon: Clock, color: 'var(--app-warning)' },
 { label: 'Incoming Stock', value: awaitingReceipt, icon: Truck, color: 'var(--app-info)' },
 { label: 'Total Procurement', value: `${Number(totalValue).toLocaleString()} ${currency}`, icon: Package, color: 'var(--app-primary)' },
 ];

 return (
 <div
 className="min-h-screen p-5 md:p-6 space-y-5 max-w-[1400px] mx-auto"
 style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font)' }}
 >
 {/* ── Header ────────────────────────────── */}
 <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
 <div className="flex items-center gap-4">
 <div
 className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
 style={{ background: 'var(--app-primary)', boxShadow: '0 8px 24px var(--app-primary-glow)' }}
 >
 <Package size={26} color="#fff" />
 </div>
 <div>
 <h1
 className="text-3xl font-black tracking-tight"
 style={{ color: 'var(--app-text)', fontFamily: 'var(--app-font-display)' }}
 >
 Procurement <span style={{ color: 'var(--app-primary)' }}>Center</span>
 </h1>
 <p className="text-sm mt-0.5 uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
 Manage RFQs, Purchase Orders & Reception
 </p>
 </div>
 </div>
 <div className="flex items-center gap-3">
 <Link
 href="/purchases/sourcing"
 className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm transition-all"
 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-text-muted)' }}
 >
 <BarChart3 size={16} /> Sourcing Hub
 </Link>
 <Link
 href="/purchases/new-order"
 className="flex items-center gap-2 px-5 h-11 rounded-xl font-bold text-sm text-white transition-all"
 style={{ background: 'var(--app-primary)', boxShadow: '0 4px 14px var(--app-primary-glow)' }}
 >
 <Plus size={16} /> New Purchase Order
 </Link>
 </div>
 </header>

 {/* ── KPI Row ───────────────────────────── */}
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-in-up" style={{ animationDelay: '60ms' }}>
 {kpis.map((kpi, i) => (
 <div key={i} className="app-kpi-card flex items-center gap-4">
 <div
 className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
 style={{ background: kpi.color + '22', color: kpi.color }}
 >
 <kpi.icon size={20} />
 </div>
 <div>
 <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: 'var(--app-text-muted)' }}>
 {kpi.label}
 </p>
 <p className="text-xl font-black tracking-tight" style={{ color: kpi.color }}>
 {kpi.value}
 </p>
 </div>
 </div>
 ))}
 </div>

 {/* ── Registry Table ────────────────────── */}
 <PurchasesRegistryClient
 orders={allOrders}
 currency={currency}
 tradeSubTypesEnabled={tradeSubTypesEnabled}
 />
 </div>
 );
}