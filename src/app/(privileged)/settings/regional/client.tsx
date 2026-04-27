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
    Phone, Loader2, Coins, AlertTriangle, RefreshCcw,
    Crown, Trash2, TrendingUp, Languages, Save,
    ChevronRight, ChevronDown, Lock,
} from 'lucide-react';
import type { RefCountry, RefCurrency, OrgCountry, OrgCurrency } from '@/types/erp';
import {
    enableOrgCountry, enableOrgCurrency,
    setDefaultOrgCountry, setDefaultOrgCurrency,
    disableOrgCountry, disableOrgCurrency,
    setOrgCurrencyCountries,
} from '@/app/actions/reference';
import { toast } from 'sonner';
import {
    getCatalogueLanguageEntries, setCatalogueLanguageEntries,
    labelFor, isRTL,
    type CatalogueLanguageEntry,
} from '@/lib/catalogue-languages';
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
type Tab = 'countries' | 'currencies' | 'languages';
type CurrencySubTab = 'select' | 'rules' | 'history' | 'revaluations';

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
    const validTab: Tab = (['countries', 'currencies', 'languages'] as const).includes(initialTab as any) ? initialTab : 'countries';
    const [tab, setTab] = useState<Tab>(validTab);
    // Sub-tab state for the Currencies top-tab. Backwards-compat:
    // ?tab=fx redirects here onto the Rate History sub-tab so old links keep working.
    const initialSub = (searchParams?.get('sub') as CurrencySubTab | null);
    const fxLegacy = searchParams?.get('tab') === 'fx';
    const [currencySubTab, setCurrencySubTab] = useState<CurrencySubTab>(
        fxLegacy ? 'history' : (['select', 'rules', 'history', 'revaluations'] as const).includes(initialSub as any) ? (initialSub as CurrencySubTab) : 'select'
    );
    useEffect(() => {
        if (fxLegacy) setTab('currencies');
    }, [fxLegacy]);
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [orgCountries, setOrgCountries] = useState<OrgCountry[]>(initialOrgCountries);
    const [orgCurrencies, setOrgCurrencies] = useState<OrgCurrency[]>(initialOrgCurrencies);
    const [isPending, startTransition] = useTransition();
    const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

    // Catalogue languages — rich shape (code + per-country activation list).
    // Empty country_ids = "active in every enabled country".
    const [langEntries, setLangEntries] = useState<CatalogueLanguageEntry[]>([]);
    const [langCustom, setLangCustom] = useState('');
    const [langSearch, setLangSearch] = useState('');
    const [langLoading, setLangLoading] = useState(false);
    const langCodes = useMemo(() => langEntries.map(e => e.code), [langEntries]);
    // Loaded eagerly (not gated by `tab === 'languages'`) so the Country tab's
    // tree expansion can show per-country language activation without first
    // visiting the Languages tab.
    useEffect(() => {
        if (langEntries.length > 0) return;
        setLangLoading(true);
        getCatalogueLanguageEntries()
            .then(setLangEntries)
            .catch(() => setLangEntries([{ code: 'fr', country_ids: [] }, { code: 'ar', country_ids: [] }]))
            .finally(() => setLangLoading(false));
    }, [langEntries.length]);

    // Persist + revert-on-failure helper. Mirrors the optimistic pattern used
    // by handleEnableCountry / handleEnableCurrency in this file.
    const persistLangEntries = async (next: CatalogueLanguageEntry[]) => {
        const prev = langEntries;
        setLangEntries(next);
        try {
            const saved = await setCatalogueLanguageEntries(next);
            setLangEntries(saved);
        } catch (e: any) {
            setLangEntries(prev);
            toast.error(e?.message || 'Failed to save languages');
        }
    };

    const toggleLang = (c: string) => {
        const has = langEntries.some(e => e.code === c);
        const next = has
            ? langEntries.filter(e => e.code !== c)
            : [...langEntries, { code: c, country_ids: [] }];
        persistLangEntries(next);
    };
    const addCustomLang = () => {
        const n = langCustom.trim().toLowerCase().slice(0, 10);
        if (!n) return;
        if (!langCodes.includes(n)) {
            persistLangEntries([...langEntries, { code: n, country_ids: [] }]);
        }
        setLangCustom('');
    };

    /** Toggle a single Country FK id on a language entry. Empty country_ids
     *  is the canonical "all enabled countries" state. */
    const toggleLangCountry = (code: string, countryFkId: number) => {
        const next = langEntries.map(e => {
            if (e.code !== code) return e;
            const has = e.country_ids.includes(countryFkId);
            return {
                ...e,
                country_ids: has
                    ? e.country_ids.filter(x => x !== countryFkId)
                    : [...e.country_ids, countryFkId].sort((a, b) => a - b),
            };
        });
        persistLangEntries(next);
    };

    /** Set a language as the catalogue default by moving it to position 0 —
     *  matches the "default = first entry" convention used by the form-render
     *  consumers (CategoryFormModal, BrandFormModal, AttributeFormModal). */
    const setDefaultLang = (code: string) => {
        const target = langEntries.find(e => e.code === code);
        if (!target) return;
        persistLangEntries([target, ...langEntries.filter(e => e.code !== code)]);
    };

    /* ─── Derived ────────────────────────────────────────────────── */
    const enabledCountryIds = useMemo(() => new Set(orgCountries.map(oc => oc.country)), [orgCountries]);
    const defaultCountryId = useMemo(() => orgCountries.find(oc => oc.is_default)?.country ?? null, [orgCountries]);
    const enabledCurrencyIds = useMemo(() => new Set(orgCurrencies.map(oc => oc.currency)), [orgCurrencies]);
    const defaultCurrencyId = useMemo(() => orgCurrencies.find(oc => oc.is_default)?.currency ?? null, [orgCurrencies]);
    const baseCurrencyCode = useMemo(() => orgCurrencies.find(o => o.is_default)?.currency_code ?? null, [orgCurrencies]);

    /* ─── Sorted active lists ────────────────────────────────────────
     * The default / base item is always pinned to the top of its pane,
     * mirroring the "pinned item" pattern. Below the pin the order is
     * preserved as the backend sent it (which is its own enabled-at order). */
    const orgCountriesSorted = useMemo(
        () => [...orgCountries].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
        [orgCountries],
    );
    const orgCurrenciesSorted = useMemo(
        () => [...orgCurrencies].sort((a, b) => Number(b.is_default) - Number(a.is_default)),
        [orgCurrencies],
    );
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
            const isFirst = enabledCountryIds.size === 0;
            const res = await enableOrgCountry(country.id, isFirst);
            if (!res.success) { toast.error(res.error || 'Failed'); return; }
            // CRITICAL: use the real DB id from the server response, NOT
            // Date.now(). The OrgCountry primary key is what `disableOrgCountry`
            // queries against — fake ids cause "No OrgCountry matches the
            // given query" errors on the next click.
            const newId = res.data?.id ?? Date.now();
            setOrgCountries(prev => [...prev, { id: newId, country: country.id, is_enabled: true, is_default: isFirst, country_name: country.name, country_iso2: country.iso2 }]);

            // Country → Currency auto-link
            const ccyCode = country.default_currency_code;
            if (ccyCode) {
                const refCcy = allCurrencies.find(c => c.code === ccyCode);
                if (refCcy && !enabledCurrencyIds.has(refCcy.id)) {
                    const isBaseTime = enabledCurrencyIds.size === 0;
                    const ccyRes = await enableOrgCurrency(refCcy.id, { is_default: isBaseTime, is_transaction_currency: true });
                    if (ccyRes.success) {
                        const newCcyId = ccyRes.data?.id ?? Date.now() + 1;
                        setOrgCurrencies(prev => [...prev, { id: newCcyId, currency: refCcy.id, is_enabled: true, is_default: isBaseTime, is_transaction_currency: true, is_reporting_currency: false, currency_code: refCcy.code, currency_name: refCcy.name, currency_symbol: refCcy.symbol }]);
                        toast.success(`${country.name} enabled · ${refCcy.code} ${isBaseTime ? 'set as base' : 'activated'} automatically`);
                    } else {
                        toast.success(`${country.name} enabled (couldn't auto-add ${ccyCode}: ${ccyRes.error || 'failed'})`);
                    }
                    return;
                }
            }
            toast.success(`${country.name} enabled`);
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
            const isFirst = enabledCurrencyIds.size === 0;
            const res = await enableOrgCurrency(currency.id, { is_default: isFirst, is_transaction_currency: true });
            if (!res.success) { toast.error(res.error || 'Failed'); return; }
            const newId = res.data?.id ?? Date.now();
            setOrgCurrencies(prev => [...prev, { id: newId, currency: currency.id, is_enabled: true, is_default: isFirst, is_transaction_currency: true, is_reporting_currency: false, currency_code: currency.code, currency_name: currency.name, currency_symbol: currency.symbol }]);
            toast.success(`${currency.code} enabled`);
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

    /**
     * Toggle a country's activation for a specific (non-base) currency.
     *
     * Data semantics:
     *   `enabled_in_country_ids = []`  → currency available in EVERY enabled country (default).
     *   `enabled_in_country_ids = [X]` → currency restricted to that list only.
     *
     * UX semantics:
     *   - Empty list shows every country chip as ON.
     *   - Toggling one OFF when list was empty: list becomes "all OTHER countries".
     *   - Toggling all chips back ON normalizes the list to empty.
     */
    const toggleCurrencyCountry = (oc: OrgCurrency, countryFkId: number) => {
        if (oc.is_default) return; // base currency cannot be restricted
        const allEnabledCountryFkIds = orgCountries.map(c => c.country);
        const current: number[] = (oc.enabled_in_country_ids as number[] | undefined) ?? [];
        const allOn = current.length === 0;
        const isCurrentlyEnabled = allOn || current.includes(countryFkId);

        let next: number[];
        if (isCurrentlyEnabled) {
            // turning OFF
            const baseList = allOn ? allEnabledCountryFkIds : current;
            next = baseList.filter(id => id !== countryFkId);
        } else {
            // turning ON
            next = [...current, countryFkId];
            // normalize: if the list now equals every enabled country, store empty
            const setAll = new Set(allEnabledCountryFkIds);
            const setNext = new Set(next);
            if (setAll.size === setNext.size && [...setAll].every(id => setNext.has(id))) {
                next = [];
            }
        }

        // Optimistic update
        setOrgCurrencies(prev => prev.map(x => x.id === oc.id ? { ...x, enabled_in_country_ids: next } : x));
        startTransition(async () => {
            const res = await setOrgCurrencyCountries(oc.id, next);
            if (!res.success) {
                toast.error(res.error || 'Failed to update country activation');
                // revert
                setOrgCurrencies(prev => prev.map(x => x.id === oc.id ? { ...x, enabled_in_country_ids: current } : x));
                return;
            }
            const ccyCode = oc.currency_code || allCurrencies.find(c => c.id === oc.currency)?.code || 'currency';
            toast.success(next.length === 0
                ? `${ccyCode} now available in all enabled countries`
                : `${ccyCode} restricted to ${next.length} ${next.length === 1 ? 'country' : 'countries'}`);
        });
    };

    /* ─── KPI definitions ────────────────────────────────────────── */
    const KPIS = [
        { label: 'Countries', value: orgCountries.length, icon: Globe, color: 'var(--app-primary)' },
        { label: 'Currencies', value: orgCurrencies.length, icon: Coins, color: 'var(--app-primary)' },
        { label: 'Base', value: baseCurrencyCode ?? '—', icon: Crown, color: 'var(--app-primary)' },
        { label: 'Languages', value: langCodes.length || '—', icon: Languages, color: 'var(--app-primary)' },
    ] as const;

    /* ─── Tab definitions ────────────────────────────────────────── */
    // All top-level tabs share the page's primary accent so the active pill
    // is always the same theme color regardless of which tab is open.
    const TABS = [
        { key: 'countries' as Tab, label: 'Countries', icon: Globe, color: '--app-primary' },
        { key: 'currencies' as Tab, label: 'Currencies', icon: Coins, color: '--app-primary' },
        { key: 'languages' as Tab, label: 'Languages', icon: Languages, color: '--app-primary' },
    ];

    // Sub-tabs share the page's primary theme accent so the strip reads as one set.
    const CURRENCY_SUB_TABS: { key: CurrencySubTab; label: string; icon: typeof Globe; color: string }[] = [
        { key: 'select', label: 'Select Currency', icon: Coins, color: '--app-primary' },
        { key: 'rules', label: 'Rate Rules', icon: RefreshCcw, color: '--app-primary' },
        { key: 'history', label: 'Rate History', icon: TrendingUp, color: '--app-primary' },
        { key: 'revaluations', label: 'Revaluations', icon: Crown, color: '--app-primary' },
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
            {/* Google's Noto Color Emoji ships flag glyphs that the OS UI font
                doesn't have on Windows / many Linux distros — without this,
                country flags render as the regional-indicator letter pair
                (CI, AL, …) instead of an actual flag. React 19 hoists this
                <link> into <head>; browsers cache it across the whole app. */}
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" />

            {/* ── Confirm modal — single accent token throughout the dialog so
                 the chrome reads as one cohesive theme element. Destructive
                 uses --app-error (semantic danger); non-destructive uses
                 --app-primary (page accent). No mixed amber/red. */}
            {confirmAction && (() => {
                const tone = isDestructive ? '--app-error' : '--app-primary';
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                        style={{ background: 'color-mix(in srgb, var(--app-foreground) 50%, transparent)', backdropFilter: 'blur(6px)' }}
                        onClick={e => { if (e.target === e.currentTarget) setConfirmAction(null); }}>
                        <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative"
                            style={{
                                background: 'var(--app-surface)',
                                border: `1px solid color-mix(in srgb, var(${tone}) 30%, var(--app-border))`,
                                boxShadow: `0 20px 60px color-mix(in srgb, var(${tone}) 18%, transparent)`,
                            }}>
                            {/* Accent bar at the very top — single visual cue for the dialog tone */}
                            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: `var(${tone})` }} />

                            <div className="px-5 pt-5 pb-3 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ ...soft(tone, 14), color: `var(${tone})`, border: `1px solid color-mix(in srgb, var(${tone}) 30%, transparent)` }}>
                                    <AlertTriangle size={16} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="font-black text-app-foreground" style={{ fontSize: 14, lineHeight: 1.3 }}>{confirmTitle}</div>
                                    <p className="font-bold uppercase tracking-widest text-app-muted-foreground mt-0.5"
                                        style={{ fontSize: 9 }}>
                                        {isDestructive ? 'Destructive · cannot be undone' : 'Affects future transactions'}
                                    </p>
                                </div>
                                <button onClick={() => setConfirmAction(null)}
                                    className="p-1.5 rounded-lg hover:bg-app-border/40 text-app-muted-foreground hover:text-app-foreground transition-colors shrink-0 -m-1"
                                    title="Close">
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="px-5 pb-4 pl-[68px]">
                                <p className="font-medium text-app-foreground leading-relaxed" style={{ fontSize: 12 }}>{confirmMessage}</p>
                            </div>

                            <div className="px-4 py-3 flex items-center justify-end gap-2 border-t border-app-border/50"
                                style={{ background: 'color-mix(in srgb, var(--app-background) 50%, transparent)' }}>
                                <button onClick={() => setConfirmAction(null)}
                                    className="px-3.5 py-1.5 rounded-xl font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border hover:bg-app-surface transition-all"
                                    style={{ fontSize: 11 }}>
                                    Cancel
                                </button>
                                <button onClick={confirmAction.onConfirm} disabled={isPending}
                                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition-all disabled:opacity-50"
                                    style={{
                                        ...grad(tone),
                                        ...glow(tone, 25),
                                        color: 'var(--app-primary-foreground, white)',
                                        fontSize: 11,
                                    }}>
                                    {isPending && <Loader2 size={11} className="animate-spin" />}
                                    {isDestructive ? 'Yes, Disable' : 'Confirm'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── COA-style page shell ── */}
            <div className="flex flex-col overflow-hidden animate-in fade-in duration-300" style={{ height: 'calc(100dvh - 6rem)' }}>

                {/* ── HEADER — same shape as Chart of Accounts ── */}
                <div className="flex items-start justify-between gap-4 mb-4 flex-shrink-0 px-4 md:px-6 pt-4 md:pt-6">
                    <div className="flex items-center gap-3">
                        <div className="page-header-icon bg-app-primary">
                            <Globe size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-app-foreground tracking-tight">Regional Settings</h1>
                            <p className="text-tp-xs md:text-tp-sm font-bold text-app-muted-foreground uppercase tracking-wide">
                                {orgCountries.length} Countries · {orgCurrencies.length} Currencies · {langCodes.length || 0} Languages
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {/* Top-level tab bar — single connected segmented control */}
                        <div className="inline-flex items-stretch gap-0.5 p-0.5 rounded-xl border border-app-border bg-app-surface/50"
                             role="tablist" aria-label="Regional sections">
                            {TABS.map(t => {
                                const Icon = t.icon; const active = tab === t.key;
                                return (
                                    <button key={t.key}
                                        role="tab"
                                        aria-selected={active}
                                        onClick={() => { setTab(t.key); setSearch(''); setRegionFilter(''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all duration-200"
                                        style={active
                                            ? {
                                                fontSize: 11,
                                                color: `var(${t.color})`,
                                                background: `color-mix(in srgb, var(${t.color}) 12%, transparent)`,
                                                border: `1px solid color-mix(in srgb, var(${t.color}) 28%, transparent)`,
                                                boxShadow: `0 1px 3px color-mix(in srgb, var(${t.color}) 18%, transparent)`,
                                            }
                                            : {
                                                fontSize: 11,
                                                color: 'var(--app-muted-foreground)',
                                                background: 'transparent',
                                                border: '1px solid transparent',
                                            }}>
                                        <Icon size={13} /> <span className="hidden sm:inline">{t.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── KPI STRIP — same pattern as COA's KPIStrip ── */}
                <div className="flex-shrink-0 mb-3 px-4 md:px-6"
                     style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                    {KPIS.map(s => (
                        <div key={s.label}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl"
                            style={{
                                background: 'color-mix(in srgb, var(--app-surface) 50%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                            }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `color-mix(in srgb, ${s.color} 10%, transparent)`, color: s.color }}>
                                <s.icon size={14} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-tp-xxs font-bold uppercase tracking-wider truncate text-app-muted-foreground">{s.label}</div>
                                <div className="text-sm font-bold tabular-nums text-app-foreground truncate">{s.value}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── CONTENT AREA — fills rest, internal margins like COA's tree ── */}
                <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-6 pb-4">
                    <div className="h-full">
                    {tab === 'countries' && (
                        <TwoPanePicker
                            kind="country"
                            allItems={allCountries}
                            filteredItems={filteredCountries}
                            orgItems={orgCountriesSorted}
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
                            enabledCurrencyCodes={new Set(orgCurrencies.map(oc => oc.currency_code).filter((c): c is string => Boolean(c)))}
                            // Tree expansion (Country → enabled currencies + languages):
                            orgCurrencies={orgCurrencies}
                            allCurrencies={allCurrencies}
                            onToggleCurrencyCountry={toggleCurrencyCountry}
                            orgLanguages={langEntries.map((e, idx) => ({
                                id: e.code,
                                code: e.code,
                                native_name: COMMON_LOCALES.find(l => l.code === e.code)?.native ?? labelFor(e.code),
                                country_ids: e.country_ids,
                                is_default: idx === 0,
                            }))}
                            onToggleLangCountry={toggleLangCountry}
                        />
                    )}
                    {tab === 'currencies' && (() => {
                        // Segmented tab bar — fixed h-8 to match the search input height
                        // exactly so the right-pane header band never changes height when
                        // the sub-tab switches. Sibling buttons share borders to read as
                        // one connected control rather than four separate pills.
                        const subTabStrip = (
                            <div className="inline-flex items-stretch shrink-0 rounded-xl overflow-hidden h-8 border border-app-border/50"
                                style={{ background: 'var(--app-surface)' }}>
                                {CURRENCY_SUB_TABS.map((s, idx) => {
                                    const SIcon = s.icon; const active = currencySubTab === s.key;
                                    const isFirst = idx === 0;
                                    return (
                                        <button key={s.key} onClick={() => setCurrencySubTab(s.key)}
                                            className="inline-flex items-center gap-1.5 px-3 font-bold transition-all duration-200"
                                            style={{
                                                fontSize: 11,
                                                color: active ? `var(${s.color})` : 'var(--app-muted-foreground)',
                                                background: active ? `color-mix(in srgb, var(${s.color}) 12%, transparent)` : 'transparent',
                                                borderLeft: isFirst ? 'none' : '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)',
                                            }}>
                                            <SIcon size={12} /> <span className="hidden sm:inline">{s.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        );

                        // The "Your Currencies" pane stays mounted across all sub-tabs;
                        // only the right-pane body swaps between the catalogue grid and
                        // the FX management sections.
                        const rightBody =
                            currencySubTab === 'rules' ? <FxManagementSection view="policies" orgCurrencyCount={orgCurrencies.length} orgBaseCode={baseCurrencyCode} />
                            : currencySubTab === 'history' ? <FxManagementSection view="rates" orgCurrencyCount={orgCurrencies.length} orgBaseCode={baseCurrencyCode} />
                            : currencySubTab === 'revaluations' ? <FxManagementSection view="revaluations" orgCurrencyCount={orgCurrencies.length} orgBaseCode={baseCurrencyCode} />
                            : undefined;

                        return (
                            <TwoPanePicker
                                kind="currency"
                                allItems={allCurrencies}
                                filteredItems={filteredCurrencies}
                                orgItems={orgCurrenciesSorted}
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
                                // Tree expansion (Currency → activation per country):
                                orgCountries={orgCountries}
                                allCountries={allCountries}
                                orgCurrencies={orgCurrencies}
                                allCurrencies={allCurrencies}
                                onToggleCurrencyCountry={toggleCurrencyCountry}
                                // Sub-tabs share the right-pane header band with the search.
                                rightPaneHeaderLeft={subTabStrip}
                                // On non-select sub-tabs, replace catalogue body with FX section.
                                rightPaneBody={rightBody}
                                hideRightPaneSearch={currencySubTab !== 'select'}
                            />
                        );
                    })()}
                    {tab === 'languages' && (() => {
                        // Synthesize uniform language items so the shared TwoPanePicker /
                        // ActiveRow / CatalogueCard shells render languages the same way
                        // they render countries and currencies.
                        const orgLanguages = langEntries.map((e, idx) => ({
                            id: e.code,
                            code: e.code,
                            native_name: COMMON_LOCALES.find(l => l.code === e.code)?.native ?? labelFor(e.code),
                            country_ids: e.country_ids,
                            is_default: idx === 0,
                        }));
                        const allLanguages = COMMON_LOCALES.map(l => ({ id: l.code, code: l.code, name: l.native }));
                        const ql = langSearch.trim().toLowerCase();
                        const filteredLanguages = ql
                            ? allLanguages.filter(l => l.code.includes(ql) || l.name.toLowerCase().includes(ql))
                            : allLanguages;
                        const enabledLangIds = new Set<any>(langCodes);
                        const defaultLangId: any = langCodes[0] ?? null;

                        return (
                            <TwoPanePicker
                                kind="language"
                                allItems={allLanguages}
                                filteredItems={filteredLanguages}
                                orgItems={orgLanguages}
                                search={langSearch}
                                setSearch={setLangSearch}
                                regions={[]}
                                regionFilter=""
                                setRegionFilter={() => {}}
                                isPending={langLoading}
                                enabledIds={enabledLangIds}
                                defaultId={defaultLangId}
                                onEnable={(item: any) => toggleLang(item.code)}
                                onSetDefault={(code: any) => setDefaultLang(String(code))}
                                onDisable={(oc: any) => toggleLang(oc.code)}
                                // Cross-axis (Language → activated countries):
                                orgCountries={orgCountries}
                                allCountries={allCountries}
                                onToggleLangCountry={toggleLangCountry}
                                // Custom locale code add-row footer band:
                                rightPaneFooter={
                                    <div className="px-4 py-2.5 border-t border-app-border/50 shrink-0 flex items-center gap-2"
                                        style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)' }}>
                                        <span className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground shrink-0">Custom</span>
                                        <input value={langCustom}
                                            onChange={e => setLangCustom(e.target.value.replace(/[^a-z-]/gi, ''))}
                                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomLang(); } }}
                                            placeholder="Locale code (e.g. ber, ku)"
                                            className="flex-1 px-3 py-1.5 rounded-xl text-[12px] font-mono bg-app-surface/50 border border-app-border/50 text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface outline-none" />
                                        <button type="button" onClick={addCustomLang}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-white"
                                            style={{ ...grad('--app-primary'), fontSize: 11 }}>
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                }
                            />
                        );
                    })()}
                    </div>{/* close content inner */}
                </div>{/* close content area */}
            </div>{/* close COA-style page shell */}

            {/* Local toolbar-button styles — same recipe as Chart of Accounts */}
            <style jsx>{`
                /* Force a flag-capable emoji font on every span tagged .flag.
                   Some platforms (older Windows, many Linux distros) don't ship
                   a flag emoji glyph in the default UI font, so the regional
                   indicator pair renders as a placeholder. Naming an emoji
                   font in the family stack picks it up where available. */
                :global(.flag) {
                    font-family: "Noto Color Emoji", "Apple Color Emoji",
                        "Segoe UI Emoji", "Twemoji Mozilla", "EmojiOne Color",
                        "Android Emoji", emoji;
                    font-feature-settings: normal;
                    line-height: 1;
                }
                :global(.regional-tbtn) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    border: 1px solid var(--app-border);
                    color: var(--app-muted-foreground);
                    padding: 0.375rem 0.625rem;
                    border-radius: 0.75rem;
                    transition: all 0.2s;
                    background: transparent;
                }
                :global(.regional-tbtn:hover) {
                    background: var(--app-surface);
                    color: var(--app-foreground);
                }
                :global(.regional-tbtn[data-active]) {
                    /* Active state inline-styled per tab color */
                }
                :global(.regional-tbtn-primary) {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.375rem;
                    font-size: 0.6875rem;
                    font-weight: 700;
                    padding: 0.375rem 0.75rem;
                    border-radius: 0.75rem;
                    background: var(--app-primary);
                    color: var(--app-primary-foreground, white);
                    box-shadow: 0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent);
                    transition: all 0.2s;
                    border: 1px solid transparent;
                }
                :global(.regional-tbtn-primary:hover) {
                    transform: translateY(-1px);
                    filter: brightness(1.1);
                }
            `}</style>
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
    enabledCurrencyCodes,
    orgCountries, allCountries, orgCurrencies, allCurrencies, onToggleCurrencyCountry,
    orgLanguages, onToggleLangCountry,
    rightPaneHeaderLeft, rightPaneBody, hideRightPaneSearch, rightPaneFooter,
}: {
    kind: 'country' | 'currency' | 'language';
    allItems: any[]; filteredItems: any[]; orgItems: any[];
    search: string; setSearch: (s: string) => void;
    regions: string[]; regionFilter: string; setRegionFilter: (r: string) => void;
    isPending: boolean;
    enabledIds: Set<number>; defaultId: number | null;
    onEnable: (item: any) => void; onSetDefault: (id: number) => void; onDisable: (oc: any) => void;
    enabledCurrencyCodes?: Set<string>;
    /** Cross-axis data — used when an active row expands into the inverse list. */
    orgCountries?: OrgCountry[];
    allCountries?: RefCountry[];
    orgCurrencies?: OrgCurrency[];
    allCurrencies?: RefCurrency[];
    onToggleCurrencyCountry?: (oc: OrgCurrency, countryFkId: number) => void;
    /** Cross-axis data for the Languages tab — synthetic OrgLanguage list +
     *  per-country toggle. The shape mirrors OrgCurrency.country_ids semantics:
     *  empty = active in every enabled country. */
    orgLanguages?: Array<{ id: string; code: string; native_name: string; country_ids: number[]; is_default: boolean }>;
    onToggleLangCountry?: (langCode: string, countryFkId: number) => void;
    /** Optional content rendered inside the right-pane header band, before the
     *  search input — used by the Currencies tab to host its sub-tab strip. */
    rightPaneHeaderLeft?: React.ReactNode;
    /** Replace the right-pane body (catalogue grid) with custom content. Used by
     *  the Currencies tab to swap in FxManagementSection on non-select sub-tabs
     *  while keeping the left "Your Currencies" pane mounted. */
    rightPaneBody?: React.ReactNode;
    /** Hide the search/region filter inside the right-pane header. */
    hideRightPaneSearch?: boolean;
    /** Optional footer band rendered below the right pane body — used by the
     *  Languages tab to host the custom locale-code add input. */
    rightPaneFooter?: React.ReactNode;
}) {
    // Both Countries and Currencies share the page's primary accent so the
    // page reads as one cohesive theme — no warning-amber drift.
    const accent = '--app-primary';
    const PanelIcon = kind === 'country' ? Globe : kind === 'language' ? Languages : Coins;
    const placeholder = kind === 'country'
        ? 'Search 250+ countries…'
        : kind === 'language' ? 'Search languages…' : 'Search 150+ currencies…';
    const noun = kind === 'country' ? 'countries' : kind === 'language' ? 'languages' : 'currencies';
    const titleNoun = kind === 'country' ? 'Countries' : kind === 'language' ? 'Languages' : 'Currencies';

    return (
        <div className="h-full grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* ── LEFT PANE: Active selection ── */}
            <section className="bg-app-surface/30 rounded-2xl border border-app-border flex flex-col overflow-hidden min-h-0">
                <PaneHeader
                    icon={<PanelIcon size={13} style={{ color: `var(${accent})` }} />}
                    title={`Your ${titleNoun}`}
                    subtitle={`${orgItems.length} active · hover to manage`}
                />
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
                    {orgItems.length === 0 ? (
                        <EmptyState
                            icon={<PanelIcon size={36} className="text-app-muted-foreground opacity-40" />}
                            title={`No ${noun} enabled`}
                            hint="Click items in the catalogue on the right to enable them →"
                        />
                    ) : orgItems.map(oc => (
                        <ActiveRow
                            key={oc.id} kind={kind} oc={oc} accent={accent}
                            allItems={allItems}
                            isPending={isPending}
                            onSetDefault={onSetDefault}
                            onDisable={onDisable}
                            orgCountries={orgCountries}
                            allCountries={allCountries}
                            orgCurrencies={orgCurrencies}
                            allCurrencies={allCurrencies}
                            orgLanguages={orgLanguages}
                            onToggleCurrencyCountry={onToggleCurrencyCountry}
                            onToggleLangCountry={onToggleLangCountry}
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
            <section className="bg-app-surface/30 rounded-2xl border border-app-border flex flex-col overflow-hidden min-h-0">
                {/* Header band — fixed min-height so it stays the same size when the
                    search row hides on Currency sub-tabs, avoiding vertical jitter
                    between sub-tab switches. */}
                <div className="px-4 py-2 border-b border-app-border/50 shrink-0 flex items-center gap-2"
                    style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', minHeight: 48 }}>
                    {rightPaneHeaderLeft}
                    {!hideRightPaneSearch && (
                        <>
                            <div className="flex-1 relative min-w-[200px] h-8">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground" />
                                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder}
                                    className="w-full h-full pl-9 pr-9 text-[12px] font-medium bg-app-surface/50 border border-app-border/50 rounded-xl text-app-foreground placeholder:text-app-muted-foreground focus:bg-app-surface focus:border-app-border focus:ring-2 focus:ring-app-primary/10 outline-none transition-all" />
                                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground"><X size={13} /></button>}
                            </div>
                            {kind === 'country' && regions.length > 0 && (
                                <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                                    className="h-8 px-2.5 rounded-xl border border-app-border/50 bg-app-surface/50 text-[11px] font-bold text-app-foreground focus:bg-app-surface outline-none cursor-pointer">
                                    <option value="">All Regions</option>
                                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            )}
                            <span className="text-[9px] font-bold uppercase tracking-widest text-app-muted-foreground whitespace-nowrap shrink-0">
                                {filteredItems.length} results
                            </span>
                        </>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-3">
                    {rightPaneBody !== undefined ? (
                        rightPaneBody
                    ) : filteredItems.length === 0 ? (
                        <EmptyState
                            icon={<Search size={36} className="text-app-muted-foreground opacity-40" />}
                            title={`No ${noun} match your search`}
                            hint="Try a different search term or clear the filter."
                        />
                    ) : (() => {
                        // Float already-enabled items to the top of the catalogue,
                        // and within that the default/base item. Same pinned-row
                        // philosophy as the left "Your …" pane — the user always
                        // sees their current selection first when scanning.
                        const sortedFiltered = [...filteredItems].sort((a, b) => {
                            const aOn = enabledIds.has(a.id) ? 1 : 0;
                            const bOn = enabledIds.has(b.id) ? 1 : 0;
                            if (aOn !== bOn) return bOn - aOn;
                            const aDef = defaultId === a.id ? 1 : 0;
                            const bDef = defaultId === b.id ? 1 : 0;
                            return bDef - aDef;
                        });
                        return (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
                                {sortedFiltered.map(item => {
                                    const ccyCode = kind === 'country' ? (item.default_currency_code as string | undefined) : undefined;
                                    const willAutoEnableCurrency = !!ccyCode && !!enabledCurrencyCodes && !enabledCurrencyCodes.has(ccyCode);
                                    return (
                                        <CatalogueCard
                                            key={item.id} kind={kind} item={item} accent={accent}
                                            isEnabled={enabledIds.has(item.id)}
                                            isDefault={defaultId === item.id}
                                            isPending={isPending}
                                            onAdd={() => onEnable(item)}
                                            willAutoEnableCurrency={willAutoEnableCurrency}
                                        />
                                    );
                                })}
                            </div>
                        );
                    })()}
                </div>
                {rightPaneFooter}
            </section>
        </div>
    );
}

/* ─── Active row in left pane (tree node — expands into inverse axis) ── */
function ActiveRow({ kind, oc, accent, allItems, isPending, onSetDefault, onDisable, orgCountries, allCountries, orgCurrencies, allCurrencies, orgLanguages, onToggleCurrencyCountry, onToggleLangCountry }: any) {
    const [expanded, setExpanded] = useState(false);
    // Country expansion has TWO sub-sections (Currencies + Languages) that can
    // be collapsed independently. Both default-open.
    const [ccyExpanded, setCcyExpanded] = useState(true);
    const [langExpanded, setLangExpanded] = useState(true);
    const isDefault = oc.is_default;
    const isCountry = kind === 'country';
    const isLanguage = kind === 'language';

    const ref = isCountry
        ? (allItems as any[]).find((x: any) => x.id === oc.country)
        : isLanguage
            ? (allItems as any[]).find((x: any) => x.code === oc.code)
            : (allItems as any[]).find((x: any) => x.id === oc.currency);
    const code = isCountry
        ? (ref?.iso2 || oc.country_iso2 || '')
        : isLanguage ? oc.code : (ref?.code || oc.currency_code);
    const name = isCountry
        ? (ref?.name || oc.country_name)
        : isLanguage ? (oc.native_name || ref?.name || oc.code) : (ref?.name || oc.currency_name);

    /* ── Children — inverse-axis list ──
     *   Country row  → list currencies (which are active for this country)
     *   Currency row → list countries (where this currency is active)
     *   Language row → list countries (where this language is active)
     */
    const isExpandable = isCountry
        ? (Array.isArray(orgCurrencies) && orgCurrencies.length > 0)
            || (Array.isArray(orgLanguages) && orgLanguages.length > 0)
        : isLanguage
            ? Array.isArray(orgCountries) && orgCountries.length > 0
            : !isDefault && Array.isArray(orgCountries) && orgCountries.length > 0;

    return (
        <div className={`group/item rounded-xl transition-all border ${isDefault && !expanded ? '' : 'border-transparent hover:border-app-border/30'} ${expanded ? 'bg-app-background/40' : 'hover:bg-app-background'}`}
            style={isDefault ? { ...soft(accent, 8), border: `1px solid color-mix(in srgb, var(${accent}) 30%, transparent)` } : {}}>
            {/* ── Main row ── */}
            <div className="flex items-center gap-2 p-2.5">
                {/* Chevron toggle (or spacer) */}
                {isExpandable ? (
                    <button onClick={() => setExpanded(e => !e)}
                        className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-app-border/50 text-app-muted-foreground hover:text-app-foreground transition-colors shrink-0"
                        title={expanded ? 'Collapse' : 'Expand'}>
                        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </button>
                ) : <div className="w-5 shrink-0" />}

                {isCountry ? (
                    <span className="flag text-2xl shrink-0">{flag(code)}</span>
                ) : (
                    /* Tile: only the DEFAULT row carries the accent tint; every
                       other row uses a neutral border-tone tile so the panel
                       doesn't drown in colour. Currency = symbol; Language = code. */
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                        style={isDefault
                            ? { ...soft(accent, 14), color: `var(${accent})`, borderColor: `color-mix(in srgb, var(${accent}) 30%, transparent)` }
                            : {
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                color: 'var(--app-foreground)',
                                borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                            }}>
                        {isLanguage
                            ? <span className="font-black uppercase" style={{ fontSize: 11 }}>{code.slice(0, 2)}</span>
                            : <span className="font-black" style={{ fontSize: 14 }}>{ref?.symbol || oc.currency_symbol || code?.charAt(0) || '$'}</span>}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-bold text-app-foreground truncate" style={{ fontSize: 12, lineHeight: 1.3 }}
                        dir={isLanguage && isRTL(code) ? 'rtl' : undefined}>{name}</div>
                    <div className="font-mono uppercase text-app-muted-foreground" style={{ fontSize: 9 }}>{code}</div>
                </div>
                {isDefault ? (
                    <span className="rounded font-black uppercase tracking-widest text-white shrink-0 inline-flex items-center" style={{ ...grad(accent), fontSize: 8, padding: '2px 6px', lineHeight: 1.2 }}>
                        <Crown size={8} className="inline mr-0.5 -mt-px" /> {isCountry ? 'Default' : isLanguage ? 'Default' : 'Base'}
                    </span>
                ) : (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/item:opacity-100 transition-opacity">
                        <button onClick={() => onSetDefault(isCountry ? oc.country : isLanguage ? oc.code : oc.currency)} disabled={isPending}
                            className="p-1.5 rounded-lg hover:bg-app-border/50 transition-colors" title={`Set as ${isCountry ? 'default' : isLanguage ? 'default' : 'base'}`}>
                            <Star size={12} style={{ color: `var(${accent})` }} />
                        </button>
                        <button onClick={() => onDisable(oc)} disabled={isPending}
                            className="p-1.5 rounded-lg hover:bg-app-error/10 transition-colors" title="Remove">
                            <Trash2 size={12} style={{ color: 'var(--app-error)' }} />
                        </button>
                    </div>
                )}
            </div>

            {/* ── Expanded children ── */}
            {expanded && isExpandable && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-150 border-t border-app-border/30 px-2.5 py-2 space-y-1">
                    {isCountry ? (
                        <>
                            {Array.isArray(orgCurrencies) && orgCurrencies.length > 0 && (
                                <>
                                    <button type="button" onClick={() => setCcyExpanded(v => !v)}
                                        className="w-full text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground hover:text-app-foreground px-2 pt-0.5 pb-1 flex items-center gap-1 transition-colors rounded-md">
                                        {ccyExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        <Coins size={10} /> Currencies
                                        <span className="font-mono normal-case tracking-normal text-app-muted-foreground/70 ml-1" style={{ fontSize: 9 }}>
                                            ({orgCurrencies.length})
                                        </span>
                                    </button>
                                    {ccyExpanded && (
                                        <CurrenciesForCountry
                                            countryOc={oc}
                                            orgCurrencies={orgCurrencies as OrgCurrency[]}
                                            allCurrencies={allCurrencies as RefCurrency[]}
                                            onToggleCurrencyCountry={onToggleCurrencyCountry}
                                            isPending={isPending}
                                        />
                                    )}
                                </>
                            )}
                            {Array.isArray(orgLanguages) && orgLanguages.length > 0 && (
                                <>
                                    <button type="button" onClick={() => setLangExpanded(v => !v)}
                                        className="w-full text-left text-[9px] font-black uppercase tracking-widest text-app-muted-foreground hover:text-app-foreground px-2 pt-2 pb-1 flex items-center gap-1 transition-colors rounded-md">
                                        {langExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                                        <Languages size={10} /> Languages
                                        <span className="font-mono normal-case tracking-normal text-app-muted-foreground/70 ml-1" style={{ fontSize: 9 }}>
                                            ({orgLanguages.length})
                                        </span>
                                    </button>
                                    {langExpanded && (
                                        <LanguagesForCountry
                                            countryOc={oc}
                                            orgLanguages={orgLanguages}
                                            onToggleLangCountry={onToggleLangCountry}
                                            accent={accent}
                                            isPending={isPending}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    ) : isLanguage ? (
                        <CountriesForLanguage
                            langCode={code}
                            country_ids={oc.country_ids as number[]}
                            orgCountries={orgCountries as OrgCountry[]}
                            allCountries={allCountries as RefCountry[]}
                            onToggleLangCountry={onToggleLangCountry}
                            accent={accent}
                            isPending={isPending}
                        />
                    ) : (
                        <CountriesForCurrency
                            currencyOc={oc}
                            orgCountries={orgCountries as OrgCountry[]}
                            allCountries={allCountries as RefCountry[]}
                            onToggleCurrencyCountry={onToggleCurrencyCountry}
                            accent={accent}
                            currencyCode={code}
                            isPending={isPending}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── Catalogue card in right pane ─────────────────────────────── */
function CatalogueCard({ kind, item, accent, isEnabled, isDefault, isPending, onAdd, willAutoEnableCurrency }: any) {
    const isCountry = kind === 'country';
    const isLanguage = kind === 'language';
    // Language items use `name` (native) as the primary label, with the locale
    // code shown as a chip — same shape as country (name + iso2 chip).
    const primaryLabel = isCountry ? item.name : isLanguage ? item.name : item.code;
    const codeChip = isCountry ? item.iso2 : isLanguage ? item.code : null;
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
                <span className="flag text-2xl shrink-0">{flag(item.iso2)}</span>
            ) : (
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={isEnabled ? { ...soft(accent, 15), color: `var(${accent})` } : { ...soft('--app-muted-foreground', 8), color: 'var(--app-muted-foreground)' }}>
                    {isLanguage
                        ? <span className="text-sm font-black uppercase">{item.code?.slice(0, 2) || '??'}</span>
                        : <span className="text-sm font-black">{item.symbol || item.code?.charAt(0) || '$'}</span>}
                </div>
            )}
            <div className="flex-1 min-w-0 relative z-10">
                <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-bold text-app-foreground truncate"
                        dir={isLanguage && isRTL(item.code) ? 'rtl' : undefined}>{primaryLabel}</span>
                    {codeChip && <span className="text-[8px] font-mono uppercase px-1 py-0.5 rounded shrink-0 bg-app-background text-app-muted-foreground">{codeChip}</span>}
                </div>
                {/* Single-line catalogue card — same philosophy as Languages.
                    Country gets a tiny "+CCY" hint inline only when adding the
                    country will auto-activate a new currency, since that's a
                    side-effect the user needs to know about. Phone code, region,
                    and the default-currency line are intentionally dropped —
                    selection only needs the name + ISO. */}
                {isCountry && !isEnabled && willAutoEnableCurrency && item.default_currency_code && (
                    <span className="inline-flex items-center gap-0.5 font-mono font-bold mt-0.5"
                        title={`Will auto-activate ${item.default_currency_code} when this country is enabled`}
                        style={{ fontSize: 9, color: 'var(--app-warning)' }}>
                        <Plus size={8} /> {item.default_currency_code}
                    </span>
                )}
                {!isCountry && !isLanguage && (
                    <p className="font-medium text-app-muted-foreground truncate mt-0.5" style={{ fontSize: 9, lineHeight: 1.3 }}>{item.name}</p>
                )}
            </div>
            <div className="shrink-0 relative z-10">
                {isEnabled ? (
                    isDefault ? (
                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest text-white" style={grad(accent)}>
                            <Crown size={8} className="inline mr-0.5 -mt-px" />{isCountry || isLanguage ? 'Default' : 'Base'}
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
    return (
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
            <div className="mb-3">{icon}</div>
            <p className="font-bold text-app-muted-foreground" style={{ fontSize: 13, lineHeight: 1.4 }}>{title}</p>
            {hint && <p className="text-app-muted-foreground mt-1 max-w-md" style={{ fontSize: 11, lineHeight: 1.5 }}>{hint}</p>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Tree expansion children — both directions of the matrix
 * ═══════════════════════════════════════════════════════════════════ */

/** Country row → expand to show every enabled currency, with toggle for non-base ones. */
function CurrenciesForCountry({ countryOc, orgCurrencies, allCurrencies, onToggleCurrencyCountry, isPending }: {
    countryOc: OrgCountry;
    orgCurrencies: OrgCurrency[];
    allCurrencies: RefCurrency[];
    onToggleCurrencyCountry?: (oc: OrgCurrency, countryFkId: number) => void;
    isPending: boolean;
}) {
    return (
        <>
            {/*
               Palette policy inside Country expansion:
               – Single accent throughout = var(--app-primary) (country's color).
               – Currency symbol tile is NEUTRAL (no extra hue) — it's just an
                 identifier, not a state.
               – Base currency: subtle muted tag, no big amber gradient.
               – "Always available" → small Lock icon (muted), not a green pill.
               – Toggle uses primary tint when on. Off = standard border gray.
             */}
            {orgCurrencies.map(ccyOc => {
                const refCcy = allCurrencies.find(c => c.id === ccyOc.currency);
                const code = refCcy?.code || ccyOc.currency_code || '';
                const symbol = refCcy?.symbol || ccyOc.currency_symbol || '$';
                const isBase = ccyOc.is_default;
                const enabledList: number[] = (ccyOc.enabled_in_country_ids as number[] | undefined) ?? [];
                const allOn = enabledList.length === 0;
                const isActiveHere = isBase || allOn || enabledList.includes(countryOc.country);
                return (
                    <div key={ccyOc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-app-surface/50">
                        <div className="w-5 shrink-0" />{/* indent */}
                        {/* Neutral symbol tile — same look whether active or not */}
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border"
                            style={{
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                            }}>
                            <span className="font-black" style={{ fontSize: 11 }}>{symbol}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="font-mono font-bold uppercase truncate" style={{ fontSize: 11, color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{code}</span>
                            {isBase && (
                                <span className="font-black uppercase tracking-widest rounded inline-flex items-center"
                                    style={{
                                        ...soft('--app-muted-foreground', 12),
                                        color: 'var(--app-muted-foreground)',
                                        fontSize: 8, padding: '1px 5px', lineHeight: 1.2,
                                        border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                                    }}>
                                    Base
                                </span>
                            )}
                        </div>
                        {isBase ? (
                            <span className="shrink-0 inline-flex items-center justify-center w-9 h-4"
                                title="Base currency is always available in every enabled country">
                                <Lock size={11} style={{ color: 'var(--app-muted-foreground)' }} />
                            </span>
                        ) : (
                            <button onClick={() => onToggleCurrencyCountry?.(ccyOc, countryOc.country)}
                                disabled={isPending}
                                className="w-9 h-4 rounded-full relative transition-all shrink-0 disabled:opacity-50"
                                style={{ background: isActiveHere ? 'color-mix(in srgb, var(--app-primary) 72%, transparent)' : 'var(--app-border)' }}
                                title={`${isActiveHere ? 'Disable' : 'Enable'} ${code} for ${countryOc.country_name || 'this country'}`}>
                                <span className={`w-3 h-3 rounded-full bg-white absolute top-0.5 transition-all shadow ${isActiveHere ? 'left-[22px]' : 'left-0.5'}`} />
                            </button>
                        )}
                    </div>
                );
            })}
        </>
    );
}

/** Country row → expand to show every enabled language with a per-language
 *  toggle scoped to this single country (mirror of CurrenciesForCountry). */
function LanguagesForCountry({ countryOc, orgLanguages, onToggleLangCountry, accent, isPending }: {
    countryOc: OrgCountry;
    orgLanguages: Array<{ id: string; code: string; native_name: string; country_ids: number[]; is_default: boolean }>;
    onToggleLangCountry?: (langCode: string, countryFkId: number) => void;
    accent: string;
    isPending: boolean;
}) {
    return (
        <>
            {orgLanguages.map(lang => {
                const allOn = lang.country_ids.length === 0;
                const isActiveHere = lang.is_default || allOn || lang.country_ids.includes(countryOc.id);
                const code = lang.code;
                return (
                    <div key={lang.code} className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-app-surface/50">
                        <div className="w-5 shrink-0" />{/* indent */}
                        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 border"
                            style={{
                                background: 'color-mix(in srgb, var(--app-border) 30%, transparent)',
                                borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)',
                            }}>
                            <span className="font-black uppercase" style={{ fontSize: 10 }}>{code.slice(0, 2)}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="font-bold truncate" style={{ fontSize: 11, color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}
                                dir={isRTL(code) ? 'rtl' : undefined}>{lang.native_name}</span>
                            <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{code}</span>
                            {lang.is_default && (
                                <span className="font-black uppercase tracking-widest rounded inline-flex items-center"
                                    style={{
                                        ...soft('--app-muted-foreground', 12),
                                        color: 'var(--app-muted-foreground)',
                                        fontSize: 8, padding: '1px 5px', lineHeight: 1.2,
                                        border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                                    }}>
                                    Default
                                </span>
                            )}
                        </div>
                        {/* Default language is always available — same lock-icon convention
                            as the base currency in CurrenciesForCountry. */}
                        {lang.is_default ? (
                            <span className="shrink-0 inline-flex items-center justify-center w-9 h-4"
                                title="Default language is always available in every enabled country">
                                <Lock size={11} style={{ color: 'var(--app-muted-foreground)' }} />
                            </span>
                        ) : (
                            <button onClick={() => onToggleLangCountry?.(lang.code, countryOc.id)}
                                disabled={isPending}
                                className="w-9 h-4 rounded-full relative transition-all shrink-0 disabled:opacity-50"
                                style={{ background: isActiveHere ? `color-mix(in srgb, var(${accent}) 72%, transparent)` : 'var(--app-border)' }}
                                title={`${isActiveHere ? 'Disable' : 'Enable'} ${code.toUpperCase()} for ${countryOc.country_name || 'this country'}`}>
                                <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all shadow ${isActiveHere ? 'left-[22px]' : 'left-0.5'}`}
                                    style={{ background: 'var(--app-primary-foreground, white)' }} />
                            </button>
                        )}
                    </div>
                );
            })}
        </>
    );
}

/** Currency row → expand to show every enabled country with per-country toggle. */
function CountriesForCurrency({ currencyOc, orgCountries, allCountries, onToggleCurrencyCountry, accent, currencyCode, isPending }: {
    currencyOc: OrgCurrency;
    orgCountries: OrgCountry[];
    allCountries: RefCountry[];
    onToggleCurrencyCountry?: (oc: OrgCurrency, countryFkId: number) => void;
    accent: string;
    currencyCode: string;
    isPending: boolean;
}) {
    const enabledList: number[] = (currencyOc.enabled_in_country_ids as number[] | undefined) ?? [];
    const allOn = enabledList.length === 0;
    return (
        <>
            {/* Single accent inside Currency expansion = `accent` (passed in from the
                row, which is --app-warning for the Currencies tab). No green/success
                callouts — they fight with the row chrome. */}
            {allOn && (
                <div className="px-2 py-1.5 mb-0.5 rounded-lg flex items-center gap-2"
                    style={{ ...soft(accent, 8), border: `1px solid color-mix(in srgb, var(${accent}) 25%, transparent)` }}>
                    <Check size={12} style={{ color: `var(${accent})` }} />
                    <span className="font-bold" style={{ fontSize: 11, color: `var(${accent})` }}>
                        Available in every enabled country
                    </span>
                    <span className="text-app-muted-foreground" style={{ fontSize: 10 }}>· toggle any below to restrict</span>
                </div>
            )}
            {orgCountries.map(country_oc => {
                const refCountry = allCountries.find(c => c.id === country_oc.country);
                const iso = refCountry?.iso2 || country_oc.country_iso2 || '??';
                const cName = refCountry?.name || country_oc.country_name || iso;
                const isActiveHere = allOn || enabledList.includes(country_oc.country);
                return (
                    <div key={country_oc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-app-surface/50">
                        <div className="w-5 shrink-0" />
                        <span className="flag text-lg shrink-0">{flag(iso)}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="font-bold truncate" style={{ fontSize: 11, color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{cName}</span>
                            <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{iso}</span>
                            {country_oc.is_default && (
                                <span className="font-black uppercase tracking-widest rounded inline-flex items-center"
                                    style={{
                                        ...soft('--app-muted-foreground', 12),
                                        color: 'var(--app-muted-foreground)',
                                        fontSize: 8, padding: '1px 5px', lineHeight: 1.2,
                                        border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                                    }}
                                    title="Default country for this organization">
                                    <Crown size={7} className="inline mr-0.5 -mt-px" /> Home
                                </span>
                            )}
                        </div>
                        <button onClick={() => onToggleCurrencyCountry?.(currencyOc, country_oc.country)}
                            disabled={isPending}
                            className="w-9 h-4 rounded-full relative transition-all shrink-0 disabled:opacity-50"
                            style={{ background: isActiveHere ? `color-mix(in srgb, var(${accent}) 72%, transparent)` : 'var(--app-border)' }}
                            title={`${isActiveHere ? 'Disable' : 'Enable'} ${currencyCode} for ${cName}`}>
                            <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all shadow ${isActiveHere ? 'left-[22px]' : 'left-0.5'}`}
                                style={{ background: 'var(--app-primary-foreground, white)' }} />
                        </button>
                    </div>
                );
            })}
        </>
    );
}

/** Language row → expand to show every enabled country with per-country toggle.
 *  Same exact layout as CountriesForCurrency — empty country_ids = "all on". */
function CountriesForLanguage({ langCode, country_ids, orgCountries, allCountries, onToggleLangCountry, accent, isPending }: {
    langCode: string;
    country_ids: number[];
    orgCountries: OrgCountry[];
    allCountries: RefCountry[];
    onToggleLangCountry?: (langCode: string, countryFkId: number) => void;
    accent: string;
    isPending: boolean;
}) {
    const allOn = country_ids.length === 0;
    return (
        <>
            {allOn && (
                <div className="px-2 py-1.5 mb-0.5 rounded-lg flex items-center gap-2"
                    style={{ ...soft(accent, 8), border: `1px solid color-mix(in srgb, var(${accent}) 25%, transparent)` }}>
                    <Check size={12} style={{ color: `var(${accent})` }} />
                    <span className="font-bold" style={{ fontSize: 11, color: `var(${accent})` }}>
                        Available in every enabled country
                    </span>
                    <span className="text-app-muted-foreground" style={{ fontSize: 10 }}>· toggle any below to restrict</span>
                </div>
            )}
            {orgCountries.map(country_oc => {
                const refCountry = allCountries.find(c => c.id === country_oc.country);
                const iso = refCountry?.iso2 || country_oc.country_iso2 || '??';
                const cName = refCountry?.name || country_oc.country_name || iso;
                const isActiveHere = allOn || country_ids.includes(country_oc.id);
                return (
                    <div key={country_oc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors hover:bg-app-surface/50">
                        <div className="w-5 shrink-0" />
                        <span className="flag text-lg shrink-0">{flag(iso)}</span>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                            <span className="font-bold truncate" style={{ fontSize: 11, color: isActiveHere ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>{cName}</span>
                            <span className="font-mono uppercase shrink-0" style={{ fontSize: 9, color: 'var(--app-muted-foreground)' }}>{iso}</span>
                            {country_oc.is_default && (
                                <span className="font-black uppercase tracking-widest rounded inline-flex items-center"
                                    style={{
                                        ...soft('--app-muted-foreground', 12),
                                        color: 'var(--app-muted-foreground)',
                                        fontSize: 8, padding: '1px 5px', lineHeight: 1.2,
                                        border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                                    }}
                                    title="Default country for this organization">
                                    <Crown size={7} className="inline mr-0.5 -mt-px" /> Home
                                </span>
                            )}
                        </div>
                        <button onClick={() => onToggleLangCountry?.(langCode, country_oc.id)}
                            disabled={isPending}
                            className="w-9 h-4 rounded-full relative transition-all shrink-0 disabled:opacity-50"
                            style={{ background: isActiveHere ? `color-mix(in srgb, var(${accent}) 72%, transparent)` : 'var(--app-border)' }}
                            title={`${isActiveHere ? 'Disable' : 'Enable'} ${langCode.toUpperCase()} for ${cName}`}>
                            <span className={`w-3 h-3 rounded-full absolute top-0.5 transition-all shadow ${isActiveHere ? 'left-[22px]' : 'left-0.5'}`}
                                style={{ background: 'var(--app-primary-foreground, white)' }} />
                        </button>
                    </div>
                );
            })}
        </>
    );
}
