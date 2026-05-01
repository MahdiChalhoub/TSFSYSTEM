/** Client Portal Admin — Client Access Management */
import { erpFetch } from "@/lib/erp-api";
import { Users, ShieldCheck, KeyRound, QrCode } from "lucide-react";
import ClientAccessClient from "./client";

export const dynamic = 'force-dynamic';

async function getAccesses() {
    try { return await erpFetch('client-portal/client-access/'); } catch { return []; }
}
async function getCustomerContacts() {
    try {
        const contacts = await erpFetch('contacts/');
        return (contacts || []).filter((c: any) => c.type === 'CUSTOMER');
    } catch { return []; }
}

export default async function ClientAccessPage() {
    const [accesses, customers] = await Promise.all([getAccesses(), getCustomerContacts()]);

    const stats = [
        { label: 'Total Clients', value: accesses.length, icon: Users, color: 'var(--app-accent)' },
        { label: 'Active', value: accesses.filter((a: any) => a.status === 'ACTIVE').length, icon: ShieldCheck, color: 'var(--app-success)' },
        { label: 'With Barcode', value: accesses.filter((a: any) => a.barcode).length, icon: QrCode, color: 'var(--app-accent-cyan)' },
        { label: 'Pending', value: accesses.filter((a: any) => a.status === 'PENDING').length, icon: KeyRound, color: 'var(--app-warning)' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                👥 Client Portal Access
            </h1>
            <p style={{ color: 'var(--app-faint)', marginBottom: '1.5rem' }}>
                Grant clients access to the self-service portal with barcode identification and granular permissions
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {stats.map(s => (
                    <div key={s.label} style={{
                        background: 'linear-gradient(135deg, var(--app-surface-2) 0%, var(--app-bg) 100%)',
                        borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <s.icon size={18} color={s.color} />
                            <span style={{ color: 'var(--app-faint)', fontSize: '0.85rem' }}>{s.label}</span>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                    </div>
                ))}
            </div>
            <ClientAccessClient accesses={accesses} customers={customers} />
        </div>
    );
}
