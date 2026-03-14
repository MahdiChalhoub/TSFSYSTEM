// @ts-nocheck
'use client';

import { useState, useMemo, useTransition } from 'react';
import {
    Globe, DollarSign, Search, Plus, Star, Check, X, Filter,
    MapPin, Phone, ChevronDown, ChevronRight, Loader2, Sparkles,
    BadgeCheck, Coins, ArrowUpDown
} from 'lucide-react';
import type { RefCountry, RefCurrency, OrgCountry, OrgCurrency } from '@/types/erp';
import {
    enableOrgCountry, enableOrgCurrency,
    setDefaultOrgCountry, setDefaultOrgCurrency,
    bulkEnableOrgCountries, bulkEnableOrgCurrencies,
    disableOrgCurrency,
} from '@/app/actions/reference';

// ─── Types ──────────────────────────────────────────────────────

interface Props {
    allCountries: RefCountry[];
    allCurrencies: RefCurrency[];
    initialOrgCountries: OrgCountry[];
    initialOrgCurrencies: OrgCurrency[];
}

type Tab = 'countries' | 'currencies';

// ─── Region Flag Emoji ──────────────────────────────────────────

function countryFlag(iso2: string): string {
    if (!iso2 || iso2.length !== 2) return '🏳️';
    const codePoints = [...iso2.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
    return String.fromCodePoint(...codePoints);
}

// ─── Component ─────────────────────────────────────────────────

export default function RegionalSettingsClient({
    allCountries, allCurrencies, initialOrgCountries, initialOrgCurrencies
}: Props) {
    const [tab, setTab] = useState<Tab>('countries');
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [orgCountries, setOrgCountries] = useState<OrgCountry[]>(initialOrgCountries);
    const [orgCurrencies, setOrgCurrencies] = useState<OrgCurrency[]>(initialOrgCurrencies);
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ─── Derived Data ───────────────────────────────────────────

    const enabledCountryIds = useMemo(
        () => new Set(orgCountries.map(oc => oc.country)),
        [orgCountries]
    );

    const defaultCountryId = useMemo(
        () => orgCountries.find(oc => oc.is_default)?.country ?? null,
        [orgCountries]
    );

    const enabledCurrencyIds = useMemo(
        () => new Set(orgCurrencies.map(oc => oc.currency)),
        [orgCurrencies]
    );

    const defaultCurrencyId = useMemo(
        () => orgCurrencies.find(oc => oc.is_default)?.currency ?? null,
        [orgCurrencies]
    );

    const regions = useMemo(
        () => [...new Set(allCountries.map(c => c.region).filter(Boolean))].sort(),
        [allCountries]
    );

    const filteredCountries = useMemo(() => {
        let list = allCountries;
        if (search) {
            const q = search.toLowerCase();
            list = list.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.iso2.toLowerCase().includes(q) ||
                c.iso3?.toLowerCase().includes(q) ||
                c.phone_code?.includes(q)
            );
        }
        if (regionFilter) {
            list = list.filter(c => c.region === regionFilter);
        }
        return list;
    }, [allCountries, search, regionFilter]);

    const filteredCurrencies = useMemo(() => {
        if (!search) return allCurrencies;
        const q = search.toLowerCase();
        return allCurrencies.filter(c =>
            c.code.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.symbol?.includes(q)
        );
    }, [allCurrencies, search]);

    // ─── Actions ────────────────────────────────────────────────

    const handleEnableCountry = (country: RefCountry) => {
        startTransition(async () => {
            const res = await enableOrgCountry(country.id, enabledCountryIds.size === 0);
            if (res.success) {
                setOrgCountries(prev => [...prev, {
                    id: Date.now(), country: country.id, is_enabled: true,
                    is_default: enabledCountryIds.size === 0,
                    country_name: country.name, country_iso2: country.iso2,
                }]);
                showToast(`${country.name} enabled`);
            } else {
                showToast(res.error || 'Failed', 'error');
            }
        });
    };

    const handleSetDefaultCountry = (countryId: number) => {
        startTransition(async () => {
            const res = await setDefaultOrgCountry(countryId);
            if (res.success) {
                setOrgCountries(prev => prev.map(oc => ({
                    ...oc, is_default: oc.country === countryId
                })));
                showToast('Default country updated');
            } else {
                showToast(res.error || 'Failed', 'error');
            }
        });
    };

    const handleEnableCurrency = (currency: RefCurrency) => {
        startTransition(async () => {
            const res = await enableOrgCurrency(currency.id, {
                is_default: enabledCurrencyIds.size === 0,
                is_transaction_currency: true,
            });
            if (res.success) {
                setOrgCurrencies(prev => [...prev, {
                    id: Date.now(), currency: currency.id, is_enabled: true,
                    is_default: enabledCurrencyIds.size === 0,
                    is_transaction_currency: true, is_reporting_currency: false,
                    currency_code: currency.code, currency_name: currency.name,
                    currency_symbol: currency.symbol,
                }]);
                showToast(`${currency.code} — ${currency.name} enabled`);
            } else {
                showToast(res.error || 'Failed', 'error');
            }
        });
    };

    const handleSetDefaultCurrency = (currencyId: number) => {
        startTransition(async () => {
            const res = await setDefaultOrgCurrency(currencyId);
            if (res.success) {
                setOrgCurrencies(prev => prev.map(oc => ({
                    ...oc, is_default: oc.currency === currencyId
                })));
                showToast('Default currency updated');
            } else {
                showToast(res.error || 'Failed', 'error');
            }
        });
    };

    const handleDisableCurrency = (orgCurrency: OrgCurrency) => {
        if (orgCurrency.is_default) {
            showToast('Cannot disable the default currency. Set another default first.', 'error');
            return;
        }
        startTransition(async () => {
            const res = await disableOrgCurrency(orgCurrency.id);
            if (res.success) {
                setOrgCurrencies(prev => prev.filter(oc => oc.id !== orgCurrency.id));
                showToast('Currency disabled');
            } else {
                showToast(res.error || 'Failed', 'error');
            }
        });
    };

    // ─── Render ─────────────────────────────────────────────────

    return (
        <div className="space-y-6">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-semibold
                    animate-in slide-in-from-right duration-300 border
                    ${toast.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-red-50 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'}`}>
                    {toast.type === 'success' ? <Check className="inline w-4 h-4 mr-2" /> : <X className="inline w-4 h-4 mr-2" />}
                    {toast.message}
                </div>
            )}

            {/* Tab Switcher */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-app-surface border border-app-border w-fit">
                <button
                    onClick={() => { setTab('countries'); setSearch(''); setRegionFilter(''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200
                        ${tab === 'countries'
                            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                            : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-hover'}`}
                >
                    <Globe size={16} /> Countries
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${tab === 'countries' ? 'bg-white/20' : 'bg-app-hover'}`}>
                        {orgCountries.length}
                    </span>
                </button>
                <button
                    onClick={() => { setTab('currencies'); setSearch(''); }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all duration-200
                        ${tab === 'currencies'
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25'
                            : 'text-app-muted-foreground hover:text-app-foreground hover:bg-app-hover'}`}
                >
                    <Coins size={16} /> Currencies
                    <span className={`ml-1 px-2 py-0.5 rounded-full text-xs ${tab === 'currencies' ? 'bg-white/20' : 'bg-app-hover'}`}>
                        {orgCurrencies.length}
                    </span>
                </button>
            </div>

            {/* Enabled Panel */}
            {tab === 'countries' && orgCountries.length > 0 && (
                <section className="bg-app-surface border border-app-border rounded-2xl p-5 space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
                        <BadgeCheck size={14} className="text-emerald-500" /> Enabled Countries
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {orgCountries.map(oc => {
                            const country = allCountries.find(c => c.id === oc.country);
                            return (
                                <div key={oc.id}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border
                                        ${oc.is_default
                                            ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700 font-bold'
                                            : 'bg-app-surface border-app-border hover:border-blue-300'}`}
                                >
                                    <span className="text-lg">{countryFlag(country?.iso2 || oc.country_iso2 || '')}</span>
                                    <span className="text-app-foreground font-semibold">{country?.name || oc.country_name}</span>
                                    {oc.is_default && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-black uppercase tracking-wider">
                                            Default
                                        </span>
                                    )}
                                    {!oc.is_default && (
                                        <button
                                            onClick={() => handleSetDefaultCountry(oc.country)}
                                            disabled={isPending}
                                            className="ml-1 p-1 rounded-lg text-app-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                                            title="Set as default"
                                        >
                                            <Star size={14} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {tab === 'currencies' && orgCurrencies.length > 0 && (
                <section className="bg-app-surface border border-app-border rounded-2xl p-5 space-y-3">
                    <h2 className="text-sm font-black uppercase tracking-widest text-app-muted-foreground flex items-center gap-2">
                        <BadgeCheck size={14} className="text-amber-500" /> Enabled Currencies
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {orgCurrencies.map(oc => {
                            const currency = allCurrencies.find(c => c.id === oc.currency);
                            return (
                                <div key={oc.id}
                                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all border
                                        ${oc.is_default
                                            ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 font-bold'
                                            : 'bg-app-surface border-app-border hover:border-amber-300'}`}
                                >
                                    <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                        {currency?.symbol || oc.currency_symbol || '$'}
                                    </span>
                                    <span className="text-app-foreground font-semibold">
                                        {currency?.code || oc.currency_code}
                                    </span>
                                    <span className="text-app-muted-foreground text-xs">
                                        {currency?.name || oc.currency_name}
                                    </span>
                                    {oc.is_default && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider">
                                            Base
                                        </span>
                                    )}
                                    {!oc.is_default && (
                                        <div className="flex items-center gap-1 ml-1">
                                            <button
                                                onClick={() => handleSetDefaultCurrency(oc.currency)}
                                                disabled={isPending}
                                                className="p-1 rounded-lg text-app-muted-foreground hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                                                title="Set as base currency"
                                            >
                                                <Star size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDisableCurrency(oc)}
                                                disabled={isPending}
                                                className="p-1 rounded-lg text-app-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                                title="Disable"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-app-muted-foreground" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder={tab === 'countries' ? 'Search countries by name, code, or phone...' : 'Search currencies by code, name, or symbol...'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-app-border bg-app-surface text-sm
                            text-app-foreground placeholder:text-app-muted-foreground
                            focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground hover:text-app-foreground">
                            <X size={16} />
                        </button>
                    )}
                </div>
                {tab === 'countries' && (
                    <select
                        value={regionFilter}
                        onChange={e => setRegionFilter(e.target.value)}
                        className="px-4 py-3 rounded-xl border border-app-border bg-app-surface text-sm
                            text-app-foreground focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                    >
                        <option value="">All Regions</option>
                        {regions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                )}
                <div className="text-xs text-app-muted-foreground px-2 whitespace-nowrap self-center">
                    {tab === 'countries'
                        ? `${filteredCountries.length} of ${allCountries.length} countries`
                        : `${filteredCurrencies.length} of ${allCurrencies.length} currencies`}
                </div>
            </div>

            {/* Loading Overlay */}
            {isPending && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                    <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </div>
            )}

            {/* Country Grid */}
            {tab === 'countries' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCountries.map(country => {
                        const isEnabled = enabledCountryIds.has(country.id);
                        const isDefault = defaultCountryId === country.id;
                        return (
                            <div key={country.id}
                                className={`group relative flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 cursor-pointer
                                    ${isEnabled
                                        ? isDefault
                                            ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 shadow-sm'
                                            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-app-surface border-app-border hover:border-blue-300 hover:shadow-md'}`}
                                onClick={() => !isEnabled && !isPending && handleEnableCountry(country)}
                            >
                                <span className="text-2xl shrink-0">{countryFlag(country.iso2)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-app-foreground truncate">{country.name}</span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-app-hover text-app-muted-foreground shrink-0">
                                            {country.iso2}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5 text-xs text-app-muted-foreground">
                                        {country.phone_code && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={10} /> {country.phone_code}
                                            </span>
                                        )}
                                        {country.region && (
                                            <span className="flex items-center gap-1">
                                                <MapPin size={10} /> {country.region}
                                            </span>
                                        )}
                                        {country.default_currency_code && (
                                            <span className="flex items-center gap-1">
                                                <DollarSign size={10} /> {country.default_currency_code}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isEnabled ? (
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isDefault ? (
                                            <span className="px-2 py-1 rounded-lg bg-blue-500 text-white text-[10px] font-black uppercase">Default</span>
                                        ) : (
                                            <Check size={18} className="text-emerald-500" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-500/25">
                                            <Plus size={14} /> Enable
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Currency Grid */}
            {tab === 'currencies' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredCurrencies.map(currency => {
                        const isEnabled = enabledCurrencyIds.has(currency.id);
                        const isDefault = defaultCurrencyId === currency.id;
                        return (
                            <div key={currency.id}
                                className={`group relative flex items-center gap-3 p-4 rounded-2xl border transition-all duration-200 cursor-pointer
                                    ${isEnabled
                                        ? isDefault
                                            ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 shadow-sm'
                                            : 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                                        : 'bg-app-surface border-app-border hover:border-amber-300 hover:shadow-md'}`}
                                onClick={() => !isEnabled && !isPending && handleEnableCurrency(currency)}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0
                                    ${isEnabled
                                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                        : 'bg-app-hover text-app-muted-foreground'}`}>
                                    {currency.symbol || currency.code.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm text-app-foreground">{currency.code}</span>
                                        {currency.minor_unit !== undefined && (
                                            <span className="text-[10px] text-app-muted-foreground">
                                                {currency.minor_unit} decimals
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-app-muted-foreground truncate mt-0.5">{currency.name}</p>
                                </div>
                                {isEnabled ? (
                                    <div className="flex items-center gap-1 shrink-0">
                                        {isDefault ? (
                                            <span className="px-2 py-1 rounded-lg bg-amber-500 text-white text-[10px] font-black uppercase">Base</span>
                                        ) : (
                                            <Check size={18} className="text-emerald-500" />
                                        )}
                                    </div>
                                ) : (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-500/25">
                                            <Plus size={14} /> Enable
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty State */}
            {tab === 'countries' && filteredCountries.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-app-muted-foreground">
                    <Globe size={48} className="mb-4 opacity-30" />
                    <p className="text-lg font-bold">No countries found</p>
                    <p className="text-sm mt-1">Try adjusting your search or filters</p>
                </div>
            )}
            {tab === 'currencies' && filteredCurrencies.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-app-muted-foreground">
                    <Coins size={48} className="mb-4 opacity-30" />
                    <p className="text-lg font-bold">No currencies found</p>
                    <p className="text-sm mt-1">Try adjusting your search</p>
                </div>
            )}
        </div>
    );
}
