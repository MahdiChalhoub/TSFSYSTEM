/** Admin — Quote Request Inbox (Catalogue Storefront Leads) */
import { getQuoteRequests } from '@/app/actions/client-portal';
import { Mail, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import QuoteInboxClient from './client';

export const dynamic = 'force-dynamic';

export default async function QuoteInboxPage() {
    const raw = await getQuoteRequests();
    const quotes = Array.isArray(raw) ? raw : (raw as any)?.results || [];

    const pending = quotes.filter((q: any) => q.status === 'PENDING').length;
    const replied = quotes.filter((q: any) => q.status === 'REPLIED').length;
    const converted = quotes.filter((q: any) => q.status === 'CONVERTED').length;

    const stats = [
        { label: 'Total Inquiries', value: quotes.length, icon: Mail, color: '#6366f1' },
        { label: 'Pending', value: pending, icon: Clock, color: '#f59e0b' },
        { label: 'Replied', value: replied, icon: CheckCircle, color: '#3b82f6' },
        { label: 'Converted', value: converted, icon: FileText, color: '#22c55e' },
    ];

    return (
        <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                📬 Quote Request Inbox
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Manage leads from your catalogue storefront. Reply with proposals or convert to orders.
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
            <QuoteInboxClient quotes={quotes} />
        </div>
    );
}
