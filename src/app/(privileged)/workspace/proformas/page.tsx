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
        { label: 'Total Proformas', value: proformas.length, icon: FileText, color: '#6366f1' },
        { label: 'Pending Review', value: pending, icon: Clock, color: '#f59e0b' },
        { label: 'Approved', value: approved, icon: CheckCheck, color: '#22c55e' },
        { label: 'Rejected', value: rejected, icon: XCircle, color: '#ef4444' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📋 Supplier Proforma Review
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Review, approve, negotiate, or reject supplier proformas. Approved proformas convert to Purchase Orders.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <s.icon size={18} color={s.color} />
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>
            <ProformaReviewClient proformas={proformas} />
        </div>
    );
}
