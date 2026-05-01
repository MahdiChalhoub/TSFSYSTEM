/** Client Portal Admin — Client Tickets */
import { erpFetch } from "@/lib/erp-api";
import { TicketCheck, AlertCircle, Clock, CheckCircle } from "lucide-react";
import ClientTicketsClient from "./client";

export const dynamic = 'force-dynamic';

async function getTickets() {
    try { return await erpFetch('client-portal/admin-tickets/'); } catch { return []; }
}

export default async function ClientTicketsPage() {
    const tickets = await getTickets();

    const stats = [
        { label: 'Total Tickets', value: tickets.length, icon: TicketCheck, color: 'var(--app-accent)' },
        { label: 'Open', value: tickets.filter((t: any) => t.status === 'OPEN').length, icon: AlertCircle, color: 'var(--app-error)' },
        { label: 'In Progress', value: tickets.filter((t: any) => t.status === 'IN_PROGRESS').length, icon: Clock, color: 'var(--app-warning)' },
        { label: 'Resolved', value: tickets.filter((t: any) => t.status === 'RESOLVED').length, icon: CheckCircle, color: 'var(--app-success)' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                🎫 Client Support Tickets
            </h1>
            <p style={{ color: 'var(--app-faint)', marginBottom: '1.5rem' }}>
                Review, assign, resolve, and track client inquiries and complaints
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
            <ClientTicketsClient tickets={tickets} />
        </div>
    );
}
