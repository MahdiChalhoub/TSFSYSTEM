'use client';

import { useActionState, useState, useEffect, useMemo, useRef } from 'react';
import { useProductDraft } from './use-product-draft';
import { createProduct } from '../actions';
import type { ProductNamingRule } from '@/app/actions/settings';
import type { ProductAttribute } from '@/types/erp';
import { getBrandsByCategory } from '@/app/actions/inventory/brands';
import { getScopedValuesForGroup, type ScopedBucket, type ExcludedValue } from '@/app/actions/inventory/attribute-scope';
import { CategorySelector } from '@/components/admin/CategorySelector';
import { toast } from 'sonner';
import {
    Package, Truck, DollarSign, Warehouse,
    Wand2, ArrowLeft, Zap, ScanBarcode, Settings2,
    ImagePlus, X, Tags, Check, Eye, EyeOff
} from 'lucide-react';
import type { ProductTypeChoice } from './wizard-step-type';
import PricingEngine from './pricing-engine';
import PackagingTree, { type PackagingLevel } from './packaging-tree';

/* ── V3 Attribute Tree Types ── */
type AttrChild = {
    id: number; name: string; code: string; sort_order: number;
    color_hex: string | null;
}
type AttrGroup = {
    id: number; name: string; code: string; is_variant: boolean;
    show_in_name: boolean; name_position: number; short_label: string | null;
    is_required: boolean; show_by_default: boolean;
    children: AttrChild[];
    linked_categories: { id: number; name: string }[];
}

/* ─────────────────────────── Styles ───────────────────────────
 * Compact spacing per design-language §1 — match COA's rhythm so
 * the form fits in the viewport without forced scrolling. Tighter
 * card padding (px-3 py-2 head, p-3 body), space-y-2/3 between
 * sections instead of space-y-5.
 */
const card = "bg-app-surface rounded-xl border border-app-border/70 overflow-hidden shadow-sm";
const cardHead = (accent: string) => `px-3 py-2 border-l-[3px] ${accent} flex items-center justify-between bg-gradient-to-r from-app-surface to-app-background/30`;
const cardTitle = "text-tp-sm font-bold text-app-foreground tracking-tight";
const fieldLabel = "block text-tp-xxs font-bold text-app-muted-foreground mb-1 uppercase tracking-widest";
const fieldInput = "w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-tp-xs focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground placeholder:text-app-muted-foreground";
const fieldSelect = "w-full bg-app-surface border border-app-border rounded-lg px-2.5 py-1.5 text-tp-xs focus:ring-2 focus:ring-app-primary/20 focus:border-app-primary/30 outline-none transition-all text-app-foreground appearance-none";

interface CategoryOption {
    id: number | string;
    name?: string;
    shortName?: string;
    code?: string;
    [key: string]: unknown;
}

interface BrandOption {
    id: number | string;
    name?: string;
    shortName?: string;
    [key: string]: unknown;
}

interface UnitOption {
    id: number | string;
    name?: string;
    shortName?: string;
    type?: string;
    [key: string]: unknown;
}

interface CountryOption {
    id: number | string;
    name?: string;
    code?: string;
    [key: string]: unknown;
}

interface ProductGroupOption {
    id: number | string;
    name: string;
    price_sync_enabled?: boolean;
    [key: string]: unknown;
}

interface SmartInitialData {
    name?: string;
    sku?: string;
    barcode?: string;
    description?: string;
    baseName?: string;
    categoryId?: number;
    brandId?: number | string;
    costPrice?: number | string;
    basePrice?: number | string;
    taxRate?: number | string;
    isTaxIncluded?: boolean;
    isExpiryTracked?: boolean;
    minStockLevel?: number | string;
    costValuationMethod?: string;
    lotManagement?: string;
    tracksLots?: boolean;
    manufacturerShelfLifeDays?: number | string;
    avgAvailableExpiryDays?: number | string;
    shippingDurationDays?: number | string;
    productGroups?: ProductGroupOption[];
    product_group?: number | string;
    [key: string]: unknown;
}

type V3FormulaSlot = {
    enabled?: boolean;
    type: 'static' | 'attribute';
    id: string;
    useShortName?: boolean;
    useShortLabel?: boolean;
};

interface NamingComponentLite {
    id: string;
    name?: string;
    enabled?: boolean;
    useShortName?: boolean;
    [key: string]: unknown;
}

interface SmartProductFormProps {
    productType: ProductTypeChoice;
    categories: CategoryOption[];
    units: UnitOption[];
    brands: BrandOption[];
    countries: CountryOption[];
    namingRule: ProductNamingRule;
    attributeTree?: AttrGroup[];
    initialData?: SmartInitialData;
    worksInTTC?: boolean;
    onBack: () => void;
    /** Hard-cancel — leaves the create flow entirely (parent decides where to go).
     *  Distinct from onBack which just rewinds to the type-picker step. */
    onCancel?: () => void;
}

