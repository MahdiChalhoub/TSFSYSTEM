import { erpFetch } from "@/lib/erp-api";
import { formatCurrency } from "@/lib/utils/currency-core";
import Link from "next/link";
import {
    ArrowLeft, Calendar, User, Tag, MapPin,
    FileText, CheckCircle2, ShieldCheck, Receipt,
    AlertCircle, Clock, Database, Printer, RotateCcw,
    History, HandCoins, Send, Lock
} from "lucide-react";
import { InvoiceClientPage } from "./InvoiceClientPage";

export const dynamic = 'force-dynamic';

async function getInvoiceDetails(id: string) {
    try {
        return await erpFetch(`invoices/${id}/`);
    } catch (e) {
        console.error("Invoice Fetch Error:", e);
        return null;
    }
}

async function getOrgSettings() {
    try {
        return await erpFetch('settings/global_financial/');
    } catch (e) {
        console.error("Settings Fetch Error:", e);
        return null;
    }
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
    const { id } = await params;
    const [invoice, orgSettings] = await Promise.all([
        getInvoiceDetails(id),
        getOrgSettings().catch(() => null)
    ]);

    const orgCurrency = orgSettings?.currency || orgSettings?.currency_code || 'XOF';
    const fmt = (n: number) => formatCurrency(n, orgCurrency);

    if (!invoice) {
        return (
            <div className="app-page flex flex-col items-center justify-center p-20 gap-4">
                <AlertCircle size={48} className="text-app-foreground" />
                <h1 className="page-header-title tracking-tighter">Invoice Not Found</h1>
                <p className="text-app-muted-foreground text-sm max-w-md text-center">
                    The requested invoice could not be found. It may have been deleted or belong to a different organization context.
                </p>
                <div className="flex gap-4 mt-6">
                    <Link href="/finance/invoices" className="bg-app-primary text-white px-6 py-2 rounded-xl font-bold shadow-lg shadow-app-primary/20 hover:bg-app-primary/90 transition-all">
                        Return to Invoices
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="app-page">
            <div className="min-h-screen p-5 md:p-6 space-y-6 max-w-[1400px] mx-auto">
                {/* Breadcrumbs & Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                        <Link href="/finance/invoices" className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-primary transition-all mb-4">
                            <ArrowLeft size={14} /> Back to Invoices
                        </Link>
                        <div className="flex items-center gap-4">
                            <h1 className="text-3xl lg:page-header-title tracking-tighter">
                                {invoice.type === 'PURCHASE' ? 'Purchase' : 'Sales'} Invoice <span className="text-app-primary">#{invoice.invoice_number || invoice.id}</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button className="p-3.5 bg-app-surface border border-app-border rounded-2xl text-app-muted-foreground hover:text-app-primary hover:border-app-primary/30 transition-all shadow-sm flex items-center gap-2 group">
                            <Printer size={20} className="group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-bold uppercase tracking-wider">Print PDF</span>
                        </button>
                    </div>
                </div>

                <InvoiceClientPage invoice={invoice} currency={orgCurrency} />

                {/* Audit Trail Section */}
                <div className="bg-app-surface p-6 md:p-8 rounded-[2rem] border border-app-border shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <History size={20} className="text-app-muted-foreground" />
                        <h3 className="text-xs font-black text-app-muted-foreground uppercase tracking-widest">Document Audit Trace</h3>
                    </div>
                    {/* Audit trail component would go here, fetching from kernel_audit_logs if needed */}
                    <div className="text-xs text-app-muted-foreground italic">
                        Created by {invoice.created_by_name || 'System'} on {new Date(invoice.created_at).toLocaleString()}
                    </div>
                </div>
            </div>
        </div>
    );
}
