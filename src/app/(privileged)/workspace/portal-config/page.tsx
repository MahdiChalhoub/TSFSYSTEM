/** Client Portal Admin — Portal Configuration */
import { erpFetch } from "@/lib/erp-api";
import { Settings, Star, Wallet, Truck, TicketCheck } from "lucide-react";
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
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                ⚙️ Client Portal Configuration
            </h1>
            <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
                Customize loyalty, wallet, delivery, tickets, and eCommerce settings for your organization
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                {[
                    { label: 'Loyalty', icon: Star, color: '#f59e0b', enabled: config?.loyalty_enabled },
                    { label: 'Wallet', icon: Wallet, color: '#6366f1', enabled: config?.wallet_enabled },
                    { label: 'Delivery', icon: Truck, color: '#06b6d4', enabled: true },
                    { label: 'Tickets', icon: TicketCheck, color: '#22c55e', enabled: config?.tickets_enabled },
                ].map(s => (
                    <div key={s.label} style={{
                        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                        borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <s.icon size={18} color={s.color} />
                            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{s.label}</span>
                            <span style={{
                                marginLeft: 'auto', padding: '2px 8px', borderRadius: 20,
                                fontSize: '0.7rem', fontWeight: 600,
                                background: s.enabled ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                color: s.enabled ? '#22c55e' : '#ef4444',
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
