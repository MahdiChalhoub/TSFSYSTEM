'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { createBrand, updateBrand, BrandState } from '@/app/actions/brands';
import {
    X, Save, Loader2, Globe, Tag, Award, AlertCircle,
    FolderTree, Lightbulb, Hash, Check, Search,
} from 'lucide-react';
import { peekNextCode } from '@/lib/sequences-client';
import { LockableCodeInput } from '@/components/admin/_shared/LockableCodeInput';
import { CategoryTreeSelector } from './CategoryTreeSelector';
import { getCatalogueLanguages, labelFor, placeholderFor, isRTL, type LocaleCode } from '@/lib/catalogue-languages';

type BrandFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    brand?: Record<string, any>;
    countries: Record<string, any>[];
    categories: Record<string, any>[];
};

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    children?: CategoryNode[];
    code?: string;
};

function buildCategoryTree(flatCategories: Record<string, any>[]): CategoryNode[] {
    const map = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];
    flatCategories.forEach(cat => {
        map.set(cat.id, { id: cat.id, name: cat.name, parentId: cat.parent, code: cat.code, children: [] });
    });
    flatCategories.forEach(cat => {
        const node = map.get(cat.id)!;
        if (cat.parent == null) roots.push(node);
        else map.get(cat.parent)?.children!.push(node);
    });
    return roots;
}

type LangEntry = { name?: string; short_name?: string };
const coerce = (v: any): LangEntry =>
    typeof v === 'string' ? { name: v } : (v && typeof v === 'object' ? v : {});

type PaneKey = 'identity' | 'markets' | 'taxonomy';

const initialState: BrandState = { message: '', errors: {} };

