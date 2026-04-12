import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    ShoppingCart, Plus, Calendar, User, Tag, Clock, Database, BarChart3,
    CheckCircle2, XCircle, Truck, FileText, AlertTriangle, Package
} from "lucide-react";

export const dynamic = 'force-dynamic';

async function getPurchaseOrders() {
    try {
        return await erpFetch(`purchase-orders/`);
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

const STATUS_MAP: Record<string, { label: string; color: string; icon?: any }> = {
    DRAFT: { label: 'Draft', color: 'bg-app-surface-2 text-app-muted-foreground', icon: FileText },
    SUBMITTED: { label: 'Pending Approval', color: 'bg-amber-100 text-amber-700', icon: Clock },
    APPROVED: { label: 'Approved', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
    REJECTED: { label: 'Rejected', color: 'bg-rose-100 text-rose-600', icon: XCircle },
    ORDERED: { label: 'Sent to Supplier', color: 'bg-indigo-100 text-indigo-700', icon: Truck },
    PARTIALLY_RECEIVED: { label: 'Partial Receipt', color: 'bg-cyan-100 text-cyan-700', icon: Package },
    RECEIVED: { label: 'Fully Received', color: 'bg-emerald-100 text-emerald-700', icon: Package },
    INVOICED: { label: 'Invoiced', color: 'bg-purple-100 text-purple-700', icon: FileText },
    COMPLETED: { label: 'Completed', color: 'bg-emerald-500 text-white', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', color: 'bg-app-surface-2 text-app-muted-foreground', icon: XCircle },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
    LOW: { label: 'Low', color: 'text-app-muted-foreground' },
    NORMAL: { label: 'Normal', color: 'text-blue-500' },
    HIGH: { label: 'High', color: 'text-orange-500' },
    URGENT: { label: 'Urgent', color: 'text-red-600 font-black' },
};

const PO_SUB_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    STANDARD: { label: 'Standard', color: 'bg-app-surface-2 text-app-muted-foreground' },
    WHOLESALE: { label: 'Wholesale', color: 'bg-amber-100 text-amber-700' },
    CONSIGNEE: { label: 'Consignee', color: 'bg-purple-100 text-purple-700' },
};

async function getOrgSettings() {
    try {
        const orgs = await erpFetch('organizations/');
        if (Array.isArray(orgs) && orgs.length > 0) {
            return { tradeSubTypesEnabled: orgs[0]?.settings?.enable_trade_sub_types ?? false };
        }
    } catch { }
    return { tradeSubTypesEnabled: false };
}

export default async function PurchaseRegistryPage() {
    const [orders, dashboard, orgSettings] = await Promise.all([
        getPurchaseOrders(),
        getPODashboard(),
        getOrgSettings(),
    ]);
    const tradeSubTypesEnabled = orgSettings.tradeSubTypesEnabled;

    const rfqCount = dashboard?.by_status?.DRAFT || 0;
    const pendingApproval = dashboard?.pending_approval || 0;
    const awaitingReceipt = dashboard?.awaiting_receipt || 0;
    const totalValue = dashboard?.total_value || 0;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-black text-app-foreground tracking-tighter">
                        Procurement <span className="text-emerald-500">Center</span>
                    </h1>
                    <p className="text-sm text-app-muted-foreground mt-1">Manage RFQs, Purchase Orders, Approvals, and Reception</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/purchases/sourcing"
                        className="bg-app-surface border-2 border-app-border text-app-muted-foreground px-6 py-3.5 rounded-2xl font-bold hover:text-emerald-600 hover:border-emerald-100 transition-all flex items-center gap-2"
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
                <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Drafts</div>
                    <div className="text-4xl font-black text-app-muted-foreground">{rfqCount}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Orders pending submission</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Pending Approval</div>
                    <div className="text-4xl font-black text-amber-600">{pendingApproval}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Awaiting manager approval</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Incoming Stock</div>
                    <div className="text-4xl font-black text-blue-600">{awaitingReceipt}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Ordered, awaiting delivery</div>
                </div>
                <div className="bg-app-surface p-6 rounded-3xl border border-app-border shadow-sm">
                    <div className="text-xs font-black text-app-muted-foreground uppercase tracking-widest mb-1">Total Procurement</div>
                    <div className="text-4xl font-black text-app-foreground">{Number(totalValue).toLocaleString()}</div>
                    <div className="mt-2 text-[10px] text-app-muted-foreground font-bold uppercase tracking-tighter">Total value of all POs</div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-app-surface rounded-3xl shadow-xl border border-app-border overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-[#F8FAFC] border-b border-app-border text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                        <tr>
                            <th className="p-6">PO Number</th>
                            <th className="p-6">Supplier</th>
                            <th className="p-6">Status</th>
                            {tradeSubTypesEnabled && <th className="p-6">Type</th>}
                            <th className="p-6">Priority</th>
                            <th className="p-6 text-right">Amount</th>
                            <th className="p-6">Expected</th>
                            <th className="p-6 text-right w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {(!orders || orders.length === 0) ? (
                            <tr>
                                <td colSpan={tradeSubTypesEnabled ? 8 : 7} className="p-20 text-center text-app-muted-foreground font-medium italic">
                                    No purchase orders found. Create your first PO to get started.
                                </td>
                            </tr>
                        ) : (
                            orders.map((po: Record<string, any>) => {
                                const statusInfo = STATUS_MAP[po.status] || { label: po.status, color: 'bg-app-surface-2 text-app-muted-foreground' };
                                const priorityInfo = PRIORITY_MAP[po.priority] || { label: po.priority, color: 'text-app-muted-foreground' };
                                return (
                                    <tr key={po.id} className="hover:bg-app-surface group transition-colors">
                                        <td className="p-6">
                                            <Link href={`/purchases/${po.id}`} className="flex flex-col">
                                                <span className="font-bold text-app-foreground group-hover:text-emerald-600 transition-colors uppercase tracking-tight">
                                                    {po.po_number || `PO-${po.id}`}
                                                </span>
                                                <div className="flex items-center gap-1 text-[10px] text-app-muted-foreground mt-0.5">
                                                    <Calendar size={10} />
                                                    {new Date(po.created_at).toLocaleDateString('fr-FR')}
                                                </div>
                                            </Link>
                                        </td>
                                        <td className="p-6">
                                            <span className="text-sm font-bold text-app-foreground">
                                                {po.supplier_display || po.supplier_name || 'N/A'}
                                            </span>
                                        </td>
                                        <td className="p-6">
                                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${statusInfo.color}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        {tradeSubTypesEnabled && (
                                            <td className="p-6">
                                                {po.purchase_sub_type && PO_SUB_TYPE_CONFIG[po.purchase_sub_type] ? (
                                                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${PO_SUB_TYPE_CONFIG[po.purchase_sub_type].color}`}>
                                                        {PO_SUB_TYPE_CONFIG[po.purchase_sub_type].label}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-app-faint">—</span>
                                                )}
                                            </td>
                                        )}
                                        <td className="p-6">
                                            <span className={`text-xs font-bold ${priorityInfo.color}`}>
                                                {po.priority === 'URGENT' && <AlertTriangle size={12} className="inline mr-1" />}
                                                {priorityInfo.label}
                                            </span>
                                        </td>
                                        <td className="p-6 text-right font-black text-app-foreground">
                                            {parseFloat(po.total_amount || 0).toLocaleString()} {po.currency || 'USD'}
                                        </td>
                                        <td className="p-6 text-sm text-app-muted-foreground">
                                            {po.expected_date ? new Date(po.expected_date).toLocaleDateString('fr-FR') : '—'}
                                        </td>
                                        <td className="p-6 text-right">
                                            <Link href={`/purchases/${po.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-app-faint hover:text-emerald-500">
                                                <Clock size={16} />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}