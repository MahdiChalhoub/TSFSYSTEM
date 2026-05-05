import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    ArrowLeft, Calendar, User, Tag, MapPin,
    FileText, CheckCircle2, ShoppingCart, Receipt,
    AlertCircle, Clock, Database, Printer, RotateCcw
} from "lucide-react";

export const dynamic = 'force-dynamic';

async function getOrderDetails(id: string) {
    try {
        return await erpFetch(`orders/${id}/`);
    } catch (e) {
        console.error("Order Fetch Error:", e);
        return null;
    }
}

function fmt(n: number) {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
}

export default async function SaleDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const order = await getOrderDetails(id);

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <AlertCircle size={48} className="text-gray-200" />
                <h1>Sale Not Found</h1>
                <Link href="/sales/history" className="text-app-success font-bold hover:underline">Return to History</Link>
            </div>
        );
    }

    const isReturnable = ['COMPLETED', 'INVOICED'].includes(order.status);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
            {/* Header & Breadcrumbs */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <Link href="/sales/history" className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-success transition-all mb-4">
                        <ArrowLeft size={14} /> Back to Sales History
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1>
                            Sale Record <span className="text-app-success">{order.invoice_number || order.ref_code || `#${order.id}`}</span>
                        </h1>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button className="p-3.5 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-success hover:border-emerald-100 transition-all shadow-sm flex items-center gap-2">
                        <Printer size={20} />
                        <span className="text-xs font-bold uppercase tracking-wider">Print Invoice</span>
                    </button>

                    {isReturnable && (
                        <Link
                            href={`/sales/returns/new?order_id=${id}`}
                            className="bg-app-error text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-app-error transition-all flex items-center gap-2"
                        >
                            <RotateCcw size={20} />
                            <span>Initiate Return</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Status & Summary Cards */}
            <div className="grid md:grid-cols-4 gap-6">
                <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Status</div>
                    <div className="text-xl font-black text-app-foreground">{order.status}</div>
                </div>
                <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Date</div>
                    <div className="text-xl font-black text-app-foreground">{new Date(order.created_at).toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm">
                    <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Customer</div>
                    <div className="text-xl font-black text-app-foreground truncate">{order.contact_name || 'Walking Customer'}</div>
                </div>
                <div className="bg-app-surface p-6 rounded-[2rem] border border-emerald-100 bg-app-success-bg/30 shadow-sm">
                    <div className="text-[10px] font-black text-app-success uppercase tracking-widest mb-1">Total Amount</div>
                    <div className="text-xl font-black text-app-success">{fmt(parseFloat(order.total_amount))}</div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid lg:grid-cols-3 gap-8">
                {/* Left: Items */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-app-surface rounded-[2rem] shadow-xl border border-app-border overflow-hidden">
                        <div className="p-6 bg-app-surface border-b border-app-border flex items-center justify-between font-black text-[10px] text-app-muted-foreground uppercase tracking-widest">
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
                                <tbody className="divide-y divide-app-border">
                                    {order.lines?.map((line: Record<string, any>) => (
                                        <tr key={line.id} className="text-sm">
                                            <td className="p-6">
                                                <div className="font-bold text-app-foreground">{line.product_name}</div>
                                                <div className="text-[10px] text-app-muted-foreground font-mono">SKU: {line.product_sku || 'N/A'}</div>
                                            </td>
                                            <td className="p-6 text-center font-bold text-app-foreground">
                                                {line.quantity}
                                            </td>
                                            <td className="p-6 text-right font-medium text-app-muted-foreground">
                                                {fmt(parseFloat(line.unit_price))}
                                            </td>
                                            <td className="p-6 text-right text-app-muted-foreground">
                                                {fmt(parseFloat(line.vat_amount || 0))}
                                            </td>
                                            <td className="p-6 text-right font-black text-app-foreground">
                                                {fmt(parseFloat(line.total))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Summary Footer */}
                    <div className="bg-app-bg text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex gap-8">
                            <div>
                                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Subtotal</div>
                                <div className="text-xl font-bold">{fmt(parseFloat(order.total_amount) - parseFloat(order.tax_amount))}</div>
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Total Tax</div>
                                <div className="text-xl font-bold">{fmt(parseFloat(order.tax_amount))}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest mb-1">Grand Total Collected</div>
                            <div className="text-5xl font-black text-emerald-400 tracking-tighter">{fmt(parseFloat(order.total_amount))}</div>
                        </div>
                    </div>
                </div>

                {/* Right: Info Panels */}
                <div className="space-y-6">
                    <div className="bg-app-surface p-6 rounded-[2rem] border border-app-border shadow-sm space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-app-info-bg text-app-info rounded-2xl">
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
                                <div className="text-sm font-black text-app-foreground">{new Date(order.created_at).toLocaleTimeString('fr-FR')}</div>
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

                    {/* Warning for Returns */}
                    {isReturnable && (
                        <div className="bg-app-error-bg p-6 rounded-[2rem] border border-rose-100">
                            <div className="flex items-center gap-3 text-app-error mb-2">
                                <RotateCcw size={20} />
                                <span className="font-black text-xs uppercase tracking-widest">Return Policy</span>
                            </div>
                            <p className="text-xs text-app-error leading-relaxed font-medium">
                                This sale is eligible for return. Initiating a return will create a pending request for supervisor approval. Once approved, inventory will be restocked and a credit note issued.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
