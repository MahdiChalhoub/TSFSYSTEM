'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import {
    Globe, DollarSign, Search, Plus, Star, Check, X, MapPin,
    Phone, Loader2, Coins, ArrowLeft, AlertTriangle,
    Crown, Trash2, Shield, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import type { RefCountry, RefCurrency, OrgCountry, OrgCurrency } from '@/types/erp';
import {
    enableOrgCountry, enableOrgCurrency,
    setDefaultOrgCountry, setDefaultOrgCurrency,
    disableOrgCountry, disableOrgCurrency,
} from '@/app/actions/reference';
import { toast } from 'sonner';
import { Languages } from 'lucide-react';
import { getCatalogueLanguages, setCatalogueLanguages, labelFor, isRTL } from '@/lib/catalogue-languages';
import { FxManagementSection } from './_components/FxManagementSection';

/* ─── Helpers ──────────────────────────────────────────────────── */
const grad = (v: string) => ({ background: `linear-gradient(135deg, var(${v}), color-mix(in srgb, var(${v}) 60%, black))` });
const soft = (v: string, p = 12) => ({ backgroundColor: `color-mix(in srgb, var(${v}) ${p}%, transparent)` });
function flag(iso2: string) { if (!iso2 || iso2.length !== 2) return '🏳️'; return String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }

/* ─── Types ────────────────────────────────────────────────────── */
interface Props { allCountries: RefCountry[]; allCurrencies: RefCurrency[]; initialOrgCountries: OrgCountry[]; initialOrgCurrencies: OrgCurrency[]; }
type Tab = 'countries' | 'currencies' | 'languages' | 'fx';

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
 *  COMPONENT — Fixed viewport layout, only panels scroll
 * ═══════════════════════════════════════════════════════════════════ */
