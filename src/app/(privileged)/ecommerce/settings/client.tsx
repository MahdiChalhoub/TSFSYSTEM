'use client';

import { useState } from 'react';
import { Settings, Save, Check } from 'lucide-react';
import { updatePortalConfig } from '@/app/actions/client-portal';

interface Props {
 config: any;
}

const STORE_MODES = [
 { value: 'B2C', label: 'B2C eCommerce', desc: 'Standard retail prices for all customers' },
 { value: 'B2B', label: 'B2B Order Portal', desc: 'Tier/negotiated pricing for business clients' },
 { value: 'CATALOG_QUOTE', label: 'Catalog + Quote', desc: 'Customers browse and request quotes' },
 { value: 'HYBRID', label: 'Hybrid', desc: 'B2C interface with B2B pricing for wholesale' },
];

export default function EcommerceSettingsClient({ config }: Props) {
 const [form, setForm] = useState({
 store_mode: config?.store_mode || 'HYBRID',
 storefront_title: config?.storefront_title || '',
 storefront_tagline: config?.storefront_tagline || '',
 ecommerce_enabled: config?.ecommerce_enabled ?? true,
 show_stock_levels: config?.show_stock_levels ?? false,
 allow_guest_browsing: config?.allow_guest_browsing ?? true,
 require_approval_for_orders: config?.require_approval_for_orders ?? false,
 seo_title: config?.seo_title || '',
 seo_description: config?.seo_description || '',
 og_image_url: config?.og_image_url || '',
 logo_url: config?.logo_url || '',
 primary_color: config?.primary_color || 'var(--app-success)',
 secondary_color: config?.secondary_color || 'var(--app-background)',
 custom_css: config?.custom_css || '',
 });
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState(false);

 const handleSave = async () => {
 if (!config?.id) return;
 setSaving(true);
 try {
 await updatePortalConfig(Number(config.id), form);
 setSaved(true);
 setTimeout(() => setSaved(false), 2000);
 } catch (e) {
 console.error(e);
 } finally {
 setSaving(false);
 }
 };

 const fieldStyle = {
 width: '100%',
 padding: '0.625rem 0.875rem',
 border: '1px solid #e2e8f0',
 borderRadius: '8px',
 fontSize: '0.9rem',
 outline: 'none',
 } as const;

 return (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '680px' }}>
 {/* ... (keeping store mode) */}

 {/* Branding & Theme */}
 <div style={{ background: 'var(--app-surface)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
 <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Branding & Visuals</h3>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Storefront Title</label>
 <input
 style={fieldStyle}
 value={form.storefront_title}
 onChange={e => setForm(f => ({ ...f, storefront_title: e.target.value }))}
 placeholder="Leave blank to use organization name"
 />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Logo URL</label>
 <input
 style={fieldStyle}
 value={form.logo_url}
 onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
 placeholder="https://example.com/logo.png"
 />
 </div>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Tagline</label>
 <input
 style={fieldStyle}
 value={form.storefront_tagline}
 onChange={e => setForm(f => ({ ...f, storefront_tagline: e.target.value }))}
 placeholder="Welcome message for the storefront"
 />
 </div>
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Primary Color</label>
 <div style={{ display: 'flex', gap: '0.5rem' }}>
 <input type="color" value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} style={{ width: '40px', height: '40px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }} />
 <input style={fieldStyle} value={form.primary_color} onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))} />
 </div>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Secondary Color</label>
 <div style={{ display: 'flex', gap: '0.5rem' }}>
 <input type="color" value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} style={{ width: '40px', height: '40px', padding: '0', border: 'none', background: 'transparent', cursor: 'pointer' }} />
 <input style={fieldStyle} value={form.secondary_color} onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))} />
 </div>
 </div>
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Custom CSS</label>
 <textarea
 style={{ ...fieldStyle, minHeight: '100px', fontFamily: 'monospace', fontSize: '0.85rem' }}
 value={form.custom_css}
 onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))}
 placeholder=".store-header { background: red; }"
 />
 </div>
 </div>
 </div>

 {/* SEO Settings */}
 <div style={{ background: 'var(--app-surface)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
 <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>SEO & Social</h3>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Meta Title</label>
 <input
 style={fieldStyle}
 value={form.seo_title}
 onChange={e => setForm(f => ({ ...f, seo_title: e.target.value }))}
 placeholder="SEO Optimized Page Title"
 />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>Meta Description</label>
 <textarea
 style={{ ...fieldStyle, minHeight: '80px', resize: 'vertical' }}
 value={form.seo_description}
 onChange={e => setForm(f => ({ ...f, seo_description: e.target.value }))}
 placeholder="Search engine snippet description"
 />
 </div>
 <div>
 <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.375rem' }}>OG Image URL</label>
 <input
 style={fieldStyle}
 value={form.og_image_url}
 onChange={e => setForm(f => ({ ...f, og_image_url: e.target.value }))}
 placeholder="https://example.com/social-share.jpg"
 />
 </div>
 </div>
 </div>

 {/* Toggles */}
 <div style={{ background: 'var(--app-surface)', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem' }}>
 <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 600 }}>Feature Toggles</h3>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
 {[
 { key: 'ecommerce_enabled', label: 'eCommerce Enabled', desc: 'Allow clients to place orders' },
 { key: 'show_stock_levels', label: 'Show Stock Levels', desc: 'Display exact quantities vs In Stock/Out of Stock' },
 { key: 'allow_guest_browsing', label: 'Guest Browsing', desc: 'Allow unauthenticated catalog browsing' },
 { key: 'require_approval_for_orders', label: 'Require Approval', desc: 'Orders need admin approval before processing' },
 ].map(toggle => (
 <div key={toggle.key} style={{
 display: 'flex', justifyContent: 'space-between', alignItems: 'center',
 padding: '0.75rem', borderRadius: '8px', background: 'var(--app-surface-2)',
 }}>
 <div>
 <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>{toggle.label}</div>
 <div style={{ fontSize: '0.8rem', color: 'var(--app-muted-foreground)' }}>{toggle.desc}</div>
 </div>
 <button
 onClick={() => setForm(f => ({ ...f, [toggle.key]: !(f as any)[toggle.key] }))}
 style={{
 width: '44px', height: '24px', borderRadius: '12px', border: 'none',
 background: (form as any)[toggle.key] ? 'var(--app-primary)' : '#cbd5e1',
 cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
 }}
 >
 <div style={{
 width: '18px', height: '18px', borderRadius: '50%', background: 'var(--app-surface)',
 position: 'absolute', top: '3px',
 left: (form as any)[toggle.key] ? '23px' : '3px',
 transition: 'left 0.2s',
 }} />
 </button>
 </div>
 ))}
 </div>
 </div>

 {/* Save */}
 <button
 onClick={handleSave}
 disabled={saving}
 style={{
 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
 padding: '0.75rem 2rem', border: 'none', borderRadius: '10px',
 background: saved ? 'var(--app-success)' : 'var(--app-primary)',
 color: 'var(--app-primary-foreground)', fontWeight: 600, fontSize: '0.95rem',
 cursor: saving ? 'not-allowed' : 'pointer',
 transition: 'background 0.2s',
 alignSelf: 'flex-start',
 }}
 >
 {saved ? <><Check size={18} /> Saved</> : <><Save size={18} /> {saving ? 'Saving...' : 'Save Settings'}</>}
 </button>
 </div>
 );
}
