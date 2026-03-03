/** Client Portal Admin — Portal Configuration */
import { erpFetch } from "@/lib/erp-api";
import { Settings, Star, Wallet, Truck, TicketCheck , LayoutDashboard} from "lucide-react";
import PortalConfigClient from "./client";
import ThemeSelector from "./ThemeSelector";

export const dynamic = 'force-dynamic';

async function getConfig() {
 try { return await erpFetch('client-portal/config/current/'); } catch { return null; }
}

export default async function PortalConfigPage() {
 const config = await getConfig();

 return (
 <div style={{ padding: '2rem', maxWidth: 1400, margin: '0 auto' }}>
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid $var(--app-primary)40` }}>
        <LayoutDashboard size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Portal Config</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Client portal customization</p>
      </div>
    </div>
  </header>
 <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
 ⚙️ Client Portal Configuration
 </h1>
 <p style={{ color: 'var(--app-muted-foreground)', marginBottom: '1.5rem' }}>
 Customize loyalty, wallet, delivery, tickets, and eCommerce settings for your organization
 </p>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
 {[
 { label: 'Loyalty', icon: Star, color: 'var(--app-warning)', enabled: config?.loyalty_enabled },
 { label: 'Wallet', icon: Wallet, color: '#6366f1', enabled: config?.wallet_enabled },
 { label: 'Delivery', icon: Truck, color: 'var(--app-info)', enabled: true },
 { label: 'Tickets', icon: TicketCheck, color: 'var(--app-success)', enabled: config?.tickets_enabled },
 ].map(s => (
 <div key={s.label} style={{
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, padding: '1.25rem', border: '1px solid var(--app-surface)',
 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
 <s.icon size={18} color={s.color} />
 <span style={{ color: 'var(--app-muted-foreground)', fontSize: '0.85rem' }}>{s.label}</span>
 <span style={{
 marginLeft: 'auto', padding: '2px 8px', borderRadius: 20,
 fontSize: '0.7rem', fontWeight: 600,
 background: s.enabled ? 'color-mix(in srgb, var(--app-success) 15%, transparent)' : 'color-mix(in srgb, var(--app-error) 15%, transparent)',
 color: s.enabled ? 'var(--app-success)' : '#ef4444',
 }}>{s.enabled ? 'ON' : 'OFF'}</span>
 </div>
 </div>
 ))}
 </div>
 {config?.id && (
 <div style={{ marginBottom: '1.5rem' }}>
 <ThemeSelector configId={config.id} currentTheme={config.storefront_theme || 'midnight'} />
 </div>
 )}
 <PortalConfigClient config={config} />
 </div>
 );
}
