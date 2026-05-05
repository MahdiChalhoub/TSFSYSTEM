'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
    Package, Plus, Pencil, Trash2, Save, X, Barcode,
    Weight, Ruler, Star, ShoppingCart, Check, AlertTriangle, Loader2
} from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';

// ─── Types ──────────────────────────────────────────────────────
interface PackagingLevel {
    id: number;
    name: string | null;
    display_name: string;
    sku: string | null;
    barcode: string | null;
    unit: number | null;
    unit_name: string | null;
    level: number;
    ratio: number;
    custom_selling_price: number | null;
    custom_selling_price_ht: number | null;
    price_mode: 'FORMULA' | 'FIXED';
    discount_pct: number;
    purchase_price_ht: number;
    purchase_price_ttc: number;
    weight_kg: number | null;
    length_cm: number | null;
    width_cm: number | null;
    height_cm: number | null;
    is_default_purchase: boolean;
    is_default_sale: boolean;
    is_active: boolean;
    effective_selling_price: number;
    effective_selling_price_ht: number;
    effective_purchase_price: number;
    unit_selling_price: number;
}

interface UnitTreeItem {
    id: number;
    name: string;
    code: string;
    depth: number;
    base_unit: number | null;
    conversion_factor: number;
}

interface Props {
    productId: string | number;
    productName?: string;
    basePriceTTC?: number;
    basePriceHT?: number;
    productUnitId?: number | null;
}

const EMPTY_FORM: Partial<PackagingLevel> = {
    name: '',
    sku: '',
    barcode: '',
    unit: null,
    ratio: 1,
    level: 1,
    price_mode: 'FORMULA',
    discount_pct: 0,
    custom_selling_price: null,
    custom_selling_price_ht: null,
    purchase_price_ht: 0,
    purchase_price_ttc: 0,
    weight_kg: null,
    length_cm: null,
    width_cm: null,
    height_cm: null,
    is_default_sale: false,
    is_default_purchase: false,
    is_active: true,
};

