import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    ArrowLeft, Calendar, User, Tag, MapPin,
    FileText, CheckCircle2, Truck, Receipt,
    AlertCircle, Clock, Database, Printer, RotateCcw,
    Boxes, ShieldCheck, AlertTriangle, TrendingDown,
    Info, ChevronRight, Hash, DollarSign
} from "lucide-react";
import { authorizePurchaseOrder, receivePurchaseOrder, invoicePurchaseOrder } from "@/app/actions/commercial/purchases";
import AttachmentManager from "@/components/common/AttachmentManager";

export const dynamic = 'force-dynamic';

async function getOrderDetails(id: string, isLegacy: boolean) {
    try {
        if (!isLegacy) {
            // New Advanced Procurement Model
            return await erpFetch(`purchase-orders/${id}/`);
        } else {
            // Legacy POS Order model
            const order = await erpFetch(`purchase/${id}/`);
            if (!order) return null;

            // Map legacy to advanced structure
            return {
                ...order,
                id: order.id,
                ref_code: order.ref_code || order.invoice_number,
                status: order.status,
                contact_name: order.contact_name,
                user_name: order.user_name,
                site_name: order.site_name,
                total_amount: order.total_amount,
                lines: (order.lines || []).map((l: any) => ({
                    id: l.id,
                    product_name: l.product_name || `Product #${l.product_id}`,
                    product_sku: l.product_sku || '',
                    quantity: l.quantity,
                    qty_received: l.quantity, // Legacy assumes full receipt
                    unit_price: l.unit_price,
                    total: l.subtotal || (parseFloat(l.quantity) * parseFloat(l.unit_price))
                }))
            };
        }
    } catch (e) {
        console.error("Order Fetch Error:", e);
        return null;
    }
}

async function getWarehouses() {
    try {
        const sites = await erpFetch('erp/sites/?include_warehouses=true');
        return sites.flatMap((s: Record<string, any>) => s.warehouses || []);
    } catch (e) {
        return [];
    }
}

