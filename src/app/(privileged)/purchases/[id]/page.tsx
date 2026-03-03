import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
 ArrowLeft, Calendar, User, Tag, MapPin,
 FileText, CheckCircle2, Truck, Receipt,
 AlertCircle, Clock, Database, Printer, RotateCcw
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

export default async function PurchaseDetailPage({ params, searchParams }: { params: { id: string }, searchParams: { type?: string } }) {
 const { id } = await params;
 const isLegacy = searchParams?.type === 'legacy';
 const order = await getOrderDetails(id, isLegacy);
 const warehouses = await getWarehouses();

 if (!order) {
 return (
 <div className="app-page flex flex-col items-center justify-center p-20 gap-4">
 <AlertCircle size={48} className="text-app-foreground" />
 <h1 className="page-header-title tracking-tighter">Order Not Found</h1>
 <Link href="/purchases" className="text-app-primary font-bold hover:underline">Return to Registry</Link>
 </div>
 );
 }

 const STEPS = [
 { id: 'DRAFT', label: 'RFQ', icon: FileText, color: 'indigo' },
 { id: 'AUTHORIZED', label: 'Order Confirmed', icon: CheckCircle2, color: 'blue' },
 { id: 'RECEIVED', label: 'Goods Received', icon: Truck, color: 'emerald' },
 { id: 'INVOICED', label: 'Bill Invoiced', icon: Receipt, color: 'gray' }
 ];

 const currentStepIndex = STEPS.findIndex(s => s.id === order.status);

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
 {/* Header & Breadcrumbs */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
 <div>
 <Link href="/purchases" className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-primary transition-all mb-4">
 <ArrowLeft size={14} /> Back to Procurement
 </Link>
 <div className="flex items-center gap-4">
 <h1 className="text-3xl lg:page-header-title tracking-tighter">
 {order.status === 'DRAFT' ? 'RFQ' : 'Purchase Order'}{" "}
 <span className="text-app-primary">{order.ref_code || `#${order.id}`}</span>
 </h1>
 </div>
 </div>

 <div className="flex gap-3">
 <a
 href={`${process.env.NEXT_PUBLIC_API_URL || 'http://backend:8000/api'}/purchase/${id}/print/`}
 target="_blank"
 className="p-3.5 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-primary hover:border-app-success/30 transition-all shadow-sm flex items-center gap-2"
 >
 <Printer size={20} />
 <span className="text-xs font-bold uppercase tracking-wider">Print {order.status === 'DRAFT' ? 'RFQ' : 'PO'}</span>
 </a>
 {order.status === 'DRAFT' && (
 <form action={authorizePurchaseOrder.bind(null, id)}>
 <button className="bg-app-primary text-app-foreground px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-app-primary transition-all flex items-center gap-2">
 <CheckCircle2 size={20} />
 <span>Confirm Order</span>
 </button>
 </form>
 )}
 {(order.status === 'AUTHORIZED' || order.status === 'PARTIAL_RECEIVED') && (
 <form action={receivePurchaseOrder.bind(null, id)} className="flex gap-2">
 <select name="warehouseId" className="bg-app-surface border border-app-border rounded-2xl px-4 py-3.5 text-sm font-bold shadow-sm" required>
 <option value="">Target WH...</option>
 {warehouses.map((w: Record<string, any>) => <option key={w.id} value={w.id}>{w.name}</option>)}
 </select>
 <button className="bg-app-primary text-app-foreground px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-app-success transition-all flex items-center gap-2">
 <Truck size={20} />
 <span>Receive Stock</span>
 </button>
 </form>
 )}
 {(order.status === 'RECEIVED' || order.status === 'PARTIAL_RECEIVED') && (
 <form action={invoicePurchaseOrder.bind(null, id)} className="flex gap-2">
 <input name="invoiceNumber" placeholder="Vendor Bill #" className="bg-app-surface border border-app-border rounded-2xl px-4 py-3.5 text-sm font-bold shadow-sm" required />
 <button className="bg-app-surface text-app-foreground px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-app-border/20 hover:bg-app-surface-2 transition-all flex items-center gap-2">
 <Receipt size={20} />
 <span>Create Bill</span>
 </button>
 </form>
 )}
 {(order.status === 'RECEIVED' || order.status === 'INVOICED' || order.status === 'PARTIAL_RECEIVED') && (
 <Link
 href={`/purchases/returns/new?order_id=${id}`}
 className="bg-rose-600 text-app-foreground px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center gap-2"
 >
 <RotateCcw size={20} />
 <span>Return Items</span>
 </Link>
 )}
 </div>
 </div>

 {/* Stepper */}
 <div className="bg-app-surface p-8 rounded-[2.5rem] shadow-sm border border-app-border overflow-hidden">
 <div className="relative flex justify-between items-center max-w-4xl mx-auto">
 {/* Background Line */}
 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-app-surface-2 -z-10" />

 {STEPS.map((step, idx) => {
 const Icon = step.icon;
 const isCompleted = idx <= currentStepIndex;
 const isCurrent = idx === currentStepIndex;

 return (
 <div key={step.id} className="flex flex-col items-center gap-3 relative bg-app-surface px-4">
 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 scale-110 shadow-lg ${isCompleted
 ? `bg-${step.color}-500 text-app-foreground shadow-${step.color}-200`
 : 'bg-app-surface border border-app-border text-app-muted-foreground'
 }`}>
 <Icon size={20} />
 </div>
 <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-app-foreground' : 'text-app-muted-foreground'}`}>
 {step.label}
 </span>
 {isCurrent && (
 <div className="absolute -bottom-6 w-1 h-1 bg-app-primary rounded-full animate-ping" />
 )}
 </div>
 );
 })}
 </div>
 </div>

 {/* Main Content Grid */}
 <div className="grid lg:grid-cols-3 gap-8">

 {/* Left: Financials & Items */}
 <div className="lg:col-span-2 space-y-6">
 <div className="bg-app-surface rounded-[2rem] shadow-xl border border-app-border overflow-hidden">
 <div className="p-6 bg-app-background border-b border-app-border flex items-center justify-between font-black text-[10px] text-app-muted-foreground uppercase tracking-widest">
 <span>Order Content</span>
 <span>{order.lines?.length || 0} Items Selected</span>
 </div>
 <div className="p-0 overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
 <th className="p-6">Product</th>
 <th className="p-6 text-center">Ordered</th>
 <th className="p-6 text-center">Received</th>
 <th className="p-6 text-right">Unit Cost</th>
 <th className="p-6 text-right">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {order.lines?.map((line: Record<string, any>) => (
 <tr key={line.id} className="text-sm">
 <td className="p-6">
 <div className="font-bold text-app-foreground">{line.product_name}</div>
 <div className="text-[10px] text-app-muted-foreground font-mono">Reference: {line.product_sku || 'N/A'}</div>
 </td>
 <td className="p-6 text-center font-bold text-app-foreground">
 {line.quantity}
 </td>
 <td className="p-6 text-center">
 <span className={`px-2 py-1 rounded-lg font-bold text-xs ${parseFloat(line.qty_received) >= parseFloat(line.quantity) ? 'bg-app-primary-light text-app-primary' : 'bg-app-warning-bg text-app-warning'}`}>
 {line.qty_received}
 </span>
 </td>
 <td className="p-6 text-right font-medium text-app-muted-foreground">
 {parseFloat(line.unit_price).toLocaleString()} XOF
 </td>
 <td className="p-6 text-right font-black text-app-foreground">
 {parseFloat(line.total).toLocaleString()} XOF
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 {/* Totals Box */}
 <div className="bg-app-surface text-app-foreground p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Status Overview</div>
 <div className="text-2xl font-black">{order.status}</div>
 </div>
 <div className="text-right">
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Estimated Grand Total</div>
 <div className="text-5xl font-black text-app-primary tracking-tighter">${parseFloat(order.total_amount).toLocaleString()}</div>
 </div>
 </div>
 </div>

 {/* Right: Logistics & Timeline */}
 <div className="space-y-6">
 {/* Information Cards */}
 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm space-y-6">
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-primary-light text-app-primary rounded-2xl">
 <User size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Vendor / Supplier</div>
 <div className="text-sm font-black text-app-foreground">{order.contact_name || 'N/A'}</div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-info-bg text-app-info rounded-2xl">
 <MapPin size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Delivery Site</div>
 <div className="text-sm font-black text-app-foreground">{order.site_name || 'N/A'}</div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-warning-bg text-app-warning rounded-2xl">
 <Calendar size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Expected Date</div>
 <div className="text-sm font-black text-app-foreground">Immediate / Net 30</div>
 </div>
 </div>
 </div>

 {/* Audit Timeline Snippet */}
 <div className="bg-app-surface rounded-[2rem] border border-app-border shadow-sm overflow-hidden">
 <div className="p-5 bg-app-background border-b border-app-border text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Audit History</div>
 <div className="page-container">
 <div className="flex gap-4">
 <div className="flex flex-col items-center">
 <div className="w-2 h-2 rounded-full bg-app-primary" />
 <div className="w-px flex-1 bg-app-surface-2 my-1" />
 </div>
 <div className="pb-4">
 <div className="text-[10px] font-black text-app-foreground uppercase">Created (RFQ)</div>
 <div className="text-[10px] text-app-muted-foreground uppercase tracking-tighter">By {order.user_name || 'System'}</div>
 </div>
 </div>
 {order.status !== 'DRAFT' && (
 <div className="flex gap-4">
 <div className="flex flex-col items-center">
 <div className="w-2 h-2 rounded-full bg-app-info" />
 <div className="w-px flex-1 bg-app-surface-2 my-1" />
 </div>
 <div className="pb-4">
 <div className="text-[10px] font-black text-app-foreground uppercase tracking-tighter">Order Confirmed</div>
 <div className="text-[10px] text-app-muted-foreground uppercase">Status &rarr; AUTHORIZED</div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Attachment Manager */}
 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm animate-in fade-in slide-in-from-right-4 duration-1000 delay-300">
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
