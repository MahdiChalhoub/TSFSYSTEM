'use client';

/**
 * PrintDialog — shared, configurable print preview for any master-data list.
 *
 * Each consumer supplies a PrintSpec: title + columns + rows. The dialog
 * lets the user toggle columns, pick portrait/landscape, show/hide header
 * & footer, and optionally include a summary row. The rendered preview
 * mirrors exactly what will print so the user sees before they print.
 *
 * Preferences (selected columns + layout toggles) persist in localStorage
 * under `spec.prefKey` so the user doesn't redo their choices every time.
 */

import { useEffect, useMemo, useState } from 'react';
import {
    X, Printer, Loader2, Settings2, FileDown,
    Columns as ColumnsIcon, Building2,
} from 'lucide-react';
import { getTenantBrand, formatAddress, type TenantBrand } from './tenant-brand';

export interface PrintColumn {
    key: string;
    label: string;
    mono?: boolean;
    align?: 'left' | 'right' | 'center';
    /** Width hint used by the print stylesheet (e.g. "120px", "25%"). */
    width?: string;
    /** When true, checkbox starts checked. Default: true. */
    defaultOn?: boolean;
}

export interface PrintSpec {
    title: string;
    subtitle?: string;
    /** Column catalogue — the user picks a subset. */
    columns: PrintColumn[];
    /** Flat row objects keyed by `column.key`. Pre-format dates/numbers
     *  on the consumer side so the print pipeline stays stateless. */
    rows: Record<string, any>[];
    /** localStorage key for persisting the user's column + layout pick.
     *  Scope it per-entity, e.g. "print.categories", "print.brands". */
    prefKey?: string;
    /** Optional line shown below the title (e.g. "Filtered: Beverages").
     *  Renders only when `layout.showHeader` is on. */
    filterLine?: string;
}

interface Prefs {
    cols: string[];
    orientation: 'portrait' | 'landscape';
    showHeader: boolean;
    showFooter: boolean;
    showSummary: boolean;
    stripeRows: boolean;
    /** Stamp the tenant's letterhead (logo + name + address) on the print. */
    showBranding: boolean;
}

const DEFAULT_PREFS: Prefs = {
    cols: [],
    orientation: 'portrait',
    showHeader: true,
    showFooter: true,
    showSummary: false,
    stripeRows: true,
    showBranding: true,
};

function loadPrefs(spec: PrintSpec): Prefs {
    const defaults: Prefs = {
        ...DEFAULT_PREFS,
        cols: spec.columns
            .filter(c => c.defaultOn !== false)
            .map(c => c.key),
    };
    if (!spec.prefKey || typeof window === 'undefined') return defaults;
    try {
        const raw = window.localStorage.getItem(spec.prefKey);
        if (!raw) return defaults;
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
    } catch {
        return defaults;
    }
}

function savePrefs(prefKey: string | undefined, prefs: Prefs) {
    if (!prefKey || typeof window === 'undefined') return;
    try { window.localStorage.setItem(prefKey, JSON.stringify(prefs)); } catch { /* ignore */ }
}

const xmlEscape = (s: any) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>)[c]);

interface Props {
    isOpen: boolean;
    onClose: () => void;
    spec: PrintSpec;
}

