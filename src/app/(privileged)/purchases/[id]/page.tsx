import { erpFetch } from "@/lib/erp-api";
import Link from "next/link";
import {
    ArrowLeft, Calendar, User, Tag, MapPin,
    FileText, CheckCircle2, Truck, Receipt,
    AlertCircle, Clock, Database, Printer, RotateCcw
} from "lucide-react";
import { authorizePurchaseOrder, receivePurchaseOrder, invoicePurchaseOrder } from "@/app/actions/commercial/purchases";

export const dynamic = 'force-dynamic';

async function getOrderDetails(id: string) {
    try {
        return await erpFetch(`purchase/${id}/`);
    } catch (e) {
        console.error("Order Fetch Error:", e);
        return null;
    }
}

async function getWarehouses() {
    try {
        const sites = await erpFetch('sites/?include_warehouses=true');
        return sites.flatMap((s: any) => s.warehouses || []);
    } catch (e) {
        return [];
    }
}

export default async function PurchaseDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const order = await getOrderDetails(id);
    const warehouses = await getWarehouses();

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
                <AlertCircle size={48} className="text-gray-200" />
                <h1 className="text-2xl font-black text-gray-900 tracking-tighter">Order Not Found</h1>
                <Link href="/purchases" className="text-emerald-500 font-bold hover:underline">Return to Registry</Link>
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
                    <Link href="/purchases" className="flex items-center gap-2 text-xs font-bold text-gray-400 hover:text-emerald-500 transition-all mb-4">
                        <ArrowLeft size={14} /> Back to Procurement
                    </Link>
                    <div className="flex items-center gap-4">
                        <h1 className="text-3xl lg:text-5xl font-black text-gray-900 tracking-tighter">
                            {order.status === 'DRAFT' ? 'RFQ' : 'Purchase Order'}{" "}
                            <span className="text-emerald-500">{order.ref_code || `#${order.id}`}</span>
                        </h1>
                    </div>
                </div>

                <div className="flex gap-3">
                    <a
                        href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/purchase/${id}/print/`}
                        target="_blank"
                        className="p-3.5 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-emerald-600 hover:border-emerald-100 transition-all shadow-sm flex items-center gap-2"
                    >
                        <Printer size={20} />
                        <span className="text-xs font-bold uppercase tracking-wider">Print {order.status === 'DRAFT' ? 'RFQ' : 'PO'}</span>
                    </a>
                    {order.status === 'DRAFT' && (
                        <form action={authorizePurchaseOrder.bind(null, id)}>
                            <button className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2">
                                <CheckCircle2 size={20} />
                                <span>Confirm Order</span>
                            </button>
                        </form>
                    )}
                    {(order.status === 'AUTHORIZED' || order.status === 'PARTIAL_RECEIVED') && (
                        <form action={receivePurchaseOrder.bind(null, id)} className="flex gap-2">
                            <select name="warehouseId" className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold shadow-sm" required>
                                <option value="">Target WH...</option>
                                {warehouses.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                            <button className="bg-emerald-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all flex items-center gap-2">
                                <Truck size={20} />
                                <span>Receive Stock</span>
                            </button>
                        </form>
                    )}
                    {(order.status === 'RECEIVED' || order.status === 'PARTIAL_RECEIVED') && (
                        <form action={invoicePurchaseOrder.bind(null, id)} className="flex gap-2">
                            <input name="invoiceNumber" placeholder="Vendor Bill #" className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold shadow-sm" required />
                            <button className="bg-gray-900 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-gray-200 hover:bg-gray-800 transition-all flex items-center gap-2">
                                <Receipt size={20} />
                                <span>Create Bill</span>
                            </button>
                        </form>
                    )}
                    {(order.status === 'RECEIVED' || order.status === 'INVOICED' || order.status === 'PARTIAL_RECEIVED') && (
                        <Link
                            href={`/purchases/returns/new?order_id=${id}`}
                            className="bg-rose-600 text-white px-8 py-3.5 rounded-2xl font-black shadow-lg shadow-rose-200 hover:bg-rose-700 transition-all flex items-center gap-2"
                        >
                            <RotateCcw size={20} />
                            <span>Return Items</span>
                        </Link>
                    )}
                </div>
            </div>

            {/* Stepper */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="relative flex justify-between items-center max-w-4xl mx-auto">
                    {/* Background Line */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-[2px] bg-gray-100 -z-10" />

                    {STEPS.map((step, idx) => {
                        const Icon = step.icon;
                        const isCompleted = idx <= currentStepIndex;
                        const isCurrent = idx === currentStepIndex;

                        return (
                            <div key={step.id} className="flex flex-col items-center gap-3 relative bg-white px-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 scale-110 shadow-lg ${isCompleted
                                    ? `bg-${step.color}-500 text-white shadow-${step.color}-200`
                                    : 'bg-white border border-gray-100 text-gray-300'
                                    }`}>
                                    <Icon size={20} />
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest ${isCompleted ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {step.label}
                                </span>
                                {isCurrent && (
                                    <div className="absolute -bottom-6 w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
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
                    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
                        <div className="p-6 bg-gray-50 border-b border-gray-100 flex items-center justify-between font-black text-[10px] text-gray-400 uppercase tracking-widest">
                            <span>Order Content</span>
                            <span>{order.lines?.length || 0} Items Selected</span>
                        </div>
                        <div className="p-0 overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        <th className="p-6">Product</th>
                                        <th className="p-6 text-center">Ordered</th>
                                        <th className="p-6 text-center">Received</th>
                                        <th className="p-6 text-right">Unit Cost</th>
                                        <th className="p-6 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {order.lines?.map((line: any) => (
                                        <tr key={line.id} className="text-sm">
                                            <td className="p-6">
                                                <div className="font-bold text-gray-900">{line.product_name}</div>
                                                <div className="text-[10px] text-gray-400 font-mono">Reference: {line.product_sku || 'N/A'}</div>
                                            </td>
                                            <td className="p-6 text-center font-bold text-gray-900">
                                                {line.quantity}
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className={`px-2 py-1 rounded-lg font-bold text-xs ${parseFloat(line.qty_received) >= parseFloat(line.quantity) ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                    {line.qty_received}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right font-medium text-gray-500">
                                                {parseFloat(line.unit_price).toLocaleString()} XOF
                                            </td>
                                            <td className="p-6 text-right font-black text-gray-900">
                                                {parseFloat(line.total).toLocaleString()} XOF
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Totals Box */}
                    <div className="bg-gray-900 text-white p-10 rounded-[3rem] shadow-2xl flex flex-col md:flex-row justify-between items-center gap-8">
                        <div>
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status Overview</div>
                            <div className="text-2xl font-black">{order.status}</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Estimated Grand Total</div>
                            <div className="text-5xl font-black text-emerald-400 tracking-tighter">${parseFloat(order.total_amount).toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* Right: Logistics & Timeline */}
                <div className="space-y-6">
                    {/* Information Cards */}
                    <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-6">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                                <User size={20} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Vendor / Supplier</div>
                                <div className="text-sm font-black text-gray-900">{order.contact_name || 'N/A'}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Delivery Site</div>
                                <div className="text-sm font-black text-gray-900">{order.site_name || 'N/A'}</div>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expected Date</div>
                                <div className="text-sm font-black text-gray-900">Immediate / Net 30</div>
                            </div>
                        </div>
                    </div>

                    {/* Audit Timeline Snippet */}
                    <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
                        <div className="p-5 bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">Audit History</div>
                        <div className="p-6 space-y-6">
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <div className="w-px flex-1 bg-gray-100 my-1" />
                                </div>
                                <div className="pb-4">
                                    <div className="text-[10px] font-black text-gray-900 uppercase">Created (RFQ)</div>
                                    <div className="text-[10px] text-gray-400 uppercase tracking-tighter">By {order.user_name || 'System'}</div>
                                </div>
                            </div>
                            {order.status !== 'DRAFT' && (
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        <div className="w-px flex-1 bg-gray-100 my-1" />
                                    </div>
                                    <div className="pb-4">
                                        <div className="text-[10px] font-black text-gray-900 uppercase tracking-tighter">Order Confirmed</div>
                                        <div className="text-[10px] text-gray-400 uppercase">Status &rarr; AUTHORIZED</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
