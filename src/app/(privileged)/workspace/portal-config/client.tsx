'use client';

import { useState } from 'react';
import { Save, RotateCcw } from 'lucide-react';
import { updatePortalConfig } from '@/app/actions/client-portal';

interface ConfigField {
 key: string;
 label: string;
 type: 'boolean' | 'number' | 'text' | 'json';
 section: string;
 hint?: string;
}

const CONFIG_FIELDS: ConfigField[] = [
 // Loyalty
 { key: 'loyalty_enabled', label: 'Enable Loyalty System', type: 'boolean', section: '⭐ Loyalty Settings' },
 { key: 'loyalty_earn_rate', label: 'Points per Currency Unit', type: 'number', section: '⭐ Loyalty Settings', hint: 'e.g. 1.0 = 1 pt/$1, 2.5 = 2.5 pt/$1' },
 { key: 'loyalty_redemption_ratio', label: 'Points for 1 Currency Unit', type: 'number', section: '⭐ Loyalty Settings', hint: 'e.g. 100 = 100 pts = $1' },
 { key: 'loyalty_min_redeem', label: 'Min Points to Redeem', type: 'number', section: '⭐ Loyalty Settings' },
 { key: 'loyalty_max_redeem_percent', label: 'Max % of Order Payable', type: 'number', section: '⭐ Loyalty Settings', hint: 'e.g. 50 = up to 50%' },
 // Wallet
 { key: 'wallet_enabled', label: 'Enable Digital Wallet', type: 'boolean', section: '💰 Wallet Settings' },
 { key: 'wallet_currency', label: 'Wallet Currency', type: 'text', section: '💰 Wallet Settings' },
 { key: 'wallet_auto_create', label: 'Auto-Create on Activation', type: 'boolean', section: '💰 Wallet Settings' },
 { key: 'wallet_max_balance', label: 'Max Wallet Balance', type: 'number', section: '💰 Wallet Settings' },
 // Delivery
 { key: 'default_delivery_fee', label: 'Default Delivery Fee', type: 'number', section: '🚛 Delivery Settings' },
 { key: 'free_delivery_threshold', label: 'Free Delivery Above', type: 'number', section: '🚛 Delivery Settings', hint: '0 = never free' },
 // Tickets
 { key: 'tickets_enabled', label: 'Enable Ticket System', type: 'boolean', section: '🎫 Ticket Settings' },
 { key: 'auto_assign_tickets', label: 'Auto-Assign Tickets', type: 'boolean', section: '🎫 Ticket Settings' },
 // eCommerce
 { key: 'ecommerce_enabled', label: 'Enable eCommerce', type: 'boolean', section: '🛒 eCommerce Settings' },
 { key: 'min_order_amount', label: 'Minimum Order Amount', type: 'number', section: '🛒 eCommerce Settings' },
 { key: 'allow_wallet_payment', label: 'Allow Wallet Payment', type: 'boolean', section: '🛒 eCommerce Settings' },
];

export default function PortalConfigClient({ config: initial }: { config: any }) {
 const [config, setConfig] = useState<any>(initial || {});
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);

 function onChange(key: string, value: any) {
 setConfig((c: any) => ({ ...c, [key]: value }));
 setSaved(false);
 }

 async function handleSave() {
 if (!config?.id) return;
 setSaving(true);
 try {
 await updatePortalConfig(config.id, config);
 setSaved(true);
 setTimeout(() => setSaved(false), 3000);
 } catch (e) { console.error(e); }
 setSaving(false);
 }

 const sections = [...new Set(CONFIG_FIELDS.map(f => f.section))];
 const cardStyle: React.CSSProperties = {
 background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
 borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '1.25rem',
 };

 if (!config?.id) {
 return (
 <div style={{ ...cardStyle, textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
 No configuration found. It will be auto-created when the first client action occurs.
 </div>
 );
 }

 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: '1.5rem' }}>
 <button onClick={handleSave} disabled={saving} style={{
 display: 'flex', alignItems: 'center', gap: 6, padding: '0.5rem 1.25rem',
 background: saved ? '#22c55e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
 border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600,
 opacity: saving ? 0.7 : 1,
 }}>
 <Save size={16} /> {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Configuration'}
 </button>
 </div>

 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
 {sections.map(section => (
 <div key={section} style={cardStyle}>
 <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '1rem', color: '#f1f5f9' }}>
 {section}
 </h3>
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
 {CONFIG_FIELDS.filter(f => f.section === section).map(field => (
 <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
 <label style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>
 {field.label}
 </label>
 {field.type === 'boolean' ? (
 <label style={{
 display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
 padding: '6px 12px', background: config[field.key] ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.15)',
 borderRadius: 6, width: 'fit-content',
 color: config[field.key] ? '#22c55e' : '#94a3b8',
 }}>
 <input type="checkbox" checked={!!config[field.key]}
 onChange={e => onChange(field.key, e.target.checked)} />
 {config[field.key] ? 'Enabled' : 'Disabled'}
 </label>
 ) : field.type === 'number' ? (
 <input type="number" step="any" value={config[field.key] ?? ''}
 onChange={e => onChange(field.key, e.target.value)}
 style={{
 padding: '6px 10px', background: '#0f172a',
 border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
 color: '#e2e8f0', width: '100%',
 }} />
 ) : (
 <input type="text" value={config[field.key] ?? ''}
 onChange={e => onChange(field.key, e.target.value)}
 style={{
 padding: '6px 10px', background: '#0f172a',
 border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
 color: '#e2e8f0', width: '100%',
 }} />
 )}
 {field.hint && (
 <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{field.hint}</span>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 );
}