export function PrintDialog({ isOpen, onClose, spec }: Props) {
    const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs(spec));
    const [printing, setPrinting] = useState(false);
    const [brand, setBrand] = useState<TenantBrand | null>(null);

    // Re-hydrate prefs when the dialog opens so a fresh page mount picks
    // up the latest storage state (e.g. changed on another tab).
    useEffect(() => {
        if (isOpen) setPrefs(loadPrefs(spec));
    }, [isOpen, spec.prefKey]);

    // Fetch tenant brand on first open; module-level cache covers repeats.
    useEffect(() => {
        if (isOpen) getTenantBrand().then(setBrand).catch(() => setBrand(null));
    }, [isOpen]);

    // Persist as the user tweaks — no "save preferences" button needed.
    useEffect(() => {
        if (isOpen) savePrefs(spec.prefKey, prefs);
    }, [prefs, spec.prefKey, isOpen]);

    const selectedColumns = useMemo(
        () => spec.columns.filter(c => prefs.cols.includes(c.key)),
        [spec.columns, prefs.cols]
    );

    const toggleCol = (key: string) =>
        setPrefs(p => ({
            ...p,
            cols: p.cols.includes(key) ? p.cols.filter(k => k !== key) : [...p.cols, key],
        }));

    const selectAll = () => setPrefs(p => ({ ...p, cols: spec.columns.map(c => c.key) }));
    const selectNone = () => setPrefs(p => ({ ...p, cols: [] }));
    const selectDefault = () => setPrefs(p => ({
        ...p,
        cols: spec.columns.filter(c => c.defaultOn !== false).map(c => c.key),
    }));

    if (!isOpen) return null;

    const doPrint = async () => {
        if (selectedColumns.length === 0) return;
        setPrinting(true);

        // Make sure the tenant brand has resolved before we build the
        // print HTML — otherwise a fast clicker outruns the fetch and
        // the letterhead silently drops out. getTenantBrand() is cached,
        // so post-first-call this is a no-op resolve.
        let activeBrand: TenantBrand | null = brand;
        if (prefs.showBranding && !activeBrand) {
            try { activeBrand = await getTenantBrand(); } catch { activeBrand = null; }
            if (activeBrand) setBrand(activeBrand);
        }

        const cols = selectedColumns;
        const rows = spec.rows;

        // Tenant letterhead — logo + legal name + contact. Rendered above the
        // page title when `showBranding` is on (default). Logos come back as
        // relative URLs from Django; we resolve to absolute so the iframe can
        // load them without same-origin surprises. If the org profile is
        // empty (no name, no logo, no address) we suppress the block entirely
        // rather than printing an empty divider line.
        const logoSrc = activeBrand?.logo && typeof window !== 'undefined'
            ? (activeBrand.logo.startsWith('http') ? activeBrand.logo : new URL(activeBrand.logo, window.location.origin).href)
            : '';
        const addressLine = activeBrand ? formatAddress(activeBrand) : '';
        const contactLine = activeBrand
            ? [activeBrand.businessEmail, activeBrand.phone, activeBrand.website].filter(Boolean).join(' · ')
            : '';
        const hasAnyBrand = !!(activeBrand && (activeBrand.name || logoSrc || addressLine || contactLine));
        const brandHtml = (prefs.showBranding && hasAnyBrand) ? `
            <div class="letterhead">
                ${logoSrc ? `<img class="logo" src="${xmlEscape(logoSrc)}" alt="" />` : ''}
                <div class="lh-body">
                    ${activeBrand!.name ? `<h2 class="lh-name">${xmlEscape(activeBrand!.name)}</h2>` : ''}
                    ${addressLine ? `<p class="lh-line">${xmlEscape(addressLine)}</p>` : ''}
                    ${contactLine ? `<p class="lh-line muted">${xmlEscape(contactLine)}</p>` : ''}
                </div>
            </div>
        ` : '';

        const headerHtml = prefs.showHeader ? `
            <div class="doc-header">
                <h1>${xmlEscape(spec.title)}</h1>
                ${spec.subtitle ? `<p class="sub">${xmlEscape(spec.subtitle)}</p>` : ''}
                <p class="meta">
                    ${rows.length} row${rows.length === 1 ? '' : 's'}
                    · ${xmlEscape(new Date().toLocaleString())}
                    ${spec.filterLine ? ` · ${xmlEscape(spec.filterLine)}` : ''}
                </p>
            </div>
        ` : '';

        const footerBrandText = (prefs.showBranding && activeBrand?.name) ? activeBrand.name : spec.title;
        const footerNote = (prefs.showBranding && activeBrand?.printFooterNote) ? activeBrand.printFooterNote : '';
        const footerHtml = prefs.showFooter ? `
            <div class="doc-footer">
                <span class="left">${xmlEscape(footerBrandText)}${footerNote ? ` · ${xmlEscape(footerNote)}` : ''}</span>
                <span class="center">Generated ${xmlEscape(new Date().toLocaleDateString())}</span>
                <span class="right">Page <span class="pn"></span></span>
            </div>
        ` : '';

        const summaryHtml = prefs.showSummary ? (() => {
            const numericCols = cols.filter(c => c.align === 'right' &&
                rows.some(r => typeof r[c.key] === 'number'));
            if (numericCols.length === 0) return '';
            return `<tfoot><tr class="summary">
                ${cols.map((c, i) => {
                    if (i === 0) return `<td><strong>Total</strong></td>`;
                    if (numericCols.includes(c)) {
                        const sum = rows.reduce((s, r) => s + (Number(r[c.key]) || 0), 0);
                        return `<td class="num"><strong>${sum}</strong></td>`;
                    }
                    return `<td></td>`;
                }).join('')}
            </tr></tfoot>`;
        })() : '';

        const theadHtml = `<thead><tr>
            ${cols.map(c => `<th class="${c.align || 'left'}"${c.width ? ` style="width:${c.width}"` : ''}>${xmlEscape(c.label)}</th>`).join('')}
        </tr></thead>`;

        const tbodyHtml = `<tbody>
            ${rows.map(r => `<tr>${cols.map(c => {
                const v = r[c.key];
                const cls = [c.align || 'left', c.mono ? 'mono' : ''].filter(Boolean).join(' ');
                return `<td class="${cls}">${xmlEscape(v ?? '')}</td>`;
            }).join('')}</tr>`).join('')}
        </tbody>`;

        const html = `<!doctype html><html><head><meta charset="utf-8"/>
            <title>${xmlEscape(spec.title)} — ${new Date().toISOString().slice(0, 10)}</title>
            <style>
                @page {
                    size: A4 ${prefs.orientation};
                    margin: 14mm 12mm 18mm 12mm;
                }
                * { box-sizing: border-box; }
                html, body { margin: 0; padding: 0; }
                body {
                    font-family: system-ui, -apple-system, Segoe UI, sans-serif;
                    color: #111;
                    font-size: 10.5px;
                    line-height: 1.35;
                }
                .letterhead {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding-bottom: 8px;
                    margin-bottom: 10px;
                    border-bottom: 1.5px solid #374151;
                }
                .letterhead .logo { height: 44px; width: auto; object-fit: contain; }
                .letterhead .lh-body { flex: 1; min-width: 0; }
                .letterhead .lh-name { font-size: 14px; margin: 0 0 1px; font-weight: 700; color: #111; }
                .letterhead .lh-line { font-size: 9.5px; margin: 0; color: #444; }
                .letterhead .lh-line.muted { color: #777; }
                .doc-header { margin-bottom: 12px; }
                .doc-header h1 { font-size: 15px; margin: 0 0 2px; }
                .doc-header .sub { color: #555; font-size: 11px; margin: 0 0 4px; }
                .doc-header .meta { color: #777; font-size: 9px; margin: 0; }
                table { width: 100%; border-collapse: collapse; }
                thead { display: table-header-group; } /* repeat header on each page */
                tfoot { display: table-row-group; }
                th, td { padding: 5px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
                th {
                    background: #f3f4f6;
                    text-transform: uppercase;
                    font-size: 8.5px;
                    letter-spacing: 0.04em;
                    color: #374151;
                    border-bottom: 1px solid #d1d5db;
                }
                th.right, td.right { text-align: right; }
                th.center, td.center { text-align: center; }
                th.left, td.left { text-align: left; }
                td.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; }
                td.num, th.num { font-variant-numeric: tabular-nums; }
                ${prefs.stripeRows ? 'tbody tr:nth-child(even) td { background: #fafbfc; }' : ''}
                tr { page-break-inside: avoid; }
                tfoot .summary td { background: #f3f4f6; border-top: 1.5px solid #9ca3af; }
                .doc-footer {
                    position: fixed;
                    left: 0; right: 0; bottom: 4mm;
                    font-size: 8.5px;
                    color: #888;
                    display: flex;
                    justify-content: space-between;
                    padding: 0 12mm;
                }
                .doc-footer .pn::after { content: counter(page); }
            </style></head><body>
            ${brandHtml}
            ${headerHtml}
            <table>${theadHtml}${tbodyHtml}${summaryHtml}</table>
            ${footerHtml}
        </body></html>`;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);
        const cleanup = () => setTimeout(() => { iframe.remove(); setPrinting(false); }, 500);
        iframe.onload = () => {
            const win = iframe.contentWindow;
            if (!win) { cleanup(); return; }
            win.addEventListener('afterprint', cleanup, { once: true });
            win.focus();
            win.print();
        };
        const doc = iframe.contentDocument;
        if (!doc) { iframe.remove(); setPrinting(false); return; }
        doc.open(); doc.write(html); doc.close();
    };

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
             onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="w-full max-w-lg max-h-[92vh] rounded-2xl flex flex-col overflow-hidden"
                 style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                     style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                             style={{ background: 'var(--app-warning, #f59e0b)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                            <Printer size={15} className="text-white" />
                        </div>
                        <div>
                            <h3>Print {spec.title}</h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground">
                                Pick what appears on paper
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {/* ── Columns ── */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-tp-xxs font-bold uppercase tracking-widest flex items-center gap-1.5"
                                   style={{ color: 'var(--app-muted-foreground)' }}>
                                <ColumnsIcon size={10} />
                                Columns <span style={{ color: 'var(--app-primary)' }}>({prefs.cols.length} / {spec.columns.length})</span>
                            </label>
                            <div className="flex items-center gap-1 text-tp-xxs font-bold">
                                <button type="button" onClick={selectAll}
                                        className="px-2 py-0.5 rounded hover:bg-app-background transition-all"
                                        style={{ color: 'var(--app-muted-foreground)' }}>All</button>
                                <button type="button" onClick={selectNone}
                                        className="px-2 py-0.5 rounded hover:bg-app-background transition-all"
                                        style={{ color: 'var(--app-muted-foreground)' }}>None</button>
                                <button type="button" onClick={selectDefault}
                                        className="px-2 py-0.5 rounded hover:bg-app-background transition-all"
                                        style={{ color: 'var(--app-primary)' }}>Default</button>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-1 p-1.5 rounded-xl"
                             style={{ background: 'var(--app-background)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                            {spec.columns.map(c => {
                                const checked = prefs.cols.includes(c.key);
                                return (
                                    <label key={c.key}
                                           className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-all"
                                           style={{
                                               background: checked ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                                               color: checked ? 'var(--app-primary)' : 'var(--app-foreground)',
                                           }}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleCol(c.key)}
                                            className="w-3.5 h-3.5 rounded"
                                            style={{ accentColor: 'var(--app-primary)' }}
                                        />
                                        <span className="text-tp-sm font-bold truncate">{c.label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Layout ── */}
                    <div>
                        <label className="text-tp-xxs font-bold uppercase tracking-widest flex items-center gap-1.5 mb-1.5"
                               style={{ color: 'var(--app-muted-foreground)' }}>
                            <Settings2 size={10} />
                            Layout
                        </label>
                        <div className="space-y-2">
                            {/* Orientation */}
                            <div className="flex items-center gap-2">
                                <span className="text-tp-xs font-bold w-24 flex-shrink-0" style={{ color: 'var(--app-muted-foreground)' }}>
                                    Orientation
                                </span>
                                <div className="flex rounded-lg overflow-hidden p-0.5 gap-0.5"
                                     style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                    {(['portrait', 'landscape'] as const).map(o => (
                                        <button key={o} type="button"
                                                onClick={() => setPrefs(p => ({ ...p, orientation: o }))}
                                                className="px-3 py-1 rounded text-tp-xxs font-bold uppercase transition-all"
                                                style={{
                                                    background: prefs.orientation === o ? 'var(--app-surface)' : 'transparent',
                                                    color: prefs.orientation === o ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                                    boxShadow: prefs.orientation === o ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
                                                }}>
                                            {o}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Toggles */}
                            <ToggleRow
                                label="Tenant letterhead"
                                hint={brand
                                    ? `Logo + ${brand.name}${brand.city ? ' · ' + brand.city : ''}`
                                    : 'Loading tenant info…'}
                                checked={prefs.showBranding}
                                disabled={!brand}
                                onChange={v => setPrefs(p => ({ ...p, showBranding: v }))} />
                            <ToggleRow label="Title header" hint="Page title + count + date" checked={prefs.showHeader}
                                       onChange={v => setPrefs(p => ({ ...p, showHeader: v }))} />
                            <ToggleRow label="Footer" hint="Page numbers + timestamp" checked={prefs.showFooter}
                                       onChange={v => setPrefs(p => ({ ...p, showFooter: v }))} />
                            <ToggleRow label="Stripe rows" hint="Alternating row background for readability" checked={prefs.stripeRows}
                                       onChange={v => setPrefs(p => ({ ...p, stripeRows: v }))} />
                            <ToggleRow label="Summary row" hint="Adds a Total row for numeric columns" checked={prefs.showSummary}
                                       onChange={v => setPrefs(p => ({ ...p, showSummary: v }))} />
                        </div>
                    </div>

                    {/* Tenant brand preview — clear, honest about what will print.
                     *  If the org profile is empty we say so loudly with a link
                     *  to the place to fix it — otherwise the user is left
                     *  wondering why their print came out without a letterhead. */}
                    {prefs.showBranding && (() => {
                        const hasName = !!brand?.name;
                        const hasLogo = !!brand?.logo;
                        const hasAddress = !!(brand && formatAddress(brand));
                        const hasAny = hasName || hasLogo || hasAddress;
                        if (!brand) {
                            return (
                                <div className="p-2.5 rounded-xl text-tp-xs font-bold"
                                     style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                                    Loading tenant info…
                                </div>
                            );
                        }
                        if (!hasAny) {
                            return (
                                <div className="p-2.5 rounded-xl flex items-start gap-2.5"
                                     style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                                    <Building2 size={14} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-warning, #f59e0b)' }} />
                                    <div className="flex-1 text-tp-xs">
                                        <p className="font-bold" style={{ color: 'var(--app-foreground)' }}>
                                            Your organization profile is empty
                                        </p>
                                        <p className="font-bold mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                            Add a logo, name, and address at <a href="/settings/print-branding" className="underline" style={{ color: 'var(--app-warning, #f59e0b)' }}>Print Letterhead</a> — without them, prints will skip the letterhead.
                                        </p>
                                    </div>
                                </div>
                            );
                        }
                        return (
                            <div className="p-2.5 rounded-xl flex items-center gap-2.5"
                                 style={{ background: 'color-mix(in srgb, var(--app-primary) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--app-primary) 20%, transparent)' }}>
                                {hasLogo ? (
                                    <img src={brand.logo!} alt="" className="w-9 h-9 rounded-lg object-contain"
                                         style={{ background: 'white', border: '1px solid var(--app-border)' }} />
                                ) : (
                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                                         style={{ background: 'var(--app-primary)', color: 'white' }}>
                                        <Building2 size={15} />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-tp-sm font-bold truncate" style={{ color: 'var(--app-foreground)' }}>
                                        {hasName ? brand.name : <span className="italic">No name set</span>}
                                    </p>
                                    <p className="text-tp-xxs font-bold truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                                        {hasAddress ? formatAddress(brand) : <span className="italic">No address — <a href="/settings/print-branding" className="underline">add one</a></span>}
                                    </p>
                                </div>
                                <span className="text-tp-xxs font-bold uppercase tracking-wide flex-shrink-0"
                                      style={{ color: 'var(--app-primary)' }}>
                                    Letterhead
                                </span>
                            </div>
                        );
                    })()}

                    {/* Preview note */}
                    <div className="p-3 rounded-xl flex items-start gap-2 text-tp-xs font-bold"
                         style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)' }}>
                        <FileDown size={12} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--app-info, #3b82f6)' }} />
                        <span style={{ color: 'var(--app-foreground)' }}>
                            Will print <strong>{spec.rows.length}</strong> row{spec.rows.length === 1 ? '' : 's'} across <strong>{prefs.cols.length}</strong> column{prefs.cols.length === 1 ? '' : 's'} in <strong>{prefs.orientation}</strong>. Your choices are remembered for next time.
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                     style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}>
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {prefs.cols.length === 0 ? 'Pick at least one column' : `Ready to print`}
                    </div>
                    <button onClick={onClose} disabled={printing}
                            className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                            style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        Cancel
                    </button>
                    <button onClick={doPrint}
                            disabled={printing || prefs.cols.length === 0}
                            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-tp-xs font-bold text-white transition-all hover:brightness-110 disabled:opacity-50"
                            style={{ background: 'var(--app-warning, #f59e0b)', boxShadow: '0 2px 8px color-mix(in srgb, var(--app-warning, #f59e0b) 25%, transparent)' }}>
                        {printing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
                        Print
                    </button>
                </div>
            </div>
        </div>
    );
}

function ToggleRow({
    label, hint, checked, onChange, disabled = false,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className={`flex items-center gap-2 ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onChange(!checked)}
                className="relative w-9 h-5 rounded-full transition-all flex-shrink-0 disabled:cursor-not-allowed"
                style={{
                    background: checked ? 'var(--app-primary)' : 'var(--app-border)',
                }}
                role="switch"
                aria-checked={checked}
            >
                <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                    style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }}
                />
            </button>
            <span className="flex-1 min-w-0">
                <span className="text-tp-sm font-bold block" style={{ color: 'var(--app-foreground)' }}>{label}</span>
                <span className="text-tp-xxs font-bold" style={{ color: 'var(--app-muted-foreground)' }}>{hint}</span>
            </span>
        </label>
    );
}
