import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    CheckCircle2, XCircle, Truck, FileText, AlertTriangle, Package,
    Search, BarChart2, Plus, Calendar, Clock, BarChart3
} from "lucide-react";
import { getCommercialContext } from "@/app/actions/commercial";
import { PurchasesRegistryClient } from "./PurchasesRegistryClient";

export const dynamic = 'force-dynamic';

async function getOrgCurrency(): Promise<string> {
    try {
        const orgs = await erpFetch('organizations/')
        const org = Array.isArray(orgs) ? orgs[0] : orgs
        return org?.currency || org?.settings?.currency || 'USD'
    } catch { return 'USD' }
}

async function getPurchaseOrders(searchParams?: { status?: string, query?: string }) {
    try {
        const query = new URLSearchParams()
        if (searchParams?.status) query.append('status', searchParams.status)
        if (searchParams?.query) query.append('query', searchParams.query)

        const url = `purchase-orders/${query.toString() ? `?${query.toString()}` : ''}`
        return await erpFetch(url);
    } catch (e) {
        console.error("Failed to fetch purchase orders:", e);
        return [];
    }
}

async function getLegacyPurchases(searchParams?: { status?: string, query?: string }) {
    try {
        const query = new URLSearchParams()
        query.append('type', 'PURCHASE')
        if (searchParams?.status) query.append('status', searchParams.status)
        if (searchParams?.query) query.append('query', searchParams.query)

        // Fetch from the generic orders endpoint matching type='PURCHASE'
        const data = await erpFetch(`orders/?${query.toString()}`);
        const results = Array.isArray(data) ? data : (data.results || []);

        // Normalize simple Orders to the PurchaseRegistry expected interface
        return results.map((o: any) => ({
            ...o,
            po_number: o.invoice_number || o.ref_code || `PRCH-${o.id}`,
            supplier_display: o.contact_name || 'Legacy Supplier',
            is_legacy: true
        }));
    } catch (e) {
        console.error("Failed to fetch legacy purchases:", e);
        return [];
    }
}

async function getPODashboard() {
    try {
        return await erpFetch(`purchase-orders/dashboard/`);
    } catch (e) {
        return null;
    }
}

async function getOrgSettings() {
    try {
        const orgs = await erpFetch('organizations/');
        if (Array.isArray(orgs) && orgs.length > 0) {
            return { tradeSubTypesEnabled: orgs[0]?.settings?.enable_trade_sub_types ?? false };
        }
    } catch { }
    return { tradeSubTypesEnabled: false };
}

export default async function PurchaseRegistryPage({ searchParams }: { searchParams: { status?: string, query?: string } }) {
    const [advancedOrders, legacyOrders, dashboard, context] = await Promise.all([
        getPurchaseOrders(searchParams),
        getLegacyPurchases(searchParams),
        getPODashboard(),
        getCommercialContext(),
    ]);

    // Merge and Sort by creation date
    const allOrders = [...(Array.isArray(advancedOrders) ? advancedOrders : advancedOrders?.results || []), ...legacyOrders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const { tradeSubTypesEnabled, currency } = context;

    const rfqCount = (dashboard?.by_status?.DRAFT || 0) + legacyOrders.filter(o => o.status === 'DRAFT').length;
    const pendingApproval = (dashboard?.pending_approval || 0) + legacyOrders.filter(o => o.status === 'SUBMITTED').length;
    const awaitingReceipt = (dashboard?.awaiting_receipt || 0) + legacyOrders.filter(o => ['ORDERED', 'PARTIALLY_RECEIVED'].includes(o.status)).length;

    const legacyTotal = legacyOrders.reduce((acc, o) => acc + parseFloat(String(o.total_amount || 0)), 0);
    const totalValue = (dashboard?.total_value || 0) + legacyTotal;

    return (
        <div className="p-6 space-y-6 max-w-[1400px] mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <Package size={28} className="text-white" />
                        </div>
                        Procurement <span className="text-emerald-600">Center</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Manage RFQs, Purchase Orders, & Reception</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link
                        href="/purchases/sourcing"
                        className="bg-white border border-gray-100 text-gray-500 h-12 px-6 rounded-2xl font-bold hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center gap-2 shadow-sm"
                    >
                        <BarChart3 size={18} />
                        <span>Sourcing Intelligence</span>
                    </Link>
                    <Link
                        href="/purchases/new-order"
                        className="bg-emerald-600 text-white h-12 px-6 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2 border-0"
                    >
                        <Plus size={18} />
                        <span>New Purchase Order</span>
                    </Link>
                </div>
            </header>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                        <FileText size={22} className="text-slate-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Drafts</p>
                        <p className="text-2xl font-black text-slate-700 mt-0.5">{rfqCount}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                        <Clock size={22} className="text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Approval</p>
                        <p className="text-2xl font-black text-amber-600 mt-0.5">{pendingApproval}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                        <Truck size={22} className="text-blue-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Incoming Stock</p>
                        <p className="text-2xl font-black text-blue-600 mt-0.5">{awaitingReceipt}</p>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 group">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
                        <Package size={22} className="text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Procurement</p>
                        <p className="text-2xl font-black text-gray-900 mt-0.5">{Number(totalValue).toLocaleString()} {currency}</p>
                    </div>
                </div>
            </div>

            {/* Registry */}
            <PurchasesRegistryClient
                orders={allOrders}
                currency={currency}
                tradeSubTypesEnabled={tradeSubTypesEnabled}
            />
        </div>
    );
}