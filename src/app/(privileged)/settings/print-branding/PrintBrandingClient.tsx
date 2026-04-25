'use client';

import { useEffect, useState } from 'react';
import {
    Building2, Save, Loader2, ExternalLink, Info, Eye, Printer, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { erpFetch } from '@/lib/erp-api';

interface OrgPayload {
    name?: string;
    logo?: string | null;
    business_email?: string | null;
    phone?: string | null;
    website?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
    country?: string | null;
    settings?: Record<string, any>;
}

interface Props {
    initialOrg: OrgPayload | null;
}

export function PrintBrandingClient({ initialOrg }: Props) {
    const [org, setOrg] = useState<OrgPayload | null>(initialOrg);
    const [footerNote, setFooterNote] = useState<string>(
        initialOrg?.settings?.print_footer_note || ''
    );
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setFooterNote(org?.settings?.print_footer_note || '');
    }, [org]);

    const dirty = (org?.settings?.print_footer_note || '') !== footerNote;

    const save = async () => {
        setSaving(true);
        try {
            const updated = await erpFetch('organizations/me/', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: { print_footer_note: footerNote.trim() || null },
                }),
            });
            setOrg(updated as OrgPayload);
            toast.success('Footer note saved');
            // Bust the tenant-brand cache so the next print pulls fresh data.
            try {
                const mod = await import('@/components/admin/_shared/tenant-brand');
                (mod as any).default = null;
            } catch { /* cache reset best-effort */ }
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const addressLine = [
        org?.address, org?.city, org?.state, org?.zip_code, org?.country,
    ].filter(Boolean).join(', ');
    const contactLine = [
        org?.business_email, org?.phone, org?.website,
    ].filter(Boolean).join(' · ');

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-5">

            {/* ── Left: editable settings ── */}
            <div className="space-y-4">

                {/* Org profile (read-only) */}
                <div
                    className="rounded-2xl p-4 sm:p-5 space-y-3"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                                Source data
                            </p>
                            <h3 className="text-tp-md font-bold text-app-foreground">Organization Profile</h3>
                        </div>
                        <a
                            href="/settings/organization"
                            className="flex items-center gap-1 text-tp-xs font-bold transition-all hover:underline"
                            style={{ color: 'var(--app-primary)' }}
                        >
                            Edit profile <ExternalLink size={11} />
                        </a>
                    </div>

                    <div className="flex items-start gap-3">
                        {org?.logo ? (
                            <img
                                src={org.logo}
                                alt=""
                                className="w-16 h-16 rounded-xl object-contain flex-shrink-0"
                                style={{ background: 'white', border: '1px solid var(--app-border)' }}
                            />
                        ) : (
                            <div
                                className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)',
                                    color: 'var(--app-primary)',
                                }}
                            >
                                <Building2 size={22} />
                            </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-tp-md font-bold text-app-foreground truncate">
                                {org?.name || 'Untitled organization'}
                            </p>
                            <p className="text-tp-xs text-app-muted-foreground truncate">
                                {addressLine || <span className="italic">No address — set one in Organization Profile</span>}
                            </p>
                            <p className="text-tp-xs text-app-muted-foreground truncate font-mono">
                                {contactLine || <span className="italic">No contact details</span>}
                            </p>
                        </div>
                    </div>

                    {(!org?.logo || !addressLine) && (
                        <div
                            className="flex items-start gap-2 p-2.5 rounded-xl text-tp-xs"
                            style={{
                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)',
                                color: 'var(--app-foreground)',
                            }}
                        >
                            <Info size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                            <span>
                                {!org?.logo && 'Upload a logo'}{(!org?.logo && !addressLine) ? ' and ' : ''}{!addressLine && 'fill in your address'} to make printed letterheads complete.
                            </span>
                        </div>
                    )}
                </div>

                {/* Footer note (editable) */}
                <div
                    className="rounded-2xl p-4 sm:p-5 space-y-3"
                    style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}
                >
                    <div>
                        <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground">
                            Editable
                        </p>
                        <h3 className="text-tp-md font-bold text-app-foreground">Print Footer Note</h3>
                        <p className="text-tp-xs text-app-muted-foreground mt-0.5">
                            Appears next to your tenant name in the footer of every printed page. Use it for
                            trade-register, VAT/TIN, or compliance lines.
                        </p>
                    </div>

                    <textarea
                        value={footerNote}
                        onChange={e => setFooterNote(e.target.value.slice(0, 200))}
                        placeholder="e.g., RC Beirut 12345 · TIN 0123456789 · Cap. social 50,000,000 LBP"
                        rows={2}
                        className="w-full rounded-xl px-3 py-2 text-tp-sm font-medium outline-none transition-all resize-none"
                        style={{
                            background: 'var(--app-background)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }}
                    />
                    <div className="flex items-center justify-between">
                        <span className="text-tp-xxs font-bold text-app-muted-foreground">
                            {footerNote.length} / 200
                        </span>
                        <button
                            onClick={save}
                            disabled={saving || !dirty}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}
                        >
                            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            Save note
                        </button>
                    </div>
                </div>

                {/* What this affects */}
                <div
                    className="rounded-2xl p-4 sm:p-5 flex items-start gap-3"
                    style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 5%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 18%, transparent)',
                    }}
                >
                    <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--app-info, #3b82f6)', color: 'white' }}
                    >
                        <Printer size={14} />
                    </div>
                    <div>
                        <p className="text-tp-sm font-bold text-app-foreground">Where the letterhead appears</p>
                        <p className="text-tp-xs text-app-muted-foreground mt-0.5">
                            Every <strong>Data → Print list</strong> action across Categories, Brands, Attributes,
                            and any future master-data page. Users can toggle the letterhead off per-print from
                            the Print dialog.
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Right: live preview ── */}
            <div className="space-y-3 lg:sticky lg:top-4 self-start">
                <div className="flex items-center justify-between">
                    <p className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground flex items-center gap-1.5">
                        <Eye size={10} />
                        Live preview
                    </p>
                    <button
                        type="button"
                        onClick={() => location.reload()}
                        title="Reload to fetch latest profile"
                        className="text-tp-xxs font-bold flex items-center gap-1 px-2 py-1 rounded transition-all hover:bg-app-background"
                        style={{ color: 'var(--app-muted-foreground)' }}
                    >
                        <RefreshCw size={9} /> Refresh
                    </button>
                </div>

                {/* Paper preview */}
                <div
                    className="rounded-2xl overflow-hidden"
                    style={{
                        background: 'white',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 12px 30px rgba(0,0,0,0.10)',
                    }}
                >
                    <div className="p-5" style={{ color: '#111', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', fontSize: '11px' }}>
                        {/* Letterhead */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '8px', marginBottom: '10px', borderBottom: '1.5px solid #374151' }}>
                            {org?.logo ? (
                                <img src={org.logo} alt="" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
                            ) : (
                                <div style={{ height: '44px', width: '44px', borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                                    <Building2 size={20} />
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 1px', color: '#111' }}>
                                    {org?.name || 'Your Company Name'}
                                </p>
                                <p style={{ fontSize: '9.5px', margin: 0, color: '#444' }}>
                                    {addressLine || '—'}
                                </p>
                                <p style={{ fontSize: '9.5px', margin: 0, color: '#777' }}>
                                    {contactLine || '—'}
                                </p>
                            </div>
                        </div>

                        {/* Title block */}
                        <h1 style={{ fontSize: '15px', margin: '0 0 2px' }}>Categories</h1>
                        <p style={{ fontSize: '11px', margin: '0 0 4px', color: '#555' }}>Product Taxonomy</p>
                        <p style={{ fontSize: '9px', margin: '0 0 12px', color: '#777' }}>
                            42 rows · {new Date().toLocaleString()}
                        </p>

                        {/* Mock table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
                            <thead>
                                <tr>
                                    <th style={{ background: '#f3f4f6', padding: '5px 7px', textAlign: 'left', borderBottom: '1px solid #d1d5db', fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Category Path</th>
                                    <th style={{ background: '#f3f4f6', padding: '5px 7px', textAlign: 'left', borderBottom: '1px solid #d1d5db', fontSize: '8.5px', textTransform: 'uppercase' }}>Code</th>
                                    <th style={{ background: '#f3f4f6', padding: '5px 7px', textAlign: 'right', borderBottom: '1px solid #d1d5db', fontSize: '8.5px', textTransform: 'uppercase' }}>Products</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['Beverages', '1000', 42],
                                    ['Beverages › Soft Drinks', '1001', 18],
                                    ['Beverages › Coffee & Tea', '1002', 12],
                                    ['Snacks', '2000', 24],
                                ].map(([path, code, n], i) => (
                                    <tr key={i} style={{ background: i % 2 === 1 ? '#fafbfc' : 'transparent' }}>
                                        <td style={{ padding: '5px 7px', borderBottom: '1px solid #e5e7eb' }}>{path}</td>
                                        <td style={{ padding: '5px 7px', borderBottom: '1px solid #e5e7eb', fontFamily: 'ui-monospace, monospace' }}>{code}</td>
                                        <td style={{ padding: '5px 7px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{n}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Footer */}
                        <div style={{ marginTop: '24px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#888' }}>
                            <span>
                                {org?.name || 'Your Company'}
                                {footerNote ? ` · ${footerNote}` : ''}
                            </span>
                            <span>Generated {new Date().toLocaleDateString()}</span>
                            <span>Page 1</span>
                        </div>
                    </div>
                </div>

                <p className="text-tp-xxs font-bold text-app-muted-foreground text-center px-4">
                    The footer note appears next to your tenant name on every printed page.
                </p>
            </div>
        </div>
    );
}
