// @ts-nocheck
'use client';

import { useActionState } from 'react';
import { createBrand, updateBrand, BrandState } from '@/app/actions/inventory/brands';
import { X, Save, Loader2, Globe, Paintbrush, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryTreeSelector } from './CategoryTreeSelector';

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
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parentId: cat.parent,
            code: cat.code,
            children: []
        });
    });

    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parent === null || cat.parent === undefined) {
            roots.push(node);
        } else {
            const parent = categoryMap.get(cat.parent);
            if (parent) parent.children!.push(node);
        }
    });

    return roots;
}

const initialState: BrandState = { message: '', errors: {} };

export function BrandFormModal({ isOpen, onClose, brand, countries, categories }: BrandFormModalProps) {
    const [state, formAction] = useActionState(brand ? updateBrand.bind(null, brand.id) : createBrand, initialState);
    const [pending, setPending] = useState(false);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
        brand?.categories?.map((c: Record<string, any>) => c.id) || []
    );

    useEffect(() => {
        if (isOpen) {
            setSelectedCategoryIds(brand?.categories?.map((c: Record<string, any>) => c.id) || []);
            setPending(false);
        }
    }, [isOpen, brand]);

    useEffect(() => {
        if (state.message === 'success') {
            onClose();
            setPending(false);
        }
    }, [state.message, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)' }}>
                            <Paintbrush size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">{brand ? 'Edit Brand' : 'New Brand'}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {brand ? `Editing "${brand.name}"` : 'Create a new product brand'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <form
                    action={formAction}
                    className="flex-1 overflow-y-auto custom-scrollbar"
                    onSubmit={() => setPending(true)}
                >
                    <div className="p-5 space-y-4">

                        {state.message && state.message !== 'success' && (
                            <div className="p-3 rounded-xl text-[12px] font-bold"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                                {state.message}
                            </div>
                        )}

                        {/* Name + Short Name */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    <Paintbrush size={10} /> Brand Name
                                </label>
                                <input
                                    name="name"
                                    defaultValue={brand?.name || ''}
                                    placeholder="e.g. Nestle"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">
                                    Short Name
                                </label>
                                <input
                                    name="shortName"
                                    defaultValue={brand?.short_name || ''}
                                    placeholder="e.g. NES"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                />
                            </div>
                        </div>

                        {/* Countries */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Globe size={10} /> Operating Countries
                            </label>
                            <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl max-h-32 overflow-y-auto custom-scrollbar"
                                style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}>
                                {countries.map(c => {
                                    const isChecked = brand?.countries?.some((bc: Record<string, any>) => bc.id === c.id);
                                    return (
                                        <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-app-surface p-1 rounded-lg transition-colors">
                                            <input
                                                type="checkbox"
                                                name="countryIds"
                                                value={c.id}
                                                defaultChecked={isChecked}
                                                className="w-3.5 h-3.5 rounded focus:ring-app-primary accent-[var(--app-primary)]"
                                            />
                                            <span className="text-[11px] font-medium text-app-foreground">{c.name} ({c.code})</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Categories */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Tag size={10} /> Linked Categories
                            </label>

                            <CategoryTreeSelector
                                categories={buildCategoryTree(categories)}
                                selectedIds={selectedCategoryIds}
                                onChange={setSelectedCategoryIds}
                                maxHeight="max-h-44"
                            />

                            {selectedCategoryIds.map(id => (
                                <input key={id} type="hidden" name="categoryIds" value={id} />
                            ))}

                            <p className="text-[10px] text-app-muted-foreground">
                                Leave empty for a <strong>universal</strong> brand across all categories.
                            </p>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 pt-0 flex gap-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)', color: 'var(--app-muted-foreground)' }}>
                            Cancel
                        </button>
                        <button type="submit" disabled={pending}
                            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            style={{ background: 'var(--app-primary)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 25%, transparent)' }}>
                            {pending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            <span>Save Brand</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}