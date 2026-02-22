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
    const [orders, dashboard, context] = await Promise.all([
        getPurchaseOrders(searchParams),
        getPODashboard(),
        getCommercialContext(),
    ]);
    const { tradeSubTypesEnabled, currency } = context;

    const rfqCount = dashboard?.by_status?.DRAFT || 0;
    const pendingApproval = dashboard?.pending_approval || 0;
    const awaitingReceipt = dashboard?.awaiting_receipt || 0;
    const totalValue = dashboard?.total_value || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 tracking-tighter">
                        Procurement <span className="text-emerald-500">Center</span>
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage RFQs, Purchase Orders, Approvals, and Reception</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/purchases/sourcing"
                        className="bg-white border-2 border-gray-100 text-gray-500 px-6 py-3.5 rounded-2xl font-bold hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center gap-2"
                    >
                        <BarChart3 size={18} />
                        <span>Sourcing Intelligence</span>
                    </Link>
                    <Link
                        href="/purchases/new-order"
                        className="bg-emerald-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>New Purchase Order</span>
                    </Link>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Drafts</div>
                    <div className="text-4xl font-black text-slate-600">{rfqCount}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Orders pending submission</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Pending Approval</div>
                    <div className="text-4xl font-black text-amber-600">{pendingApproval}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Awaiting manager approval</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Incoming Stock</div>
                    <div className="text-4xl font-black text-blue-600">{awaitingReceipt}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Ordered, awaiting delivery</div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                    <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Procurement</div>
                    <div className="text-4xl font-black text-gray-900">{Number(totalValue).toLocaleString()} {currency}</div>
                    <div className="mt-2 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Total value of all POs</div>
                </div>
            </div>

            {/* Registry */}
            <PurchasesRegistryClient
                orders={orders}
                currency={currency}
                tradeSubTypesEnabled={tradeSubTypesEnabled}
            />
        </div>
    );
}