export default function RegionalSettingsClient({ allCountries, allCurrencies, initialOrgCountries, initialOrgCurrencies }: Props) {
    const [tab, setTab] = useState<Tab>('countries');
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [orgCountries, setOrgCountries] = useState<OrgCountry[]>(initialOrgCountries);
    const [orgCurrencies, setOrgCurrencies] = useState<OrgCurrency[]>(initialOrgCurrencies);
    const [isPending, startTransition] = useTransition();
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
    // Catalogue languages — tenant-wide list of locale codes used across
    // product / category translations. Persisted to Organization.settings.
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

    // Derived
    const enabledCountryIds = useMemo(() => new Set(orgCountries.map(oc => oc.country)), [orgCountries]);
    const defaultCountryId = useMemo(() => orgCountries.find(oc => oc.is_default)?.country ?? null, [orgCountries]);
    const enabledCurrencyIds = useMemo(() => new Set(orgCurrencies.map(oc => oc.currency)), [orgCurrencies]);
    const defaultCurrencyId = useMemo(() => orgCurrencies.find(oc => oc.is_default)?.currency ?? null, [orgCurrencies]);
    const regions = useMemo(() => [...new Set(allCountries.map(c => c.region).filter(Boolean))].sort(), [allCountries]);

    const filteredCountries = useMemo(() => {
        let list = allCountries;
        if (search) { const q = search.toLowerCase(); list = list.filter(c => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase().includes(q) || c.iso3?.toLowerCase().includes(q) || c.phone_code?.includes(q)); }
        if (regionFilter) list = list.filter(c => c.region === regionFilter);
        return list;
    }, [allCountries, search, regionFilter]);

    const filteredCurrencies = useMemo(() => {
        if (!search) return allCurrencies;
        const q = search.toLowerCase();
        return allCurrencies.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || c.symbol?.includes(q));
    }, [allCurrencies, search]);

    /* ── Country Actions ────────────────────────────────────────── */
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
        setConfirmAction({
            type: 'set-default-country',
            label: c?.name || 'this country',
            onConfirm: () => { setConfirmAction(null); doSetDefaultCountry(id); }
        });
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
        setConfirmAction({
            type: 'disable-country',
            label: c?.name || oc.country_name || 'this country',
            onConfirm: () => { setConfirmAction(null); doDisableCountry(oc); }
        });
    };

    /* ── Currency Actions ───────────────────────────────────────── */
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
        setConfirmAction({
            type: 'set-default-currency',
            label: c ? `${c.code} — ${c.name}` : 'this currency',
            onConfirm: () => { setConfirmAction(null); doSetDefaultCurrency(id); }
        });
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
        setConfirmAction({
            type: 'disable-currency',
            label: c ? `${c.code} — ${c.name}` : oc.currency_code || 'this currency',
            onConfirm: () => { setConfirmAction(null); doDisableCurrency(oc); }
        });
    };

    /* ── Confirm Dialog Derived ─────────────────────────────────── */
    const isDestructive = confirmAction?.type.startsWith('disable');
    const confirmTitle = confirmAction?.type.startsWith('set-default') ? 'Change Default' : 'Disable Item';
    const confirmMessage = confirmAction?.type.startsWith('set-default')
        ? `Are you sure you want to set "${confirmAction?.label}" as the new default? This will affect all future transactions and documents.`
        : `Are you sure you want to disable "${confirmAction?.label}"? It will be removed from your organization's active list.`;

    /* ═══════ RENDER ═══════════════════════════════════════════════ */
    return (
        <>
            {/* ── Confirmation Modal ── */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmAction(null)}>
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                    <div className="relative w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-6 animate-in zoom-in-95 fade-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex items-start gap-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${isDestructive ? 'bg-rose-500/10' : ''}`}
                                style={!isDestructive ? soft('--app-warning', 12) : {}}>
                                <AlertTriangle size={22} className={isDestructive ? 'text-rose-500' : ''}
                                    style={!isDestructive ? { color: 'var(--app-warning)' } : {}} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-[15px] font-black text-app-foreground">{confirmTitle}</h3>
                                <p className="text-[12px] text-app-muted-foreground mt-1.5 leading-relaxed">{confirmMessage}</p>
                            </div>
                        </div>
                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button onClick={() => setConfirmAction(null)}
                                className="px-5 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-app-muted-foreground bg-app-background border border-app-border hover:bg-app-hover transition-all">
                                Cancel
                            </button>
                            <button onClick={confirmAction.onConfirm} disabled={isPending}
                                className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-wider text-white transition-all shadow-lg ${isDestructive ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25' : 'shadow-app-primary/25'
                                    }`}
                                style={!isDestructive ? grad('--app-warning') : {}}>
                                {isPending && <Loader2 className="w-4 h-4 animate-spin inline mr-1.5" />}
                                {isDestructive ? 'Yes, Disable' : 'Yes, Change Default'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════
             *  FIXED VIEWPORT SHELL — fills parent <main> exactly, no page scroll
             * ═══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col h-full -m-4 md:-m-5 overflow-hidden animate-in fade-in duration-500">

                {/* ── FIXED HEADER AREA ──────────────────────────────── */}
                <div className="shrink-0 px-4 md:px-8 pt-4 pb-3 border-b border-app-border/40"
                    style={{ backgroundColor: 'var(--app-background)' }}>
                    <div className="max-w-[1400px] mx-auto">
                        {/* Back */}
                        <Link href="/settings" className="inline-flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground uppercase tracking-widest hover:text-app-foreground transition-colors mb-3">
                            <ArrowLeft size={14} /> Settings
                        </Link>

                        {/* Header row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg" style={grad('--app-primary')}>
                                    <Globe size={20} className="text-white" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-black text-app-foreground tracking-tight">Regional Settings</h1>
                                    <p className="text-[10px] text-app-muted-foreground mt-0.5">
                                        Configure countries and currencies for your organization
                                    </p>
                                </div>
                            </div>

                            {/* KPIs + Tabs inline */}
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Quick KPIs */}
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-surface border border-app-border/50">
                                    <Globe size={12} style={{ color: 'var(--app-primary)' }} />
                                    <span className="text-sm font-black text-app-foreground">{orgCountries.length}</span>
                                    <span className="text-[8px] font-bold text-app-muted-foreground uppercase">countries</span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-app-surface border border-app-border/50">
                                    <Coins size={12} style={{ color: 'var(--app-warning)' }} />
                                    <span className="text-sm font-black text-app-foreground">{orgCurrencies.length}</span>
                                    <span className="text-[8px] font-bold text-app-muted-foreground uppercase">currencies</span>
                                </div>

                                {/* Tab Switcher */}
                                <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-app-surface border border-app-border/50">
                                    {([
                                        { key: 'countries' as Tab, label: 'Countries', icon: Globe, color: '--app-primary' },
                                        { key: 'currencies' as Tab, label: 'Currencies', icon: Coins, color: '--app-warning' },
                                        { key: 'fx' as Tab, label: 'FX & Rates', icon: TrendingUp, color: '--app-success' },
                                        { key: 'languages' as Tab, label: 'Languages', icon: Languages, color: '--app-info' },
                                    ]).map(t => {
                                        const Icon = t.icon; const active = tab === t.key;
                                        return (
                                            <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); setRegionFilter(''); }}
                                                className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-[11px] font-bold transition-all duration-200 ${active ? 'text-white shadow-md' : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                                style={active ? grad(t.color) : {}}>
                                                <Icon size={13} /> {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── CONTENT AREA (fills remaining viewport) ─────── */}
                <div className="flex-1 overflow-auto px-4 md:px-8 py-4">
                    {tab === 'fx' ? (
                    /* ── FX & RATES PANEL — single source of truth for the
                          finance multi-currency stack: rate history, auto-
                          sync policies, and period-end revaluations. ── */
                    <div className="max-w-[1400px] mx-auto">
                        <FxManagementSection />
                    </div>
                    ) : tab === 'languages' ? (
                    /* ── LANGUAGES PANEL — single column picker ── */
                    <div className="max-w-[900px] mx-auto h-full bg-app-surface rounded-xl border border-app-border/50 flex flex-col overflow-hidden">
                        <div className="px-5 py-3 border-b border-app-border/50 flex items-center justify-between"
                             style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                            <div>
                                <h2 className="text-[11px] font-black uppercase tracking-widest text-app-foreground flex items-center gap-2">
                                    <Languages size={13} style={{ color: 'var(--app-info)' }} />
                                    Catalogue languages
                                </h2>
                                <p className="text-[10px] text-app-muted-foreground mt-0.5">
                                    {langCodes.length} enabled · used across category + product translation inputs
                                </p>
                            </div>
                            <button onClick={saveLangs} disabled={langSaving || langLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold text-white transition-all disabled:opacity-50"
                                    style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 35%, transparent)' }}>
                                {langSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Save
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-3">
                            {langLoading ? (
                                <div className="flex justify-center py-10">
                                    <Loader2 size={16} className="animate-spin text-app-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <p className="text-[11px] text-app-muted-foreground">
                                        Pick the languages your catalogue needs. Category / product forms render one translation input per enabled locale. The default language is the main <code className="font-mono text-app-foreground">name</code> field — never duplicated.
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                                        {COMMON_LOCALES.map(l => {
                                            const active = langCodes.includes(l.code);
                                            return (
                                                <button key={l.code} type="button"
                                                        onClick={() => toggleLang(l.code)}
                                                        className="flex items-center justify-between px-3 py-2 rounded-xl transition-all text-left"
                                                        style={{
                                                            background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                                            border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                                            color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                                        }}>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="text-[12px] font-bold truncate block" dir={isRTL(l.code) ? 'rtl' : undefined}>
                                                            {l.native}
                                                        </span>
                                                        <span className="text-[9px] font-mono uppercase text-app-muted-foreground">
                                                            {l.code}
                                                        </span>
                                                    </span>
                                                    {active && <span className="text-[12px] font-bold ml-2">✓</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {langCodes.filter(c => !COMMON_LOCALES.some(l => l.code === c)).length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-app-border/50">
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground self-center mr-2">Custom:</span>
                                            {langCodes.filter(c => !COMMON_LOCALES.some(l => l.code === c)).map(c => (
                                                <span key={c} className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded"
                                                      style={{ background: 'color-mix(in srgb, var(--app-info) 10%, transparent)', color: 'var(--app-info)' }}>
                                                    {labelFor(c)}
                                                    <button type="button" onClick={() => toggleLang(c)}>×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 pt-3 border-t border-app-border/50">
                                        <input value={langCustom}
                                               onChange={e => setLangCustom(e.target.value.replace(/[^a-z-]/gi, ''))}
                                               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang() } }}
                                               placeholder="Custom locale code (e.g. ber, ku)"
                                               className="flex-1 px-3 py-2 rounded-lg text-[11px] font-mono outline-none"
                                               style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                                        <button type="button" onClick={addCustomLang}
                                                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[10px] font-bold"
                                                style={{ background: 'var(--app-primary)', color: 'white' }}>
                                            <Plus size={11} /> Add
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    ) : (
                    <div className="max-w-[1400px] mx-auto h-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">

                        {/* ── LEFT PANEL: Active Selection ── */}
                        <div className="bg-app-surface rounded-xl border border-app-border/50 flex flex-col overflow-hidden min-h-0">
                            <div className="px-4 py-3 border-b border-app-border/50 shrink-0"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                <h2 className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
                                    <Shield size={11} style={{ color: tab === 'countries' ? 'var(--app-primary)' : 'var(--app-warning)' }} />
                                    Your {tab === 'countries' ? 'Countries' : 'Currencies'}
                                </h2>
                                <p className="text-[9px] text-app-muted-foreground mt-0.5">
                                    {tab === 'countries' ? 'Hover items — ⭐ Set default, ✕ Remove' : 'Hover items — ⭐ Set base, ✕ Remove'}
                                </p>
                            </div>

                            {/* Scrollable active items */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                                {tab === 'countries' ? (
                                    orgCountries.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <Globe size={24} className="mx-auto text-app-muted-foreground opacity-20" />
                                            <p className="text-[10px] font-bold text-app-muted-foreground mt-2">No countries enabled yet</p>
                                            <p className="text-[9px] text-app-muted-foreground mt-0.5">Click items on the right →</p>
                                        </div>
                                    ) : orgCountries.map(oc => {
                                        const c = allCountries.find(x => x.id === oc.country);
                                        return (
                                            <div key={oc.id} className={`group/item flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${oc.is_default ? 'border border-app-primary/20' : 'hover:bg-app-background border border-transparent'}`}
                                                style={oc.is_default ? soft('--app-primary', 6) : {}}>
                                                <span className="text-lg">{flag(c?.iso2 || oc.country_iso2 || '')}</span>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[12px] font-bold text-app-foreground block truncate">{c?.name || oc.country_name}</span>
                                                    <span className="text-[8px] text-app-muted-foreground font-mono">{c?.iso2 || oc.country_iso2}</span>
                                                </div>
                                                {oc.is_default ? (
                                                    <span className="px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase tracking-wider text-white shrink-0" style={grad('--app-primary')}>
                                                        <Crown size={7} className="inline mr-0.5 -mt-px" /> Default
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <button onClick={() => handleSetDefaultCountry(oc.country)} disabled={isPending}
                                                            className="p-1 rounded-md hover:bg-app-primary/10 transition-colors" title="Set as default">
                                                            <Star size={12} style={{ color: 'var(--app-primary)' }} />
                                                        </button>
                                                        <button onClick={() => handleDisableCountry(oc)} disabled={isPending}
                                                            className="p-1 rounded-md hover:bg-rose-500/10 transition-colors" title="Remove">
                                                            <Trash2 size={12} className="text-rose-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                ) : (
                                    orgCurrencies.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <Coins size={24} className="mx-auto text-app-muted-foreground opacity-20" />
                                            <p className="text-[10px] font-bold text-app-muted-foreground mt-2">No currencies enabled yet</p>
                                            <p className="text-[9px] text-app-muted-foreground mt-0.5">Click items on the right →</p>
                                        </div>
                                    ) : orgCurrencies.map(oc => {
                                        const c = allCurrencies.find(x => x.id === oc.currency);
                                        return (
                                            <div key={oc.id} className={`group/item flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${oc.is_default ? 'border border-amber-500/20' : 'hover:bg-app-background border border-transparent'}`}
                                                style={oc.is_default ? soft('--app-warning', 6) : {}}>
                                                <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-black shrink-0" style={soft('--app-warning', 15)}>
                                                    <span style={{ color: 'var(--app-warning)' }}>{c?.symbol || oc.currency_symbol || '$'}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[12px] font-bold text-app-foreground block">{c?.code || oc.currency_code}</span>
                                                    <span className="text-[8px] text-app-muted-foreground truncate block">{c?.name || oc.currency_name}</span>
                                                </div>
                                                {oc.is_default ? (
                                                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[7px] font-black uppercase tracking-wider shrink-0">
                                                        <Crown size={7} className="inline mr-0.5 -mt-px" /> Base
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <button onClick={() => handleSetDefaultCurrency(oc.currency)} disabled={isPending}
                                                            className="p-1 rounded-md hover:bg-amber-500/10 transition-colors" title="Set as base">
                                                            <Star size={12} style={{ color: 'var(--app-warning)' }} />
                                                        </button>
                                                        <button onClick={() => handleDisableCurrency(oc)} disabled={isPending}
                                                            className="p-1 rounded-md hover:bg-rose-500/10 transition-colors" title="Remove">
                                                            <Trash2 size={12} className="text-rose-500" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            {/* Processing bar */}
                            {isPending && (
                                <div className="px-4 py-2 border-t border-app-border/50 flex items-center gap-2 shrink-0" style={soft('--app-info', 8)}>
                                    <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--app-info)' }} />
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--app-info)' }}>Processing...</span>
                                </div>
                            )}
                        </div>

                        {/* ── RIGHT PANEL: Browse & Add ── */}
                        <div className="bg-app-surface rounded-xl border border-app-border/50 flex flex-col overflow-hidden min-h-0">
                            {/* Fixed search header */}
                            <div className="px-4 py-3 border-b border-app-border/50 shrink-0"
                                style={{ backgroundColor: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-muted-foreground" />
                                        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                                            placeholder={tab === 'countries' ? 'Search 250+ countries...' : 'Search 150+ currencies...'}
                                            className="w-full pl-9 pr-7 h-9 rounded-lg border border-app-border bg-app-surface text-[12px] font-semibold text-app-foreground placeholder:text-app-muted-foreground focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all" />
                                        {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground"><X size={13} /></button>}
                                    </div>
                                    {tab === 'countries' && (
                                        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                                            className="h-9 px-3 rounded-lg border border-app-border bg-app-surface text-[11px] font-semibold text-app-foreground focus:ring-2 focus:ring-app-primary/20 outline-none cursor-pointer">
                                            <option value="">All Regions</option>
                                            {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    )}
                                    <span className="text-[9px] font-bold text-app-muted-foreground self-center whitespace-nowrap uppercase tracking-wider">
                                        {tab === 'countries' ? `${filteredCountries.length} results` : `${filteredCurrencies.length} results`}
                                    </span>
                                </div>
                            </div>

                            {/* Scrollable grid — ONLY THIS SCROLLS */}
                            <div className="flex-1 overflow-y-auto p-3">
                                {tab === 'countries' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filteredCountries.length === 0 ? (
                                            <div className="col-span-full py-14 text-center bg-app-background/50 rounded-xl border border-dashed border-app-border">
                                                <Globe size={28} className="mx-auto text-app-muted-foreground opacity-20" />
                                                <p className="text-[11px] font-bold text-app-muted-foreground mt-2">No countries match your search</p>
                                            </div>
                                        ) : filteredCountries.map(country => {
                                            const isEnabled = enabledCountryIds.has(country.id);
                                            const isDefault = defaultCountryId === country.id;
                                            return (
                                                <div key={country.id}
                                                    className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg border transition-all duration-200 ${isEnabled
                                                        ? isDefault
                                                            ? 'border-app-primary/30'
                                                            : 'border-app-border/30'
                                                        : 'border-app-border/20 hover:border-app-primary/30 hover:shadow-md cursor-pointer'
                                                        }`}
                                                    style={isEnabled ? (isDefault ? soft('--app-primary', 6) : soft('--app-success', 4)) : {}}
                                                    onClick={() => !isEnabled && !isPending && handleEnableCountry(country)}>

                                                    <span className="text-lg shrink-0">{flag(country.iso2)}</span>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-[12px] text-app-foreground truncate">{country.name}</span>
                                                            <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-app-background text-app-muted-foreground shrink-0">{country.iso2}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mt-0.5 text-[8px] text-app-muted-foreground">
                                                            {country.phone_code && <span className="flex items-center gap-0.5"><Phone size={7} /> {country.phone_code}</span>}
                                                            {country.region && <span className="flex items-center gap-0.5"><MapPin size={7} /> {country.region}</span>}
                                                            {country.default_currency_code && <span className="flex items-center gap-0.5"><DollarSign size={7} /> {country.default_currency_code}</span>}
                                                        </div>
                                                    </div>

                                                    {isEnabled ? (
                                                        isDefault ? (
                                                            <span className="px-1.5 py-0.5 rounded-md text-[7px] font-black uppercase text-white shrink-0" style={grad('--app-primary')}>Default</span>
                                                        ) : (
                                                            <Check size={14} className="shrink-0" style={{ color: 'var(--app-success)' }} />
                                                        )
                                                    ) : (
                                                        <div className="opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md text-white text-[9px] font-bold shadow-md" style={grad('--app-primary')}>
                                                                <Plus size={10} /> Add
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {filteredCurrencies.length === 0 ? (
                                            <div className="col-span-full py-14 text-center bg-app-background/50 rounded-xl border border-dashed border-app-border">
                                                <Coins size={28} className="mx-auto text-app-muted-foreground opacity-20" />
                                                <p className="text-[11px] font-bold text-app-muted-foreground mt-2">No currencies match your search</p>
                                            </div>
                                        ) : filteredCurrencies.map(currency => {
                                            const isEnabled = enabledCurrencyIds.has(currency.id);
                                            const isDefault = defaultCurrencyId === currency.id;
                                            return (
                                                <div key={currency.id}
                                                    className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg border transition-all duration-200 ${isEnabled
                                                        ? isDefault
                                                            ? 'border-amber-500/30'
                                                            : 'border-app-border/30'
                                                        : 'border-app-border/20 hover:border-amber-400/30 hover:shadow-md cursor-pointer'
                                                        }`}
                                                    style={isEnabled ? (isDefault ? soft('--app-warning', 6) : soft('--app-success', 4)) : {}}
                                                    onClick={() => !isEnabled && !isPending && handleEnableCurrency(currency)}>

                                                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shrink-0"
                                                        style={isEnabled ? soft('--app-warning', 15) : soft('--app-muted-foreground', 8)}>
                                                        <span style={{ color: isEnabled ? 'var(--app-warning)' : 'var(--app-muted-foreground)' }}>
                                                            {currency.symbol || currency.code.charAt(0)}
                                                        </span>
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-[12px] text-app-foreground">{currency.code}</span>
                                                            {currency.minor_unit !== undefined && <span className="text-[8px] text-app-muted-foreground">{currency.minor_unit} dec</span>}
                                                        </div>
                                                        <p className="text-[9px] text-app-muted-foreground truncate mt-0.5">{currency.name}</p>
                                                    </div>

                                                    {isEnabled ? (
                                                        isDefault ? (
                                                            <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[7px] font-black uppercase shrink-0">Base</span>
                                                        ) : (
                                                            <Check size={14} className="shrink-0" style={{ color: 'var(--app-success)' }} />
                                                        )
                                                    ) : (
                                                        <div className="opacity-0 group-hover:opacity-100 transition-all shrink-0">
                                                            <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500 text-white text-[9px] font-bold shadow-md">
                                                                <Plus size={10} /> Add
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>
            </div>
        </>
    );
}
