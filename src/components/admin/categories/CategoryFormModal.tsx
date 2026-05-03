'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import {
    X, Save, Loader2, FolderTree, AlertCircle, Hash, Tag, ChevronRight,
    Layers, Check, Lightbulb, Barcode, Award, ListTree,
} from 'lucide-react';
import { createCategory, updateCategory, CategoryState } from '@/app/actions/categories';
import { CategoryCascader } from './CategoryCascader';
import { peekNextCode } from '@/lib/sequences-client';
import { LockableCodeInput } from '@/components/admin/_shared/LockableCodeInput';
import {
    getCatalogueLanguages, getCachedCatalogueLanguages,
    labelFor, placeholderFor, isRTL, type LocaleCode,
} from '@/lib/catalogue-languages';
import { erpFetch } from '@/lib/erp-api';
import { getAttributeTree } from '@/app/actions/inventory/attributes';
// Reuse the same tree picker BrandFormModal uses for its Categories pane.
// Brands map to a flat list (no children); attributes map to roots with
// their values nested — both fit the CategoryTreeSelector shape.
import { CategoryTreeSelector } from '../CategoryTreeSelector';

type CategoryFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    category?: Record<string, any>;
    parentId?: number | null;
    potentialParents?: Record<string, any>[];
};

type LangEntry = { name?: string; short_name?: string };
const coerce = (v: any): LangEntry =>
    typeof v === 'string' ? { name: v } : (v && typeof v === 'object' ? v : {});

type PaneKey = 'identity' | 'hierarchy' | 'brands' | 'attributes';

const initialState: CategoryState = { message: '', errors: {} };

// Module-level cache for the next-code peek. The sequence backend is slow
// (~300-800ms) and the value rarely changes between modal opens within
// the same session; cache the first result so subsequent opens stamp the
// suggestion synchronously instead of showing a blank field that pops in.
let _categoryCodeCache: string | null = null;

// Shape consumed by CategoryTreeSelector. Brands are flat (children = []),
// attributes are roots with their values nested as children.
type TreeNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: TreeNode[];
    code?: string;
};