const StatusBadge = ({ status }: { status: string }) => {
    const configs: Record<string, { label: string; color: string; icon: any }> = {
        'DRAFT': { label: 'RFQ Draft', color: 'slate', icon: FileText },
        'SENT': { label: 'Sent to Vendor', color: 'indigo', icon: Truck },
        'CONFIRMED': { label: 'Confirmed', color: 'blue', icon: CheckCircle2 },
        'PARTIALLY_RECEIVED': { label: 'Partially Received', color: 'orange', icon: Boxes },
        'RECEIVED': { label: 'Fully Received', color: 'emerald', icon: ShieldCheck },
        'PARTIALLY_INVOICED': { label: 'Partially Billed', color: 'cyan', icon: Receipt },
        'INVOICED': { label: 'Billed', color: 'slate', icon: Receipt },
        'COMPLETED': { label: 'Closed', color: 'teal', icon: CheckCircle2 },
        'CANCELLED': { label: 'Cancelled', color: 'rose', icon: AlertTriangle },
    };

    const config = configs[status] || { label: status, color: 'slate', icon: Info };
    const Icon = config.icon;

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-app-surface border border-app-border shadow-sm`}>
            <div className={`w-2 h-2 rounded-full bg-${config.color}-500 animate-pulse`} />
            <Icon size={14} className={`text-${config.color}-500`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-app-foreground">{config.label}</span>
        </div>
    );
};

const KpiCard = ({ title, value, sub, icon: Icon, color }: any) => (
    <div className="bg-app-surface/40 backdrop-blur-xl border border-app-border p-6 rounded-[2rem] flex flex-col gap-1 shadow-sm relative overflow-hidden group hover:bg-app-surface/60 transition-all">
        <div className={`absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all text-${color}-500`}>
            <Icon size={120} />
        </div>
        <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-[0.2em] mb-2">{title}</div>
        <div className="text-3xl font-black text-app-foreground tracking-tighter">{value}</div>
        <div className="text-[10px] font-bold text-app-muted-foreground">{sub}</div>
    </div>
);

export default async function PurchaseDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { type?: string } }) {
    const { id } = await params;
    const isLegacy = searchParams?.type === 'legacy';
    const order = await getOrderDetails(id, isLegacy);
    const warehouses = await getWarehouses();

    if (!order) {
        return (
            <div className="app-page flex flex-col items-center justify-center p-20 gap-4">
                <AlertCircle size={48} className="text-app-foreground shadow-2xl" />
                <h1 className="page-header-title tracking-tighter">Order Not Found</h1>
                <Link href="/purchases" className="text-app-primary font-black hover:underline uppercase tracking-widest text-xs">Return to Registry</Link>
            </div>
        );
    }

    const STEPS = [
        { id: 'DRAFT', label: 'Draft', color: 'slate' },
        { id: 'SENT', label: 'Sent', color: 'indigo' },
        { id: 'RECEIVED', label: 'Received', color: 'emerald' },
        { id: 'INVOICED', label: 'Invoiced', color: 'slate' },
        { id: 'COMPLETED', label: 'Closed', color: 'teal' }
    ];

    const currentStepIndex = STEPS.findIndex(s => {
        if (order.status === 'PARTIALLY_RECEIVED') return s.id === 'RECEIVED';
        if (order.status === 'PARTIALLY_INVOICED') return s.id === 'INVOICED';
        return s.id === order.status;
    });

    const disc = order.discrepancy_summary || {};

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 pb-32">

            {/* Dynamic Header Part (Glassmorphism) */}
            <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-app-primary/10 via-app-transparent to-app-info/10 blur-[100px] opacity-30 -z-10" />

                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                    <div className="space-y-4">
                        <Link href="/purchases" className="group/back flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-app-muted-foreground hover:text-app-primary transition-all">
                            <div className="w-6 h-6 rounded-lg bg-app-surface border border-app-border flex items-center justify-center group-hover/back:-translate-x-1 transition-transform">
                                <ArrowLeft size={12} />
                            </div>
                            Back to Procurement Registry
                        </Link>

                        <div className="flex flex-wrap items-center gap-4">
                            <h1 className="text-4xl lg:text-5xl font-black text-app-foreground tracking-tighter leading-none">
                                {order.status === 'DRAFT' ? 'Request for Quote' : 'Purchase Order'}
                                <span className="text-app-primary ml-3 opacity-80">{order.ref_code || `#${order.id}`}</span>
                            </h1>
                            <StatusBadge status={order.status} />
                        </div>

                        <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest">
                            <div className="flex items-center gap-2">
                                <User size={14} className="text-app-primary" /> {order.contact_name}
                            </div>
                            <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-app-info" /> Net 30 Terms
                            </div>
                            <div className="flex items-center gap-2">
                                <MapPin size={14} className="text-app-warning" /> {order.site_name || 'Global Warehouse'}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button className="h-12 px-6 bg-app-surface border border-app-border rounded-2xl text-[10px] font-black uppercase tracking-widest hover:text-app-primary hover:border-app-primary transition-all flex items-center gap-2 shadow-sm">
                            <Printer size={16} /> Print Document
                        </button>

                        {order.status === 'DRAFT' && (
                            <form action={authorizePurchaseOrder.bind(null, id)}>
                                <button className="h-12 px-10 bg-app-primary text-app-foreground rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2">
                                    <ShieldCheck size={18} /> Confirm Order
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>

            {/* KPI Strip - Financial & Logistics Health */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                    title="Value of PO"
                    value={`${parseFloat(order.total_amount).toLocaleString()} XOF`}
                    sub="Total ordered commitment"
                    icon={DollarSign}
                    color="indigo"
                />
                <KpiCard
                    title="Receipt Progress"
                    value={`${order.receipt_progress || 0}%`}
                    sub={`${disc.total_received || 0} units physically on-site`}
                    icon={Truck}
                    color="emerald"
                />
                <KpiCard
                    title="Billing Status"
                    value={`${(disc.total_invoiced || 0).toLocaleString()}`}
                    sub="Units currently invoiced"
                    icon={Receipt}
                    color="cyan"
                />
                <KpiCard
                    title="Discrepancy Gap"
                    value={`${(disc.total_missing_vs_po || 0).toLocaleString()}`}
                    sub={`${(disc.total_missing_amount || 0).toLocaleString()} XOF at risk`}
                    icon={TrendingDown}
                    color="rose"
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left Column: Discrepancy Engine & Items */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Detailed Items with Discrepancy Engine */}
                    <div className="bg-app-surface rounded-[2.5rem] border border-app-border shadow-soft overflow-hidden">
                        <div className="p-8 bg-app-surface/40 backdrop-blur-md border-b border-app-border flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-black text-app-foreground tracking-tight">Discrepancy Engine Dashboard</h2>
                                <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest mt-1">Comparing 4 layers of reality</p>
                            </div>
                            <div className="flex items-center gap-2 px-4 py-2 bg-app-background rounded-xl border border-app-border text-[9px] font-black uppercase tracking-widest">
                                <Database size={12} className="text-app-primary" /> Live Data Sync
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[9px] font-black text-app-muted-foreground uppercase tracking-[0.15em] border-b border-app-border/50">
                                        <th className="px-8 py-5">Line Item</th>
                                        <th className="px-6 py-5 text-center bg-app-background/30">Ordered</th>
                                        <th className="px-6 py-5 text-center">Declared</th>
                                        <th className="px-6 py-5 text-center bg-app-background/30">Received</th>
                                        <th className="px-6 py-5 text-center">Invoiced</th>
                                        <th className="px-8 py-5 text-right">Net Gap</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-app-border/30">
                                    {order.lines?.map((line: any) => {
                                        const hasIssue = parseFloat(line.missing_vs_po) > 0 || line.disputed_lines_count > 0;
                                        return (
                                            <tr key={line.id} className={`group hover:bg-app-background/20 transition-all ${hasIssue ? 'bg-rose-500/[0.02]' : ''}`}>
                                                <td className="px-8 py-6">
                                                    <div className="font-black text-app-foreground text-sm leading-tight group-hover:text-app-primary transition-colors">{line.product_name}</div>
                                                    <div className="flex items-center gap-3 mt-1.5 font-mono text-[9px] text-app-muted-foreground uppercase tracking-tighter">
                                                        <span>Ref: {line.product_sku || '---'}</span>
                                                        <span className="w-1 h-1 rounded-full bg-app-border" />
                                                        <span>ID: {line.id}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center font-black text-app-foreground bg-app-background/10">
                                                    {line.quantity}
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    {line.supplier_declared_qty !== null ? (
                                                        <div className="flex flex-col items-center">
                                                            <span className="font-black text-app-foreground">{line.supplier_declared_qty}</span>
                                                            {parseFloat(line.declared_gap) !== 0 && (
                                                                <span className={`text-[9px] font-bold ${parseFloat(line.declared_gap) < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                    {parseFloat(line.declared_gap) > 0 ? '+' : ''}{line.declared_gap}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] text-app-muted-foreground/30 font-black tracking-widest italic uppercase">Waiting</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-6 text-center bg-app-background/10">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className={`px-2 py-0.5 rounded-lg text-xs font-black ${parseFloat(line.qty_received) >= parseFloat(line.quantity) ? 'text-emerald-500' : (parseFloat(line.qty_received) > 0 ? 'text-orange-500' : 'text-rose-500')}`}>
                                                            {line.qty_received}
                                                        </div>
                                                        {(parseFloat(line.qty_damaged) > 0 || parseFloat(line.qty_rejected) > 0) && (
                                                            <div className="flex gap-1 text-[8px] font-bold uppercase">
                                                                {parseFloat(line.qty_damaged) > 0 && <span className="text-rose-500">Dmg: {line.qty_damaged}</span>}
                                                                {parseFloat(line.qty_rejected) > 0 && <span className="text-rose-400">Rej: {line.qty_rejected}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-6 text-center">
                                                    <span className={`font-black ${parseFloat(line.qty_invoiced) > 0 ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>{line.qty_invoiced}</span>
                                                </td>
                                                <td className="px-8 py-6 text-right">
                                                    <div className="flex flex-col items-end">
                                                        <div className={`text-sm font-black ${parseFloat(line.missing_vs_po) > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                            {parseFloat(line.missing_vs_po) > 0 ? `-${line.missing_vs_po}` : 'MATCH'}
                                                        </div>
                                                        <div className="text-[10px] font-bold text-app-muted-foreground tracking-tighter">
                                                            {parseFloat(line.missing_amount) > 0 ? `${parseFloat(line.missing_amount).toLocaleString()} XOF` : 'Target met'}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-8 bg-app-background/30 border-t border-app-border flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-2xl bg-app-surface border border-app-border flex items-center justify-center text-app-primary">
                                    <ShieldCheck size={18} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-app-foreground uppercase tracking-widest">3-Way Match Validation</div>
                                    <div className="text-[10px] font-medium text-app-muted-foreground">Automated verification against inventory and supplier declarations</div>
                                </div>
                            </div>
                            <Link href={`/purchases/${id}/audit`} className="px-6 py-3 bg-app-surface border border-app-border rounded-xl text-[10px] font-black uppercase tracking-widest text-app-muted-foreground hover:text-app-primary transition-all">
                                Open Full Audit
                            </Link>
                        </div>
                    </div>

                    {/* Floating Action Toolbar (Bottom) */}
                    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-app-surface/80 backdrop-blur-2xl border border-app-border py-4 px-8 rounded-3xl shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-20 duration-1000">
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest">Ready to process</span>
                            <span className="text-[11px] font-bold text-app-foreground">{order.status} Stage</span>
                        </div>
                        <div className="w-px h-8 bg-app-border" />
                        <div className="flex gap-3">
                            {(order.status === 'AUTHORIZED' || order.status === 'SENT' || order.status === 'PARTIALLY_RECEIVED') && (
                                <form action={receivePurchaseOrder.bind(null, id)} className="flex items-center gap-3">
                                    <select name="warehouseId" className="h-10 px-4 bg-app-background border border-app-border rounded-xl text-xs font-bold" required>
                                        <option value="">WH Select...</option>
                                        {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </select>
                                    <button className="h-10 px-6 bg-app-primary text-app-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all flex items-center gap-2">
                                        <Boxes size={14} /> Receive Goods
                                    </button>
                                </form>
                            )}
                            {(order.status === 'RECEIVED' || order.status === 'PARTIALLY_INVOICED' || order.status === 'PARTIALLY_RECEIVED') && (
                                <form action={invoicePurchaseOrder.bind(null, id)} className="flex items-center gap-3">
                                    <input name="invoiceNumber" placeholder="Bill ID..." className="h-10 w-24 px-4 bg-app-background border border-app-border rounded-xl text-xs font-bold" required />
                                    <button className="h-10 px-6 bg-emerald-600 text-app-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                                        <Receipt size={14} /> Generate Bill
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Logistics & Audit */}
                <div className="space-y-8">

                    {/* Logistics Info */}
                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] p-8 shadow-soft space-y-8">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-4 h-px bg-app-border" /> LOGISTICS PROFILE
                        </div>

                        <div className="space-y-6">
                            <div className="flex gap-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-app-background border border-app-border flex items-center justify-center text-app-primary group-hover:scale-110 transition-all">
                                    <User size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Supplier</div>
                                    <div className="text-sm font-black text-app-foreground">{order.contact_name}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-app-background border border-app-border flex items-center justify-center text-app-warning group-hover:scale-110 transition-all">
                                    <MapPin size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Fulfillment Site</div>
                                    <div className="text-sm font-black text-app-foreground">{order.site_name || 'Main Warehouse'}</div>
                                </div>
                            </div>

                            <div className="flex gap-4 group">
                                <div className="w-12 h-12 rounded-2xl bg-app-background border border-app-border flex items-center justify-center text-app-info group-hover:scale-110 transition-all">
                                    <Receipt size={20} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Payment Context</div>
                                    <div className="text-sm font-black text-app-foreground">{order.payment_method || 'Net 30 Credit'}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Lifecycle Timeline */}
                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] p-8 shadow-soft space-y-8">
                        <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                            <div className="w-4 h-px bg-app-border" /> AUDIT TIMELINE
                        </div>

                        <div className="space-y-4">
                            {[
                                { label: 'RFQ Initialized', status: 'DRAFT', date: 'Created', user: order.user_name },
                                { label: 'Order Confirmed', status: 'AUTHORIZED', date: order.approved_at, user: order.approved_by_name },
                                { label: 'Carrier Dispatched', status: 'SENT', date: 'Logistics', user: 'Supplier Node' },
                                { label: 'Warehouse Inbound', status: 'RECEIVED', date: order.received_date, user: 'Inventory SVC' }
                            ].map((event, i) => {
                                const isPast = STEPS.findIndex(s => s.id === (event.status === 'RECEIVED' ? (order.status.includes('RECEIVED') ? 'RECEIVED' : order.status) : event.status)) <= currentStepIndex;
                                return (
                                    <div key={i} className="flex gap-4 group">
                                        <div className="flex flex-col items-center">
                                            <div className={`w-3 h-3 rounded-full border-2 border-app-surface ring-4 ${isPast ? 'bg-app-primary ring-app-primary/10' : 'bg-app-border ring-app-transparent'}`} />
                                            <div className={`w-[1px] h-12 bg-app-border ${i === 3 ? 'opacity-0' : ''}`} />
                                        </div>
                                        <div className="space-y-0.5">
                                            <div className={`text-[10px] font-black uppercase tracking-wider ${isPast ? 'text-app-foreground' : 'text-app-muted-foreground opacity-40'}`}>{event.label}</div>
                                            <div className="text-[9px] font-bold text-app-muted-foreground">{event.user || 'Pending Workflow'}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Document Vault */}
                    <div className="bg-app-surface border border-app-border rounded-[2.5rem] p-8 shadow-soft animate-in fade-in slide-in-from-right-8 duration-1000 delay-500">
                        <div className="flex items-center justify-between mb-6">
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-[0.2em] flex items-center gap-3">
                                <div className="w-4 h-px bg-app-border" /> DOCUMENT VAULT
                            </div>
                            <Hash size={16} className="text-app-muted-foreground/30" />
                        </div>

                        <AttachmentManager
                            linkedModel="commercial.PurchaseOrder"
                            linkedId={parseInt(id)}
                            category="PURCHASE_DOC"
                            compact
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
