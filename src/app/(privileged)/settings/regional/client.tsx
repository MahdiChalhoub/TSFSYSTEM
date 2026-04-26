'use client';

/**
 * Regional Settings — Dajingo Pro V2
 * ==================================
 * Per .agents/workflows/design-language.md:
 *   §1  Page wrapper:        flex flex-col h-full p-4 md:p-6 animate-in fade-in
 *   §2  Page header:         page-header-icon · text-lg md:text-xl font-black ·
 *                            uppercase tracking-widest subtitle
 *   §3  Adaptive grid:       repeat(auto-fit, minmax(140px, 1fr))
 *   §4  KPI strip:           w-7 h-7 icon box · text-[10px] uppercase label ·
 *                            text-sm font-black tabular-nums value
 *   §6  Content shell:       bg-app-surface/30 border border-app-border/50 rounded-2xl
 *   §9  Empty state:         icon @ opacity-40 · text-sm bold · text-[11px] hint
 *   §11 Modal:               rounded-2xl shell with primary glow
 *   §12 Inline form:         left-accent border, auto-fit field grid
 *   §14 Color tokens:        var(--app-primary | info | success | warning | error)
 *   §15 Typography scale:    explicit minimums
 *
 * Tabs (4): Countries · Currencies · FX & Rates · Languages
 *   Countries / Currencies share a 2-pane picker (selection ← available)
 *   FX delegates to FxManagementSection (already aligned)
 *   Languages is a single-card multi-select picker
 */

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Globe, DollarSign, Search, Plus, Star, Check, X, MapPin,
    Phone, Loader2, Coins, AlertTriangle,
    Crown, Trash2, TrendingUp, Languages, Save,
} from 'lucide-react';
import type { RefCountry, RefCurrency, OrgCountry, OrgCurrency } from '@/types/erp';
import {
    enableOrgCountry, enableOrgCurrency,
    setDefaultOrgCountry, setDefaultOrgCurrency,
    disableOrgCountry, disableOrgCurrency,
} from '@/app/actions/reference';
import { toast } from 'sonner';
import { getCatalogueLanguages, setCatalogueLanguages, labelFor, isRTL } from '@/lib/catalogue-languages';
import { FxManagementSection } from './_components/FxManagementSection';