export function CategoryFormModal({
    isOpen, onClose, category, parentId, potentialParents = [],
}: CategoryFormModalProps) {
    const [state, formAction] = useActionState(
        category ? updateCategory.bind(null, category.id) : createCategory,
        initialState,
    );
    const [pending, setPending] = useState(false);
    const [activePane, setActivePane] = useState<PaneKey>('identity');

    // ── Hierarchy state ──
    const [isSubCategory, setIsSubCategory] = useState(!!parentId || (category && !!category.parent));
    const [selectedParent, setSelectedParent] = useState<number | string>(parentId || category?.parent || '');

    // Seed from module-level cache so the Code field renders pre-filled
    // on the modal's first paint when this isn't the very first open in
    // the session. Avoids the "code pops in 500ms later" flicker.
    const [suggestedCode, setSuggestedCode] = useState<string>(_categoryCodeCache ?? '');

    // ── Locales + translations ──
    const [locales, setLocales] = useState<LocaleCode[]>(
        () => getCachedCatalogueLanguages() ?? ['fr', 'ar'],
    );
    const [translations, setTranslations] = useState<Record<string, LangEntry>>(() => {
        const src: Record<string, any> = { ...(category?.translations || {}) };
        if (category?.name_fr && !src.fr) src.fr = { name: category.name_fr };
        if (category?.name_ar && !src.ar) src.ar = { name: category.name_ar };
        const out: Record<string, LangEntry> = {};
        Object.keys(src).forEach(k => { out[k] = coerce(src[k]); });
        return out;
    });
    const patchT = (code: string, field: 'name' | 'short_name', value: string) =>
        setTranslations(t => ({ ...t, [code]: { ...(t[code] || {}), [field]: value } }));
    const [activeLang, setActiveLang] = useState<string>('__default__');
    const [nameDraft, setNameDraft] = useState<string>(category?.name || '');

    // ── Brand + Attribute selection (M2M).
    // Hydrated from the category row when editing. The dirty flags below
    // are CRITICAL: without them, opening Edit and clicking Update would
    // send `attributes: []` (clearing the M2M) and call syncBrandLinks
    // with an empty set (removing this category from every brand). We
    // only forward the pane data to the action when the user has
    // actually touched the chips. ──
    const [brandTree, setBrandTree] = useState<TreeNode[]>([]);
    const [attrTree, setAttrTree] = useState<TreeNode[]>([]);
    const [selectedBrandIds, setSelectedBrandIds] = useState<Set<number>>(
        () => new Set<number>(
            Array.isArray(category?.brand_ids) ? category!.brand_ids
                : Array.isArray(category?.brands) ? category!.brands.map((b: any) => typeof b === 'number' ? b : b.id)
                    : [],
        ),
    );
    const [selectedAttrIds, setSelectedAttrIds] = useState<Set<number>>(
        () => new Set<number>(
            Array.isArray(category?.attribute_ids) ? category!.attribute_ids
                : Array.isArray(category?.attributes) ? category!.attributes.map((a: any) => typeof a === 'number' ? a : a.id)
                    : [],
        ),
    );
    const [brandsDirty, setBrandsDirty] = useState(false);
    const [attrsDirty, setAttrsDirty] = useState(false);
    const [loadingLinks, setLoadingLinks] = useState(false);
    const [linksLoaded, setLinksLoaded] = useState(false);

    useEffect(() => { if (state.message === 'success') onClose(); }, [state, onClose]);

    useEffect(() => {
        if (!isOpen) return;
        setIsSubCategory(!!parentId || (category && !!category.parent));
        setSelectedParent(parentId || category?.parent || '');
        setActivePane('identity');
        setNameDraft(category?.name || '');
        // Reset dirty flags + reload tracker on each open so the next save
        // doesn't blindly clear M2M data the user never touched.
        setBrandsDirty(false);
        setAttrsDirty(false);
        setLinksLoaded(false);

        if (!category) {
            // Fire and update cache. If we already had a cached value the
            // input is already showing it — this just refreshes for the
            // next open.
            peekNextCode('CATEGORY')
                .then(code => {
                    _categoryCodeCache = code;
                    setSuggestedCode(code);
                })
                .catch(() => {/* keep whatever we already had */});
        } else {
            setSuggestedCode('');
        }

        getCatalogueLanguages().then(next => {
            setLocales(prev =>
                prev.length === next.length && prev.every((c, i) => c === next[i]) ? prev : next,
            );
        }).catch(() => { /* keep cached */ });

        // NOTE: brand + attribute trees are NOT loaded here. They load on
        // demand the first time the user opens the Brands or Attributes
        // pane (see ensureLinksLoaded below). Saves a noticeable chunk of
        // the modal's open time when the user only edits Identity.
    }, [isOpen, parentId, category]);

    // Lazy loader for the Brands + Attributes panes. First time the user
    // clicks one of those tabs we fetch both (cheaper to fetch together
    // than to round-trip twice). Subsequent visits are no-ops.
    const ensureLinksLoaded = () => {
        if (linksLoaded || loadingLinks) return;
        setLoadingLinks(true);
        Promise.all([
            erpFetch('inventory/brands/').then((r: any) =>
                Array.isArray(r) ? r : (r?.results ?? [])
            ).catch(() => []),
            getAttributeTree().catch(() => []),
        ]).then(([brands, attrs]) => {
            setBrandTree((brands as any[]).map(b => ({
                id: b.id, name: b.name, code: b.code, parent: null, children: [],
            })));
            const mapAttr = (a: any): TreeNode => ({
                id: a.id,
                name: a.name,
                code: a.code,
                parent: a.parent ?? null,
                children: Array.isArray(a.children) ? a.children.map(mapAttr) : [],
            });
            setAttrTree((attrs as any[]).map(mapAttr));
            setLinksLoaded(true);
        }).finally(() => setLoadingLinks(false));
    };

    // ── Tree exclusion (can't pick self or descendant as parent) ──
    const descendants = useMemo(() => {
        if (!category) return new Set<number>();
        const out = new Set<number>();
        const stack: number[] = [category.id];
        while (stack.length) {
            const cur = stack.pop()!;
            potentialParents
                .filter(c => c.parent === cur)
                .forEach(c => { out.add(c.id); stack.push(c.id); });
        }
        return out;
    }, [category, potentialParents]);

    const availableParents = useMemo(
        () => potentialParents.filter(p => (!category || p.id !== category.id) && !descendants.has(p.id)),
        [potentialParents, category, descendants],
    );

    if (!isOpen) return null;

    const parentName = selectedParent ? potentialParents.find(p => p.id == selectedParent)?.name : null;
    const parentCode = selectedParent ? potentialParents.find(p => p.id == selectedParent)?.code : null;
    const hasError = state.message && state.message !== 'success';
    const defaultCode = locales[0];
    const extras = locales.slice(1);
    const translatedCount = extras.filter(c => (translations[c]?.name || '').trim()).length;

    const panes: { key: PaneKey; label: string; icon: React.ReactNode; badge: React.ReactNode; tone: string }[] = [
        {
            key: 'identity',
            label: 'Identity',
            icon: <Tag size={13} />,
            badge: extras.length > 0
                ? `${(nameDraft.trim() ? 1 : 0) + translatedCount}/${locales.length}`
                : (nameDraft.trim() ? '✓' : '—'),
            tone: nameDraft.trim() ? 'var(--app-success)' : 'var(--app-muted-foreground)',
        },
        {
            key: 'hierarchy',
            label: 'Hierarchy',
            icon: <Layers size={13} />,
            badge: isSubCategory ? (parentName ? '↳' : '?') : 'Root',
            tone: isSubCategory && !parentName ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)',
        },
        {
            key: 'brands',
            label: 'Brands',
            icon: <Award size={13} />,
            badge: selectedBrandIds.size > 0 ? `${selectedBrandIds.size}` : 'Any',
            tone: selectedBrandIds.size > 0 ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
        },
        {
            key: 'attributes',
            label: 'Attributes',
            icon: <ListTree size={13} />,
            badge: selectedAttrIds.size > 0 ? `${selectedAttrIds.size}` : 'None',
            tone: selectedAttrIds.size > 0 ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
        },
    ];

    return (
        <div
            // Mobile: pin to bottom (sheet). Desktop (sm+): center.
            className="fixed inset-0 z-[110] flex items-end md:items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                // Mobile: full-width sheet, slide-up, rounded only on top,
                //   95vh tall so the user actually has room to type.
                // Desktop (sm+): centered card, all corners rounded, max
                //   width 3xl, restored zoom-in animation, restored 92vh.
                className="w-full md:max-w-3xl md:mx-4 overflow-hidden flex flex-col
                           rounded-t-2xl md:rounded-2xl
                           h-[95vh] md:h-auto md:max-h-[92vh]
                           animate-in slide-in-from-bottom-4 md:slide-in-from-bottom-0 md:zoom-in-95 duration-200"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Mobile drag-handle hint — purely decorative, signals
                    the sheet is dismissable by swiping the modal away. */}
                <div className="md:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 30%, transparent)' }} />
                </div>
                {/* ── Header ── */}
                <div
                    className="px-4 md:px-5 py-2.5 md:py-3 flex items-center justify-between flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
                        <div
                            className="w-8 h-8 md:w-9 md:h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <FolderTree size={16} className="text-white" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-tp-md font-bold text-app-foreground truncate">
                                {category ? 'Edit Category' : 'Create Category'}
                            </h3>
                            <p className="text-tp-xs font-bold text-app-muted-foreground truncate">
                                {category
                                    ? `Editing "${category.name}"`
                                    : (nameDraft ? `Naming: ${nameDraft}` : 'Product Taxonomy — start with a name')}
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
                    id="category-form"
                    action={(formData) => { setPending(true); formAction(formData); }}
                    className="flex-1 flex min-h-0"
                >
                    {/* Sidebar nav (desktop, ≥768px) */}
                    <aside
                        className="w-[180px] flex-shrink-0 p-2 space-y-1 border-r hidden md:block"
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
                                    onClick={() => {
                                        setActivePane(p.key);
                                        if (p.key === 'brands' || p.key === 'attributes') ensureLinksLoaded();
                                    }}
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

                        <div
                            className="mt-3 p-2.5 rounded-xl"
                            style={{ background: 'var(--app-surface)', border: '1px solid color-mix(in srgb, var(--app-border) 60%, transparent)' }}
                        >
                            <p className="text-tp-xxs font-bold uppercase tracking-wide text-app-muted-foreground flex items-center gap-1 mb-1">
                                <Hash size={9} /> Reference
                            </p>
                            <p className="text-tp-xs font-mono font-bold truncate"
                                style={{ color: category?.code ? 'var(--app-foreground)' : 'var(--app-muted-foreground)' }}>
                                {category?.code || (suggestedCode ? `${suggestedCode}` : 'Auto on save')}
                            </p>
                        </div>
                    </aside>

                    {/* Mobile + tablet tab strip (<768px) — equal-width segments
                        instead of a horizontal scrollbar; bigger touch targets;
                        the badge sits below the label so labels stay aligned. */}
                    <div
                        className="md:hidden grid border-b flex-shrink-0"
                        style={{
                            borderColor: 'var(--app-border)',
                            background: 'color-mix(in srgb, var(--app-background) 50%, var(--app-surface))',
                            gridTemplateColumns: `repeat(${panes.length}, minmax(0, 1fr))`,
                        }}
                    >
                        {panes.map(p => {
                            const active = activePane === p.key;
                            return (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => {
                                        setActivePane(p.key);
                                        if (p.key === 'brands' || p.key === 'attributes') ensureLinksLoaded();
                                    }}
                                    className="flex flex-col items-center justify-center gap-0.5 py-2 text-tp-xxs font-bold transition-all min-h-[52px]"
                                    style={{
                                        color: active ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        borderBottom: `2px solid ${active ? 'var(--app-primary)' : 'transparent'}`,
                                        background: active ? 'var(--app-surface)' : 'transparent',
                                    }}
                                >
                                    <span className="flex items-center gap-1">
                                        {p.icon}
                                        <span className="truncate">{p.label}</span>
                                    </span>
                                    <span
                                        className="text-tp-xxs font-mono leading-none"
                                        style={{ color: p.tone, opacity: 0.85 }}
                                    >
                                        {p.badge}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Pane content. scroll-behavior + overscroll-behavior
                        keep the modal scroll smooth and stop wheel events
                        from chaining to the page underneath. Tighter
                        padding on mobile, no enforced minHeight (the sheet
                        already fills 95vh). */}
                    <div
                        className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-5 min-w-0
                                   md:min-h-[460px]"
                        style={{
                            scrollBehavior: 'smooth',
                            overscrollBehavior: 'contain',
                            WebkitOverflowScrolling: 'touch',
                        }}
                    >
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

                        {/* ═══ Pane: IDENTITY (now also holds Codes) ═══ */}
                        <div className={activePane === 'identity' ? 'space-y-4' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Category Identity</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Name, codes and translations. Internal reference + barcode prefix below.
                                </p>
                            </div>

                            {/* Language tabs */}
                            {extras.length > 0 && (
                                <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar">
                                    <button type="button"
                                        onClick={() => setActiveLang('__default__')}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-tp-xxs font-bold transition-all flex-shrink-0"
                                        style={{
                                            background: activeLang === '__default__' ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                            border: `1px solid ${activeLang === '__default__' ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                            color: activeLang === '__default__' ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                        }}>
                                        <Tag size={9} /> DEFAULT{defaultCode ? ` · ${defaultCode.toUpperCase()}` : ''}
                                    </button>
                                    {extras.map(code => {
                                        const active = activeLang === code;
                                        const filled = !!(translations[code]?.name || '').trim();
                                        return (
                                            <button key={code} type="button"
                                                onClick={() => setActiveLang(code)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-tp-xxs font-bold uppercase transition-all flex-shrink-0"
                                                style={{
                                                    background: active ? 'color-mix(in srgb, var(--app-primary) 12%, transparent)' : 'var(--app-background)',
                                                    border: `1px solid ${active ? 'color-mix(in srgb, var(--app-primary) 40%, transparent)' : 'var(--app-border)'}`,
                                                    color: active ? 'var(--app-primary)' : (filled ? 'var(--app-foreground)' : 'var(--app-muted-foreground)'),
                                                }}>
                                                {code}
                                                {filled && <span className="w-1 h-1 rounded-full" style={{ background: 'var(--app-success, #22c55e)' }} />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Name + Short Name (per active language) */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                {activeLang === '__default__' ? (
                                    <>
                                        <div>
                                            <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                                <Tag size={9} className="inline mr-1" />Category Name
                                            </label>
                                            <input
                                                name="name"
                                                value={nameDraft}
                                                onChange={e => setNameDraft(e.target.value)}
                                                placeholder="e.g. Beverages"
                                                required
                                                className="w-full text-tp-sm font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                            />
                                            {state.errors?.name && <p className="text-tp-xs font-bold mt-0.5" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>}
                                        </div>
                                        <div>
                                            <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">Short Name</label>
                                            <input
                                                name="shortName"
                                                defaultValue={category?.short_name || ''}
                                                placeholder="e.g. BEV"
                                                className="w-full text-tp-sm font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                            />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                                {labelFor(activeLang)}
                                            </label>
                                            <input
                                                value={translations[activeLang]?.name || ''}
                                                onChange={e => patchT(activeLang, 'name', e.target.value)}
                                                placeholder={placeholderFor(activeLang)}
                                                dir={isRTL(activeLang) ? 'rtl' : undefined}
                                                className="w-full text-tp-sm font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                                Short Name · {activeLang.toUpperCase()}
                                            </label>
                                            <input
                                                value={translations[activeLang]?.short_name || ''}
                                                onChange={e => patchT(activeLang, 'short_name', e.target.value)}
                                                placeholder={isRTL(activeLang) ? 'مثال: مش' : 'e.g. BEV'}
                                                dir={isRTL(activeLang) ? 'rtl' : undefined}
                                                className="w-full text-tp-sm font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                            />
                                        </div>
                                        <input type="hidden" name="name" value={nameDraft} />
                                        <input type="hidden" name="shortName" value={category?.short_name || ''} />
                                    </>
                                )}
                                <input type="hidden" name="translationsJson" value={JSON.stringify(translations)} />
                            </div>

                            {/* Codes — merged into Identity below the name fields */}
                            <div className="pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--app-border) 60%, transparent)' }}>
                                <h5 className="text-tp-xs font-bold uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1.5">
                                    <Hash size={10} /> Codes &amp; Barcode
                                </h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                            Code (Unique)
                                        </label>
                                        <LockableCodeInput
                                            name="code"
                                            defaultValue={category?.code}
                                            suggestedValue={suggestedCode}
                                            isEdit={!!category}
                                            placeholder="e.g. 1001 or CAT-BEV"
                                            mono
                                            className="w-full text-tp-sm px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                        />
                                        <p className="text-tp-xs font-bold text-app-muted-foreground mt-1">
                                            Internal reference — not printed.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                            <Barcode size={9} className="inline mr-1" />Barcode Prefix
                                        </label>
                                        <LockableCodeInput
                                            name="barcodePrefix"
                                            defaultValue={category?.barcode_prefix}
                                            isEdit={!!category?.barcode_prefix}
                                            placeholder="e.g. 0410"
                                            mono
                                            maxLength={10}
                                            inputFilter="digits"
                                            warning="Changing the barcode prefix will break every product barcode already printed in this category. Only change this if you understand the impact. Continue?"
                                            className="w-full text-tp-sm px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                            style={{
                                                background: 'var(--app-background)',
                                                border: state.errors?.barcode_prefix ? '1px solid var(--app-error)' : '1px solid var(--app-border)',
                                            }}
                                        />
                                        {state.errors?.barcode_prefix ? (
                                            <p className="text-tp-xs font-bold mt-1" style={{ color: 'var(--app-error)' }}>
                                                {state.errors.barcode_prefix[0]}
                                            </p>
                                        ) : (
                                            <p className="text-tp-xs font-bold text-app-muted-foreground mt-1">
                                                e.g. <code className="font-mono">0410</code> → <code className="font-mono">0410001</code>.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ Pane: HIERARCHY ═══ */}
                        <div className={activePane === 'hierarchy' ? 'space-y-4' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Tree Position</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Pick how this category sits in the catalogue tree — preview updates live.
                                </p>
                            </div>

                            {/* ── Choice cards (Root vs Sub) — bigger, illustrative,
                                 with description + icon stack instead of a plain pill toggle. ── */}
                            {!parentId && (
                                <div className="grid grid-cols-2 gap-2.5">
                                    {([
                                        {
                                            value: false,
                                            icon: <FolderTree size={18} />,
                                            title: 'Root Category',
                                            sub: 'Top-level entry — own branch in the tree',
                                        },
                                        {
                                            value: true,
                                            icon: <Layers size={18} />,
                                            title: 'Sub-Category',
                                            sub: 'Nested under an existing parent',
                                        },
                                    ] as const).map(opt => {
                                        const active = isSubCategory === opt.value;
                                        return (
                                            <button
                                                key={String(opt.value)}
                                                type="button"
                                                onClick={() => {
                                                    setIsSubCategory(opt.value);
                                                    if (!opt.value) setSelectedParent('');
                                                }}
                                                className="text-left p-3 rounded-xl transition-all relative overflow-hidden"
                                                style={{
                                                    background: active
                                                        ? 'color-mix(in srgb, var(--app-primary) 8%, var(--app-surface))'
                                                        : 'var(--app-surface)',
                                                    border: `1.5px solid ${active
                                                        ? 'color-mix(in srgb, var(--app-primary) 45%, transparent)'
                                                        : 'var(--app-border)'}`,
                                                    boxShadow: active
                                                        ? '0 4px 12px color-mix(in srgb, var(--app-primary) 12%, transparent)'
                                                        : undefined,
                                                }}
                                            >
                                                {active && (
                                                    <span
                                                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                                                        style={{ background: 'var(--app-primary)' }}
                                                    >
                                                        <Check size={11} className="text-white" strokeWidth={3} />
                                                    </span>
                                                )}
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <div
                                                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                                                        style={{
                                                            background: active
                                                                ? 'var(--app-primary)'
                                                                : 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                                                            color: active ? '#fff' : 'var(--app-muted-foreground)',
                                                        }}
                                                    >
                                                        {opt.icon}
                                                    </div>
                                                </div>
                                                <div
                                                    className="text-tp-sm font-bold mb-0.5"
                                                    style={{ color: active ? 'var(--app-primary)' : 'var(--app-foreground)' }}
                                                >
                                                    {opt.title}
                                                </div>
                                                <div className="text-tp-xxs font-bold text-app-muted-foreground leading-snug">
                                                    {opt.sub}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* ── Live placement preview (mini visual tree) ──
                                 Shows the breadcrumb chain the user is constructing.
                                 Solid fill (was a gradient) — gradients are
                                 expensive to repaint when the modal scrolls. */}
                            <div
                                className="rounded-xl p-3.5"
                                style={{
                                    background: 'color-mix(in srgb, var(--app-primary) 3%, var(--app-surface))',
                                    border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                                }}
                            >
                                <div className="text-tp-xxs font-bold uppercase tracking-widest text-app-muted-foreground mb-2 flex items-center gap-1.5">
                                    <FolderTree size={10} /> Placement Preview
                                </div>
                                <PlacementPreview
                                    isSub={!!isSubCategory}
                                    parent={isSubCategory && selectedParent
                                        ? potentialParents.find(p => p.id == selectedParent)
                                        : null}
                                    name={nameDraft || (category?.name) || 'New Category'}
                                />
                            </div>

                            {/* ── Parent picker (only when sub-category) ──
                                 Cascader has its own per-level badges so a
                                 separate field label would just add visual noise. */}
                            {isSubCategory && (
                                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                                    <CategoryCascader
                                        allCategories={availableParents as any}
                                        selectedId={typeof selectedParent === 'number' ? selectedParent : parseInt(selectedParent as string) || null}
                                        onSelect={(id) => setSelectedParent(id || '')}
                                        excludeId={category?.id}
                                    />
                                    <input type="hidden" name="parentId" value={selectedParent} />
                                </div>
                            )}
                            {!isSubCategory && <input type="hidden" name="parentId" value="" />}

                            {/* ── Info banner — adapts copy based on choice ── */}
                            <div
                                className="p-3 rounded-xl flex items-start gap-2 text-tp-xs font-bold"
                                style={{
                                    background: isSubCategory && !parentName
                                        ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)'
                                        : 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                    border: `1px solid ${isSubCategory && !parentName
                                        ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 20%, transparent)'
                                        : 'color-mix(in srgb, var(--app-info, #3b82f6) 20%, transparent)'}`,
                                    color: isSubCategory && !parentName
                                        ? 'var(--app-warning, #f59e0b)'
                                        : 'var(--app-info, #3b82f6)',
                                }}
                            >
                                <Lightbulb size={12} className="mt-0.5 flex-shrink-0" />
                                <span>
                                    {isSubCategory && !parentName
                                        ? 'Pick a parent above — sub-categories must nest under an existing branch.'
                                        : isSubCategory
                                            ? 'Sub-categories inherit barcode rules from their parent unless overridden in Identity.'
                                            : 'Root categories appear at the top of the catalogue tree.'}
                                </span>
                            </div>
                        </div>

                        {/* ═══ Pane: BRANDS ═══ */}
                        <div className={activePane === 'brands' ? 'space-y-3' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Linked Brands</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Which brands carry products in this category. Empty = any brand can.
                                </p>
                            </div>

                            {loadingLinks ? (
                                <div className="py-8 flex items-center justify-center text-app-muted-foreground">
                                    <Loader2 size={14} className="animate-spin mr-2" /> Loading brands…
                                </div>
                            ) : (
                                <CategoryTreeSelector
                                    categories={brandTree as any}
                                    selectedIds={Array.from(selectedBrandIds)}
                                    onChange={(ids) => {
                                        setSelectedBrandIds(new Set(ids));
                                        setBrandsDirty(true);
                                    }}
                                    maxHeight="max-h-[320px]"
                                />
                            )}

                            {/* Only emit hidden inputs once the user has touched
                                the chips. Without this, an Edit save would clear
                                every brand link this category currently has. */}
                            {brandsDirty && (
                                <input type="hidden" name="brandsDirty" value="1" />
                            )}
                            {brandsDirty && Array.from(selectedBrandIds).map(id => (
                                <input key={id} type="hidden" name="brandIds" value={id} />
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
                                    {selectedBrandIds.size === 0
                                        ? 'No brand linked — every brand can place products in this category.'
                                        : `${selectedBrandIds.size} brand${selectedBrandIds.size === 1 ? '' : 's'} will be linked. Saving updates each brand's category list.`}
                                </span>
                            </div>
                        </div>

                        {/* ═══ Pane: ATTRIBUTES ═══ */}
                        <div className={activePane === 'attributes' ? 'space-y-3' : 'hidden'}>
                            <div>
                                <h4 className="text-tp-md font-bold text-app-foreground mb-0.5">Relevant Attributes</h4>
                                <p className="text-tp-xs font-bold text-app-muted-foreground">
                                    Attribute groups (Size, Color, Parfum, …) and their values relevant to products
                                    in this category.
                                </p>
                            </div>

                            {loadingLinks ? (
                                <div className="py-8 flex items-center justify-center text-app-muted-foreground">
                                    <Loader2 size={14} className="animate-spin mr-2" /> Loading attributes…
                                </div>
                            ) : (
                                <CategoryTreeSelector
                                    categories={attrTree as any}
                                    selectedIds={Array.from(selectedAttrIds)}
                                    onChange={(ids) => {
                                        setSelectedAttrIds(new Set(ids));
                                        setAttrsDirty(true);
                                    }}
                                    maxHeight="max-h-[320px]"
                                />
                            )}

                            {/* Same dirty-only emission as brands — avoids
                                clearing the M2M when the user only edited
                                Identity fields. */}
                            {attrsDirty && (
                                <input type="hidden" name="attributesDirty" value="1" />
                            )}
                            {attrsDirty && Array.from(selectedAttrIds).map(id => (
                                <input key={id} type="hidden" name="attributeIds" value={id} />
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
                                    {selectedAttrIds.size === 0
                                        ? 'No attribute selected — products in this category will have no dynamic fields.'
                                        : `${selectedAttrIds.size} attribute${selectedAttrIds.size === 1 ? '' : 's'} will appear when creating products in this category.`}
                                </span>
                            </div>
                        </div>
                    </div>
                </form>

                {/* ── Footer — desktop: pane label + Cancel + Save in one row.
                     Mobile: hide the meta label, give Cancel + Save equal width
                     and bigger touch targets so they sit above the home
                     indicator. ── */}
                <div
                    className="px-4 md:px-5 py-2.5 md:py-3 flex items-center gap-2 flex-shrink-0"
                    style={{
                        borderTop: '1px solid var(--app-border)',
                        background: 'color-mix(in srgb, var(--app-background) 40%, var(--app-surface))',
                        paddingBottom: 'max(env(safe-area-inset-bottom), 0.625rem)',
                    }}
                >
                    {/* Meta label — desktop only, mobile hides to free width */}
                    <div className="hidden md:block flex-1 text-tp-xs font-bold text-app-muted-foreground">
                        {panes.find(p => p.key === activePane)?.label} ·{' '}
                        {activePane === 'identity' ? 'Required' : 'Optional'}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={pending}
                        className="flex-1 md:flex-initial px-4 py-2.5 md:py-2 rounded-xl text-tp-xs font-bold transition-all disabled:opacity-50"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="category-form"
                        disabled={pending}
                        className="flex-1 md:flex-initial px-5 py-2.5 md:py-2 rounded-xl text-tp-xs font-bold bg-app-primary text-white transition-all flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
                        style={{ boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}
                    >
                        {pending ? <Loader2 className="animate-spin" size={14} /> : (category ? <Check size={14} /> : <Save size={14} />)}
                        {category ? 'Update' : 'Create'}
                    </button>
                </div>
            </div>
        </div>
    );
}

/**
 * PlacementPreview — visual breadcrumb showing the chain of nodes the new
 * category will live under. Renders three states:
 *
 *   • Root mode             →  [📁 New Category]
 *   • Sub mode, no parent   →  [🏠 Root] → [? choose parent] → [📂 New Category]
 *   • Sub mode, with parent →  [📁 Parent.full_path] → [📂 New Category]
 *
 * Pure presentation, no state. Adapts to whatever name the user is currently
 * typing in the Identity pane via the `name` prop.
 */
function PlacementPreview({
    isSub,
    parent,
    name,
}: {
    isSub: boolean;
    parent: Record<string, any> | null | undefined;
    name: string;
}) {
    type Crumb = { id: string; label: string; tone: 'root' | 'parent' | 'placeholder' | 'self' };
    const crumbs: Crumb[] = [];

    if (isSub) {
        if (parent) {
            const path: string[] = (parent.full_path || parent.name || '').split(' > ').filter(Boolean);
            path.forEach((p, i) => {
                crumbs.push({ id: `p-${i}`, label: p, tone: 'parent' });
            });
        } else {
            crumbs.push({ id: 'placeholder', label: 'Choose a parent…', tone: 'placeholder' });
        }
    } else {
        crumbs.push({ id: 'root', label: 'Catalogue Root', tone: 'root' });
    }

    crumbs.push({ id: 'self', label: name, tone: 'self' });

    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {crumbs.map((c, i) => (
                <PreviewChip key={c.id} crumb={c} isFirst={i === 0} isLast={i === crumbs.length - 1} />
            ))}
        </div>
    );
}

function PreviewChip({
    crumb,
    isFirst,
    isLast,
}: {
    crumb: { id: string; label: string; tone: 'root' | 'parent' | 'placeholder' | 'self' };
    isFirst: boolean;
    isLast: boolean;
}) {
    const palette = {
        root: {
            bg: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)',
            color: 'var(--app-muted-foreground)',
            border: 'color-mix(in srgb, var(--app-border) 80%, transparent)',
        },
        parent: {
            bg: 'color-mix(in srgb, var(--app-foreground) 6%, transparent)',
            color: 'var(--app-foreground)',
            border: 'color-mix(in srgb, var(--app-border) 80%, transparent)',
        },
        placeholder: {
            bg: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
            color: 'var(--app-warning, #f59e0b)',
            border: 'color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)',
            dashed: true,
        },
        self: {
            bg: 'var(--app-primary)',
            color: '#fff',
            border: 'var(--app-primary)',
        },
    } as const;

    const p = palette[crumb.tone];
    return (
        <>
            {!isFirst && (
                <ChevronRight size={11} className="flex-shrink-0" style={{ color: 'var(--app-muted-foreground)', opacity: 0.5 }} />
            )}
            <span
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-tp-xs font-bold transition-all ${isLast ? 'animate-in fade-in zoom-in-95 duration-150' : ''}`}
                style={{
                    background: p.bg,
                    color: p.color,
                    border: `1.5px ${('dashed' in p && p.dashed) ? 'dashed' : 'solid'} ${p.border}`,
                    boxShadow: crumb.tone === 'self'
                        ? '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)'
                        : undefined,
                    maxWidth: '180px',
                }}
            >
                {crumb.tone === 'self' && <Tag size={10} />}
                {crumb.tone === 'root' && <FolderTree size={10} />}
                <span className="truncate">{crumb.label}</span>
            </span>
        </>
    );
}
