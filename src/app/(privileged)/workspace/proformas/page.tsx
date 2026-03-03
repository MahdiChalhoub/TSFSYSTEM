/** Supplier Portal Admin — Proforma Review */
import { erpFetch } from "@/lib/erp-api";
import { FileText, Clock, CheckCheck, XCircle } from "lucide-react";
import ProformaReviewClient from "./client";

export const dynamic = 'force-dynamic';

async function getProformas() {
 try { return await erpFetch('supplier-portal/admin-proformas/'); } catch { return []; }
}

export default async function ProformaReviewPage() {
 const proformas = await getProformas();

 const pending = proformas.filter((p: any) => ['SUBMITTED', 'UNDER_REVIEW'].includes(p.status)).length;
 const approved = proformas.filter((p: any) => ['APPROVED', 'CONVERTED'].includes(p.status)).length;
 const rejected = proformas.filter((p: any) => p.status === 'REJECTED').length;

 const stats = [
 { label: 'Total Proformas', value: proformas.length, icon: FileText, color: 'text-app-primary', bg: 'bg-app-primary/5', border: 'border-app-primary/30' },
 { label: 'Pending Review', value: pending, icon: Clock, color: 'text-app-warning', bg: 'bg-app-warning-bg', border: 'border-app-warning/30' },
 { label: 'Approved', value: approved, icon: CheckCheck, color: 'text-app-primary', bg: 'bg-app-primary-light', border: 'border-app-success/30' },
 { label: 'Rejected', value: rejected, icon: XCircle, color: 'text-app-error', bg: 'bg-app-error-bg', border: 'border-app-error/30' },
 ];

 return (
 <div className="app-page p-6 max-w-7xl mx-auto">
 <div className="mb-6">
 <h1 className="page-header-title text-app-foreground font-serif tracking-tight">
 📋 Supplier Proforma Review
 </h1>
 <p className="text-app-muted-foreground mt-1">
 Review, approve, negotiate, or reject supplier proformas. Approved proformas convert to Purchase Orders.
 </p>
 </div>

 <div className="grid grid-cols-4 gap-4 mb-8">
 {stats.map(s => {
 const Icon = s.icon;
 return (
 <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-5 shadow-sm`}>
 <div className="flex items-center gap-2 mb-3">
 <Icon size={18} className={s.color} />
 <span className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">{s.label}</span>
 </div>
 <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
 </div>
 );
 })}
 </div>
 <ProformaReviewClient proformas={proformas} />
 </div>
 );
}