/* ─── Helpers ──────────────────────────────────────────────────── */
const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))` });
const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` });
const glow = (v: string, opacity = 30) => ({ boxShadow: `0 4px 14px color-mix(in srgb, var(${v}) ${opacity}%, transparent)` });
function flag(iso2: string) {
    if (!iso2 || iso2.length !== 2) return '🏳️';
    return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

/* ─── Types ────────────────────────────────────────────────────── */
interface Props { allCountries: RefCountry[]; allCurrencies: RefCurrency[]; initialOrgCountries: OrgCountry[]; initialOrgCurrencies: OrgCurrency[]; }
type Tab = 'countries' | 'currencies' | 'fx' | 'languages';

const COMMON_LOCALES: { code: string; native: string }[] = [
    { code: 'en', native: 'English' }, { code: 'fr', native: 'Français' }, { code: 'ar', native: 'العربية' },
    { code: 'es', native: 'Español' }, { code: 'de', native: 'Deutsch' }, { code: 'it', native: 'Italiano' },
    { code: 'pt', native: 'Português' }, { code: 'nl', native: 'Nederlands' }, { code: 'tr', native: 'Türkçe' },
    { code: 'ru', native: 'Русский' }, { code: 'zh', native: '中文' }, { code: 'ja', native: '日本語' },
    { code: 'he', native: 'עברית' }, { code: 'fa', native: 'فارسی' },
];

type ConfirmAction = {
    type: 'set-default-country' | 'set-default-currency' | 'disable-country' | 'disable-currency';
    label: string;
    onConfirm: () => void;
} | null;

/* ═══════════════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════════════ */
export default function RegionalSettingsClient({ allCountries, allCurrencies, initialOrgCountries, initialOrgCurrencies }: Props) {
    /* ─── State ─────────────────────────────────────────────────── */
    const searchParams = useSearchParams();
    const initialTab = (searchParams?.get('tab') as Tab | null) ?? 'countries';
    const validTab: Tab = (['countries', 'currencies', 'fx', 'languages'] as const).includes(initialTab as any) ? initialTab : 'countries';
    const [tab, setTab] = useState<Tab>(validTab);
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [orgCountries, setOrgCountries] = useState<OrgCountry[]>(initialOrgCountries);
    const [orgCurrencies, setOrgCurrencies] = useState<OrgCurrency[]>(initialOrgCurrencies);
    const [isPending, startTransition] = useTransition();
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

    // Catalogue languages
    const [langCodes, setLangCodes] = useState<string[]>([]);
    const [langCustom, setLangCustom] = useState('');
    const [langLoading, setLangLoading] = useState(false);
    const [langSaving, setLangSaving] = useState(false);
    useEffect(() => {
        if (tab !== 'languages' || langCodes.length > 0) return;
        setLangLoading(true);
        getCatalogueLanguages()
            .then(setLangCodes)
            .catch(() => setLangCodes(['fr', 'ar']))
            .finally(() => setLangLoading(false));
    }, [tab, langCodes.length]);
    const toggleLang = (c: string) => setLangCodes(p => p.includes(c) ? p.filter(x => x !== c) : [...p, c]);
    const addCustomLang = () => {
        const n = langCustom.trim().toLowerCase().slice(0, 10);
        if (!n) return;
        if (!langCodes.includes(n)) setLangCodes(p => [...p, n]);
        setLangCustom('');
    };
    const saveLangs = async () => {
        setLangSaving(true);
        try {
            const saved = await setCatalogueLanguages(langCodes);
            setLangCodes(saved);
            toast.success(`${saved.length} language${saved.length === 1 ? '' : 's'} enabled for the catalogue`);
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setLangSaving(false);
        }
    };

    /* ─── Derived ────────────────────────────────────────────────── */
    const enabledCountryIds = useMemo(() => new Set(orgCountries.map(oc => oc.country)), [orgCountries]);
    const defaultCountryId = useMemo(() => orgCountries.find(oc => oc.is_default)?.country ?? null, [orgCountries]);
    const enabledCurrencyIds = useMemo(() => new Set(orgCurrencies.map(oc => oc.currency)), [orgCurrencies]);
    const defaultCurrencyId = useMemo(() => orgCurrencies.find(oc => oc.is_default)?.currency ?? null, [orgCurrencies]);
    const baseCurrencyCode = useMemo(() => orgCurrencies.find(o => o.is_default)?.currency_code ?? null, [orgCurrencies]);
    const regions = useMemo(
        () => [...new Set(allCountries.map(c => c.region).filter((r): r is string => Boolean(r)))].sort(),
        [allCountries],
    );

    const filteredCountries = useMemo(() => {
        let list = allCountries;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || c.iso3?.toLowerCase().includes(q) || c.phone_code?.includes(q));
        }
        if (regionFilter) list = list.filter(c => c.region === regionFilter);
        return list;
    }, [allCountries, search, regionFilter]);

    const filteredCurrencies = useMemo(() => {
        if (!search) return allCurrencies;
        const q = search.toLowerCase();
        return allCurrencies.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol?.includes(q));
    }, [allCurrencies, search]);

    /* ─── Country Actions ────────────────────────────────────────── */
    const handleEnableCountry = (country: RefCountry) => {
        startTransition(async () => {
            const res = await enableOrgCountry(country.id, enabledCountryIds.size === 0);
            if (res.success) { setOrgCountries(prev => [...prev, { id: Date.now(), country: country.id, is_enabled: true, is_default: enabledCountryIds.size === 0, country_name: country.name, country_iso2: country.iso2 }]); toast.success(`${country.name} enabled`); }
            else toast.error(res.error || 'Failed');
        });
    };
    const doSetDefaultCountry = (id: number) => {
        startTransition(async () => {
            const res = await setDefaultOrgCountry(id);
            if (res.success) { setOrgCountries(prev => prev.map(oc => ({ ...oc, is_default: oc.country === id }))); toast.success('Default country updated'); }
            else toast.error(res.error || 'Failed');
        });
    };
    const handleSetDefaultCountry = (id: number) => {
        const c = allCountries.find(x => x.id === id);
        setConfirmAction({ type: 'set-default-country', label: c?.name || 'this country', onConfirm: () => { setConfirmAction(null); doSetDefaultCountry(id); } });
    };
    const doDisableCountry = (oc: OrgCountry) => {
        startTransition(async () => {
            const res = await disableOrgCountry(oc.id);
            if (res.success) { setOrgCountries(prev => prev.filter(x => x.id !== oc.id)); toast.success('Country disabled'); }
            else toast.error(res.error || 'Failed');
        });
    };
    const handleDisableCountry = (oc: OrgCountry) => {
        if (oc.is_default) return toast.error('Cannot disable the default country. Set another default first.');
        const c = allCountries.find(x => x.id === oc.country);
        setConfirmAction({ type: 'disable-country', label: c?.name || oc.country_name || 'this country', onConfirm: () => { setConfirmAction(null); doDisableCountry(oc); } });
    };

    /* ─── Currency Actions ───────────────────────────────────────── */
    const handleEnableCurrency = (currency: RefCurrency) => {
        startTransition(async () => {
            const res = await enableOrgCurrency(currency.id, { is_default: enabledCurrencyIds.size === 0, is_transaction_currency: true });
            if (res.success) { setOrgCurrencies(prev => [...prev, { id: Date.now(), currency: currency.id, is_enabled: true, is_default: enabledCurrencyIds.size === 0, is_transaction_currency: true, is_reporting_currency: false, currency_code: currency.code, currency_name: currency.name, currency_symbol: currency.symbol }]); toast.success(`${currency.code} enabled`); }
            else toast.error(res.error || 'Failed');
        });
    };
    const doSetDefaultCurrency = (id: number) => {
        startTransition(async () => {
            const res = await setDefaultOrgCurrency(id);
            if (res.success) { setOrgCurrencies(prev => prev.map(oc => ({ ...oc, is_default: oc.currency === id }))); toast.success('Base currency updated'); }
            else toast.error(res.error || 'Failed');
        });
    };
    const handleSetDefaultCurrency = (id: number) => {
        const c = allCurrencies.find(x => x.id === id);
        setConfirmAction({ type: 'set-default-currency', label: c ? `${c.code} — ${c.name}` : 'this currency', onConfirm: () => { setConfirmAction(null); doSetDefaultCurrency(id); } });
    };
    const doDisableCurrency = (oc: OrgCurrency) => {
        startTransition(async () => {
            const res = await disableOrgCurrency(oc.id);
            if (res.success) { setOrgCurrencies(prev => prev.filter(x => x.id !== oc.id)); toast.success('Currency disabled'); }
            else toast.error(res.error || 'Failed');
        });
    };
    const handleDisableCurrency = (oc: OrgCurrency) => {
        if (oc.is_default) return toast.error('Cannot disable the base currency. Set another default first.');
        const c = allCurrencies.find(x => x.id === oc.currency);
        setConfirmAction({ type: 'disable-currency', label: c ? `${c.code} — ${c.name}` : oc.currency_code || 'this currency', onConfirm: () => { setConfirmAction(null); doDisableCurrency(oc); } });
    };

    /* ─── KPI definitions ────────────────────────────────────────── */
    const KPIS = [
        { label: 'Countries', value: orgCountries.length, icon: Globe, color: 'var(--app-primary)' },
        { label: 'Currencies', value: orgCurrencies.length, icon: Coins, color: 'var(--app-warning)' },
        { label: 'Base', value: baseCurrencyCode ?? '—', icon: Crown, color: 'var(--app-success)' },
        { label: 'Languages', value: langCodes.length || '—', icon: Languages, color: 'var(--app-info)' },
    ] as const;

    /* ─── Tab definitions ────────────────────────────────────────── */
    const TABS = [
        { key: 'countries' as Tab, label: 'Countries', icon: Globe, color: '--app-primary' },
        { key: 'currencies' as Tab, label: 'Currencies', icon: Coins, color: '--app-warning' },
        { key: 'fx' as Tab, label: 'FX & Rates', icon: TrendingUp, color: '--app-success' },
        { key: 'languages' as Tab, label: 'Languages', icon: Languages, color: '--app-info' },
    ];

    /* ─── Confirm dialog ─────────────────────────────────────────── */
    const isDestructive = confirmAction?.type.startsWith('disable');
    const confirmTitle = confirmAction?.type.startsWith('set-default') ? 'Change Default' : 'Disable Item';
    const confirmMessage = confirmAction?.type.startsWith('set-default')
        ? `Set "${confirmAction?.label}" as the new default? This affects all future transactions and documents.`
        : `Disable "${confirmAction?.label}"? It will be removed from your active list.`;

    /* ═══════════════════════════════════════════════════════════════
     *  RENDER
     * ═══════════════════════════════════════════════════════════════ */
    return (
        <>
            {/* ── Modal — design.md §11 ── */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
                    onClick={e => { if (e.target === e.currentTarget) setConfirmAction(null); }}>
                    <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                        <div className="px-5 py-3 flex items-center gap-2.5"
                            style={{ background: `color-mix(in srgb, var(${isDestructive ? '--app-error' : '--app-warning'}) 6%, var(--app-surface))`, borderBottom: '1px solid var(--app-border)' }}>
                            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                                style={{ background: `var(${isDestructive ? '--app-error' : '--app-warning'})`, ...glow(isDestructive ? '--app-error' : '--app-warning') }}>
                                <AlertTriangle size={15} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-app-foreground">{confirmTitle}</h3>
                                <p className="text-[10px] font-bold text-app-muted-foreground">{isDestructive ? 'Destructive action' : 'Affects future transactions'}</p>
                            </div>
                        </div>
                        <div className="px-5 py-4">
                            <p className="text-[12px] font-medium text-app-foreground leading-relaxed">{confirmMessage}</p>
                        </div>
                        <div className="px-5 py-3 flex items-center justify-end gap-2 border-t border-app-border/50"
                            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                            <button onClick={() => setConfirmAction(null)}
                                className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:bg-app-surface transition-all">
                                Cancel
                            </button>
                            <button onClick={confirmAction.onConfirm} disabled={isPending}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold text-white transition-all disabled:opacity-50"
                                style={isDestructive
                                    ? { ...grad('--app-error'), ...glow('--app-error', 25) }
                                    : { ...grad('--app-warning'), ...glow('--app-warning', 25) }}>
                                {isPending && <Loader2 size={11} className="animate-spin" />}
                                {isDestructive ? 'Yes, Disable' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Full-bleed viewport shell (page fills the workspace) ── */}
            <div className="flex flex-col h-full -m-4 md:-m-5 overflow-hidden animate-in fade-in duration-300">

                {/* ── FIXED HEADER AREA (full-bleed bg, content centered) ── */}
                <div className="shrink-0 px-4 md:px-8 pt-4 pb-3 border-b border-app-border/40"
                    style={{ backgroundColor: 'var(--app-background)' }}>
                    <div className="max-w-[1400px] mx-auto space-y-3">
                        {/* Page header — design.md §2 */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="page-header-icon bg-app-primary" style={glow('--app-primary')}>
                                    <Globe size={20} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-lg md:text-xl font-black text-app-foreground tracking-tight truncate">Regional Settings</h1>
                                    <p className="text-[10px] md:text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest truncate">
                                        {orgCountries.length} Countries · {orgCurrencies.length} Currencies · {langCodes.length || 0} Languages
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 self-start sm:self-auto">
                                {tab === 'languages' && (
                                    <button onClick={saveLangs} disabled={langSaving || langLoading}
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-white px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                                        style={{ ...grad('--app-info'), ...glow('--app-info', 25) }}>
                                        {langSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={13} />}
                                        <span>Save Languages</span>
                                    </button>
                                )}
                                {/* Tab pills — pill-on-surface segmented control */}
                                <div className="inline-flex items-stretch p-0.5 rounded-xl bg-app-surface border border-app-border/50">
                                    {TABS.map(t => {
                                        const Icon = t.icon; const active = tab === t.key;
                                        return (
                                            <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setRegionFilter(''); }}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-200 ${active ? 'text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                                style={active ? { ...grad(t.color), boxShadow: `0 2px 8px color-mix(in srgb, var(${t.color}) 25%, transparent)` } : {}}>
                                                <Icon size={12} /> <span className="hidden sm:inline">{t.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* KPI strip — design.md §3, §4 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                            {KPIS.map(s => (
                                <div key={s.label}
                                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: `color-mix(in srgb, ${s.color} 12%, transparent)`, color: s.color }}>
                                        <s.icon size={13} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-app-muted-foreground">{s.label}</div>
                                        <div className="text-sm font-black text-app-foreground tabular-nums truncate">{s.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── CONTENT AREA — full-bleed, content centered to 1400px ── */}
                <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-8 py-4">
                    <div className="max-w-[1400px] mx-auto h-full">
                    {tab === 'countries' && (
                        <TwoPanePicker
                            kind="country"
                            allItems={allCountries}
                            filteredItems={filteredCountries}
                            orgItems={orgCountries}
                            search={search}
                            setSearch={setSearch}
                            regions={regions}
                            regionFilter={regionFilter}
                            setRegionFilter={setRegionFilter}
                            isPending={isPending}
                            enabledIds={enabledCountryIds}
                            defaultId={defaultCountryId}
                            onEnable={handleEnableCountry as any}
                            onSetDefault={handleSetDefaultCountry}
                            onDisable={handleDisableCountry as any}
                        />
                    )}
                    {tab === 'currencies' && (
                        <TwoPanePicker
                            kind="currency"
                            allItems={allCurrencies}
                            filteredItems={filteredCurrencies}
                            orgItems={orgCurrencies}
                            search={search}
                            setSearch={setSearch}
                            regions={[]}
                            regionFilter=""
                            setRegionFilter={() => {}}
                            isPending={isPending}
                            enabledIds={enabledCurrencyIds}
                            defaultId={defaultCurrencyId}
                            onEnable={handleEnableCurrency as any}
                            onSetDefault={handleSetDefaultCurrency}
                            onDisable={handleDisableCurrency as any}
                        />
                    )}
                    {tab === 'fx' && (
                        <div className="h-full overflow-y-auto custom-scrollbar pr-1">
                            <FxManagementSection />
                        </div>
                    )}
                    {tab === 'languages' && (
                        <LanguagesPanel
                            langCodes={langCodes}
                            langCustom={langCustom}
                            setLangCustom={setLangCustom}
                            langLoading={langLoading}
                            toggleLang={toggleLang}
                            addCustomLang={addCustomLang}
                        />
                    )}
                    </div>{/* close max-w-[1400px] content inner */}
                </div>{/* close flex-1 content area */}
            </div>{/* close full-bleed shell */}
        </>
    );
}

/* ═══════════════════════════════════════════════════════════════════
 *  TwoPanePicker — shared layout for Countries + Currencies
 * ═══════════════════════════════════════════════════════════════════ */
function TwoPanePicker({
    kind, allItems, filteredItems, orgItems,
    search, setSearch, regions, regionFilter, setRegionFilter,
    isPending,
    enabledIds, defaultId,
    onEnable, onSetDefault, onDisable,
}: {
    kind: 'country' | 'currency';
    allItems: any[]; filteredItems: any[]; orgItems: any[];
    search: string; setSearch: (s: string) => void;
    regions: string[]; regionFilter: string; setRegionFilter: (r: string) => void;
    isPending: boolean;
    enabledIds: Set<number>; defaultId: number | null;
    onEnable: (item: any) => void; onSetDefault: (id: number) => void; onDisable: (oc: any) => void;
}) {
    const accent = kind === 'country' ? '--app-primary' : '--app-warning';
    const PanelIcon = kind === 'country' ? Globe : Coins;
    const placeholder = kind === 'country' ? 'Search 250+ countries…' : 'Search 150+ currencies…';

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* ── LEFT PANE: Active selection ── */}
            <section className="bg-app-surface/30 rounded-2xl border border-app-border/50 flex flex-col overflow-hidden min-h-0">
                <PaneHeader
                    icon={<PanelIcon size={13} style={{ color: `var(${accent})` }} />}
                    title={`Your ${kind === 'country' ? 'Countries' : 'Currencies'}`}
                    subtitle={`${orgItems.length} active · hover to manage`}
                />
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                    {orgItems.length === 0 ? (
                        <EmptyState
                            icon={<PanelIcon size={36} className="text-app-muted-foreground opacity-40" />}
                            title={`No ${kind === 'country' ? 'countries' : 'currencies'} enabled`}
                            hint="Click items in the catalogue on the right to enable them →"
                        />
                    ) : orgItems.map(oc => (
                        <ActiveRow
                            key={oc.id} kind={kind} oc={oc} accent={accent}
                            allItems={allItems}
                            isPending={isPending}
                            onSetDefault={onSetDefault}
                            onDisable={onDisable}
                        />
                    ))}
                </div>
                {isPending && (
                    <div className="px-3 py-2 border-t border-app-border/50 flex items-center gap-2 shrink-0" style={soft('--app-info', 8)}>
                        <Loader2 size={12} className="animate-spin" style={{ color: 'var(--app-info)' }} />
                        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--app-info)' }}>Processing…</span>
                    </div>
                )}
            </section>

            {/* ── RIGHT PANE: Browse + add ── */}
            <section className="bg-app-surface/30 rounded-2xl border border-app-border/50 flex flex-col overflow-hidden min-h-0">
                <div className="px-4 py-3 border-b border-app-border/50 shrink-0 flex items-center gap-2"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                    <div className="flex-1 relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder}
                            className="w-full pl-9 pr-9 py-2 text-[12px] font-medium bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                        {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground"><X size={13} /></button>}
                    </div>
                    {kind === 'country' && regions.length > 0 && (
                        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                            className="h-9 px-2.5 rounded-xl border border-app-border/50 bg-app-surface/50 text-[11px] font-bold text-app-foreground focus:bg-app-surface outline-none cursor-pointer">
                            <option value="">All Regions</option>
                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    )}
                    <span className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground whitespace-nowrap shrink-0">
                        {filteredItems.length} results
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3">
                    {filteredItems.length === 0 ? (
                        <EmptyState
                            icon={<Search size={36} className="text-app-muted-foreground opacity-40" />}
                            title={`No ${kind === 'country' ? 'countries' : 'currencies'} match your search`}
                            hint="Try a different search term or clear the filter."
                        />
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                            {filteredItems.map(item => (
                                <CatalogueCard
                                    key={item.id} kind={kind} item={item} accent={accent}
                                    isEnabled={enabledIds.has(item.id)}
                                    isDefault={defaultId === item.id}
                                    isPending={isPending}
                                    onAdd={() => onEnable(item)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

/* ─── Active row in left pane ──────────────────────────────────── */
function ActiveRow({ kind, oc, accent, allItems, isPending, onSetDefault, onDisable }: any) {
    const isDefault = oc.is_default;
    const isCountry = kind === 'country';
    const ref = isCountry
        ? allItems.find((x: any) => x.id === oc.country)
        : allItems.find((x: any) => x.id === oc.currency);
    const code = isCountry ? (ref?.iso2 || oc.country_iso2 || '') : (ref?.code || oc.currency_code);
    const name = isCountry ? (ref?.name || oc.country_name) : (ref?.name || oc.currency_name);

    return (
        <div className={`group/item flex items-center gap-2.5 p-2.5 rounded-xl transition-all border ${isDefault ? '' : 'border-transparent hover:bg-app-background hover:border-app-border/30'}`}
            style={isDefault ? { ...soft(accent, 8), border: `1px solid color-mix(in srgb, var(${accent}) 30%, transparent)` } : {}}>
            {isCountry ? (
                <span className="text-2xl shrink-0">{flag(code)}</span>
            ) : (
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ ...soft(accent, 15), color: `var(${accent})` }}>
                    <span className="text-sm font-black">{ref?.symbol || oc.currency_symbol || code?.charAt(0) || '$'}</span>
                </div>
            )}
            <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-app-foreground truncate">{name}</div>
                <div className="text-[9px] font-mono uppercase text-app-muted-foreground">{code}</div>
            </div>
            {isDefault ? (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white shrink-0" style={grad(accent)}>
                    <Crown size={8} className="inline mr-0.5 -mt-px" /> {isCountry ? 'Default' : 'Base'}
                </span>
            ) : (
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    <button onClick={() => onSetDefault(isCountry ? oc.country : oc.currency)} disabled={isPending}
                        className="p-1.5 rounded-lg hover:bg-app-border/50 transition-colors" title={`Set as ${isCountry ? 'default' : 'base'}`}>
                        <Star size={12} style={{ color: `var(${accent})` }} />
                    </button>
                    <button onClick={() => onDisable(oc)} disabled={isPending}
                        className="p-1.5 rounded-lg hover:bg-app-error/10 transition-colors" title="Remove">
                        <Trash2 size={12} style={{ color: 'var(--app-error)' }} />
                    </button>
                </div>
            )}
        </div>
    );
}

/* ─── Catalogue card in right pane ─────────────────────────────── */
function CatalogueCard({ kind, item, accent, isEnabled, isDefault, isPending, onAdd }: any) {
    const isCountry = kind === 'country';
    return (
        <button onClick={() => !isEnabled && !isPending && onAdd()}
            disabled={isEnabled || isPending}
            className="group/c relative flex items-center gap-2.5 p-2.5 rounded-xl border transition-all duration-200 text-left disabled:cursor-default"
            style={isEnabled
                ? { ...(isDefault ? soft(accent, 8) : soft('--app-success', 4)), border: `1px solid color-mix(in srgb, var(${isDefault ? accent : '--app-success'}) 30%, transparent)` }
                : { background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
            {!isEnabled && (
                <span className="absolute inset-0 rounded-xl pointer-events-none transition-opacity opacity-0 group-hover/c:opacity-100"
                    style={{ background: `color-mix(in srgb, var(${accent}) 4%, transparent)`, border: `1px solid color-mix(in srgb, var(${accent}) 30%, transparent)` }} />
            )}
            {isCountry ? (
                <span className="text-2xl shrink-0">{flag(item.iso2)}</span>
            ) : (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={isEnabled ? { ...soft(accent, 15), color: `var(${accent})` } : { ...soft('--app-muted-foreground', 8), color: 'var(--app-muted-foreground)' }}>
                    <span className="text-sm font-black">{item.symbol || item.code?.charAt(0) || '$'}</span>
                </div>
            )}
            <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-app-foreground truncate">{isCountry ? item.name : item.code}</span>
                    {isCountry && <span className="text-[8px] font-mono px-1 py-0.5 rounded shrink-0 bg-app-background text-app-muted-foreground">{item.iso2}</span>}
                </div>
                {isCountry ? (
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] font-medium text-app-muted-foreground truncate">
                        {item.phone_code && <span className="flex items-center gap-0.5"><Phone size={8} /> {item.phone_code}</span>}
                        {item.region && <span className="flex items-center gap-0.5"><MapPin size={8} /> {item.region}</span>}
                        {item.default_currency_code && <span className="flex items-center gap-0.5"><DollarSign size={8} /> {item.default_currency_code}</span>}
                    </div>
                ) : (
                    <p className="text-[9px] font-medium text-app-muted-foreground truncate mt-0.5">{item.name}</p>
                )}
            </div>
            <div className="shrink-0 relative z-10">
                {isEnabled ? (
                    isDefault ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white" style={grad(accent)}>
                            <Crown size={8} className="inline mr-0.5 -mt-px" />{isCountry ? 'Default' : 'Base'}
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: 'var(--app-success)' }}>
                            <Check size={11} /> Active
                        </span>
                    )
                ) : (
                    <span className="opacity-0 group-hover/c:opacity-100 transition-opacity flex items-center gap-1 px-2 py-1 rounded-lg text-white text-[10px] font-bold shadow-md"
                        style={grad(accent)}>
                        <Plus size={10} /> Add
                    </span>
                )}
            </div>
        </button>
    );
}

/* ═══════════════════════════════════════════════════════════════════
 *  LanguagesPanel — single-card multi-select
 * ═══════════════════════════════════════════════════════════════════ */
function LanguagesPanel({ langCodes, langCustom, setLangCustom, langLoading, toggleLang, addCustomLang }: {
    langCodes: string[]; langCustom: string; setLangCustom: (s: string) => void;
    langLoading: boolean; toggleLang: (c: string) => void; addCustomLang: () => void;
}) {
    const customCodes = langCodes.filter(c => !COMMON_LOCALES.some(l => l.code === c));
    return (
        <div className="h-full max-w-[900px] mx-auto bg-app-surface/30 rounded-2xl border border-app-border/50 flex flex-col overflow-hidden">
            <PaneHeader
                icon={<Languages size={13} style={{ color: 'var(--app-info)' }} />}
                title="Catalogue Languages"
                subtitle={`${langCodes.length} enabled · used across category + product translation inputs`}
            />
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
                {langLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
                    </div>
                ) : (
                    <>
                        <p className="text-[11px] font-medium text-app-muted-foreground leading-relaxed">
                            Pick the languages your catalogue needs. Category / product forms render one translation input
                            per enabled locale. The default language is the main <code className="font-mono px-1 py-0.5 rounded bg-app-background text-app-foreground">name</code> field — never duplicated.
                        </p>

                        {/* Common locale grid — adaptive */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                            {COMMON_LOCALES.map(l => {
                                const active = langCodes.includes(l.code);
                                return (
                                    <button key={l.code} type="button" onClick={() => toggleLang(l.code)}
                                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all text-left"
                                        style={{
                                            background: active ? 'color-mix(in srgb, var(--app-info) 10%, transparent)' : 'var(--app-surface)',
                                            border: `1px solid ${active ? 'color-mix(in srgb, var(--app-info) 40%, transparent)' : 'color-mix(in srgb, var(--app-border) 50%, transparent)'}`,
                                        }}>
                                        <span className="flex-1 min-w-0">
                                            <span className={`text-[12px] font-bold truncate block ${active ? '' : 'text-app-foreground'}`}
                                                style={active ? { color: 'var(--app-info)' } : {}}
                                                dir={isRTL(l.code) ? 'rtl' : undefined}>
                                                {l.native}
                                            </span>
                                            <span className="text-[9px] font-mono uppercase text-app-muted-foreground">{l.code}</span>
                                        </span>
                                        {active && <Check size={14} style={{ color: 'var(--app-info)' }} />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Custom codes */}
                        {customCodes.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-app-border/50">
                                <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mr-2">Custom</span>
                                {customCodes.map(c => (
                                    <span key={c} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                                        style={{ ...soft('--app-info', 12), color: 'var(--app-info)' }}>
                                        {labelFor(c)}
                                        <button type="button" onClick={() => toggleLang(c)} className="hover:opacity-70" aria-label={`Remove ${c}`}>
                                            <X size={11} />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Add custom — design.md §12 inline form */}
                        <div className="rounded-2xl p-3 border-l-2 flex items-center gap-2"
                            style={{ background: 'color-mix(in srgb, var(--app-info) 4%, var(--app-surface))', borderColor: 'var(--app-info)' }}>
                            <input value={langCustom}
                                onChange={e => setLangCustom(e.target.value.replace(/[^a-z-]/gi, ''))}
                                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang(); } }}
                                placeholder="Custom locale code (e.g. ber, ku)"
                                className="flex-1 px-3 py-2 rounded-lg text-[12px] font-mono outline-none"
                                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                            <button type="button" onClick={addCustomLang}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold text-white"
                                style={{ ...grad('--app-info'), ...glow('--app-info', 25) }}>
                                <Plus size={12} /> Add
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Shared sub-components — design.md §6/§9
 * ═══════════════════════════════════════════════════════════════════ */
function PaneHeader({ icon, title, subtitle, action }: {
    icon: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode;
}) {
    // Inline font-size so no global h2 / prose CSS can override (was rendering
    // huge in production due to a default user-agent h2 size beating the
    // `text-[11px]` arbitrary class through specificity). Same for subtitle.
    return (
        <div className="px-4 py-3 border-b border-app-border/50 flex items-center justify-between gap-3 shrink-0"
            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-black uppercase tracking-widest text-app-foreground"
                     style={{ fontSize: 11, lineHeight: 1.3 }}>
                    {icon}<span className="truncate">{title}</span>
                </div>
                {subtitle && (
                    <p className="font-bold text-app-muted-foreground mt-0.5 truncate"
                       style={{ fontSize: 10, lineHeight: 1.3 }}>{subtitle}</p>
                )}
            </div>
            {action}
        </div>
    );
}

function EmptyState({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }) {
    // Inline font-size on the body text — protects against any global
    // p / .prose CSS that would otherwise inflate it in production builds.
    return (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="mb-3">{icon}</div>
            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 13, lineHeight: 1.4 }}>{title}</p>
            {hint && <p className="text-app-muted-foreground mt-1 max-w-md" style={{ fontSize: 11, lineHeight: 1.5 }}>{hint}</p>}
        </div>
    );
}
