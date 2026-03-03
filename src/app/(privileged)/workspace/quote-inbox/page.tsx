/** Admin — Quote Request Inbox (Catalogue Storefront Leads) */
import { getQuoteRequests } from '@/app/actions/client-portal';
import { Mail, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import QuoteInboxClient from './client';

export const dynamic = 'force-dynamic';

export default async function QuoteInboxPage() {
 let raw: any = [];
 try { raw = await getQuoteRequests(); } catch { }
 const quotes = Array.isArray(raw) ? raw : (raw as any)?.results || [];

 const pending = quotes.filter((q: any) => q.status === 'PENDING').length;
 const replied = quotes.filter((q: any) => q.status === 'REPLIED').length;
 const converted = quotes.filter((q: any) => q.status === 'CONVERTED').length;

 const stats = [
 { label: 'Total Inquiries', value: quotes.length, icon: Mail, color: '#6366f1' },
 { label: 'Pending', value: pending, icon: Clock, color: 'var(--app-warning)' },
 { label: 'Replied', value: replied, icon: CheckCircle, color: 'var(--app-info)' },
 { label: 'Converted', value: converted, icon: FileText, color: 'var(--app-success)' },
 ];

 return (
 <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-success)20', border: `1px solid $var(--app-success)40` }}>
        <Inbox size={26} style={{ color: 'var(--app-success)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Quote Inbox</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Incoming B2B quote requests</p>
      </div>
    </div>
  </header>
 <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
 📬 Quote Request Inbox
 </h1>
 <p style={{ color: 'var(--app-muted-foreground)', marginBottom: '1.5rem' }}>
 Manage leads from your catalogue storefront. Reply with proposals or convert to orders.
 </p>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
 {stats.map(s => (
 <div key={s.label} style={{
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, padding: '1.25rem', border: '1px solid var(--app-surface)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
 <s.icon size={18} color={s.color} />
 <span style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem' }}>{s.label}</span>
 </div>
 <div style={{ fontSize: '1.75rem', fontWeight: 700, color: s.color }}>{s.value}</div>
 </div>
 ))}
 </div>
 <QuoteInboxClient quotes={quotes} />
 </div>
 );
}