export default function SmartProductForm({
    productType,
    categories, units, brands, countries, namingRule,
    attributeTree = [], initialData, onBack, onCancel
}: SmartProductFormProps) {
    const initialState: { message: string; errors: Record<string, string[]> } = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createProduct, initialState);

    // Draft autosave — debounced localStorage persistence + offer-to-restore
    // banner. The hook was already implemented but never wired up.
    const formRef = useRef<HTMLFormElement | null>(null);
    const { hasDraft, draftAge, saveDraft, restoreDraft, clearDraft } = useProductDraft();
    const [draftDismissed, setDraftDismissed] = useState(false);
    // Clear the saved draft on successful submit (state.message + no errors).
    useEffect(() => {
        if (state.message && (!state.errors || Object.keys(state.errors).length === 0)) {
            clearDraft();
        }
    }, [state.message, state.errors, clearDraft]);
    // Warn the user before they accidentally close the tab with unsaved work.
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            const form = formRef.current;
            if (!form) return;
            const fd = new FormData(form);
            const name = String(fd.get('name') || '').trim();
            if (name) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, []);

    const numOrZero = (v: unknown, fallback = 0): number => {
        if (typeof v === 'number') return v;
        const n = parseFloat(String(v ?? ''));
        return isNaN(n) ? fallback : n;
    };

    /* ── Cascading filter state ── */
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(initialData?.categoryId ?? null);
    const [selectedBrandId, setSelectedBrandId] = useState<string>(initialData?.brandId ? String(initialData.brandId) : '');
    // Phase 2: track country too so the attribute picker can scope-filter
    // values by all three axes (category × country × brand).
    const [selectedCountryId, setSelectedCountryId] = useState<number | null>(
        (initialData as { countryId?: number })?.countryId ?? null,
    );
    // Memoised context object so AttrGroupSelector's effect deps stay stable.
    const productScopeCtx = useMemo(() => ({
        categoryId: selectedCategoryId,
        countryId: selectedCountryId,
        brandId: selectedBrandId ? Number(selectedBrandId) : null,
    }), [selectedCategoryId, selectedCountryId, selectedBrandId]);
    const [selectedAttributeId] = useState('');
    const [activeTab, setActiveTab] = useState('pricing');

    /* ── V3 Dynamic Attribute Selections: { groupId → childId } ── */
    const [selectedAttrValues, setSelectedAttrValues] = useState<Record<number, number | null>>({});
    const [baseName, setBaseName] = useState<string>(initialData?.baseName || '');
    const [showHiddenAttrs, setShowHiddenAttrs] = useState(false);

    /* ── Filtered brands + attributes (cascading) ── */
    const [filteredBrands, setFilteredBrands] = useState<BrandOption[]>(brands);
    const [filteredAttributes] = useState<ProductAttribute[]>([]);
    const [loadingFilters, setLoadingFilters] = useState(false);

    /* ── V3: Compute relevant attribute groups from tree based on selected category ── */
    const relevantAttrGroups = useMemo(() => {
        const catId = selectedCategoryId;
        if (!catId) return attributeTree.filter(g => g.show_by_default);
        const relevant = new Set<number>();
        for (const g of attributeTree) {
            if (g.linked_categories?.some(c => c.id === catId)) relevant.add(g.id);
            if (g.show_by_default) relevant.add(g.id);
        }
        return attributeTree.filter(g => relevant.has(g.id));
    }, [attributeTree, selectedCategoryId]);

    const hiddenAttrGroups = useMemo(() => {
        const relevantIds = new Set(relevantAttrGroups.map(g => g.id));
        return attributeTree.filter(g => !relevantIds.has(g.id));
    }, [attributeTree, relevantAttrGroups]);

    /* ── V3: Auto-generated display name using nomenclature engine ── */
    const v3GeneratedName = useMemo(() => {
        // If a V3 formula is saved, use its ordering
        const formula = (namingRule as ProductNamingRule & { v3_formula?: V3FormulaSlot[] }).v3_formula;
        if (formula && formula.length > 0) {
            const parts: string[] = [];
            for (const slot of formula) {
                if (!slot.enabled) continue;
                if (slot.type === 'static') {
                    if (slot.id === 'brand' && selectedBrandId) {
                        const b = brands.find(br => String(br.id) === selectedBrandId);
                        if (b) parts.push(slot.useShortName ? (b.shortName || b.name?.substring(0, 3)?.toUpperCase() || '') : (b.name ?? ''));
                    } else if (slot.id === 'base_name' && baseName.trim()) {
                        parts.push(baseName.trim());
                    }
                    // category, country, emballage handled by legacy fallback if needed
                } else if (slot.type === 'attribute') {
                    const attrId = parseInt(slot.id.replace('attr_', ''));
                    const group = attributeTree.find(g => g.id === attrId);
                    const childIdSel = group ? selectedAttrValues[group.id] : null;
                    if (group && childIdSel != null) {
                        const child = group.children.find(c => c.id === childIdSel);
                        if (child) {
                            parts.push(slot.useShortLabel && group.short_label
                                ? `${child.name}${group.short_label}`
                                : child.name);
                        }
                    }
                }
            }
            return parts.join(namingRule.separator || ' ').trim();
        }

        // Default fallback: [Brand] + [Base Name] + [Shown Attributes by name_position]
        const parts: string[] = [];
        if (selectedBrandId) {
            const b = brands.find(br => String(br.id) === selectedBrandId);
            if (b?.name) parts.push(b.name);
        }
        const base = baseName.trim();
        if (base) parts.push(base);
        const shownAttrs = attributeTree
            .filter(g => g.show_in_name && selectedAttrValues[g.id])
            .sort((a, b) => a.name_position - b.name_position);
        for (const group of shownAttrs) {
            const childId = selectedAttrValues[group.id];
            if (childId == null) continue;
            const child = group.children.find(c => c.id === childId);
            if (child) {
                parts.push(group.short_label ? `${child.name}${group.short_label}` : child.name);
            }
        }
        return parts.join(' ').trim();
    }, [selectedBrandId, baseName, brands, attributeTree, selectedAttrValues, namingRule]);

    const attrCount = Object.values(selectedAttrValues).filter(Boolean).length;

    /* ── Emballage (Packing) State ── */
    const [emballageVal, setEmballageVal] = useState('');
    const [emballageUnitId, setEmballageUnitId] = useState('');

    /* ── Unit Type Filtering ── */
    const [unitType, setUnitType] = useState('');
    const filteredUnits = unitType ? units.filter(u => u.type === unitType) : units;
    const unitTypes = Array.from(new Set(units.map(u => u.type).filter((t): t is string => Boolean(t))));

    /* ── Auto Name ── */
    const [autoName, setAutoName] = useState('');
    const [shortName, setShortName] = useState('');

    /* ── Image Upload State ── */
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    /* ── Pricing State ── */
    const [costPrice, setCostPrice] = useState(numOrZero(initialData?.costPrice));
    const [sellPrice, setSellPrice] = useState(numOrZero(initialData?.basePrice));
    const [taxPercent, setTaxPercent] = useState(numOrZero(initialData?.taxRate, 0.11) || 0.11);
    const [isTaxIncluded, setIsTaxIncluded] = useState<boolean>(initialData?.isTaxIncluded ?? true);

    /* ── Packaging State ── */
    const [packagingLevels, setPackagingLevels] = useState<PackagingLevel[]>([]);
    const productGroups: ProductGroupOption[] = initialData?.productGroups || [];

    /* ── Inventory State ── */
    const [stockStrategy, setStockStrategy] = useState('make_to_stock');
    const [minStock, setMinStock] = useState<number>(numOrZero(initialData?.minStockLevel, 10) || 10);
    const [maxStock, setMaxStock] = useState(300);
    const [reorderPoint, setReorderPoint] = useState(80);

    /* ── Cost Valuation & Lot Management State ── */
    const [costValuation, setCostValuation] = useState<string>(initialData?.costValuationMethod || 'WAVG');
    const [lotManagement, setLotManagement] = useState<string>(initialData?.lotManagement || 'NONE');
    const [tracksLots, setTracksLots] = useState<boolean>(initialData?.tracksLots ?? false);
    const [expiryTracked, setExpiryTracked] = useState<boolean>(initialData?.isExpiryTracked ?? false);
    const [mfgShelfLife, setMfgShelfLife] = useState<number>(numOrZero(initialData?.manufacturerShelfLifeDays));
    const [avgExpiry, setAvgExpiry] = useState<number>(numOrZero(initialData?.avgAvailableExpiryDays));
    const [shippingDays, setShippingDays] = useState<number>(numOrZero(initialData?.shippingDurationDays));

    /* ── Type-based visibility ── */
    const isService = productType === 'SERVICE';
    const isBundle = productType === 'COMBO';
    const isDigital = productType === 'DIGITAL';
    const showInventory = !isService && !isDigital;
    const showPackaging = !isService && !isDigital;
    const showSupplier = !isBundle && !isDigital;

    /* ────── Cascading Filter: Category → Brands ────── */
    useEffect(() => {
        const loadFiltered = async () => {
            setLoadingFilters(true);
            try {
                const brandListRaw = selectedCategoryId
                    ? await getBrandsByCategory(selectedCategoryId)
                    : brands;
                const brandList = (brandListRaw ?? []) as unknown as BrandOption[];
                setFilteredBrands(brandList.length > 0 ? brandList : brands);
                // Reset if current brand not in filtered list
                if (selectedBrandId && brandList.length > 0 && !brandList.find(b => String(b.id) === selectedBrandId)) {
                    setSelectedBrandId('');
                }
            } catch { setFilteredBrands(brands); }
            finally { setLoadingFilters(false); }
        };
        loadFiltered();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategoryId]);

    /* ── Auto-generate name: use V3 nomenclature if attribute tree exists, else legacy rule ── */
    useEffect(() => {
        // V3 nomenclature takes precedence if we have a base name or attributes selected
        if (v3GeneratedName) {
            setAutoName(v3GeneratedName);
            return;
        }
        // Legacy fallback
        const categoryMatch = categories.find(c => c.id === selectedCategoryId);
        const brandMatch = brands.find(b => String(b.id) === selectedBrandId);
        const attrMatch = filteredAttributes.find(a => String(a.id) === selectedAttributeId);
        const emballageUnitMatch = units.find(u => String(u.id) === emballageUnitId);

        const componentValues: Record<string, { short: string; full: string }> = {
            category: { short: categoryMatch?.shortName || categoryMatch?.code || '', full: categoryMatch?.name || '' },
            brand: { short: brandMatch?.name?.substring(0, 3).toUpperCase() || '', full: brandMatch?.name || '' },
            family: { short: attrMatch?.name || '', full: attrMatch?.name || '' },
            emballage: {
                short: emballageVal && emballageUnitMatch ? `${emballageVal}${emballageUnitMatch.shortName || emballageUnitMatch.name || ''}` : (emballageVal || ''),
                full: emballageVal && emballageUnitMatch ? `${emballageVal} ${emballageUnitMatch.name ?? ''}` : (emballageVal || '')
            }
        };
        const parts = (namingRule.components as NamingComponentLite[]).filter(c => c.enabled).map(c => {
            const value = componentValues[c.id];
            return c.useShortName ? value?.short : value?.full;
        }).filter(Boolean);
        setAutoName(parts.join(namingRule.separator));
    }, [selectedCategoryId, selectedBrandId, selectedAttributeId, emballageVal, emballageUnitId, categories, brands, filteredAttributes, namingRule, units, v3GeneratedName]);

    /* ── Auto-generate barcode when category changes ── */
    useEffect(() => {
        if (!selectedCategoryId) return;
        (async () => {
            try {
                const { generateNewBarcodeAction } = await import('@/app/actions/barcode-settings');
                const res = await generateNewBarcodeAction();
                if (res.success && res.code) {
                    const el = document.getElementsByName('barcode')[0] as HTMLInputElement;
                    if (el) el.value = res.code;
                }
            } catch { /* silent */ }
        })();
    }, [selectedCategoryId]);

    /* ── Image handler ── */
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    /* ── Sidebar tabs ── */
    const sidebarTabs = [
        { id: 'pricing', label: 'Pricing', icon: DollarSign, visible: true },
        { id: 'inventory', label: 'Inventory', icon: Warehouse, visible: showInventory },
        { id: 'packaging', label: 'Packaging', icon: Package, visible: showPackaging },
        { id: 'supplier', label: 'Supplier', icon: Truck, visible: showSupplier },
    ].filter(t => t.visible);

    const typeLabels: Record<ProductTypeChoice, { label: string; accent: string }> = {
        SINGLE: { label: 'Physical Product', accent: 'from-emerald-500 to-teal-600' },
        SERVICE: { label: 'Service', accent: 'from-blue-500 to-indigo-600' },
        COMBO: { label: 'Bundle / Combo', accent: 'from-purple-500 to-fuchsia-600' },
        DIGITAL: { label: 'Digital Product', accent: 'from-amber-500 to-orange-600' },
    };

    return (
        <form ref={formRef}
              action={formAction}
              onChange={() => saveDraft(formRef.current)}
              className="max-w-[1440px] mx-auto w-full fade-in-up">
            {/* Resume-draft banner — shown once, dismissible */}
            {hasDraft && !draftDismissed && (
                <div className="mb-3 rounded-xl px-4 py-3 flex items-center gap-3"
                     style={{
                         background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                         border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 24%, transparent)',
                     }}>
                    <span className="text-tp-xs font-bold" style={{ color: 'var(--app-info, #3b82f6)' }}>
                        Unfinished draft from {draftAge}
                    </span>
                    <span className="text-tp-xs flex-1 truncate" style={{ color: 'var(--app-muted-foreground)' }}>
                        Pick up where you left off?
                    </span>
                    <button type="button"
                            onClick={() => { restoreDraft(formRef.current); setDraftDismissed(true) }}
                            className="text-tp-xs font-bold px-3 py-1 rounded-lg transition-all hover:brightness-110"
                            style={{ background: 'var(--app-info, #3b82f6)', color: '#fff' }}>
                        Resume
                    </button>
                    <button type="button"
                            onClick={() => { clearDraft(); setDraftDismissed(true) }}
                            className="text-tp-xs font-bold px-3 py-1 rounded-lg transition-colors"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                        Discard
                    </button>
                </div>
            )}

            {/* Hidden fields */}
            <input type="hidden" name="productType" value={productType} />
            <input type="hidden" name="brandId" value={selectedBrandId} />
            <input type="hidden" name="minStockLevel" value={minStock} />
            <input type="hidden" name="parfumName" value={filteredAttributes.find(a => String(a.id) === selectedAttributeId)?.name || ''} />
            <input type="hidden" name="baseName" value={baseName} />
            {/* V3: Submit all selected attribute value IDs */}
            {Object.values(selectedAttrValues).filter((id): id is number => id !== null && id !== undefined).map(id => (
                <input key={id} type="hidden" name="attributeValueIds" value={id} />
            ))}

            {/* Errors */}
            {state.message && (
                <div className={`mb-3 px-3 py-2 rounded-xl border text-tp-xs font-medium ${state.errors && Object.keys(state.errors).length > 0 ? 'bg-app-error-bg text-app-error border-app-error' : 'bg-app-success-bg text-app-success border-app-success'}`}>
                    <p className="font-bold">{state.message}</p>
                    {state.errors && Object.keys(state.errors).length > 0 && (
                        <ul className="list-disc pl-5 mt-1 space-y-0.5 text-[12px]">
                            {Object.entries(state.errors).map(([field, msgs]) => (
                                <li key={field}><span className="font-bold capitalize">{field}:</span> {msgs.join(', ')}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Header — compact, single row */}
            <div className="flex items-center gap-3 mb-3">
                <button type="button" onClick={onBack} className="w-9 h-9 rounded-xl bg-app-surface border border-app-border flex items-center justify-center hover:bg-app-background transition-all group flex-shrink-0">
                    <ArrowLeft className="w-4 h-4 text-app-muted-foreground group-hover:text-app-foreground transition-colors" />
                </button>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-tp-xxs font-black uppercase tracking-wider text-white bg-gradient-to-r ${typeLabels[productType].accent} flex-shrink-0`}>
                    {typeLabels[productType].label}
                </span>
                <h2 className="text-lg md:text-xl font-black tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                    Create <span style={{ color: 'var(--app-primary)' }}>Product</span>
                </h2>
            </div>

            <div className="flex flex-col md:flex-row gap-3 items-start">

                {/* ═══════ ZONE A — Product Core (Left 60%) ═══════ */}
                <div className="w-full md:w-[58%] space-y-3">

                    {/* ────── CARD: Product Identity ────── */}
                    <div className={card}>
                        <div className={cardHead('border-l-blue-500')}>
                            <h3 className={cardTitle}>Product Identity</h3>
                        </div>
                        <div className="p-3 space-y-3">

                            {/* ── ROW 1: Auto-Generated Name + Short Name ── */}
                            <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/30 border border-app-info/40 p-4 rounded-xl">
                                <div className="flex items-center gap-1.5 mb-2">
                                    <Wand2 className="w-3.5 h-3.5 text-app-info" />
                                    <span className="text-[10px] font-bold text-app-info uppercase tracking-widest">Auto-Generated Name</span>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        name="name"
                                        type="text"
                                        value={autoName}
                                        readOnly
                                        className="flex-1 bg-app-surface border border-app-info/40 rounded-lg px-3 py-2.5 text-[14px] font-bold text-app-foreground outline-none shadow-sm cursor-default"
                                        placeholder="Fill fields below to generate name..."
                                        required
                                    />
                                    <input
                                        type="text"
                                        name="shortName"
                                        value={shortName}
                                        onChange={(e) => setShortName(e.target.value)}
                                        className="w-[130px] bg-app-surface border border-app-border rounded-lg px-3 py-2.5 text-[12px] outline-none placeholder:text-app-muted-foreground font-semibold"
                                        placeholder="Short name"
                                    />
                                </div>
                                <p className="text-[9px] text-app-info/70 mt-1.5 font-medium">
                                    Rule: {(namingRule.components as NamingComponentLite[]).filter(c => c.enabled).map(c => c.name ?? '').join(` ${namingRule.separator} `)}
                                </p>
                            </div>

                            {/* ── ROW 2: SKU | Barcode ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className={fieldLabel}>SKU</label>
                                        <button type="button" onClick={() => {
                                            const el = document.getElementsByName('sku')[0] as HTMLInputElement;
                                            if (el) el.value = `PRD-${Date.now().toString().slice(-6)}`;
                                        }} className="text-[9px] text-app-info font-bold hover:underline">Auto-Generate</button>
                                    </div>
                                    <input name="sku" type="text" className={fieldInput + ' font-mono'} placeholder="PRD-000123" defaultValue={initialData?.sku} />
                                </div>
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className={fieldLabel}>Barcode</label>
                                        <button type="button" onClick={async () => {
                                            try {
                                                const { generateNewBarcodeAction } = await import('@/app/actions/barcode-settings');
                                                const res = await generateNewBarcodeAction();
                                                if (res.success && res.code) {
                                                    const el = document.getElementsByName('barcode')[0] as HTMLInputElement;
                                                    if (el) el.value = res.code;
                                                } else toast.error('Failed: ' + res.error);
                                            } catch { toast.error('Barcode generation failed'); }
                                        }} className="text-[9px] text-app-info font-bold hover:underline flex items-center gap-1">
                                            <ScanBarcode className="w-3 h-3" /> Re-Generate
                                        </button>
                                    </div>
                                    <input name="barcode" type="text" className={fieldInput + ' font-mono'} placeholder="Auto-generated when category is selected" defaultValue={initialData?.barcode} />
                                </div>
                            </div>

                            {/* ── ROW 3: Image (50%) | Description (50%) ── */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={fieldLabel}>Product Image</label>
                                    <label className="block w-full h-28 rounded-xl border-2 border-dashed border-app-border hover:border-app-primary/40 bg-app-background flex items-center justify-center cursor-pointer transition-all group overflow-hidden relative">
                                        {imagePreview ? (
                                            <>
                                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                <button type="button" onClick={(e) => { e.preventDefault(); setImagePreview(null); }}
                                                    className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 hover:bg-app-foreground/70 flex items-center justify-center transition-colors">
                                                    <X className="w-4 h-4 text-white" />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="text-center">
                                                <ImagePlus className="w-8 h-8 text-app-muted-foreground group-hover:text-app-primary transition-colors mx-auto mb-2" />
                                                <span className="text-[11px] font-semibold text-app-muted-foreground group-hover:text-app-primary">Click to upload · JPG, PNG, WebP</span>
                                            </div>
                                        )}
                                        <input type="file" name="image" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                    </label>
                                </div>
                                <div>
                                    <label className={fieldLabel}>Description</label>
                                    <textarea
                                        name="description"
                                        className={fieldInput + ' min-h-[110px] resize-none text-tp-xs'}
                                        placeholder="Optional product notes or description…"
                                        defaultValue={initialData?.description}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ────── CARD: Classification ──────
                     *  Re-architected for the new compact layout:
                     *   • Adaptive auto-fit grids (no hardcoded grid-cols-N).
                     *   • Filter hints inline with labels — not separate rows.
                     *   • Single semantic group per row (taxonomy → identity →
                     *     unit) so the eye walks top-to-bottom logically.
                     *   • All design-language tokens (text-tp-*, var(--app-*),
                     *     color-mix tints, no raw hex).
                     *   • Heavy reuse of the existing CategorySelector and
                     *     AttrGroupSelector components — same data flow,
                     *     same backend wiring, just cleaner chrome.
                     */}
                    <div className={card}>
                        <div className={cardHead('border-l-purple-500')}>
                            <h3 className={cardTitle}>Classification</h3>
                            <div className="flex items-center gap-2">
                                {selectedCategoryId && (
                                    <span className="text-tp-xxs font-bold uppercase tracking-widest"
                                          style={{ color: 'var(--app-muted-foreground)' }}>
                                        Filtered ·{' '}
                                        <span style={{ color: 'var(--app-primary)' }}>
                                            {filteredBrands.length}b
                                        </span>{' '}/{' '}
                                        <span style={{ color: 'var(--app-primary)' }}>
                                            {filteredUnits.length}u
                                        </span>
                                    </span>
                                )}
                                {loadingFilters && (
                                    <span className="text-tp-xxs font-bold animate-pulse"
                                          style={{ color: 'var(--app-info)' }}>
                                        Filtering…
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-3 space-y-3">

                            {/* ── Row 1 — Category tree (full width, drives every other field below) ── */}
                            <CategorySelector
                                categories={categories as unknown as Parameters<typeof CategorySelector>[0]['categories']}
                                onChange={(id) => setSelectedCategoryId(id)}
                            />

                            {/* ── Row 2 — Identity bundle: Brand · Country · Base name (adaptive) ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                {/* Brand */}
                                <div>
                                    <label className={fieldLabel + ' flex items-center justify-between'}>
                                        <span>Brand</span>
                                        {selectedCategoryId && filteredBrands.length > 0 && filteredBrands.length !== brands.length && (
                                            <span className="normal-case tracking-normal text-tp-xxs font-bold flex items-center gap-1"
                                                  style={{ color: 'var(--app-success)' }}
                                                  title={`${filteredBrands.length} brands linked to this category`}>
                                                <span className="w-1 h-1 rounded-full" style={{ background: 'var(--app-success)' }} />
                                                {filteredBrands.length} for category
                                            </span>
                                        )}
                                    </label>
                                    <select
                                        className={fieldSelect}
                                        value={selectedBrandId}
                                        onChange={(e) => setSelectedBrandId(e.target.value)}
                                    >
                                        <option value="">Select brand…</option>
                                        {filteredBrands.map(b => <option key={String(b.id)} value={String(b.id)}>{b.name}</option>)}
                                    </select>
                                </div>

                                {/* Origin country */}
                                <div>
                                    <label className={fieldLabel}>Origin country</label>
                                    <select name="countryId" className={fieldSelect}
                                        value={selectedCountryId ?? ''}
                                        onChange={(e) => setSelectedCountryId(e.target.value ? Number(e.target.value) : null)}>
                                        <option value="">Select country…</option>
                                        {countries.map(c => <option key={String(c.id)} value={String(c.id)}>{c.name} ({c.code})</option>)}
                                    </select>
                                </div>

                                {/* Base product name — full-width on narrow viewports (spans both cols
                                    when only 2 fit), single col on wide. The flex-basis trick lets
                                    auto-fit treat it as a "preferred wide" field. */}
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className={fieldLabel + ' flex items-center justify-between'}>
                                        <span>
                                            Base product name <span style={{ color: 'var(--app-error)' }}>*</span>
                                        </span>
                                        <span className="normal-case tracking-normal text-tp-xxs font-medium"
                                              style={{ color: 'var(--app-muted-foreground)', opacity: 0.8 }}>
                                            Core identity — no brand/attributes
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={baseName}
                                        onChange={(e) => setBaseName(e.target.value)}
                                        className={fieldInput}
                                        placeholder="e.g. Orange Juice, Eau de Parfum, Premium Rice"
                                    />
                                </div>
                            </div>

                            {/* ── Row 3 — Unit & Packing (only for stock-tracked products) ── */}
                            {!isService && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                                    {/* Stock unit (compound: type filter → unit) */}
                                    <div>
                                        <label className={fieldLabel + ' flex items-center justify-between'}>
                                            <span>
                                                Stock unit <span style={{ color: 'var(--app-error)' }}>*</span>
                                            </span>
                                            {unitType && (
                                                <span className="normal-case tracking-normal text-tp-xxs font-bold"
                                                      style={{ color: 'var(--app-info, #3b82f6)' }}>
                                                    {filteredUnits.length} {unitType}
                                                </span>
                                            )}
                                        </label>
                                        <div className="flex gap-1.5">
                                            <select
                                                value={unitType}
                                                onChange={(e) => setUnitType(e.target.value)}
                                                className={fieldSelect}
                                                style={{ flex: '0 0 38%' }}
                                                title="Filter units by type">
                                                <option value="">Any type</option>
                                                {unitTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                            <select name="unitId" className={fieldSelect + ' flex-1'} required>
                                                <option value="">Select unit…</option>
                                                {filteredUnits.map(u => <option key={String(u.id)} value={String(u.id)}>{u.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Packing — value + unit (e.g. 330 ml, 1 kg) */}
                                    <div>
                                        <label className={fieldLabel}>Packing (emballage)</label>
                                        <div className="flex gap-1.5">
                                            <input
                                                name="size"
                                                type="number"
                                                step="0.01"
                                                value={emballageVal}
                                                onChange={(e) => setEmballageVal(e.target.value)}
                                                className={fieldInput}
                                                style={{ flex: '0 0 50%' }}
                                                placeholder="e.g. 330"
                                            />
                                            <select
                                                name="sizeUnitId"
                                                value={emballageUnitId}
                                                onChange={(e) => setEmballageUnitId(e.target.value)}
                                                className={fieldSelect + ' flex-1'}
                                            >
                                                <option value="">Unit</option>
                                                {units.map(u => <option key={String(u.id)} value={String(u.id)}>{u.shortName || u.name}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Row 4 — Attributes (dynamic, only when category has them) ── */}
                            {attributeTree.length > 0 && (
                                <div className="pt-3"
                                     style={{ borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)' }}>
                                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <Tags className="w-3.5 h-3.5" style={{ color: 'var(--app-warning)' }} />
                                            <span className="text-tp-xxs font-black uppercase tracking-widest"
                                                  style={{ color: 'var(--app-warning)' }}>
                                                Attributes
                                            </span>
                                            {attrCount > 0 && (
                                                <span className="text-tp-xxs font-bold px-1.5 py-0.5 rounded-full"
                                                      style={{
                                                          background: 'color-mix(in srgb, var(--app-warning) 12%, transparent)',
                                                          color: 'var(--app-warning)',
                                                      }}>
                                                    {attrCount} selected
                                                </span>
                                            )}
                                        </div>
                                        {hiddenAttrGroups.length > 0 && (
                                            <button type="button"
                                                    onClick={() => setShowHiddenAttrs(!showHiddenAttrs)}
                                                    className="flex items-center gap-1.5 text-tp-xxs font-bold transition-colors"
                                                    style={{ color: 'var(--app-muted-foreground)' }}
                                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-foreground)' }}
                                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)' }}>
                                                {showHiddenAttrs ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                {showHiddenAttrs ? 'Hide' : 'Show'} {hiddenAttrGroups.length} more
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        {relevantAttrGroups.map(group => (
                                            <AttrGroupSelector
                                                key={group.id}
                                                group={group}
                                                selectedId={selectedAttrValues[group.id] || null}
                                                onSelect={(childId) => setSelectedAttrValues(prev => ({ ...prev, [group.id]: childId }))}
                                                productCtx={productScopeCtx}
                                            />
                                        ))}
                                    </div>

                                    {hiddenAttrGroups.length > 0 && showHiddenAttrs && (
                                        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                            {hiddenAttrGroups.map(group => (
                                                <AttrGroupSelector
                                                    key={group.id}
                                                    group={group}
                                                    selectedId={selectedAttrValues[group.id] || null}
                                                    onSelect={(childId) => setSelectedAttrValues(prev => ({ ...prev, [group.id]: childId }))}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ────── CARD: Traceability ────── */}
                    <div className={card}>
                        <div className={cardHead('border-l-amber-400')}>
                            <h3 className={cardTitle}>Traceability & Rules</h3>
                        </div>
                        <div className="p-3">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                                {[
                                    { label: 'Track Expiry', name: 'isExpiryTracked', default: false, desc: 'Enforce dates', visible: showInventory },
                                    { label: 'Available in POS', name: 'isForSale', default: true, desc: 'Sell via terminal', visible: true },
                                    { label: 'For Purchasing', name: 'isForPurchasing', default: true, desc: 'Buy via PO', visible: showSupplier },
                                    { label: 'Serialize (IMEI)', name: 'isSerialized', default: false, desc: 'Track serials', visible: showInventory },
                                ].filter(t => t.visible).map((toggle, i) => (
                                    <label key={i} className="flex items-start gap-3 p-3 rounded-xl border border-app-border hover:bg-app-primary/5 transition-all cursor-pointer group">
                                        <input type="checkbox" name={toggle.name} className="w-4 h-4 mt-0.5 rounded border-app-border text-app-primary focus:ring-app-primary shrink-0" defaultChecked={toggle.default} />
                                        <div>
                                            <div className="text-[11px] font-bold text-app-foreground group-hover:text-app-primary transition-colors">{toggle.label}</div>
                                            <div className="text-[9px] text-app-muted-foreground font-medium">{toggle.desc}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ═══════ ZONE B — Business Config (Right 40%) ═══════ */}
                <div className="w-full md:w-[42%]">
                    <div className={card + ' sticky top-4'}>
                        <div className="px-5 py-3.5 border-b border-app-border bg-gradient-to-r from-app-surface to-app-background/30">
                            <div className="flex items-center gap-2">
                                <Settings2 className="w-4 h-4 text-app-muted-foreground" />
                                <h3 className={cardTitle}>Business Configuration</h3>
                            </div>
                        </div>

                        {/* Tab bar */}
                        <div className="flex border-b border-app-border bg-app-surface">
                            {sidebarTabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-bold transition-all border-b-2 ${activeTab === tab.id ? 'border-app-primary text-app-primary bg-app-primary/5' : 'border-transparent text-app-muted-foreground hover:text-app-foreground hover:bg-app-background'}`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="p-3">

                            {/* ── Pricing Tab ── */}
                            {activeTab === 'pricing' && (
                                <div className="space-y-3">
                                    <PricingEngine
                                        costPrice={costPrice}
                                        sellPrice={sellPrice}
                                        taxPercent={taxPercent}
                                        isTaxIncluded={isTaxIncluded}
                                        onCostChange={setCostPrice}
                                        onSellChange={setSellPrice}
                                        onTaxChange={setTaxPercent}
                                        onTaxIncludedChange={setIsTaxIncluded}
                                    />

                                    {/* ── All Pricing Levels Summary ── */}
                                    {(sellPrice > 0 || packagingLevels.length > 0) && (
                                        <div className="p-3 rounded-xl bg-gradient-to-b from-app-surface to-app-background border border-app-border">
                                            <div className="text-[10px] font-bold text-app-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                                <DollarSign className="w-3.5 h-3.5 text-app-primary" />
                                                All Pricing Levels
                                            </div>
                                            <div className="border border-app-border rounded-lg overflow-hidden">
                                                <table className="w-full text-[11px]">
                                                    <thead>
                                                        <tr className="bg-app-surface-hover/40 text-[9px] uppercase tracking-widest text-app-muted-foreground">
                                                            <th className="text-left py-2 px-3 font-bold">Level</th>
                                                            <th className="text-center py-2 px-3 font-bold">Mode</th>
                                                            <th className="text-right py-2 px-3 font-bold">Qty</th>
                                                            <th className="text-right py-2 px-3 font-bold">Price</th>
                                                            <th className="text-right py-2 px-3 font-bold">Per Unit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-app-border/30">
                                                        {/* Base unit row */}
                                                        <tr className="bg-app-info-bg/30">
                                                            <td className="py-2 px-3 font-bold text-app-foreground flex items-center gap-1.5">
                                                                <span className="w-4 h-4 rounded-full bg-app-info text-white text-[8px] font-black flex items-center justify-center">1</span>
                                                                Piece
                                                            </td>
                                                            <td className="py-2 px-3 text-center">
                                                                <span className="text-[8px] font-bold text-app-info bg-app-info-bg px-1.5 py-0.5 rounded">BASE</span>
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-bold text-app-foreground">1</td>
                                                            <td className="py-2 px-3 text-right font-bold text-app-primary">{sellPrice > 0 ? `$${sellPrice.toFixed(2)}` : '—'}</td>
                                                            <td className="py-2 px-3 text-right font-medium text-app-muted-foreground">{sellPrice > 0 ? `$${sellPrice.toFixed(2)}` : '—'}</td>
                                                        </tr>
                                                        {/* Packaging levels */}
                                                        {packagingLevels.filter((l) => l.unitId && l.ratio > 0).map((lvl, idx) => {
                                                            const totalUnits = (() => { let t = 1; for (let i = 0; i <= packagingLevels.indexOf(lvl); i++) { if (packagingLevels[i].ratio > 0) t *= packagingLevels[i].ratio; } return t; })();
                                                            const discountFactor = 1 - (lvl.discountPct / 100);
                                                            const formulaPrice = sellPrice * totalUnits * discountFactor;
                                                            const effectivePrice = lvl.priceMode === 'FIXED' && lvl.price > 0 ? lvl.price : formulaPrice;
                                                            const perUnit = totalUnits > 0 ? effectivePrice / totalUnits : 0;
                                                            const unitName = units.find((u) => String(u.id) === lvl.unitId)?.name || `Level ${idx + 2}`;
                                                            return (
                                                                <tr key={lvl.id} className="hover:bg-app-primary/5 transition-colors">
                                                                    <td className="py-2 px-3 font-bold text-app-foreground flex items-center gap-1.5">
                                                                        <span className="w-4 h-4 rounded-full bg-purple-500/20 text-app-accent text-[8px] font-black flex items-center justify-center">{idx + 2}</span>
                                                                        {unitName}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-center">
                                                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${lvl.priceMode === 'FORMULA' ? 'text-app-info bg-app-info-bg' : 'text-app-warning bg-app-warning-bg'}`}>
                                                                            {lvl.priceMode}
                                                                            {lvl.priceMode === 'FORMULA' && lvl.discountPct > 0 ? ` −${lvl.discountPct}%` : ''}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-bold text-app-foreground">{totalUnits}</td>
                                                                    <td className="py-2 px-3 text-right font-bold text-app-primary">
                                                                        {effectivePrice > 0 ? `$${effectivePrice.toFixed(2)}` : '—'}
                                                                    </td>
                                                                    <td className="py-2 px-3 text-right font-medium text-app-muted-foreground">
                                                                        {perUnit > 0 ? `$${perUnit.toFixed(2)}` : '—'}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                            {packagingLevels.length === 0 && (
                                                <p className="text-[10px] text-app-muted-foreground text-center mt-2">
                                                    Add packaging levels in the Packaging tab to see all prices here
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* ── Product Groups (Combo) ── */}
                                    <div className="p-3 rounded-xl bg-app-surface border border-app-border">
                                        <div className="text-[10px] font-bold text-app-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                            <Package className="w-3.5 h-3.5 text-app-accent" />
                                            Product Groups / Combos
                                        </div>
                                        <div className="space-y-2">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Assign to Group</label>
                                                <select
                                                    name="productGroupId"
                                                    className="w-full bg-app-background border border-app-border rounded-lg px-3 py-2 text-[11px] font-semibold text-app-foreground outline-none focus:ring-2 focus:ring-app-primary/20 transition-all"
                                                    defaultValue={initialData?.product_group || ''}
                                                >
                                                    <option value="">No group (independent pricing)</option>
                                                    {productGroups.map((g) => (
                                                        <option key={String(g.id)} value={String(g.id)}>
                                                            {g.name}
                                                            {g.price_sync_enabled ? ' 🔗 (price synced)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <p className="text-[9px] text-app-muted-foreground mt-1">
                                                When price sync is enabled, changing this product&apos;s price updates all products in the group.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Inventory Tab ── */}
                            {activeTab === 'inventory' && (
                                <div className="space-y-3">

                                    {/* ═══ 1. Cost Valuation Method ═══ */}
                                    <div>
                                        <label className={fieldLabel}>Cost Valuation Method</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'WAVG', label: 'Moving Average', desc: 'Weighted average of all purchases', icon: '⚖️' },
                                                { id: 'FIFO', label: 'FIFO', desc: 'First in, first out', icon: '📦' },
                                                { id: 'LIFO', label: 'LIFO', desc: 'Last in, first out', icon: '🔄' },
                                                { id: 'STANDARD', label: 'Standard Cost', desc: 'Fixed manual cost', icon: '📌' },
                                            ].map(m => (
                                                <label key={m.id} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${costValuation === m.id ? 'border-app-primary bg-app-primary/5 shadow-sm' : 'border-app-border hover:border-app-primary/30'}`}>
                                                    <input type="radio" name="costValuationMethod" value={m.id} checked={costValuation === m.id} onChange={() => setCostValuation(m.id)} className="mt-0.5 w-3.5 h-3.5 text-app-primary focus:ring-app-primary" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[13px]">{m.icon}</span>
                                                            <span className="text-[11px] font-bold text-app-foreground">{m.label}</span>
                                                        </div>
                                                        <p className="text-[9px] text-app-muted-foreground mt-0.5">{m.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ═══ 2. Lot / Date Management ═══ */}
                                    <div>
                                        <label className={fieldLabel}>Lot / Date Management</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'NONE', label: 'No lot tracking', desc: 'Simple quantity-only tracking', icon: '—' },
                                                { id: 'FIFO_AUTO', label: 'FIFO — Automatic', desc: 'System always picks oldest lot first', icon: '🔢' },
                                                { id: 'FEFO', label: 'FEFO — First Expiry Out', desc: 'Shortest remaining shelf-life consumed first', icon: '⏱️' },
                                                { id: 'MANUAL', label: 'Manual Selection', desc: 'Operator picks which lot/layer at POS or warehouse', icon: '👆' },
                                            ].map(m => (
                                                <label key={m.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${lotManagement === m.id ? 'border-app-info bg-app-info/5 shadow-sm' : 'border-app-border hover:border-app-info/30'}`}>
                                                    <input type="radio" name="lotManagement" value={m.id} checked={lotManagement === m.id} onChange={() => setLotManagement(m.id)} className="mt-0.5 w-3.5 h-3.5 text-app-info focus:ring-app-info" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[12px]">{m.icon}</span>
                                                            <span className="text-[11px] font-bold text-app-foreground">{m.label}</span>
                                                        </div>
                                                        <p className="text-[9px] text-app-muted-foreground">{m.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        <div className="flex gap-4 mt-3">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" name="tracksLots" checked={tracksLots} onChange={e => setTracksLots(e.target.checked)} className="w-3.5 h-3.5 rounded border-app-border text-app-info focus:ring-app-info" />
                                                <span className="text-[10px] font-semibold text-app-foreground">Track Lot/Batch Numbers</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" name="tracksSerials" className="w-3.5 h-3.5 rounded border-app-border text-app-primary focus:ring-app-primary" />
                                                <span className="text-[10px] font-semibold text-app-foreground">Track Serial Numbers</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* ═══ 3. Expiry & Shelf Life ═══ */}
                                    <div className="p-3 rounded-xl bg-gradient-to-b from-amber-50/30 to-orange-50/20 border border-app-warning/40">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-bold text-app-foreground flex items-center gap-1.5">
                                                <span className="text-[14px]">🕐</span>
                                                Expiry & Shelf Life
                                            </h4>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" name="isExpiryTracked" checked={expiryTracked} onChange={e => setExpiryTracked(e.target.checked)} className="w-3.5 h-3.5 rounded border-app-warning text-app-warning focus:ring-app-warning" />
                                                <span className="text-[10px] font-bold text-app-warning">Enabled</span>
                                            </label>
                                        </div>

                                        {expiryTracked && (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="block text-[8px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">Manufacturer Shelf Life</label>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                name="manufacturerShelfLifeDays"
                                                                value={mfgShelfLife}
                                                                onChange={e => setMfgShelfLife(parseInt(e.target.value) || 0)}
                                                                className={fieldInput + ' text-[11px] text-center'}
                                                                placeholder="240"
                                                            />
                                                            <span className="text-[9px] text-app-muted-foreground font-medium shrink-0">days</span>
                                                        </div>
                                                        <p className="text-[8px] text-app-muted-foreground mt-0.5">
                                                            {mfgShelfLife > 0 ? `≈ ${(mfgShelfLife / 30).toFixed(1)} months` : '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">Avg. Available Expiry</label>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                name="avgAvailableExpiryDays"
                                                                value={avgExpiry}
                                                                onChange={e => setAvgExpiry(parseInt(e.target.value) || 0)}
                                                                className={fieldInput + ' text-[11px] text-center'}
                                                                placeholder="120"
                                                            />
                                                            <span className="text-[9px] text-app-muted-foreground font-medium shrink-0">days</span>
                                                        </div>
                                                        <p className="text-[8px] text-app-muted-foreground mt-0.5">
                                                            {avgExpiry > 0 ? `≈ ${(avgExpiry / 30).toFixed(1)} months` : '—'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[8px] font-bold text-app-muted-foreground mb-1 uppercase tracking-wider">Shipping Duration</label>
                                                        <div className="flex items-center gap-1">
                                                            <input
                                                                type="number"
                                                                name="shippingDurationDays"
                                                                value={shippingDays}
                                                                onChange={e => setShippingDays(parseInt(e.target.value) || 0)}
                                                                className={fieldInput + ' text-[11px] text-center'}
                                                                placeholder="60"
                                                            />
                                                            <span className="text-[9px] text-app-muted-foreground font-medium shrink-0">days</span>
                                                        </div>
                                                        <p className="text-[8px] text-app-muted-foreground mt-0.5">
                                                            {shippingDays > 0 ? `≈ ${(shippingDays / 30).toFixed(1)} months` : 'from PO'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Computed summary */}
                                                {mfgShelfLife > 0 && (
                                                    <div className="p-3 rounded-lg bg-app-surface/60 border border-app-warning/50 space-y-1.5">
                                                        <p className="text-[9px] font-bold text-app-warning uppercase tracking-wider">Shelf Life Summary</p>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex-1 h-5 bg-app-warning-bg rounded-full overflow-hidden relative">
                                                                {/* Shipping bar */}
                                                                {shippingDays > 0 && (
                                                                    <div
                                                                        className="absolute left-0 top-0 h-full bg-red-300/60 rounded-l-full"
                                                                        style={{ width: `${Math.min((shippingDays / mfgShelfLife) * 100, 100)}%` }}
                                                                    />
                                                                )}
                                                                {/* Available bar */}
                                                                {avgExpiry > 0 && (
                                                                    <div
                                                                        className="absolute top-0 h-full bg-emerald-400/60"
                                                                        style={{
                                                                            left: `${Math.min(((mfgShelfLife - avgExpiry) / mfgShelfLife) * 100, 100)}%`,
                                                                            width: `${Math.min((avgExpiry / mfgShelfLife) * 100, 100)}%`
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex justify-between text-[8px] text-app-muted-foreground font-medium">
                                                            <span>Mfg: {(mfgShelfLife / 30).toFixed(0)}m</span>
                                                            {shippingDays > 0 && <span className="text-app-error">Ship: {(shippingDays / 30).toFixed(0)}m</span>}
                                                            {avgExpiry > 0 && (
                                                                <span className="text-app-success font-bold">
                                                                    Available: {(avgExpiry / 30).toFixed(0)}m
                                                                    {shippingDays > 0 && ` → Sellable: ${((avgExpiry - shippingDays) / 30).toFixed(1)}m`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* ═══ 4. Stock Strategy ═══ */}
                                    <div>
                                        <label className={fieldLabel}>Stock Strategy</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'make_to_stock', label: 'Make to Stock', desc: 'Keep inventory on hand' },
                                                { id: 'make_to_order', label: 'Make to Order', desc: 'Produce when ordered' },
                                                { id: 'dropship', label: 'Dropship', desc: 'Ship from supplier' },
                                            ].map(s => (
                                                <label key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${stockStrategy === s.id ? 'border-app-primary bg-app-primary/5' : 'border-app-border hover:border-app-primary/30'}`}>
                                                    <input type="radio" name="stockStrategy" value={s.id} checked={stockStrategy === s.id} onChange={() => setStockStrategy(s.id)} className="mt-0.5 w-4 h-4 text-app-primary focus:ring-app-primary" />
                                                    <div>
                                                        <span className="text-[12px] font-bold text-app-foreground">{s.label}</span>
                                                        <p className="text-[10px] text-app-muted-foreground">{s.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ═══ 5. Replenishment Rules ═══ */}
                                    <div className="p-3 bg-app-background rounded-xl border border-app-border space-y-3">
                                        <h4 className="font-bold text-app-foreground flex items-center gap-1.5">
                                            <Warehouse className="w-3.5 h-3.5 text-app-warning" />
                                            Replenishment Rules
                                        </h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Minimum</label>
                                                <input type="number" value={minStock} onChange={e => setMinStock(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Maximum</label>
                                                <input type="number" value={maxStock} onChange={e => setMaxStock(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Reorder Point</label>
                                                <input type="number" value={reorderPoint} onChange={e => setReorderPoint(parseInt(e.target.value) || 0)} className={fieldInput + ' text-[12px]'} />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Lead Time (days)</label>
                                                <input type="number" name="supplierLeadTime" className={fieldInput + ' text-[12px]'} placeholder="5" />
                                            </div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-gradient-to-r from-app-primary/5 to-app-info/5 border border-app-primary/20">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <Zap className="w-3 h-3 text-app-primary" />
                                                <span className="text-[10px] font-bold text-app-primary">AI Suggestion</span>
                                            </div>
                                            <p className="text-[11px] text-app-foreground font-medium">
                                                Suggested reorder: <span className="font-bold text-app-primary">{Math.round((minStock + maxStock) / 2.5)} units</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── Packaging Tab ── */}
                            {activeTab === 'packaging' && (
                                <PackagingTree levels={packagingLevels} onChange={setPackagingLevels} units={units as Parameters<typeof PackagingTree>[0]['units']} basePrice={sellPrice} />
                            )}

                            {/* ── Supplier Tab ── */}
                            {activeTab === 'supplier' && (
                                <div className="space-y-4">
                                    <div className="p-3 bg-app-surface rounded-xl border border-app-border space-y-3">
                                        <h4 className="font-bold text-app-foreground flex items-center gap-1.5">
                                            <Truck className="w-3.5 h-3.5 text-app-info" />
                                            Primary Supplier
                                        </h4>
                                        <div>
                                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Vendor</label>
                                            <select name="supplierId" className={fieldSelect}><option value="">No supplier attached</option></select>
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Supplier SKU</label>
                                            <input name="supplierSku" type="text" className={fieldInput + ' font-mono text-[12px]'} placeholder="e.g. LOR-SHAMP-001" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-muted-foreground mb-1 uppercase tracking-wider">Buy Price</label>
                                                <input type="number" name="supplierPrice" step="0.01" className={fieldInput + ' text-[12px]'} placeholder="0.00" />
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-semibold text-app-info mb-1 uppercase tracking-wider">Lead Time</label>
                                                <input type="number" name="supplierLeadTimeDays" className="w-full bg-app-info-bg border border-app-info rounded-lg px-3 py-[10px] text-[12px] outline-none font-bold text-app-info placeholder:text-app-info" placeholder="Days" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky footer — pins to the bottom of the viewport while the
                page scrolls so the Create button is always reachable, but
                disappears below the form's last row when content fits. */}
            <div className="sticky bottom-0 mt-3 pt-3 pb-2 px-1 flex items-center justify-between gap-2 flex-wrap"
                 style={{
                     borderTop: '1px solid color-mix(in srgb, var(--app-foreground) 8%, transparent)',
                     background: 'color-mix(in srgb, var(--app-bg) 92%, transparent)',
                     backdropFilter: 'blur(6px)',
                     WebkitBackdropFilter: 'blur(6px)',
                 }}>
                <button type="button" onClick={onBack}
                        className="px-3 py-1.5 bg-app-background border border-app-border rounded-xl text-tp-xs font-bold text-app-muted-foreground hover:bg-app-surface-hover transition-all">
                    ← Back to Type
                </button>
                <div className="flex items-center gap-2">
                    <button type="button"
                            onClick={onCancel || onBack}
                            className="px-3 py-1.5 bg-app-surface border border-app-border rounded-xl text-tp-xs font-bold text-app-muted-foreground hover:bg-app-background transition-all">
                        Cancel
                    </button>
                    <button type="submit" disabled={isPending}
                            className="px-4 py-1.5 rounded-xl text-tp-sm font-bold text-white transition-all disabled:opacity-50 flex items-center gap-2 hover:brightness-110"
                            style={{
                                background: 'linear-gradient(90deg, var(--app-primary), var(--app-info, #3b82f6))',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}>
                        {isPending && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                        {isPending ? 'Creating…' : 'Create Product'}
                    </button>
                </div>
            </div>
        </form>
    );
}

/* ═══════════════════════════════════════════════════════════
 *  V3 Attribute Group Selector — Chip-based per-group
 * ═══════════════════════════════════════════════════════════ */
function AttrGroupSelector({
    group, selectedId, onSelect, productCtx,
}: {
    group: AttrGroup
    selectedId: number | null
    onSelect: (childId: number | null) => void
    /** Product context for scope filtering (Phase 2). When provided,
     *  the selector fetches scoped buckets from the backend instead of
     *  rendering group.children flat. Optional — omitting it keeps the
     *  legacy flat behaviour. */
    productCtx?: { categoryId?: number | null; countryId?: number | null; brandId?: number | null }
}) {
    const selected = group.children.find(c => c.id === selectedId);

    // Phase 2: scope-aware buckets. Fetched lazily when productCtx changes.
    // Empty buckets array → show flat group.children (pre-migration / no
    // scopes set on any value).
    const [buckets, setBuckets] = useState<ScopedBucket[] | null>(null);
    // Phase-5 close-out: out-of-scope values kept in a separate
    // "Restricted" bucket so the operator sees them with a warning chip
    // + click-to-confirm rather than disappearing silently.
    const [excluded, setExcluded] = useState<ExcludedValue[]>([]);
    // Track which excluded ids the operator has explicitly approved
    // (one-click confirm). Approved ids render as normal selectable
    // chips; un-approved render greyed with a warning icon.
    const [approvedExcluded, setApprovedExcluded] = useState<Set<number>>(new Set());
    useEffect(() => {
        let cancelled = false;
        if (!productCtx || (!productCtx.categoryId && !productCtx.countryId && !productCtx.brandId)) {
            setBuckets(null);
            setExcluded([]);
            return;
        }
        getScopedValuesForGroup(group.id, productCtx, { includeOutOfScope: true }).then(r => {
            if (cancelled) return;
            if (!r || r.buckets.length === 0) {
                setBuckets(null);
            } else {
                const onlyUniversal = r.buckets.length === 1 && r.buckets[0].key === 'universal';
                setBuckets(onlyUniversal ? null : r.buckets);
            }
            setExcluded(r?.excluded ?? []);
        });
        return () => { cancelled = true; };
    }, [group.id, productCtx?.categoryId, productCtx?.countryId, productCtx?.brandId]);

    return (
        <div className="rounded-xl border border-app-border/40 overflow-hidden transition-all"
            style={{ background: selectedId ? 'color-mix(in srgb, var(--app-primary) 2%, transparent)' : '' }}>
            {/* Group header */}
            <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                        background: group.is_variant ? 'color-mix(in srgb, var(--app-success) 10%, transparent)' : 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
                        color: group.is_variant ? 'var(--app-success)' : 'var(--app-warning)',
                    }}>
                    {group.is_variant ? <Package className="w-3 h-3" /> : <Tags className="w-3 h-3" />}
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-app-foreground">
                        {group.name}
                        {group.is_required && <span className="text-app-error ml-0.5">*</span>}
                    </span>
                    <div className="flex items-center gap-1.5">
                        {group.show_in_name && (
                            <span className="font-bold uppercase tracking-wider text-app-warning">📝 in name</span>
                        )}
                        {group.is_variant && (
                            <span className="font-bold uppercase tracking-wider text-app-success">variant</span>
                        )}
                    </div>
                </div>
                {selected && (
                    <button type="button" onClick={() => onSelect(null)}
                        className="text-[9px] font-bold text-app-muted-foreground hover:text-app-foreground px-1.5 py-0.5 rounded-md hover:bg-app-border/30 transition-colors">
                        Clear
                    </button>
                )}
            </div>

            {/* Value chips — bucketed when scope filtering is active,
                flat otherwise. The two paths share <Chip> rendering so a
                value picked in either mode looks identical. */}
            {buckets ? (
                <div className="px-3 pb-2.5 space-y-2">
                    {buckets.map(bucket => (
                        <div key={bucket.key}>
                            <div className="text-[8px] font-bold uppercase tracking-widest text-app-muted-foreground mb-1 flex items-center gap-1.5">
                                <span>{bucket.label}</span>
                                <span className="text-app-muted-foreground/60">·</span>
                                <span>{bucket.values.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {bucket.values.map(v => (
                                    <Chip
                                        key={v.id}
                                        id={v.id}
                                        name={v.name}
                                        scopeLabel={v.scope_label !== 'Universal' ? v.scope_label : undefined}
                                        selected={v.id === selectedId}
                                        onClick={() => onSelect(v.id === selectedId ? null : v.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                    {/* Phase-5 close-out: out-of-scope values rendered
                        with a warning chip + click-to-confirm. The
                        operator can still pick them — the click flips
                        the value into approvedExcluded so the second
                        click selects normally. Beats the silent
                        "the value just doesn't appear" UX. */}
                    {excluded.length > 0 && (
                        <div>
                            <div className="text-[8px] font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"
                                style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                <span>⚠ Restricted by scope</span>
                                <span className="opacity-60">·</span>
                                <span>{excluded.length}</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {excluded.map(v => {
                                    const approved = approvedExcluded.has(v.id);
                                    const isSel = v.id === selectedId;
                                    if (approved) {
                                        return (
                                            <Chip
                                                key={v.id}
                                                id={v.id}
                                                name={v.name}
                                                scopeLabel={v.scope_label}
                                                selected={isSel}
                                                onClick={() => onSelect(isSel ? null : v.id)}
                                            />
                                        );
                                    }
                                    return (
                                        <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setApprovedExcluded(prev => new Set(prev).add(v.id))}
                                            title={`Out of scope on: ${v.failed_axes.join(', ')}. Click to override.`}
                                            className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all"
                                            style={{
                                                background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 6%, transparent)',
                                                color: 'var(--app-warning, #f59e0b)',
                                                borderColor: 'color-mix(in srgb, var(--app-warning, #f59e0b) 35%, transparent)',
                                            }}
                                        >
                                            <span>⚠</span>
                                            <span>{v.name}</span>
                                            <span className="text-[8px] font-mono opacity-70">
                                                Override · {v.failed_axes.join('+')}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="px-3 pb-2.5 flex flex-wrap gap-1.5">
                    {group.children.map(child => (
                        <Chip
                            key={child.id}
                            id={child.id}
                            name={child.name}
                            colorHex={child.color_hex}
                            selected={child.id === selectedId}
                            onClick={() => onSelect(child.id === selectedId ? null : child.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function Chip({ id, name, colorHex, scopeLabel, selected, onClick }: {
    id: number
    name: string
    colorHex?: string | null
    scopeLabel?: string
    selected: boolean
    onClick: () => void
}) {
    return (
        <button
            key={id}
            type="button"
            onClick={onClick}
            title={scopeLabel ? `Scope: ${scopeLabel}` : undefined}
            className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${selected
                ? 'border-app-primary bg-app-primary text-white shadow-md'
                : 'border-app-border/50 text-app-foreground hover:border-app-border hover:bg-app-surface/50'
                }`}
            style={selected ? { boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)' } : {}}>
            {colorHex && (
                <div className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20"
                    style={{ background: colorHex }} />
            )}
            <span>{name}</span>
            {scopeLabel && (
                <span className={`text-[8px] font-mono ${selected ? 'text-white/70' : 'text-app-muted-foreground'}`}>
                    {scopeLabel}
                </span>
            )}
            {selected && <Check className="w-3 h-3" />}
        </button>
    );
}
