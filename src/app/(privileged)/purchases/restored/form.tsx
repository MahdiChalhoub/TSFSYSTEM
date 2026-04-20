'use client';

import { useActionState, useState, useEffect, useRef, forwardRef } from "react";
import type { PurchaseLine } from '@/types/erp';
import { createPurchaseInvoice } from "@/app/actions/commercial/purchases";
import { searchProductsSimple } from "@/app/actions/inventory/product-actions";
import { useDev } from "@/context/DevContext";
import {
    Search, ShoppingCart, SlidersHorizontal, BookOpen, Plus,
    Trash2, ArrowRight, ArrowLeft, Settings2, FileText, Package,
    LayoutGrid, Shield
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { CatalogueModal } from "../new-order/_components/CatalogueModal";
import { CustomizeSidebar } from "../new-order/_components/CustomizeSidebar";
import { SmartFillModal } from "../new-order/_components/SmartFillModal";
import { ImportFromPOModal } from "../new-order/_components/ImportFromPOModal";
import { SupplierScorecard } from "../new-order/_components/SupplierScorecard";
import { ConfigSidebar } from "../new-order/_components/ConfigSidebar";
import { TransferRequestDialog } from "../new-order/_components/TransferRequestDialog";
import { PurchaseRequestDialog } from "../new-order/_components/PurchaseRequestDialog";
import { Zap, FileDown, ClipboardList, ArrowRightLeft, Send } from "lucide-react";
import {
    PO_ALL_COLUMNS,
    PO_DEFAULT_VISIBLE_COLS,
    loadPOProfiles,
    loadPOActiveProfileId,
    savePOProfiles,
    savePOActiveProfileId,
    type POViewProfile,
} from "../new-order/_lib/constants";
import { getPurchaseAnalyticsConfig, type PurchaseAnalyticsConfig } from "@/app/actions/settings/purchase-analytics-config";

/* ═══════════════════════════════════════════════════════════════
 *  CONFIG ROW — read-only key/value pair in Analytics drawer
 * ═══════════════════════════════════════════════════════════════ */
function ConfigRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span style={{ color: 'var(--app-muted-foreground)' }}>{label}</span>
            <span className="font-mono font-bold tabular-nums" style={{ color: 'var(--app-foreground)' }}>{value}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
 *  PRODUCT SEARCH — debounced typeahead
 * ═══════════════════════════════════════════════════════════════ */
const ProductSearch = forwardRef<HTMLInputElement, {
    callback: (p: Record<string, any>) => void;
    siteId: number;
    stockScope: 'branch' | 'all';
    warehouseId?: number;
}>(
    function ProductSearch({ callback, siteId, stockScope, warehouseId }, ref) {
        const [query, setQuery] = useState('');
        const [results, setResults] = useState<Record<string, any>[]>([]);
        const [open, setOpen] = useState(false);

        useEffect(() => {
            const timer = setTimeout(async () => {
                if (query.length > 1) {
                    const res = await searchProductsSimple(query, siteId, undefined, { stockScope, warehouseId });
                    setResults(res);
                    setOpen(true);
                } else {
                    setResults([]);
                    setOpen(false);
                }
            }, 300);
            return () => clearTimeout(timer);
        }, [query, siteId, stockScope, warehouseId]);

        return (
            <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--app-muted-foreground)' }} />
                <input
                    ref={ref}
                    type="text"
                    className="w-full pl-9 pr-3 py-2 text-[13px] bg-transparent border-none outline-none transition-all"
                    style={{ color: 'var(--app-foreground)' }}
                    placeholder="Search product name, barcode, SKU..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length > 1 && setOpen(true)}
                />
                {open && results.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-64 mt-1 rounded-xl shadow-xl z-50 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                        }}>
                        {results.map(r => (
                            <button
                                key={r.id as React.Key}
                                type="button"
                                onClick={() => { callback(r); setQuery(''); setOpen(false); }}
                                className="w-full text-left p-3 border-b last:border-b-0 text-[12px] font-bold transition-all flex items-center gap-2"
                                style={{ color: 'var(--app-foreground)', borderColor: 'color-mix(in srgb, var(--app-border) 50%, transparent)' }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 5%, transparent)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                    <Package size={12} />
                                </div>
                                <span className="flex-1 truncate">{r.name as React.ReactNode}</span>
                                <span className="font-mono text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>{r.sku as React.ReactNode}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }
);

/* ═══════════════════════════════════════════════════════════════
 *  MAIN FORM
 * ═══════════════════════════════════════════════════════════════ */
export default function PurchaseForm({
    suppliers,
    sites,
    financialSettings,
    paymentTerms = [],
    drivers = [],
    users = [],
}: {
    suppliers: Record<string, any>[],
    sites: Record<string, any>[],
    financialSettings: Record<string, any>,
    paymentTerms?: Record<string, any>[],
    drivers?: Record<string, any>[],
    users?: Record<string, any>[],
}) {
    const initialState = { message: '', errors: {} };
    const [state, formAction, isPending] = useActionState(createPurchaseInvoice, initialState);
    const { logOperation } = useDev();
    const router = useRouter();
    const searchRef = useRef<HTMLInputElement>(null);

    // ── State ──
    const [scope, setScope] = useState<'OFFICIAL' | 'INTERNAL'>('OFFICIAL');
    const [selectedSiteId, setSelectedSiteId] = useState<number | ''>('');
    const [invoicePriceType] = useState<'HT' | 'TTC'>('HT');
    const [vatRecoverable, setVatRecoverable] = useState<boolean>(true);
    const [lines, setLines] = useState<PurchaseLine[]>([]);
    const [catalogueOpen, setCatalogueOpen] = useState(false);
    const [smartFillOpen, setSmartFillOpen] = useState(false);
    const [importPoOpen, setImportPoOpen] = useState(false);
    const [configOpen, setConfigOpen] = useState(false);
    const [selectedSupplierId, setSelectedSupplierId] = useState<number | ''>('');
    const [selectedPaymentTermId, setSelectedPaymentTermId] = useState<number | ''>('');
    const [selectedDriverId, setSelectedDriverId] = useState<number | ''>('');
    const [assignedToId, setAssignedToId] = useState<number | ''>('');
    const [notes, setNotes] = useState('');
    const [transferLine, setTransferLine] = useState<any | null>(null);
    const [purchaseRequestLine, setPurchaseRequestLine] = useState<any | null>(null);
    const [mobileSheetLine, setMobileSheetLine] = useState<any | null>(null);
    const [toastMsg, setToastMsg] = useState<string | null>(null);
    // Tier 3.1 — sortable headers
    const [sortBy, setSortBy] = useState<'none' | 'quantity' | 'stockTotal' | 'scoreAdjust' | 'expirySafety'>('none');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const toggleSort = (key: typeof sortBy) => {
        if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(key); setSortDir('desc'); }
    };
    // Tier 4.2 — Bulk selection
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
    const toggleRowSelection = (productId: number) => {
        setSelectedRows(prev => {
            const next = new Set(prev);
            if (next.has(productId)) next.delete(productId);
            else next.add(productId);
            return next;
        });
    };
    const selectAllRows = () => setSelectedRows(new Set(lines.map((l: any) => Number(l.productId))));
    const clearSelection = () => setSelectedRows(new Set());
    const bulkDelete = () => {
        setLines(lines.filter((l: any) => !selectedRows.has(Number(l.productId))));
        clearSelection();
    };
    const bulkSetProposed = () => {
        setLines(lines.map((l: any) => selectedRows.has(Number(l.productId))
            ? { ...l, quantity: l.requiredProposed || l.quantity, _flash: Date.now() }
            : l));
    };

    const sortedLines = (() => {
        if (sortBy === 'none') return lines;
        const mult = sortDir === 'asc' ? 1 : -1;
        return [...lines].sort((a: any, b: any) => {
            const av = Number(a[sortBy] || 0), bv = Number(b[sortBy] || 0);
            return (av - bv) * mult;
        });
    })();
    // Per-session overrides (persisted browser-local)
    const [stockScope, setStockScope] = useState<'branch' | 'all'>('branch');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | ''>('');
    const [analyticsOpen, setAnalyticsOpen] = useState(false);

    // Org-wide analytics config — single source of truth lives at
    // /settings/purchase-analytics (RBAC'd, audited, versioned).
    const [analyticsConfig, setAnalyticsConfig] = useState<PurchaseAnalyticsConfig | null>(null);
    useEffect(() => {
        getPurchaseAnalyticsConfig().then(setAnalyticsConfig).catch(() => { /* use defaults */ });
    }, []);

    // Persist session-only overrides (stock scope + warehouse). The org-level
    // periods/formulas are NOT stored here — they come from the config above.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('po_session_overrides');
            if (raw) {
                const p = JSON.parse(raw);
                if (p.stockScope) setStockScope(p.stockScope);
                if (typeof p.warehouseId === 'number') setSelectedWarehouseId(p.warehouseId);
            }
        } catch { /* noop */ }
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem('po_session_overrides', JSON.stringify({
                stockScope, warehouseId: selectedWarehouseId || null,
            }));
        } catch { /* noop */ }
    }, [stockScope, selectedWarehouseId]);

    // Warehouses available for the selected site
    const siteWarehouses = (() => {
        const s = sites.find((x: any) => x.id === Number(selectedSiteId));
        return (s?.warehouses || []) as Array<{ id: number; name: string }>;
    })();

    // ── Column Customization (profiles persisted to localStorage) ──
    const [customizeOpen, setCustomizeOpen] = useState(false);
    const [poProfiles, setPOProfiles] = useState<POViewProfile[]>([{ id: 'default', name: 'Default', columns: PO_DEFAULT_VISIBLE_COLS }]);
    const [poActiveProfileId, setPOActiveProfileId] = useState('default');
    const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(PO_DEFAULT_VISIBLE_COLS);

    useEffect(() => {
        const loaded = loadPOProfiles();
        if (loaded.length) {
            setPOProfiles(loaded);
            const activeId = loadPOActiveProfileId();
            const active = loaded.find(p => p.id === activeId) || loaded[0];
            setPOActiveProfileId(active.id);
            setVisibleColumns(active.columns);
        }
    }, []);

    const activeProfile = poProfiles.find(p => p.id === poActiveProfileId);
    const visibleColCount = Object.values(visibleColumns).filter(Boolean).length;
    const col = (key: string) => visibleColumns[key] !== false;

    // Map search_enhanced / catalogue row → safety tag text
    const resolveSafetyTag = (p: Record<string, any>): 'SAFE' | 'CAUTION' | 'RISKY' => {
        if (p.safety_tag) return String(p.safety_tag).toUpperCase() as any;
        const daysToSell = Number(p.days_to_sell_all ?? 0);
        const avgExpiry = Number(p.avg_expiry_days ?? 0);
        if (!avgExpiry) return 'SAFE';
        if (daysToSell >= avgExpiry) return 'RISKY';
        if (daysToSell < 0.6 * avgExpiry) return 'SAFE';
        return 'CAUTION';
    };

    useEffect(() => { setVatRecoverable(scope === 'OFFICIAL'); }, [scope]);

    // Keyboard shortcuts: Ctrl+K → focus search, Ctrl+Enter → submit
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); searchRef.current?.focus(); }
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                const submitBtn = document.querySelector<HTMLButtonElement>('button[type="submit"]');
                if (submitBtn && !submitBtn.disabled) { e.preventDefault(); submitBtn.click(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Tier 1.4 — Success redirect: when the action returns a successful message,
    // route to the purchases list after a brief flash.
    useEffect(() => {
        if (state.message && (!state.errors || Object.keys(state.errors).length === 0)) {
            const t = setTimeout(() => {
                try { localStorage.removeItem('po_draft'); } catch { /* noop */ }
                router.push('/purchases');
            }, 900);
            return () => clearTimeout(t);
        }
    }, [state, router]);

    // Tier 4.3 — Draft auto-save: persist the in-progress PO every 10s and
    // restore on mount. Cleared on successful submit.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const raw = localStorage.getItem('po_draft');
            if (raw) {
                const d = JSON.parse(raw);
                if (Array.isArray(d.lines) && d.lines.length > 0) setLines(d.lines);
                if (d.notes) setNotes(d.notes);
                if (d.selectedSupplierId) setSelectedSupplierId(d.selectedSupplierId);
                if (d.selectedSiteId) setSelectedSiteId(d.selectedSiteId);
                if (d.selectedPaymentTermId) setSelectedPaymentTermId(d.selectedPaymentTermId);
                if (d.selectedDriverId) setSelectedDriverId(d.selectedDriverId);
                if (d.assignedToId) setAssignedToId(d.assignedToId);
            }
        } catch { /* noop */ }
    }, []);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const t = setTimeout(() => {
            try {
                if (lines.length === 0 && !notes) { localStorage.removeItem('po_draft'); return; }
                localStorage.setItem('po_draft', JSON.stringify({
                    lines, notes, selectedSupplierId, selectedSiteId,
                    selectedPaymentTermId, selectedDriverId, assignedToId,
                    savedAt: Date.now(),
                }));
            } catch { /* noop */ }
        }, 10000);
        return () => clearTimeout(t);
    }, [lines, notes, selectedSupplierId, selectedSiteId, selectedPaymentTermId, selectedDriverId, assignedToId]);

    // ── Line Management ──
    // Intelligence fields come from `search_enhanced` endpoint (or catalogue_list).
    // Spec: po_intelligence_grid.md — 25+ analytics fields, safety tag logic,
    // proposed qty = max(0, daily_sales × lead_time_days - stock_on_location).
    const addProductToLines = (product: Record<string, any>) => {
        // Duplicate-merge (Tier 1.3 from 11/10 plan): incrementing qty instead of
        // silently dropping the re-add, so double-click from search/catalogue counts up.
        const existingIdx = lines.findIndex(l => l.productId === product.id);
        if (existingIdx >= 0) {
            const next = [...lines];
            (next[existingIdx] as any).quantity = Number((next[existingIdx] as any).quantity || 0) + 1;
            setLines(next);
            return;
        }
        const taxRate = Number(product.tax_rate ?? product.taxRate ?? 0.11);
        const unitCostHT = Number(product.cost_price_ht ?? product.costPriceHT ?? product.unitCostHT ?? 0);
        const sellingPriceHT = Number(product.selling_price_ht ?? product.sellingPriceHT ?? 0);

        const stockOnLoc = Number(product.stock_on_location ?? product.stockInLocation ?? 0);
        const totalStock = Number(product.total_stock ?? product.stockLevel ?? 0);
        const stockTransit = Number(product.stock_in_transit ?? 0);
        const dailySales = Number(product.daily_sales ?? product.avg_daily_sales ?? 0);
        const monthlyAvg = Number(product.monthly_average ?? product.total_sold ?? 0);
        // Proposed Qty formula driven by org-level analytics config (see /settings/purchase-analytics):
        //   AVG_DAILY_x_LEAD_DAYS → daily_sales × lead_days × safety_multiplier - stock_on_location
        //   MONTHLY_AVG_x_MONTHS  → monthly_avg × safety_multiplier - stock_on_location
        const leadDays = Number(analyticsConfig?.proposed_qty_lead_days ?? 14);
        const safetyMult = Number(analyticsConfig?.proposed_qty_safety_multiplier ?? 1.5);
        const formula = analyticsConfig?.proposed_qty_formula ?? 'AVG_DAILY_x_LEAD_DAYS';
        const computedQty = formula === 'MONTHLY_AVG_x_MONTHS'
            ? Math.ceil(monthlyAvg * safetyMult) - stockOnLoc
            : Math.ceil(dailySales * leadDays * safetyMult) - stockOnLoc;
        const proposedQty = Number(product.proposedQty ?? product.proposed_qty ?? Math.max(1, computedQty));
        const purchaseCount = Number(product.purchase_count ?? 0);
        const totalPurchased = Number(product.total_purchased ?? 0);
        const finScore = Number(product.financial_score ?? 0);
        const adjScore = Number(product.adjustment_score ?? 0);
        const bestPrice = Number(product.best_supplier_price ?? unitCostHT);
        const avgExpiry = Number(product.avg_expiry_days ?? 0);
        const safety = resolveSafetyTag(product);

        // Status derives from velocity vs stock. Matches the UI colours (LOW/URGENT/OPTIONAL).
        const statusText = stockOnLoc <= 0 ? 'URGENT' : (dailySales > 0 && stockOnLoc < dailySales * 7) ? 'LOW' : 'OPTIONAL';

        setLines(prev => [{
            ...product,
            productId: product.id,
            productName: product.name,
            quantity: proposedQty,
            unitCostHT,
            unitCostTTC: unitCostHT * (1 + taxRate),
            sellingPriceHT,
            sellingPriceTTC: sellingPriceHT * (1 + taxRate),
            expiryDate: '',
            taxRate,
            requiredProposed: proposedQty,
            stockTransit,
            stockTotal: totalStock || stockOnLoc,
            poCount: purchaseCount,
            statusText,
            salesMonthly: monthlyAvg || Math.round(dailySales * 30),
            scoreAdjust: adjScore ? adjScore.toFixed(1) : finScore.toFixed(1),
            purchasedSold: totalPurchased,
            supplierPrice: bestPrice,
            expirySafety: avgExpiry ? `${avgExpiry} days` : '—',
            safetyTag: safety,
        }, ...prev]);
    };

    const updateLine = (idx: number, updates: Record<string, any>) => {
        const newLines = [...lines];
        Object.assign(newLines[idx], updates);
        setLines(newLines);
    };

    const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx));

    // Bulk-add products (used by SmartFill + CatalogueModal multi-select if enabled)
    const addProductsBulk = (products: Record<string, any>[]) => {
        products.forEach(p => addProductToLines(p));
    };

    // Import pre-formed lines from a previous PO. Each line already has productId,
    // quantity, unitCost — we re-key them to our shape and skip duplicates.
    const importPOLines = (poLines: Record<string, any>[]) => {
        const existing = new Set(lines.map(l => l.productId));
        const toAdd = poLines.filter(l => !existing.has(l.product_id ?? l.productId));
        toAdd.forEach(l => {
            addProductToLines({
                id: l.product_id ?? l.productId,
                name: l.product_name ?? l.productName,
                sku: l.sku ?? '',
                proposedQty: l.quantity,
                cost_price_ht: l.unit_cost ?? l.unitCost ?? 0,
                tax_rate: l.tax_rate ?? l.taxRate ?? 0.11,
            });
        });
    };

    const statusColorMap: Record<string, { bg: string; text: string; border: string }> = {
        LOW: { bg: 'color-mix(in srgb, var(--app-warning) 10%, transparent)', text: 'var(--app-warning)', border: 'color-mix(in srgb, var(--app-warning) 25%, transparent)' },
        URGENT: { bg: 'color-mix(in srgb, var(--app-error) 10%, transparent)', text: 'var(--app-error)', border: 'color-mix(in srgb, var(--app-error) 25%, transparent)' },
        OPTIONAL: { bg: 'color-mix(in srgb, var(--app-info) 10%, transparent)', text: 'var(--app-info)', border: 'color-mix(in srgb, var(--app-info) 25%, transparent)' },
    };

    return (
        <form action={formAction} className="flex-1 flex flex-col relative">
            {/* Tier 3.4 — Print layout */}
            <style jsx global>{`
                @media print {
                    .no-print, .no-print * { display: none !important; }
                    body { background: white !important; }
                    .print-only { display: block !important; }
                }
                .print-only { display: none; }
            `}</style>
            <input type="hidden" name="scope" value={scope} />
            <input type="hidden" name="invoicePriceType" value={invoicePriceType} />
            <input type="hidden" name="vatRecoverable" value={vatRecoverable ? 'true' : 'false'} />
            <input type="hidden" name="siteId" value={selectedSiteId} />
            <input type="hidden" name="warehouseId" value={selectedWarehouseId} />
            <input type="hidden" name="supplierId" value={selectedSupplierId} />
            <input type="hidden" name="paymentTermId" value={selectedPaymentTermId} />
            <input type="hidden" name="driverId" value={selectedDriverId} />
            <input type="hidden" name="assignedToId" value={assignedToId} />
            <input type="hidden" name="notes" value={notes} />

            {/* ═══ Page Header — back arrow + title + scope pills + icon triplet ═══ */}
            <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-3 flex-shrink-0 no-print"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                    boxShadow: '0 1px 3px color-mix(in srgb, var(--app-foreground) 4%, transparent)',
                }}>
                {/* Left: back + title */}
                <div className="flex items-center gap-3">
                    <Link href="/purchases"
                        className="w-9 h-9 rounded-full flex items-center justify-center transition-colors hover:bg-app-border/30"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <ArrowLeft size={16} />
                    </Link>
                    <h1 className="text-lg md:text-xl font-black tracking-tight"
                        style={{ color: 'var(--app-foreground)' }}>
                        New <span style={{ color: 'var(--app-primary)' }}>Purchase Order</span>
                    </h1>
                </div>

                {/* Right: scope pills + config + analytics + doc */}
                <div className="flex items-center gap-2">
                    <div className="flex rounded-full overflow-hidden h-[30px]"
                        style={{ border: '1px solid var(--app-border)' }}>
                        <button type="button" onClick={() => setScope('OFFICIAL')}
                            className="px-4 text-[10px] font-black uppercase tracking-wider transition-all"
                            style={scope === 'OFFICIAL' ? {
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            } : { background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                            Official
                        </button>
                        <button type="button" onClick={() => setScope('INTERNAL')}
                            className="px-4 text-[10px] font-black uppercase tracking-wider transition-all"
                            style={scope === 'INTERNAL' ? {
                                background: 'var(--app-primary)', color: 'white',
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            } : { background: 'var(--app-surface)', color: 'var(--app-muted-foreground)' }}>
                            Internal
                        </button>
                    </div>
                    <button type="button" onClick={() => setAnalyticsOpen(true)}
                        title="Analytics profile — stock scope + org config"
                        className="p-1.5 rounded-lg transition-colors hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <SlidersHorizontal size={15} />
                    </button>
                    <button type="button" onClick={() => setConfigOpen(true)}
                        title="Order configuration — supplier, branch, payment, driver, notes"
                        className="p-1.5 rounded-lg transition-colors relative"
                        style={{ background: 'var(--app-primary)', color: 'white' }}>
                        <FileText size={15} />
                        {!selectedSupplierId && (
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
                                style={{ background: 'var(--app-error, #ef4444)' }}
                                title="Supplier not selected" />
                        )}
                    </button>
                </div>
            </div>

            {/* ═══ Toolbar: Product Lines + Search + Actions ═══ */}
            <div className="flex-shrink-0 flex items-center gap-0"
                style={{
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                {/* Product Lines label with left accent */}
                <div className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
                    style={{ borderLeft: '3px solid var(--app-primary)' }}>
                    <LayoutGrid size={14} style={{ color: 'var(--app-muted-foreground)' }} />
                    <span className="text-[12px] font-bold tracking-tight" style={{ color: 'var(--app-foreground)' }}>
                        Product Lines
                    </span>
                </div>

                {/* Search */}
                <div className="flex-1 border-l" style={{ borderColor: 'var(--app-border)' }}>
                    <ProductSearch
                        ref={searchRef}
                        callback={addProductToLines}
                        siteId={Number(selectedSiteId) || 1}
                        stockScope={stockScope}
                        warehouseId={Number(selectedWarehouseId) || undefined}
                    />
                </div>

                {/* Right buttons */}
                <div className="flex items-center gap-1.5 px-3 flex-shrink-0">
                    <button type="button" onClick={() => setCustomizeOpen(true)}
                        title="Customize visible columns + view profiles"
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <SlidersHorizontal size={13} />
                        <span className="hidden md:inline">{visibleColCount} Cols</span>
                    </button>
                    <button type="button" onClick={() => setCatalogueOpen(true)}
                        className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:bg-app-border/20"
                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                        <BookOpen size={13} />
                        <span className="hidden md:inline">Catalogue</span>
                    </button>
                    <button type="button" className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all"
                        style={{ background: 'var(--app-primary)', color: 'white', boxShadow: '0 2px 6px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                        <Plus size={14} />
                        <span className="hidden sm:inline">New</span>
                    </button>
                </div>
            </div>

            {/* ═══ Column Headers ═══ */}
            <div className="flex-shrink-0 hidden md:flex items-center gap-0 text-[10px] font-black uppercase tracking-wider"
                style={{
                    color: 'var(--app-muted-foreground)',
                    background: 'var(--app-surface)',
                    borderBottom: '1px solid var(--app-border)',
                }}>
                <div className="px-4 py-3 w-[200px] flex-shrink-0">Product</div>
                {col('qty') && <button type="button" onClick={() => toggleSort('quantity')}
                    className="px-2 py-3 w-[60px] flex-shrink-0 text-center text-[10px] font-black uppercase tracking-wider transition-colors hover:text-app-primary"
                    style={{ color: sortBy === 'quantity' ? 'var(--app-primary)' : 'inherit' }}>
                    Qty {sortBy === 'quantity' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>}
                {col('salesWindows') && <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">Requested</div>}
                {col('qty') && <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <div>Required</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">proposed</div>
                </div>}
                {col('stock') && <button type="button" onClick={() => toggleSort('stockTotal')}
                    className="px-2 py-3 w-[90px] flex-shrink-0 text-center hidden lg:block text-[10px] font-black uppercase tracking-wider transition-colors hover:text-app-primary"
                    style={{ color: sortBy === 'stockTotal' ? 'var(--app-primary)' : 'inherit' }}>
                    <div>Stock {sortBy === 'stockTotal' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">transit · total</div>
                </button>}
                {col('productStatus') && <div className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden lg:block">
                    <div>PO</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">Count</div>
                </div>}
                {col('productStatus') && <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center">Status</div>}
                {col('dailySales') && <div className="px-2 py-3 w-[70px] flex-shrink-0 text-center hidden xl:block">
                    <div>Sales</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">monthly</div>
                </div>}
                {col('financialScore') && <button type="button" onClick={() => toggleSort('scoreAdjust')}
                    className="px-2 py-3 w-[65px] flex-shrink-0 text-center hidden xl:block text-[10px] font-black uppercase tracking-wider transition-colors hover:text-app-primary"
                    style={{ color: sortBy === 'scoreAdjust' ? 'var(--app-primary)' : 'inherit' }}>
                    <div>Score {sortBy === 'scoreAdjust' && (sortDir === 'asc' ? '↑' : '↓')}</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">adjust</div>
                </button>}
                {col('trend') && <div className="px-2 py-3 w-[75px] flex-shrink-0 text-center hidden xl:block">
                    <div>Purchased</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">sold</div>
                </div>}
                {col('unitCost') && <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center">
                    <div>Cost</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">sell price</div>
                </div>}
                {col('bestSupplier') && <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <div>Supplier</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">price</div>
                </div>}
                {col('expiry') && <div className="px-2 py-3 w-[80px] flex-shrink-0 text-center hidden lg:block">
                    <div>Expiry</div>
                    <div className="font-semibold normal-case text-[9px] opacity-60">safety</div>
                </div>}
                {col('suppliers') && <div className="px-2 py-3 w-[45px] flex-shrink-0 text-center" style={{ borderLeft: '1px solid var(--app-border)' }}>SUP+</div>}
            </div>

            {/* ═══ Scrollable Body ═══ */}
            <div className="flex-1 overflow-y-auto overflow-x-auto"
                style={{ background: 'color-mix(in srgb, var(--app-surface) 50%, var(--app-background))' }}>

                {/* Empty State */}
                {lines.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
                        <ShoppingCart size={40} className="mb-4 opacity-30" style={{ color: 'var(--app-muted-foreground)' }} />
                        <p className="text-sm font-bold" style={{ color: 'var(--app-foreground)' }}>No products added yet</p>
                        <p className="text-[12px] mt-1" style={{ color: 'var(--app-muted-foreground)' }}>
                            Search above or browse the catalogue to add product lines.
                        </p>
                    </div>
                )}

                {/* Desktop Rows */}
                {sortedLines.length > 0 && (
                    <div className="hidden md:block">
                        {sortedLines.map((line, idx) => {
                            const statusStyle = statusColorMap[(line.statusText as string) || 'OPTIONAL'] || statusColorMap['OPTIONAL'];
                            // Tier 3.2 — row conditional tinting by urgency
                            const rowBg = line.safetyTag === 'RISKY'
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 4%, transparent)'
                                : line.statusText === 'URGENT'
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 3%, transparent)'
                                : line.statusText === 'LOW'
                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 3%, transparent)'
                                : 'transparent';
                            const rowHoverBg = line.safetyTag === 'RISKY'
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 7%, transparent)'
                                : line.statusText === 'URGENT'
                                ? 'color-mix(in srgb, var(--app-error, #ef4444) 5%, transparent)'
                                : line.statusText === 'LOW'
                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 5%, transparent)'
                                : 'color-mix(in srgb, var(--app-primary) 3%, transparent)';
                            return (
                                <div key={line.productId} className="group flex items-center gap-0 transition-colors"
                                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)', background: rowBg }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = rowHoverBg}
                                    onMouseLeave={(e) => e.currentTarget.style.background = rowBg}>
                                    {/* Product */}
                                    <div className="px-4 py-2.5 w-[200px] flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                                <Package size={13} />
                                            </div>
                                            <span className="truncate text-[13px] font-bold" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                        <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    </div>
                                    {/* Qty — inline editor w/ live line-total flash (Tier 1.2) */}
                                    {col('qty') && <div className="px-2 py-2 w-[60px] flex-shrink-0 text-center">
                                        <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all focus:ring-2"
                                            style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                            value={line.quantity}
                                            onChange={(e) => {
                                                updateLine(idx, { quantity: Number(e.target.value), _flash: Date.now() });
                                            }}
                                            name={`lines[${idx}][quantity]`} />
                                    </div>}
                                    {/* Requested */}
                                    {col('salesWindows') && <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center font-semibold text-[12px] hidden xl:block" style={{ color: 'var(--app-muted-foreground)' }}>—</div>}
                                    {/* Required */}
                                    {col('qty') && <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.requiredProposed as number}</span>
                                    </div>}
                                    {/* Stock + Transfer button — spec: po_intelligence_grid.md §3.2 */}
                                    {col('stock') && <div className="px-2 py-2.5 w-[90px] flex-shrink-0 text-center hidden lg:block group/stock relative">
                                        <span className="text-[12px] tabular-nums" style={{ color: 'var(--app-muted-foreground)' }}>{line.stockTransit as number}</span>
                                        <span className="text-[12px] mx-0.5" style={{ color: 'var(--app-border)' }}>·</span>
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</span>
                                        <button type="button"
                                            onClick={() => setTransferLine(line)}
                                            title="⇄ Request transfer from another warehouse"
                                            className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/stock:opacity-100 p-1 rounded-md transition-all"
                                            style={{ color: 'var(--app-info, #3b82f6)', background: 'var(--app-surface)' }}>
                                            <ArrowRightLeft size={11} />
                                        </button>
                                    </div>}
                                    {/* PO Count */}
                                    {col('productStatus') && <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden lg:block">
                                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold tabular-nums"
                                            style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)', color: 'var(--app-muted-foreground)' }}>
                                            {line.poCount as number}
                                        </span>
                                    </div>}
                                    {/* Status */}
                                    {col('productStatus') && <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center">
                                        <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider"
                                            style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                            {line.statusText as string}
                                        </span>
                                    </div>}
                                    {/* Sales */}
                                    {col('dailySales') && <div className="px-2 py-2.5 w-[70px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.salesMonthly as number}</span>
                                    </div>}
                                    {/* Score */}
                                    {col('financialScore') && <div className="px-2 py-2.5 w-[65px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-info, #3b82f6)' }}>{line.scoreAdjust as string}</span>
                                    </div>}
                                    {/* Purchased */}
                                    {col('trend') && <div className="px-2 py-2.5 w-[75px] flex-shrink-0 text-center hidden xl:block">
                                        <span className="font-bold text-[12px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>{line.purchasedSold as number}</span>
                                    </div>}
                                    {/* Cost — dual row: unit cost + live line total; flashes when qty changes (Tier 1.2) */}
                                    {col('unitCost') && <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center">
                                        <div className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-foreground)' }}>
                                            {Number(line.unitCostHT).toFixed(2)}
                                        </div>
                                        <div className="text-[10px] font-black font-mono tabular-nums transition-colors duration-500"
                                            key={line._flash || 0}
                                            style={{
                                                color: line._flash && Date.now() - Number(line._flash) < 600
                                                    ? 'var(--app-primary)'
                                                    : 'var(--app-muted-foreground)',
                                            }}
                                            title={`Line total: ${Number(line.quantity) * Number(line.unitCostHT)}`}>
                                            = {(Number(line.quantity) * Number(line.unitCostHT)).toLocaleString()}
                                        </div>
                                        <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                    </div>}
                                    {/* Supplier Price + Request button — spec: po_intelligence_grid.md §3.2 */}
                                    {col('bestSupplier') && <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block group/sup relative">
                                        <span className="font-bold font-mono text-[11px] tabular-nums" style={{ color: 'var(--app-error, #ef4444)' }}>{Number(line.supplierPrice).toFixed(2)}</span>
                                        <button type="button"
                                            onClick={() => setPurchaseRequestLine(line)}
                                            title="📨 Request from another supplier"
                                            className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/sup:opacity-100 p-1 rounded-md transition-all"
                                            style={{ color: 'var(--app-warning, #f59e0b)', background: 'var(--app-surface)' }}>
                                            <Send size={11} />
                                        </button>
                                    </div>}
                                    {/* Expiry + Safety Tag — spec: po_intelligence_grid.md §2.1 */}
                                    {col('expiry') && <div className="px-2 py-2.5 w-[80px] flex-shrink-0 text-center hidden lg:block">
                                        {(() => {
                                            const tag = String(line.safetyTag || 'SAFE');
                                            const color = tag === 'RISKY' ? 'var(--app-error, #ef4444)'
                                                : tag === 'CAUTION' ? 'var(--app-warning, #f59e0b)'
                                                : 'var(--app-success, #22c55e)';
                                            return (
                                                <div className="flex items-center justify-center gap-1" title={`${tag} · ${line.expirySafety}`}>
                                                    <Shield size={10} style={{ color }} />
                                                    <span className="text-[11px] font-bold" style={{ color: 'var(--app-muted-foreground)' }}>
                                                        {line.expirySafety as string}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                    </div>}
                                    {/* SUP+ slot — bulk checkbox + delete (Tier 4.2) */}
                                    {col('suppliers') && <div className="px-2 py-2.5 w-[45px] flex-shrink-0 flex items-center justify-center gap-1" style={{ borderLeft: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}>
                                        <input type="checkbox"
                                            checked={selectedRows.has(Number(line.productId))}
                                            onChange={() => toggleRowSelection(Number(line.productId))}
                                            className="w-3 h-3 rounded cursor-pointer"
                                            style={{ accentColor: 'var(--app-primary)' }} />
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="opacity-20 group-hover:opacity-100 p-1 rounded-lg transition-all"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Mobile Cards */}
                {lines.length > 0 && (
                    <div className="block md:hidden p-3 space-y-3">
                        {lines.map((line, idx) => {
                            const statusStyle = statusColorMap[(line.statusText as string) || 'OPTIONAL'] || statusColorMap['OPTIONAL'];
                            return (
                                <div key={line.productId}
                                    onClick={(e) => {
                                        // Tap on the card (not on a control) opens the detail sheet
                                        if ((e.target as HTMLElement).closest('input, button, select')) return;
                                        setMobileSheetLine(line);
                                    }}
                                    className="p-3 rounded-xl shadow-sm relative cursor-pointer"
                                    style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                            <Package size={14} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="truncate text-[13px] font-bold block" style={{ color: 'var(--app-foreground)' }}>{line.productName as string}</span>
                                            <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider inline-block mt-0.5"
                                                style={{ background: statusStyle.bg, color: statusStyle.text, border: `1px solid ${statusStyle.border}` }}>
                                                {line.statusText as string}
                                            </span>
                                        </div>
                                        <button type="button" onClick={() => removeLine(idx)}
                                            className="p-2 rounded-lg transition-all flex-shrink-0"
                                            style={{ color: 'var(--app-error, #ef4444)' }}>
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                    <input type="hidden" name={`lines[${idx}][productId]`} value={String(line.productId)} />
                                    <input type="hidden" name={`lines[${idx}][taxRate]`} value={line.taxRate} />
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Qty</label>
                                            <input type="number" className="w-full rounded-lg p-1.5 text-center font-bold text-[12px] outline-none transition-all"
                                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}
                                                value={line.quantity}
                                                onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                                                name={`lines[${idx}][quantity]`} />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Cost</label>
                                            <div className="text-[12px] font-bold font-mono tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{Number(line.unitCostHT).toFixed(2)}</div>
                                            <input type="hidden" name={`lines[${idx}][unitCostHT]`} value={line.unitCostHT} />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: 'var(--app-muted-foreground)' }}>Stock</label>
                                            <div className="text-[12px] font-bold tabular-nums text-center py-1.5" style={{ color: 'var(--app-foreground)' }}>{line.stockTotal as number}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Bulk Actions Bar (Tier 4.2) — appears when ≥1 row selected ═══ */}
            {selectedRows.size > 0 && (
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 py-2.5 animate-in slide-in-from-bottom-2 duration-150"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 12%, var(--app-surface))',
                        borderTop: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}>
                    <div className="flex items-center gap-2 text-[11px] font-black" style={{ color: 'var(--app-primary)' }}>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            {selectedRows.size}
                        </span>
                        <span className="uppercase tracking-widest">selected</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <button type="button" onClick={bulkSetProposed}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                            style={{ color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 30%, transparent)', background: 'var(--app-surface)' }}>
                            Set Qty = Proposed
                        </button>
                        <button type="button" onClick={bulkDelete}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1"
                            style={{ color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)', background: 'var(--app-surface)' }}>
                            <Trash2 size={11} /> Delete
                        </button>
                        <button type="button" onClick={clearSelection}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all"
                            style={{ color: 'var(--app-muted-foreground)' }}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ Sticky Footer with Gradient Line ═══ */}
            <div className="flex-shrink-0 relative">
                {/* Teal gradient line */}
                <div className="h-[3px] w-full"
                    style={{ background: `linear-gradient(to right, color-mix(in srgb, var(--app-primary) 60%, transparent), color-mix(in srgb, var(--app-primary) 20%, transparent))` }} />

                {(() => {
                    const itemCount = lines.length;
                    const unitCount = lines.reduce((s, l: any) => s + Number(l.quantity || 0), 0);
                    const subtotalHT = lines.reduce((s, l: any) => s + Number(l.quantity || 0) * Number(l.unitCostHT || 0), 0);
                    const taxAmount = lines.reduce((s, l: any) => s + Number(l.quantity || 0) * Number(l.unitCostHT || 0) * Number(l.taxRate || 0), 0);
                    const totalTTC = subtotalHT + (vatRecoverable ? 0 : taxAmount);
                    // Tier 5.3 — Multi-currency: pull from org financial settings.
                    const currency = String(financialSettings?.default_currency || financialSettings?.currency_code || 'CFA');
                    const riskyCount = lines.filter((l: any) => l.safetyTag === 'RISKY').length;
                    const cautionCount = lines.filter((l: any) => l.safetyTag === 'CAUTION').length;
                    const safeCount = lines.filter((l: any) => l.safetyTag === 'SAFE').length;
                    // Expected delivery: today + org lead_days (from analytics config) or 14d fallback
                    const leadDays = Number(analyticsConfig?.proposed_qty_lead_days ?? 14);
                    const expectedDelivery = new Date(Date.now() + leadDays * 86400000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

                    return (
                        <>
                            {/* Order Intelligence Summary strip — Tier 2.2 */}
                            {itemCount > 0 && (
                                <div className="px-5 py-2 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest flex-wrap"
                                    style={{ background: 'color-mix(in srgb, var(--app-surface) 80%, var(--app-background))', borderTop: '1px solid color-mix(in srgb, var(--app-border) 50%, transparent)' }}>
                                    <span style={{ color: 'var(--app-muted-foreground)' }}>Intelligence:</span>
                                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--app-success, #22c55e)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} /> Safe <span className="font-mono">{safeCount}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--app-warning, #f59e0b)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} /> Caution <span className="font-mono">{cautionCount}</span>
                                    </span>
                                    <span className="inline-flex items-center gap-1" style={{ color: 'var(--app-error, #ef4444)' }}>
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'currentColor' }} /> Risky <span className="font-mono">{riskyCount}</span>
                                    </span>
                                    <span className="ml-auto" style={{ color: 'var(--app-muted-foreground)' }}>
                                        ETA: <span style={{ color: 'var(--app-foreground)' }}>{expectedDelivery}</span> ({leadDays}d lead)
                                    </span>
                                </div>
                            )}

                <div className="flex justify-between items-center gap-4 px-5 py-3"
                    style={{ background: 'var(--app-surface)', borderTop: '1px solid var(--app-border)' }}>
                    {/* Left: Rich totals — spec: 11/10 plan Tier 1.1 */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'color-mix(in srgb, var(--app-success, #22c55e) 10%, transparent)', color: 'var(--app-success, #22c55e)' }}>
                            Items <span className="font-mono text-[11px]">{itemCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'color-mix(in srgb, #a855f7 10%, transparent)', color: '#a855f7' }}>
                            Units <span className="font-mono text-[11px]">{unitCount}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 10%, transparent)', color: 'var(--app-muted-foreground)' }}>
                            HT <span className="font-mono text-[11px] tabular-nums">{subtotalHT.toLocaleString()}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'color-mix(in srgb, var(--app-info, #3b82f6) 10%, transparent)', color: 'var(--app-info, #3b82f6)' }}
                            title={vatRecoverable ? 'VAT recoverable — excluded from TTC' : 'VAT not recoverable — included in TTC'}>
                            VAT <span className="font-mono text-[11px] tabular-nums">{taxAmount.toLocaleString()}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                            style={{ background: 'var(--app-primary)', color: 'white' }}>
                            Total <span className="font-mono text-[11px] tabular-nums">{totalTTC.toLocaleString()} {currency}</span>
                        </span>
                    </div>

                    {/* Right: Messages + Create PO */}
                    <div className="flex-1 flex justify-end items-center gap-3">
                        {state.message && (
                            <div className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-block ${state.errors && Object.keys(state.errors).length > 0 ? '' : ''}`}
                                style={{
                                    background: state.errors && Object.keys(state.errors).length > 0
                                        ? 'color-mix(in srgb, var(--app-error) 10%, transparent)'
                                        : 'color-mix(in srgb, var(--app-success) 10%, transparent)',
                                    color: state.errors && Object.keys(state.errors).length > 0
                                        ? 'var(--app-error)'
                                        : 'var(--app-success)',
                                }}>
                                {state.message}
                            </div>
                        )}
                    </div>

                    {/* Right: Approval hint + Create PO button — Tier 5.1 */}
                    {(() => {
                        const approvalThreshold = Number(financialSettings?.po_approval_threshold ?? 500000);
                        const needsApproval = totalTTC > approvalThreshold;
                        return (
                            <div className="flex items-center gap-2">
                                {needsApproval && (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
                                        style={{ background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 12%, transparent)', color: 'var(--app-warning, #f59e0b)' }}
                                        title={`Total exceeds approval threshold (${approvalThreshold.toLocaleString()} CFA)`}>
                                        ⚠ Requires Approval
                                    </span>
                                )}
                                <button
                                    type="submit"
                                    disabled={isPending || lines.length === 0}
                                    className="flex items-center justify-center gap-2 px-8 py-2.5 rounded-full font-black uppercase tracking-widest text-[11px] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    style={{
                                        background: needsApproval ? 'var(--app-warning, #f59e0b)' : 'var(--app-primary)',
                                        color: 'white',
                                        boxShadow: needsApproval
                                            ? '0 4px 14px color-mix(in srgb, var(--app-warning, #f59e0b) 40%, transparent)'
                                            : '0 4px 14px color-mix(in srgb, var(--app-primary) 40%, transparent)',
                                    }}>
                                    {isPending ? 'Processing...' : <><ArrowRight size={14} /> {needsApproval ? 'Submit for Approval' : 'Create PO'}</>}
                                </button>
                            </div>
                        );
                    })()}
                </div>
                        </>
                    );
                })()}
            </div>

            {catalogueOpen && (
                <CatalogueModal
                    onSelect={(p) => addProductToLines(p)}
                    onClose={() => setCatalogueOpen(false)}
                    siteId={Number(selectedSiteId) || 0}
                    supplierId={Number(selectedSupplierId) || undefined}
                />
            )}

            {smartFillOpen && selectedSupplierId && (
                <SmartFillModal
                    supplierId={Number(selectedSupplierId)}
                    siteId={Number(selectedSiteId) || 0}
                    warehouseId={Number(selectedWarehouseId) || 0}
                    stockScope={stockScope}
                    existingProductIds={lines.map(l => Number(l.productId))}
                    onAddProducts={(products) => { addProductsBulk(products); setSmartFillOpen(false); }}
                    onClose={() => setSmartFillOpen(false)}
                />
            )}

            {importPoOpen && selectedSupplierId && (
                <ImportFromPOModal
                    supplierId={Number(selectedSupplierId)}
                    existingProductIds={lines.map(l => Number(l.productId))}
                    onImportLines={(poLines) => { importPOLines(poLines); setImportPoOpen(false); }}
                    onClose={() => setImportPoOpen(false)}
                />
            )}

            {/* ═══ Analytics Session Drawer ═══
             * Session-only overrides (stock scope + warehouse) live here.
             * Org-wide config (sales period, lead days, formula) is shown
             * read-only with a link to /settings/purchase-analytics.
             */}
            {analyticsOpen && (
                <>
                    <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setAnalyticsOpen(false)} />
                    <div className="fixed right-0 top-0 bottom-0 w-[360px] z-50 flex flex-col animate-in slide-in-from-right duration-200"
                        style={{ background: 'var(--app-surface)', borderLeft: '1px solid var(--app-border)', backdropFilter: 'blur(20px)' }}>
                        <div className="px-5 py-3.5 flex items-center justify-between flex-shrink-0"
                            style={{ borderBottom: '1px solid var(--app-border)' }}>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ background: 'color-mix(in srgb, var(--app-primary) 12%, transparent)', color: 'var(--app-primary)' }}>
                                    <Settings2 size={13} />
                                </div>
                                <span className="text-[13px] font-black" style={{ color: 'var(--app-foreground)' }}>
                                    Analytics
                                </span>
                            </div>
                            <button type="button" onClick={() => setAnalyticsOpen(false)}
                                className="p-1 rounded-lg transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}>
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            {/* Quick actions — Smart Fill + Import from PO */}
                            <section>
                                <div className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Quick Actions
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                    <button type="button" onClick={() => { setAnalyticsOpen(false); setSmartFillOpen(true); }}
                                        disabled={!selectedSupplierId}
                                        title={selectedSupplierId ? 'Auto-suggest products below reorder point' : 'Pick a supplier first'}
                                        className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                        <Zap size={12} /> Smart Fill
                                    </button>
                                    <button type="button" onClick={() => { setAnalyticsOpen(false); setImportPoOpen(true); }}
                                        disabled={!selectedSupplierId}
                                        title={selectedSupplierId ? 'Import lines from a previous PO' : 'Pick a supplier first'}
                                        className="flex items-center justify-center gap-1.5 text-[11px] font-bold px-2 py-2 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={{ color: 'var(--app-muted-foreground)', border: '1px solid var(--app-border)' }}>
                                        <FileDown size={12} /> Import
                                    </button>
                                </div>
                            </section>

                            {/* Supplier picker — required for Smart Fill + Import */}
                            <section>
                                <div className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Supplier
                                </div>
                                <select value={selectedSupplierId}
                                    onChange={(e) => setSelectedSupplierId(e.target.value ? Number(e.target.value) : '')}
                                    className="w-full text-[12px] font-bold px-2.5 py-2 rounded-lg outline-none"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                    <option value="">— None selected —</option>
                                    {suppliers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name || s.company_name}</option>
                                    ))}
                                </select>
                                {selectedSupplierId ? (
                                    <div className="mt-2">
                                        <SupplierScorecard supplierId={Number(selectedSupplierId)} />
                                    </div>
                                ) : (
                                    <p className="text-[10px] mt-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Required for Smart Fill &amp; Import.
                                    </p>
                                )}
                            </section>

                            {/* Session overrides (this browser only) */}
                            <section>
                                <div className="text-[10px] font-black uppercase tracking-widest mb-2"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    Session — Stock Scope
                                </div>
                                <div className="flex gap-1.5">
                                    {[
                                        { id: 'branch', label: '🏪 Branch' },
                                        { id: 'all', label: '🌐 All' },
                                    ].map(o => (
                                        <button key={o.id} type="button" onClick={() => setStockScope(o.id as any)}
                                            className="flex-1 text-[11px] font-bold px-2 py-2 rounded-lg transition-all"
                                            style={stockScope === o.id ? {
                                                background: 'var(--app-info, #3b82f6)', color: 'white',
                                            } : {
                                                background: 'var(--app-background)', color: 'var(--app-muted-foreground)',
                                                border: '1px solid var(--app-border)',
                                            }}>
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </section>

                            {siteWarehouses.length > 0 && (
                                <section>
                                    <div className="text-[10px] font-black uppercase tracking-widest mb-2"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Session — Primary Warehouse
                                    </div>
                                    <select value={selectedWarehouseId}
                                        onChange={(e) => setSelectedWarehouseId(e.target.value ? Number(e.target.value) : '')}
                                        className="w-full text-[12px] font-bold px-2.5 py-2 rounded-lg outline-none"
                                        style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }}>
                                        <option value="">— Any / site default —</option>
                                        {siteWarehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </section>
                            )}

                            <section>
                                <label className="flex items-center gap-2 text-[12px] font-bold cursor-pointer"
                                    style={{ color: 'var(--app-foreground)' }}>
                                    <input type="checkbox" checked={vatRecoverable}
                                        onChange={(e) => setVatRecoverable(e.target.checked)} />
                                    VAT Recoverable
                                </label>
                            </section>

                            {/* Org-wide config — read-only summary, link to settings page */}
                            <section className="pt-4 mt-2" style={{ borderTop: '1px solid var(--app-border)' }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest"
                                        style={{ color: 'var(--app-muted-foreground)' }}>
                                        Org-Wide Config
                                    </div>
                                    <Link href="/settings/purchase-analytics"
                                        className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all"
                                        style={{ color: 'var(--app-primary)', border: '1px solid color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                                        Configure <ExternalLink size={10} />
                                    </Link>
                                </div>

                                {analyticsConfig ? (
                                    <div className="space-y-2 text-[11px]">
                                        <ConfigRow label="Sales averaging" value={`${analyticsConfig.sales_avg_period_days}d`} />
                                        <ConfigRow label="Window size" value={`${analyticsConfig.sales_window_size_days}d`} />
                                        <ConfigRow label="Best-price lookback" value={`${analyticsConfig.best_price_period_days}d`} />
                                        <ConfigRow label="Proposed qty formula" value={analyticsConfig.proposed_qty_formula === 'AVG_DAILY_x_LEAD_DAYS' ? 'avg daily × lead' : 'monthly × months'} />
                                        <ConfigRow label="Lead time" value={`${analyticsConfig.proposed_qty_lead_days}d`} />
                                        <ConfigRow label="Safety multiplier" value={`×${analyticsConfig.proposed_qty_safety_multiplier}`} />
                                        <ConfigRow label="PO count source" value={analyticsConfig.po_count_source === 'PURCHASE_INVOICE' ? 'Invoices' : 'Orders'} />
                                        <ConfigRow label="Context" value={analyticsConfig.purchase_context} />
                                    </div>
                                ) : (
                                    <div className="text-[10px]" style={{ color: 'var(--app-muted-foreground)' }}>
                                        Loading…
                                    </div>
                                )}
                                <p className="text-[10px] mt-3 leading-snug"
                                    style={{ color: 'var(--app-muted-foreground)' }}>
                                    These values come from <strong>/settings/purchase-analytics</strong> and apply
                                    org-wide (audited, versioned, RBAC'd). Session overrides above only affect
                                    this browser.
                                </p>
                            </section>
                        </div>
                    </div>
                </>
            )}

            <ConfigSidebar
                configOpen={configOpen}
                setConfigOpen={setConfigOpen}
                selectedSiteId={selectedSiteId}
                setSelectedSiteId={(v: number) => setSelectedSiteId(v)}
                selectedWarehouseId={selectedWarehouseId}
                setSelectedWarehouseId={(v: number) => setSelectedWarehouseId(v)}
                selectedSupplierId={selectedSupplierId}
                setSelectedSupplierId={(v: number) => setSelectedSupplierId(v)}
                selectedPaymentTermId={selectedPaymentTermId}
                setSelectedPaymentTermId={(v: number) => setSelectedPaymentTermId(v)}
                selectedDriverId={selectedDriverId}
                setSelectedDriverId={(v: number) => setSelectedDriverId(v)}
                assignedToId={assignedToId}
                setAssignedToId={(v: number) => setAssignedToId(v)}
                availableWarehouses={siteWarehouses}
                safeSites={sites}
                safeSuppliers={suppliers}
                safePaymentTerms={paymentTerms}
                safeDrivers={drivers}
                safeUsers={users}
                docNumberPreview={`${scope === 'OFFICIAL' ? 'PO' : 'INT'}-${new Date().getFullYear()}-NEW`}
                scope={scope}
                setScope={setScope}
                canToggleScope={true}
                notes={notes}
                setNotes={setNotes}
            />

            <CustomizeSidebar
                customizeOpen={customizeOpen}
                setCustomizeOpen={setCustomizeOpen}
                poProfiles={poProfiles}
                setPOProfiles={(v) => { setPOProfiles(v); savePOProfiles(v); }}
                poActiveProfileId={poActiveProfileId}
                setPOActiveProfileId={(v) => { setPOActiveProfileId(v); savePOActiveProfileId(v); }}
                visibleColumns={visibleColumns}
                setVisibleColumns={setVisibleColumns}
                activeProfile={activeProfile}
                visibleColCount={visibleColCount}
            />

            {transferLine && (
                <TransferRequestDialog
                    productId={Number(transferLine.productId)}
                    productName={String(transferLine.productName || '')}
                    currentQty={Number(transferLine.quantity || 1)}
                    otherWarehouses={Array.isArray(transferLine.otherWarehouseStock) ? transferLine.otherWarehouseStock : []}
                    toWarehouseId={Number(selectedWarehouseId) || undefined}
                    toWarehouseName={siteWarehouses.find(w => w.id === Number(selectedWarehouseId))?.name}
                    onClose={() => setTransferLine(null)}
                    onSubmitted={() => setToastMsg('Transfer request queued ✓')}
                />
            )}

            {purchaseRequestLine && (
                <PurchaseRequestDialog
                    productId={Number(purchaseRequestLine.productId)}
                    productName={String(purchaseRequestLine.productName || '')}
                    currentQty={Number(purchaseRequestLine.quantity || 1)}
                    suggestedPrice={Number(purchaseRequestLine.supplierPrice || purchaseRequestLine.unitCostHT || 0)}
                    suppliers={suppliers as any}
                    excludeSupplierId={Number(selectedSupplierId) || undefined}
                    onClose={() => setPurchaseRequestLine(null)}
                    onSubmitted={() => setToastMsg('Purchase request queued ✓')}
                />
            )}

            {/* Tier 3.3 — Mobile bottom sheet for full line detail / edit */}
            {mobileSheetLine && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMobileSheetLine(null)} />
                    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-3xl p-5 pb-8 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
                        style={{ background: 'var(--app-surface)', boxShadow: '0 -12px 40px rgba(0,0,0,0.2)' }}>
                        <div className="w-12 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--app-border)' }} />
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                style={{ background: 'color-mix(in srgb, var(--app-primary) 10%, transparent)', color: 'var(--app-primary)' }}>
                                <Package size={18} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[14px] font-black truncate" style={{ color: 'var(--app-foreground)' }}>
                                    {mobileSheetLine.productName}
                                </div>
                                <div className="text-[10px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>
                                    {mobileSheetLine.sku || '—'}
                                </div>
                            </div>
                            <button type="button" onClick={() => setMobileSheetLine(null)}
                                className="p-1.5 rounded-lg" style={{ color: 'var(--app-muted-foreground)' }}>✕</button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            {[
                                { label: 'Qty', value: mobileSheetLine.quantity },
                                { label: 'Stock', value: mobileSheetLine.stockTotal },
                                { label: 'Daily', value: Math.round(Number(mobileSheetLine.salesMonthly || 0) / 30) },
                                { label: 'Score', value: mobileSheetLine.scoreAdjust },
                                { label: 'Cost', value: Number(mobileSheetLine.unitCostHT).toFixed(2) },
                                { label: 'Supplier', value: Number(mobileSheetLine.supplierPrice).toFixed(2) },
                            ].map(s => (
                                <div key={s.label} className="px-2 py-2 rounded-lg text-center"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                    <div className="text-[8px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{s.label}</div>
                                    <div className="text-[12px] font-black font-mono mt-0.5" style={{ color: 'var(--app-foreground)' }}>{String(s.value)}</div>
                                </div>
                            ))}
                        </div>

                        <div className="mb-3">
                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: 'var(--app-muted-foreground)' }}>
                                Order Quantity
                            </label>
                            <input type="number" value={mobileSheetLine.quantity}
                                onChange={(e) => {
                                    const idx = lines.findIndex((l: any) => l.productId === mobileSheetLine.productId);
                                    if (idx >= 0) updateLine(idx, { quantity: Number(e.target.value), _flash: Date.now() });
                                    setMobileSheetLine({ ...mobileSheetLine, quantity: Number(e.target.value) });
                                }}
                                className="w-full text-[14px] font-black px-3 py-3 rounded-xl outline-none text-center"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-foreground)' }} />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => { setMobileSheetLine(null); setTransferLine(mobileSheetLine); }}
                                className="py-3 rounded-xl text-[11px] font-black uppercase tracking-wider"
                                style={{ color: 'var(--app-info, #3b82f6)', border: '1px solid color-mix(in srgb, var(--app-info, #3b82f6) 30%, transparent)' }}>
                                ⇄ Transfer
                            </button>
                            <button type="button" onClick={() => { setMobileSheetLine(null); setPurchaseRequestLine(mobileSheetLine); }}
                                className="py-3 rounded-xl text-[11px] font-black uppercase tracking-wider"
                                style={{ color: 'var(--app-warning, #f59e0b)', border: '1px solid color-mix(in srgb, var(--app-warning, #f59e0b) 30%, transparent)' }}>
                                📨 Request
                            </button>
                            <button type="button"
                                onClick={() => {
                                    const idx = lines.findIndex((l: any) => l.productId === mobileSheetLine.productId);
                                    if (idx >= 0) removeLine(idx);
                                    setMobileSheetLine(null);
                                }}
                                className="col-span-2 py-3 rounded-xl text-[11px] font-black uppercase tracking-wider"
                                style={{ color: 'var(--app-error, #ef4444)', border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 30%, transparent)' }}>
                                <Trash2 size={13} className="inline mr-1" /> Remove Line
                            </button>
                        </div>
                    </div>
                </>
            )}

            {toastMsg && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full text-[11px] font-bold animate-in fade-in slide-in-from-bottom-2 duration-200"
                    style={{
                        background: 'var(--app-success, #22c55e)', color: 'white',
                        boxShadow: '0 8px 24px color-mix(in srgb, var(--app-success, #22c55e) 40%, transparent)',
                    }}
                    onAnimationEnd={() => setTimeout(() => setToastMsg(null), 2500)}>
                    {toastMsg}
                </div>
            )}

            {/* ═══ Right-Edge Floating Icon Rail ═══
             * Secondary actions — grid/column customize + focus search (Ctrl+K).
             * Sticks to the viewport right edge, vertically centered lower.
             */}
            <div className="fixed right-3 bottom-24 z-30 flex flex-col gap-2 no-print">
                <button type="button" onClick={() => setCustomizeOpen(true)}
                    title="Customize columns"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                    style={{
                        background: 'var(--app-surface)',
                        color: 'var(--app-muted-foreground)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-foreground) 8%, transparent)',
                    }}>
                    <SlidersHorizontal size={14} />
                </button>
                <button type="button" onClick={() => searchRef.current?.focus()}
                    title="Focus search (Ctrl+K)"
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                    style={{
                        background: 'var(--app-surface)',
                        color: 'var(--app-muted-foreground)',
                        border: '1px solid var(--app-border)',
                        boxShadow: '0 2px 8px color-mix(in srgb, var(--app-foreground) 8%, transparent)',
                    }}>
                    <Plus size={14} />
                </button>
            </div>
        </form>
    );
}