export function BrandFormModal({ isOpen, onClose, brand, countries, categories }: BrandFormModalProps) {
    const [state, formAction] = useActionState(brand ? updateBrand.bind(null, brand.id) : createBrand, initialState);
    const [pending, setPending] = useState(false);

    const [activePane, setActivePane] = useState<PaneKey>('identity');

    // Brand name mirror — so the sidebar header can echo what the user is typing.
    const [nameDraft, setNameDraft] = useState<string>(brand?.name || '');

    // Country selection — driven from React state so the Markets pane can stay
    // mounted-but-hidden and still reflect the current selection accurately.
    const [selectedCountryIds, setSelectedCountryIds] = useState<Set<number>>(
        () => new Set<number>((brand?.countries || []).map((c: any) => c.id))
    );
    const [countryFilter, setCountryFilter] = useState('');

    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
        brand?.categories?.map((c: Record<string, any>) => c.id) || []
    );
    const [suggestedCode, setSuggestedCode] = useState<string>('');

    const [locales, setLocales] = useState<LocaleCode[]>([]);
    const [translations, setTranslations] = useState<Record<string, LangEntry>>({});
    const [activeLang, setActiveLang] = useState<string>('__default__');

    const patchT = (code: string, field: 'name' | 'short_name', value: string) =>
        setTranslations(t => ({ ...t, [code]: { ...(t[code] || {}), [field]: value } }));

    const tree = useMemo(() => buildCategoryTree(categories), [categories]);
    const sortedCountries = useMemo(
        () => [...countries].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
        [countries]
    );
    const filteredCountries = useMemo(() => {
        const q = countryFilter.trim().toLowerCase();
        if (!q) return sortedCountries;
        return sortedCountries.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.code || '').toLowerCase().includes(q)
        );
    }, [sortedCountries, countryFilter]);

    const translatedCount = useMemo(
        () => Object.keys(translations).filter(k => translations[k]?.name || translations[k]?.short_name).length,
        [translations]
    );

    useEffect(() => {
        if (!isOpen) return;
        getCatalogueLanguages().then(setLocales).catch(() => setLocales([]));
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedCountryIds(new Set<number>((brand?.countries || []).map((c: any) => c.id)));
        setSelectedCategoryIds(brand?.categories?.map((c: Record<string, any>) => c.id) || []);
        setPending(false);
        setCountryFilter('');
        setActivePane('identity');
        setNameDraft(brand?.name || '');
        if (!brand) peekNextCode('BRAND').then(setSuggestedCode).catch(() => setSuggestedCode(''));
        else setSuggestedCode('');
        const src: Record<string, any> = { ...(brand?.translations || {}) };
        const out: Record<string, LangEntry> = {};
        Object.keys(src).forEach(k => { out[k] = coerce(src[k]); });
        setTranslations(out);
        setActiveLang('__default__');
    }, [isOpen, brand]);

    useEffect(() => {
        if (state.message === 'success') {
            onClose();
            setPending(false);
        }
    }, [state.message, onClose]);

    if (!isOpen) return null;

    const defaultCode = locales[0];
    const extras = locales.slice(1);
    const hasError = state.message && state.message !== 'success';

    const panes: { key: PaneKey; label: string; icon: React.ReactNode; badge: React.ReactNode; tone: string }[] = [
        {
            key: 'identity',
            label: 'Identity',
            icon: <Tag size={13} />,
            badge: extras.length > 0
                ? `${translatedCount + 1}/${locales.length}`
                : (nameDraft.trim() ? '✓' : '—'),
            tone: nameDraft.trim() ? 'var(--app-success)' : 'var(--app-muted-foreground)',
        },
        {
            key: 'markets',
            label: 'Markets',
            icon: <Globe size={13} />,
            badge: selectedCountryIds.size > 0 ? `${selectedCountryIds.size}` : 'All',
            tone: selectedCountryIds.size > 0 ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
        },
        {
            key: 'taxonomy',
            label: 'Categories',
            icon: <FolderTree size={13} />,
            badge: selectedCategoryIds.length > 0 ? `${selectedCategoryIds.length}` : 'Any',
            tone: selectedCategoryIds.length > 0 ? 'var(--app-primary)' : 'var(--app-warning, #f59e0b)',
        },
    ];

    const toggleCountry = (id: number) => setSelectedCountryIds(s => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-3xl mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* ── Header ── */}
                <div
                    className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <Award size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-tp-md font-bold text-app-foreground truncate">
                                {brand ? 'Edit Brand' : 'Create Brand'}
                            </h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground truncate">
                                {brand ? `Editing "${brand.name}"` : (nameDraft ? `Naming: ${nameDraft}` : 'Start by giving your brand a name')}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Body: sidebar + pane ── */}
                <form
                    id="brand-form"
                    action={(formData) => { setPending(true); formAction(formData); }}
                    className="flex-1 flex min-h-0"
                >
                    {/* Sidebar nav */}
                    <aside
                        className="w-[180px] flex-shrink-0 p-2 space-y-1 border-r hidden sm:block"
                        style={{
                            background: 'color-mix(in srgb, var(--app-background) 60%, var(--app-surface))',
                            borderColor: 'var(--app-border)',
                        }}
                    >
                        {panes.map(p => {
                            const active = activePane === p.key;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setActivePane(p.key)}
                                    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-tp-sm font-bold transition-all relative"
                                    style={{
                                        background: active ? 'var(--app-surface)' : 'transparent',
                                        color: active ? 'var(--app-primary)' : 'var(--app-foreground)',
                                        boxShadow: active ? '0 2px 8px color-mix(in srgb, var(--app-primary) 12%, transparent)' : undefined,
                                    }}
                                >
                                    {active && (
                                        <span
                                            className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r"
                                            style={{ background: 'var(--app-primary)' }}
                                        />
                                    )}
                                    <span className="ml-1 flex items-center justify-center w-6 h-6 rounded-lg flex-shrink-0"
                                          style={{
                                              background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                              color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                          }}>
                                        {p.icon}
                                    </span>
                                    <span className="flex-1 text-left truncate">{p.label}</span>
                                    <span
                                        className="text-tp-xxs font-mono font-bold px-1.5 py-0.5 rounded"
                                        style={{
                                            background: 'color-mix(in srgb, var(--app-background) 70%, transparent)',
                                            color: p.tone,
                                            border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                                        }}
                                    >
                                        {p.badge}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Reference code preview — lives in sidebar as meta */}
                        <div
                            className="mt-3 p-2.5 rounded-xl"
                            style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}
                        >
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1 mb-1">
                                <Hash size={9} /> Reference
                            </p>
                            <p className="text-tp-xs font-mono font-bold truncate"
                               style={{ color: brand?.reference_code ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {brand?.reference_code || (suggestedCode ? `${suggestedCode}` : 'Auto on save')}
                            </p>
                        </div>
                    </aside>

                    {/* Mobile tab strip (shown only when sidebar is hidden) */}
                    <div className="sm:hidden flex border-b flex-shrink-0 overflow-x-auto custom-scrollbar" style={{ borderColor: 'var(--app-border)' }}>
                        {panes.map(p => {
                            const active = activePane === p.key;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => setActivePane(p.key)}
                                    className="flex items-center gap-1 px-3 py-2 text-tp-xs font-bold transition-all flex-shrink-0"
                                    style={{
                                        color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        borderBottom: `2px solid ${active ? 'var(--app-primary)' : 'transparent'}`,
                                    }}
                                >
                                    {p.icon}
                                    {p.label}
                                    <span className="font-mono opacity-70">{p.badge}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Pane content — all panes stay mounted so form captures
                        everything. min-h locks the body height so swapping
                        language tabs / panes / selecting countries doesn't
                        bounce the modal up and down. */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 min-w-0"
                        style={{ minHeight: '460px' }}>
                        {hasError && (
                            <div
                                className="mb-4 p-3 rounded-xl flex items-center gap-2 text-tp-sm font-bold animate-in slide-in-from-top-1 duration-200"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)',
                                    color: 'var(--app-error)',
                                }}
                            >
                                <AlertCircle size={14} />
                                {state.message}
                            </div>
                        )}

                        {/* ═══ Pane: IDENTITY ═══ */}
                        <div className={activePane === 'identity' ? 'space-y-4' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Brand Identity</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    The primary name shown to users. Add translations for multi-language catalogues.
                                </p>
                            </div>

                            {/* Language chip row */}
                            {extras.length > 0 && (
                                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => setActiveLang('__default__')}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-tp-xxs font-bold uppercase transition-all flex-shrink-0"
                                        style={{
                                            background: activeLang === '__default__' ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                            border: `1px solid ${activeLang === '__default__' ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                            color: activeLang === '__default__' ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        }}
                                    >
                                        <Tag size={9} /> DEFAULT{defaultCode ? ` · ${defaultCode.toUpperCase()}` : ''}
                                    </button>
                                    {extras.map(code => {
                                        const active = activeLang === code;
                                        const filled = !!(translations[code]?.name || translations[code]?.short_name);
                                        return (
                                            <button
                                                key={code}
                                                type="button"
                                                onClick={() => setActiveLang(code)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-tp-xxs font-bold uppercase transition-all flex-shrink-0"
                                                style={{
                                                    background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                                    border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                                    color: active ? 'var(--app-primary)' : (filled ? 'var(--app-foreground)' : 'var(--app-muted-foreground)'),
                                                }}
                                            >
                                                {code}
                                                {filled && <span className="w-1 h-1 rounded-full" style={{ background: 'var(--app-success, #22c55e)' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Big name input — hero field */}
                            {activeLang === '__default__' ? (
                                <>
                                    <div>
                                        <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                            Brand Name <span style={{ color: 'var(--app-error)' }}>*</span>
                                        </label>
                                        <input
                                            name="name"
                                            value={nameDraft}
                                            onChange={e => setNameDraft(e.target.value)}
                                            placeholder="e.g., Nestle"
                                            required
                                            autoFocus
                                            className="w-full bg-app-surface border rounded-xl px-4 py-3 text-tp-lg font-bold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/10 transition-all placeholder:text-app-muted-foreground/40"
                                            style={{ borderColor: state.errors?.name ? 'var(--app-error)' : 'var(--app-border)' }}
                                        />
                                        {state.errors?.name && (
                                            <p className="text-tp-xs font-bold mt-1" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">Code</label>
                                        <LockableCodeInput
                                            name="shortName"
                                            defaultValue={brand?.short_name}
                                            suggestedValue={suggestedCode}
                                            isEdit={!!brand}
                                            placeholder="e.g., NES"
                                            mono
                                            className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2.5 text-tp-md font-mono font-bold text-app-foreground outline-none focus:border-app-primary/50 transition-all"
                                        />
                                        <p className="text-tp-xxs font-bold text-app-muted-foreground mt-1">
                                            3-letter abbreviation shown on compact listings.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                            {labelFor(activeLang)}
                                        </label>
                                        <input
                                            value={translations[activeLang]?.name || ''}
                                            onChange={e => patchT(activeLang, 'name', e.target.value)}
                                            placeholder={placeholderFor(activeLang)}
                                            dir={isRTL(activeLang) ? 'rtl' : undefined}
                                            className="w-full bg-app-surface border border-app-border rounded-xl px-4 py-3 text-tp-lg font-bold text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-tp-xs font-bold text-app-muted-foreground mb-1 block">
                                            Code · {activeLang.toUpperCase()}
                                        </label>
                                        <input
                                            value={translations[activeLang]?.short_name || ''}
                                            onChange={e => patchT(activeLang, 'short_name', e.target.value)}
                                            placeholder={isRTL(activeLang) ? 'مثال: نس' : 'e.g., NES'}
                                            dir={isRTL(activeLang) ? 'rtl' : undefined}
                                            className="w-full bg-app-surface border border-app-border rounded-xl px-3 py-2.5 text-tp-md font-mono font-bold text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                        />
                                        <p className="text-tp-xxs font-bold text-app-muted-foreground mt-1">
                                            3-letter abbreviation in {labelFor(activeLang)}.
                                        </p>
                                    </div>
                                    <input type="hidden" name="name" value={nameDraft} />
                                    <input type="hidden" name="shortName" value={brand?.short_name || ''} />
                                </>
                            )}

                            <input type="hidden" name="translationsJson" value={JSON.stringify(translations)} />
                        </div>

                        {/* ═══ Pane: MARKETS ═══ */}
                        <div className={activePane === 'markets' ? 'space-y-3' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Distribution Markets</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Pick the countries where this brand is sold. Leave empty for global availability.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" />
                                    <input
                                        value={countryFilter}
                                        onChange={e => setCountryFilter(e.target.value)}
                                        placeholder={`Search ${sortedCountries.length} countries...`}
                                        className="w-full bg-app-background border border-app-border rounded-xl pl-8 pr-3 py-2 text-tp-sm font-bold text-app-foreground outline-none focus:border-app-primary/50 transition-all placeholder:text-app-muted-foreground/40"
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCountryIds(new Set(sortedCountries.map(c => c.id)))}
                                    className="text-tp-xxs font-bold px-2.5 py-2 rounded-xl transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                >
                                    All
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedCountryIds(new Set())}
                                    className="text-tp-xxs font-bold px-2.5 py-2 rounded-xl transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                >
                                    None
                                </button>
                            </div>

                            <div
                                className="grid grid-cols-2 md:grid-cols-3 gap-1 p-1.5 rounded-xl overflow-y-auto custom-scrollbar"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)',
                                    maxHeight: '320px',
                                }}
                            >
                                {filteredCountries.length === 0 ? (
                                    <div className="col-span-full p-4 text-center text-tp-xs font-bold text-app-muted-foreground">
                                        No countries match &ldquo;{countryFilter}&rdquo;
                                    </div>
                                ) : filteredCountries.map(c => {
                                    const checked = selectedCountryIds.has(c.id);
                                    return (
                                        <button
                                            key={c.id}
                                            type="button"
                                            onClick={() => toggleCountry(c.id)}
                                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all text-left text-tp-sm"
                                            style={{
                                                background: checked ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'transparent',
                                                border: `1px solid ${checked ? 'color-mix(in srgb, var(--app-primary) 35%, transparent)' : 'transparent'}`,
                                                color: checked ? 'var(--app-primary)' : 'var(--app-foreground)',
                                            }}
                                        >
                                            <span
                                                className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all"
                                                style={{
                                                    background: checked ? 'var(--app-primary)' : 'var(--app-surface)',
                                                    border: `1px solid ${checked ? 'var(--app-primary)' : 'var(--app-border)'}`,
                                                }}
                                            >
                                                {checked && <Check size={10} className="text-white" strokeWidth={3} />}
                                            </span>
                                            <span className="font-bold truncate flex-1">{c.name}</span>
                                            <span className="font-mono text-tp-xxs opacity-60">{c.code}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {Array.from(selectedCountryIds).map(id => (
                                <input key={id} type="hidden" name="countryIds" value={id} />
                            ))}
                        </div>

                        {/* ═══ Pane: TAXONOMY ═══ */}
                        <div className={activePane === 'taxonomy' ? 'space-y-3' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Linked Categories</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Which product categories can use this brand. Empty = universal.
                                </p>
                            </div>

                            <CategoryTreeSelector
                                categories={tree as any}
                                selectedIds={selectedCategoryIds}
                                onChange={setSelectedCategoryIds}
                                maxHeight="max-h-[320px]"
                            />

                            {selectedCategoryIds.map(id => (
                                <input key={id} type="hidden" name="categoryIds" value={id} />
                            ))}

                            <div
                                className="p-3 rounded-xl flex items-start gap-2 text-tp-xs font-bold"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                    border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)',
                                    color: 'var(--app-info, #3b82f6)',
                                }}
                            >
                                <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                                <span>
                                    {selectedCategoryIds.length === 0
                                        ? 'No category selected — this brand will appear in every category.'
                                        : `Selecting a parent automatically includes all sub-categories. ${selectedCategoryIds.length} category${selectedCategoryIds.length === 1 ? '' : 'ies'} linked.`}
                                </span>
                            </div>
                        </div>
                    </div>
                </form>

                {/* ── Footer — always visible, saves regardless of active pane ── */}
                <div
                    className="px-5 py-3 flex items-center gap-2 flex-shrink-0"
                    style={{ borderTop: '1px solid var(--app-border)', background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))' }}
                >
                    <div className="flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {panes.find(p => p.key === activePane)?.label} · {activePane === 'identity' ? 'Required' : 'Optional'}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        className="px-4 py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="brand-form"
                        disabled={pending}
                        className="px-5 py-2 rounded-xl text-tp-xs font-bold bg-app-primary text-white transition-all flex items-center gap-2 hover:brightness-110 disabled:opacity-50"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                    >
                        {pending ? <Loader2 className="animate-spin" size={14} /> : (brand ? <Check size={14} /> : <Save size={14} />)}
                        {brand ? 'Update Brand' : 'Create Brand'}
                    </button>
                </div>
            </div>
        </div>
    );
}