// ─── Main Component ─────────────────────────────────────────────
export default function ProductPackagingTab({ productId, productName, basePriceTTC, basePriceHT, productUnitId }: Props) {
    const [packages, setPackages] = useState<PackagingLevel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState<Partial<PackagingLevel>>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [unitTree, setUnitTree] = useState<UnitTreeItem[]>([]);

    // ── Load packaging levels ──
    const loadPackages = useCallback(async () => {
        try {
            setLoading(true);
            const data = await erpFetch(`inventory/products/${productId}/packaging/`);
            setPackages(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Failed to load packaging:', e);
            setPackages([]);
        } finally {
            setLoading(false);
        }
    }, [productId]);

    useEffect(() => { loadPackages(); }, [loadPackages]);

    // ── Load unit family tree ──
    useEffect(() => {
        if (!productUnitId) return;
        (async () => {
            try {
                const tree = await erpFetch(`inventory/units/family_tree/?unit_id=${productUnitId}`);
                setUnitTree(Array.isArray(tree) ? tree : []);
            } catch (e) {
                console.error('Failed to load unit tree:', e);
            }
        })();
    }, [productUnitId]);

    // ── Toast helper ──
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    // ── Create ──
    const handleCreate = async () => {
        if (!form.unit && unitTree.length > 0) { setError('Please select a unit type'); return; }
        if (!form.ratio || form.ratio <= 0) { setError('Qty in base unit must be positive'); return; }
        setError(null);
        setSaving(true);
        try {
            await erpFetch(`inventory/products/${productId}/packaging/create/`, {
                method: 'POST',
                body: JSON.stringify({
                    name: form.name || null,
                    sku: form.sku || null,
                    barcode: form.barcode || null,
                    unit: form.unit || null,
                    ratio: form.ratio,
                    level: form.level || 1,
                    price_mode: form.price_mode,
                    discount_pct: form.discount_pct || 0,
                    custom_selling_price: form.price_mode === 'FIXED' ? form.custom_selling_price : null,
                    custom_selling_price_ht: form.price_mode === 'FIXED' ? form.custom_selling_price_ht : null,
                    purchase_price_ht: form.purchase_price_ht || 0,
                    purchase_price_ttc: form.purchase_price_ttc || 0,
                    weight_kg: form.weight_kg || null,
                    length_cm: form.length_cm || null,
                    width_cm: form.width_cm || null,
                    height_cm: form.height_cm || null,
                    is_default_sale: form.is_default_sale || false,
                    is_default_purchase: form.is_default_purchase || false,
                    is_active: form.is_active !== false,
                }),
            });
            showToast('Package created', 'success');
            setShowCreate(false);
            setForm(EMPTY_FORM);
            await loadPackages();
        } catch (e: any) {
            showToast(e.message || 'Failed to create', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Update ──
    const handleUpdate = async () => {
        if (!editingId) return;
        if (!form.unit && unitTree.length > 0) { setError('Please select a unit type'); return; }
        if (!form.ratio || form.ratio <= 0) { setError('Qty in base unit must be positive'); return; }
        setError(null);
        setSaving(true);
        try {
            await erpFetch(`inventory/products/${productId}/packaging/${editingId}/`, {
                method: 'PATCH',
                body: JSON.stringify({
                    name: form.name || null,
                    sku: form.sku || null,
                    barcode: form.barcode || null,
                    unit: form.unit || null,
                    ratio: form.ratio,
                    level: form.level,
                    price_mode: form.price_mode,
                    discount_pct: form.discount_pct || 0,
                    custom_selling_price: form.price_mode === 'FIXED' ? form.custom_selling_price : null,
                    custom_selling_price_ht: form.price_mode === 'FIXED' ? form.custom_selling_price_ht : null,
                    purchase_price_ht: form.purchase_price_ht || 0,
                    purchase_price_ttc: form.purchase_price_ttc || 0,
                    weight_kg: form.weight_kg || null,
                    length_cm: form.length_cm || null,
                    width_cm: form.width_cm || null,
                    height_cm: form.height_cm || null,
                    is_default_sale: form.is_default_sale || false,
                    is_default_purchase: form.is_default_purchase || false,
                    is_active: form.is_active !== false,
                }),
            });
            showToast('Package updated', 'success');
            setEditingId(null);
            setForm(EMPTY_FORM);
            await loadPackages();
        } catch (e: any) {
            showToast(e.message || 'Failed to update', 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ──
    const handleDelete = async (pkg: PackagingLevel) => {
        if (!confirm(`Delete "${pkg.display_name}"? This cannot be undone.`)) return;
        try {
            await erpFetch(`inventory/products/${productId}/packaging/${pkg.id}/delete/`, {
                method: 'DELETE',
            });
            showToast('Package deleted', 'success');
            await loadPackages();
        } catch (e: any) {
            showToast(e.message || 'Failed to delete', 'error');
        }
    };

    // ── Start editing ──
    const startEdit = (pkg: PackagingLevel) => {
        setEditingId(pkg.id);
        setShowCreate(false);
        setForm({
            name: pkg.name || '',
            sku: pkg.sku || '',
            barcode: pkg.barcode || '',
            unit: pkg.unit,
            ratio: pkg.ratio,
            level: pkg.level,
            price_mode: pkg.price_mode,
            discount_pct: pkg.discount_pct,
            custom_selling_price: pkg.custom_selling_price,
            custom_selling_price_ht: pkg.custom_selling_price_ht,
            purchase_price_ht: pkg.purchase_price_ht,
            purchase_price_ttc: pkg.purchase_price_ttc,
            weight_kg: pkg.weight_kg,
            length_cm: pkg.length_cm,
            width_cm: pkg.width_cm,
            height_cm: pkg.height_cm,
            is_default_sale: pkg.is_default_sale,
            is_default_purchase: pkg.is_default_purchase,
            is_active: pkg.is_active,
        });
        setError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setShowCreate(false);
        setForm(EMPTY_FORM);
        setError(null);
    };

    // ── Render ────────────────────────────────────────────────────
    const fmtPrice = (v: number | null | undefined) =>
        v != null ? Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

    return (
        <div className="space-y-4">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right-5 ${toast.type === 'success'
                    ? 'bg-app-success/90 text-white backdrop-blur'
                    : 'bg-app-error/90 text-white backdrop-blur'
                    }`}>
                    {toast.type === 'success' ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    {toast.message}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-violet-400" />
                    </div>
                    <div>
                        <h3>Packaging Levels</h3>
                        <p className="text-xs text-app-muted-foreground">{packages.length} package{packages.length !== 1 ? 's' : ''} configured</p>
                    </div>
                </div>
                {!showCreate && !editingId && (
                    <button
                        onClick={() => { setShowCreate(true); setForm(EMPTY_FORM); setError(null); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
              bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold
              hover:from-violet-500 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/20"
                    >
                        <Plus className="h-4 w-4" /> Add Package
                    </button>
                )}
            </div>

            {/* Create / Edit Form */}
            {(showCreate || editingId) && (
                <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-5 space-y-4">
                    <h4 className="font-bold text-app-foreground">
                        {showCreate ? '✦ New Package' : '✏️ Edit Package'}
                    </h4>

                    {error && (
                        <div className="flex items-center gap-2 p-3 rounded-xl bg-app-error/10 border border-app-error/30 text-red-400 text-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
                        </div>
                    )}

                    {/* Row 1: Unit Type, Name, SKU, Barcode */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                <Package className="inline h-3 w-3 mr-1" />Unit Type *
                            </label>
                            <select
                                value={form.unit ?? ''}
                                onChange={e => {
                                    const unitId = e.target.value ? parseInt(e.target.value) : null;
                                    const selected = unitTree.find(u => u.id === unitId);
                                    setForm(f => ({
                                        ...f,
                                        unit: unitId,
                                        level: selected?.depth ?? f.level,
                                        // Auto-suggest ratio from unit conversion factor
                                        ratio: selected?.conversion_factor && selected.conversion_factor > 1
                                            ? selected.conversion_factor
                                            : f.ratio,
                                    }));
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            >
                                <option value="">Select unit...</option>
                                {unitTree
                                    .filter(u => u.depth > 0) // Exclude base unit (depth 0)
                                    .map(u => (
                                        <option key={u.id} value={u.id}>
                                            {'—'.repeat(u.depth - 1)} {u.name} ({u.code}) · L{u.depth}
                                        </option>
                                    ))
                                }
                            </select>
                            {form.unit && (
                                <p className="text-[10px] mt-0.5 font-medium" style={{ color: 'var(--app-info)' }}>
                                    Level {unitTree.find(u => u.id === form.unit)?.depth ?? '?'} in unit tree
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">Package Name</label>
                            <input
                                value={form.name || ''}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="Auto from unit if empty"
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">SKU / Reference</label>
                            <input
                                value={form.sku || ''}
                                onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                                placeholder="PKG-CARTON-24"
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                <Barcode className="inline h-3 w-3 mr-1" />Barcode
                            </label>
                            <input
                                value={form.barcode || ''}
                                onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                                placeholder="6001234000002"
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                    </div>

                    {/* Row 2: Ratio, Price Mode */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">Qty in Base Unit *</label>
                            <input
                                type="number"
                                min="0.0001"
                                step="0.0001"
                                value={form.ratio ?? ''}
                                onChange={e => setForm(f => ({ ...f, ratio: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                        <div className="flex items-end pb-0.5">
                            <p className="text-xs text-app-muted-foreground">
                                {form.ratio && form.ratio > 0 ? `This package contains ${form.ratio}× of the base unit` : ''}
                            </p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">Selling Price Mode</label>
                            <select
                                value={form.price_mode || 'FORMULA'}
                                onChange={e => setForm(f => ({ ...f, price_mode: e.target.value as 'FORMULA' | 'FIXED' }))}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            >
                                <option value="FORMULA">Formula (auto)</option>
                                <option value="FIXED">Fixed (manual)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                {form.price_mode === 'FORMULA' ? 'Discount %' : 'Sell Price (TTC)'}
                            </label>
                            {form.price_mode === 'FORMULA' ? (
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={form.discount_pct ?? 0}
                                    onChange={e => setForm(f => ({ ...f, discount_pct: parseFloat(e.target.value) || 0 }))}
                                    className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                                />
                            ) : (
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={form.custom_selling_price ?? ''}
                                    onChange={e => setForm(f => ({ ...f, custom_selling_price: parseFloat(e.target.value) || null }))}
                                    className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                                />
                            )}
                        </div>
                    </div>

                    {/* Row 3: Purchase Prices */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                <ShoppingCart className="inline h-3 w-3 mr-1" />Purchase Price HT
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.purchase_price_ht ?? ''}
                                onChange={e => setForm(f => ({ ...f, purchase_price_ht: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                            <p className="text-[10px] text-app-muted-foreground mt-0.5">Default only — PO line is the real cost</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">Purchase Price TTC</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.purchase_price_ttc ?? ''}
                                onChange={e => setForm(f => ({ ...f, purchase_price_ttc: parseFloat(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                <Weight className="inline h-3 w-3 mr-1" />Weight (kg)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.001"
                                value={form.weight_kg ?? ''}
                                onChange={e => setForm(f => ({ ...f, weight_kg: parseFloat(e.target.value) || null }))}
                                className="w-full px-3 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-app-muted-foreground block mb-1">
                                <Ruler className="inline h-3 w-3 mr-1" />Dimensions (L×W×H cm)
                            </label>
                            <div className="flex gap-1">
                                <input
                                    type="number" min="0" step="0.1" placeholder="L"
                                    value={form.length_cm ?? ''}
                                    onChange={e => setForm(f => ({ ...f, length_cm: parseFloat(e.target.value) || null }))}
                                    className="w-1/3 px-2 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                                />
                                <input
                                    type="number" min="0" step="0.1" placeholder="W"
                                    value={form.width_cm ?? ''}
                                    onChange={e => setForm(f => ({ ...f, width_cm: parseFloat(e.target.value) || null }))}
                                    className="w-1/3 px-2 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                                />
                                <input
                                    type="number" min="0" step="0.1" placeholder="H"
                                    value={form.height_cm ?? ''}
                                    onChange={e => setForm(f => ({ ...f, height_cm: parseFloat(e.target.value) || null }))}
                                    className="w-1/3 px-2 py-2 rounded-lg border border-app-border bg-app-surface text-app-foreground text-sm text-center focus:ring-2 focus:ring-violet-500/40 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Row 4: Flags */}
                    <div className="flex flex-wrap gap-6">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-app-foreground">
                            <input
                                type="checkbox"
                                checked={form.is_default_sale || false}
                                onChange={e => setForm(f => ({ ...f, is_default_sale: e.target.checked }))}
                                className="rounded border-app-border text-violet-500 focus:ring-violet-500"
                            />
                            <Star className="h-3.5 w-3.5 text-amber-400" /> Default Sale Package
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-app-foreground">
                            <input
                                type="checkbox"
                                checked={form.is_default_purchase || false}
                                onChange={e => setForm(f => ({ ...f, is_default_purchase: e.target.checked }))}
                                className="rounded border-app-border text-violet-500 focus:ring-violet-500"
                            />
                            <ShoppingCart className="h-3.5 w-3.5 text-blue-400" /> Default Purchase Package
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-app-foreground">
                            <input
                                type="checkbox"
                                checked={form.is_active !== false}
                                onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                                className="rounded border-app-border text-violet-500 focus:ring-violet-500"
                            />
                            Active
                        </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            onClick={cancelEdit}
                            className="px-4 py-2 rounded-lg border border-app-border text-sm text-app-foreground hover:bg-app-surface-hover transition"
                        >
                            <X className="inline h-3.5 w-3.5 mr-1" />Cancel
                        </button>
                        <button
                            onClick={showCreate ? handleCreate : handleUpdate}
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg
                bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold
                hover:from-violet-500 hover:to-purple-500 transition-all disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {showCreate ? 'Create' : 'Save'}
                        </button>
                    </div>
                </div>
            )}

            {/* Package List */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                </div>
            ) : packages.length === 0 && !showCreate ? (
                <div className="text-center py-12 rounded-2xl border border-dashed border-app-border">
                    <Package className="h-12 w-12 mx-auto text-app-muted-foreground mb-3 opacity-40" />
                    <p className="text-app-muted-foreground text-sm">No packaging levels configured</p>
                    <p className="text-app-muted-foreground text-xs mt-1">Add packages like &ldquo;Pack of 6&rdquo; or &ldquo;Carton of 24&rdquo;</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {packages.map(pkg => (
                        <div
                            key={pkg.id}
                            className={`group rounded-xl border p-4 transition-all ${!pkg.is_active
                                ? 'border-app-border/50 opacity-60'
                                : editingId === pkg.id
                                    ? 'border-violet-500/50 bg-violet-500/5'
                                    : 'border-app-border hover:border-violet-500/30 theme-surface'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                {/* Left: Identity */}
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500/15 to-purple-500/15 flex items-center justify-center shrink-0">
                                        <span className="text-sm font-black text-violet-400">×{pkg.ratio}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-app-foreground text-sm truncate">{pkg.display_name}</span>
                                            {pkg.is_default_sale && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-app-warning/15 text-amber-400 border border-app-warning/20">
                                                    SALE
                                                </span>
                                            )}
                                            {pkg.is_default_purchase && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-app-info/15 text-blue-400 border border-app-info/20">
                                                    BUY
                                                </span>
                                            )}
                                            {!pkg.is_active && (
                                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-app-error/15 text-red-400 border border-app-error/20">
                                                    INACTIVE
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-app-muted-foreground mt-0.5">
                                            {pkg.sku && <span>SKU: {pkg.sku}</span>}
                                            {pkg.barcode && <span><Barcode className="inline h-3 w-3" /> {pkg.barcode}</span>}
                                            {pkg.weight_kg && <span><Weight className="inline h-3 w-3" /> {pkg.weight_kg}kg</span>}
                                            <span className="uppercase text-[10px] opacity-70">{pkg.price_mode}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Center: Pricing */}
                                <div className="hidden md:flex items-center gap-6 text-sm">
                                    <div className="text-right">
                                        <div className="text-xs text-app-muted-foreground">Sell TTC</div>
                                        <div className="font-bold text-emerald-400">{fmtPrice(pkg.effective_selling_price)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-app-muted-foreground">Sell HT</div>
                                        <div className="font-semibold text-app-foreground">{fmtPrice(pkg.effective_selling_price_ht)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-app-muted-foreground">Buy HT</div>
                                        <div className="font-semibold text-blue-400">{fmtPrice(pkg.purchase_price_ht)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-app-muted-foreground">Per unit</div>
                                        <div className="font-medium text-app-muted-foreground">{fmtPrice(pkg.unit_selling_price)}</div>
                                    </div>
                                </div>

                                {/* Right: Actions */}
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => startEdit(pkg)}
                                        className="p-2 rounded-lg hover:bg-violet-500/10 text-violet-400 transition"
                                        title="Edit"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(pkg)}
                                        className="p-2 rounded-lg hover:bg-app-error/10 text-red-400 transition"
                                        title="Delete"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
