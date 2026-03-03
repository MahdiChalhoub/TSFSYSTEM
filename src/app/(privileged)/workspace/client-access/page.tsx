/** Client Portal Admin — Client Access Management */
import { erpFetch } from "@/lib/erp-api";
import { Users, ShieldCheck, KeyRound, QrCode , UserCheck} from "lucide-react";
import ClientAccessClient from "./client";

export const dynamic = 'force-dynamic';

async function getAccesses() {
 try { return await erpFetch('client-portal/client-access/'); } catch { return []; }
}
async function getCustomerContacts() {
 try {
 const contacts = await erpFetch('crm/contacts/');
 return (contacts || []).filter((c: any) => c.type === 'CUSTOMER');
 } catch { return []; }
}

export default async function ClientAccessPage() {
 const [accesses, customers] = await Promise.all([getAccesses(), getCustomerContacts()]);

 const stats = [
 { label: 'Total Clients', value: accesses.length, icon: Users, color: '#6366f1' },
 { label: 'Active', value: accesses.filter((a: any) => a.status === 'ACTIVE').length, icon: ShieldCheck, color: 'var(--app-success)' },
 { label: 'With Barcode', value: accesses.filter((a: any) => a.barcode).length, icon: QrCode, color: 'var(--app-info)' },
 { label: 'Pending', value: accesses.filter((a: any) => a.status === 'PENDING').length, icon: KeyRound, color: 'var(--app-warning)' },
 ];

 return (
 <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid $var(--app-primary)40` }}>
        <UserCheck size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Client Access</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Manage client portal permissions</p>
      </div>
    </div>
  </header>
 <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
 👥 Client Portal Access
 </h1>
 <p style={{ color: 'var(--app-muted-foreground)', marginBottom: '1.5rem' }}>
 Grant clients access to the self-service portal with barcode identification and granular permissions
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
 <ClientAccessClient accesses={accesses} customers={customers} />
 </div>
 );
}
