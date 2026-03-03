import { erpFetch } from "@/lib/erp-api";
import { formatCurrency } from "@/lib/utils/currency-core";
import Link from "next/link";
import {
 ArrowLeft, Calendar, User, Tag, MapPin,
 FileText, CheckCircle2, ShoppingCart, Receipt,
 AlertCircle, Clock, Database, Printer, RotateCcw,
 History, HandCoins
} from "lucide-react";

export const dynamic = 'force-dynamic';

async function getOrderDetails(id: string) {
 try {
 return await erpFetch(`pos/orders/${id}/`);
 } catch (e) {
 console.error("Order Fetch Error:", e);
 return null;
 }
}

import { SalesAuditTimeline } from "./SalesAuditTimeline";
import { PaymentReconciliationPanel } from "./PaymentReconciliationPanel";
import { OrderActions } from "./OrderActions";

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
 const { id } = await params;
 const [order, orgSettings] = await Promise.all([
 getOrderDetails(id),
 erpFetch('settings/global_financial/').catch(() => null)
 ]);
 const orgCurrency = orgSettings?.currency || orgSettings?.currency_code || 'XOF';
 const fmt = (n: number) => formatCurrency(n, orgCurrency);

 if (!order) {
 return (
 <div className="app-page flex flex-col items-center justify-center p-20 gap-4">
 <AlertCircle size={48} className="text-app-foreground" />
 <h1 className="page-header-title tracking-tighter">Sale Not Found</h1>
 <p className="text-app-muted-foreground text-sm max-w-md text-center">
 The record could not be found in your current organization context.
 This could be due to strict tenant isolation or the record being deleted.
 </p>
 <div className="flex gap-4 mt-6">
 <Link href="/sales/history" className="bg-app-primary text-app-foreground px-6 py-2 rounded-xl font-bold shadow-lg shadow-emerald-100">Return to History</Link>
 </div>
 <div className="text-[10px] text-app-muted-foreground font-mono mt-20 p-4 border border-dashed border-app-border rounded-lg">
 Diagnostic Info:<br />
 Attempted ID: {id}<br />
 Path: /sales/[id]<br />
 Mode: Production
 </div>
 </div>
 );
 }

 const isReturnable = ['COMPLETED', 'INVOICED'].includes(order.status);
 const totalAmount = parseFloat(order.total_amount || '0');
 const taxAmount = parseFloat(order.tax_amount || '0');

 return (
 <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
 {/* Header & Breadcrumbs */}
 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
 <div>
 <Link href="/sales/history" className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-primary transition-all mb-4">
 <ArrowLeft size={14} /> Back to Sales History
 </Link>
 <div className="flex items-center gap-4">
 <h1 className="text-3xl lg:page-header-title tracking-tighter">
 Sale Record <span className="text-app-primary">{order.invoice_number || order.ref_code || `#${order.id}`}</span>
 </h1>
 </div>
 </div>

 <div className="flex flex-wrap gap-3">
 <OrderActions
 orderId={order.id}
 isLocked={order.is_locked}
 isVerified={order.is_verified}
 />

 <button className="p-3.5 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-primary hover:border-app-success/30 transition-all shadow-sm flex items-center gap-2">
 <Printer size={20} />
 <span className="text-xs font-bold uppercase tracking-wider">Print Invoice</span>
 </button>

 {isReturnable && (
 <Link
 href={`/sales/returns/new?order_id=${id}`}
 className="bg-rose-600 text-app-foreground px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center gap-2"
 >
 <RotateCcw size={20} />
 <span>Initiate Return</span>
 </Link>
 )}
 </div>
 </div>

 {/* 4-Axis Status Cards */}
 <div className="grid md:grid-cols-4 gap-4">
 {[
 { label: 'Order Status', value: order.order_status || order.status || 'DRAFT', color: 'text-app-foreground' },
 { label: 'Delivery Status', value: order.delivery_status || '—', color: 'text-app-info' },
 { label: 'Payment Status', value: order.payment_status || '—', color: 'text-app-primary' },
 { label: 'Invoice Status', value: order.invoice_status || '—', color: 'text-app-primary' },
 ].map(({ label, value, color }) => (
 <div key={label} className="bg-app-surface p-5 rounded-[2rem] border border-app-border shadow-sm">
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">{label}</div>
 <div className={`text-base font-black ${color}`}>{value}</div>
 </div>
 ))}
 </div>

 {/* Summary amount card */}
 <div className="grid md:grid-cols-3 gap-4">
 <div className="bg-app-surface p-5 rounded-[2rem] border border-app-border shadow-sm">
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Date</div>
 <div className="text-base font-black text-app-foreground">{order.created_at ? new Date(order.created_at).toLocaleDateString('fr-FR') : '—'}</div>
 </div>
 <div className="bg-app-surface p-5 rounded-[2rem] border border-app-border shadow-sm">
 <div className="text-[9px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Customer</div>
 <div className="text-base font-black text-app-foreground truncate">{order.contact_name || 'Walking Customer'}</div>
 </div>
 <div className="bg-app-primary-light/30 p-5 rounded-[2rem] border border-app-success/30 shadow-sm">
 <div className="text-[9px] font-black text-app-primary uppercase tracking-widest mb-1">Total Amount</div>
 <div className="text-base font-black text-app-success">{fmt(totalAmount)}</div>
 </div>
 </div>

 {/* Main Content Grid */}
 <div className="grid lg:grid-cols-3 gap-8">
 {/* Left: Items */}
 <div className="lg:col-span-2 space-y-6">
 <div className="bg-app-surface rounded-[2rem] shadow-xl border border-app-border overflow-hidden">
 <div className="p-6 bg-app-background border-b border-app-border flex items-center justify-between font-black text-[10px] text-app-muted-foreground uppercase tracking-widest">
 <span>Sold Items</span>
 <span>{order.lines?.length || 0} Products</span>
 </div>
 <div className="p-0 overflow-x-auto">
 <table className="w-full text-left">
 <thead>
 <tr className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
 <th className="p-6">Product</th>
 <th className="p-6 text-center">Qty</th>
 <th className="p-6 text-right">Unit Price</th>
 <th className="p-6 text-right">Tax</th>
 <th className="p-6 text-right">Total</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-gray-50">
 {(order.lines || []).map((line: Record<string, any>) => (
 <tr key={line.id} className="text-sm">
 <td className="p-6">
 <div className="font-bold text-app-foreground">{line.product_name}</div>
 <div className="text-[10px] text-app-muted-foreground font-mono">SKU: {line.product_sku || 'N/A'}</div>
 </td>
 <td className="p-6 text-center font-bold text-app-foreground">
 {line.quantity}
 </td>
 <td className="p-6 text-right font-medium text-app-muted-foreground">
 {fmt(parseFloat(line.unit_price || '0'))}
 </td>
 <td className="p-6 text-right text-app-muted-foreground">
 {fmt(parseFloat(line.vat_amount || 0))}
 </td>
 <td className="p-6 text-right font-black text-app-foreground">
 {fmt(parseFloat(line.total || '0'))}
 </td>
 </tr>
 ))}
 {(!order.lines || order.lines.length === 0) && (
 <tr>
 <td colSpan={5} className="p-10 text-center text-app-muted-foreground italic">
 Aucun article trouvé pour cette vente.
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 {/* Summary Footer */}
 <div className="bg-app-surface text-app-foreground p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
 <div className="flex gap-8">
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Subtotal HT</div>
 <div className="text-xl font-bold">{fmt(totalAmount - taxAmount)}</div>
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Total Tax</div>
 <div className="text-xl font-bold">{fmt(taxAmount)}</div>
 </div>
 </div>
 <div className="text-right">
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Grand Total TTC</div>
 <div className="text-5xl font-black text-app-primary tracking-tighter">{fmt(totalAmount)}</div>
 </div>
 </div>
 </div>

 {/* Right: Info + Audit Timeline */}
 <div className="space-y-6">
 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm space-y-6">
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-primary/5 text-app-primary rounded-2xl">
 <Receipt size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Payment Info</div>
 <div className="text-sm font-black text-app-foreground">{order.payment_method || 'N/A'}</div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-info-bg text-app-info rounded-2xl">
 <Clock size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Transaction Time</div>
 <div className="text-sm font-black text-app-foreground">{order.created_at ? new Date(order.created_at).toLocaleTimeString('fr-FR') : '—'}</div>
 </div>
 </div>
 <div className="flex items-start gap-4">
 <div className="p-3 bg-app-warning-bg text-app-warning rounded-2xl">
 <MapPin size={20} />
 </div>
 <div>
 <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Processing Site</div>
 <div className="text-sm font-black text-app-foreground">{order.site_name || 'Main Warehouse'}</div>
 </div>
 </div>
 </div>

 {/* Return warning */}
 {isReturnable && (
 <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100">
 <div className="flex items-center gap-3 text-rose-600 mb-2">
 <RotateCcw size={20} />
 <span className="font-black text-xs uppercase tracking-widest">Return Policy</span>
 </div>
 <p className="text-xs text-rose-700 leading-relaxed font-medium">
 This sale is eligible for return. Initiating a return will create a pending request for supervisor approval. Once approved, inventory will be restocked and a credit note issued.
 </p>
 </div>
 )}

 {/* Gap 5 — Payment Reconciliation Panel */}
 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
 <div className="flex items-center gap-2 mb-4">
 <HandCoins size={16} className="text-app-muted-foreground" />
 <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Payment Reconciliation</h3>
 </div>
 <PaymentReconciliationPanel orderId={order.id} />
 </div>

 {/* Gap 8 — Audit Trail Timeline */}
 <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
 <div className="flex items-center gap-2 mb-4">
 <History size={16} className="text-app-muted-foreground" />
 <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Audit Trail</h3>
 </div>
 <SalesAuditTimeline orderId={order.id} />
 </div>
 </div>
 </div>
 </div>
 );
}

