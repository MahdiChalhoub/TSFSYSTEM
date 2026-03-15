'use client';

import { useActionState } from 'react';
import { createAttribute, updateAttribute, AttributeState } from '@/app/actions/attributes';
import { X, Save, Loader2, Sparkles, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CategoryTreeSelector } from './CategoryTreeSelector';

type AttributeFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    attribute?: Record<string, any> | null;
    categories: Record<string, any>[];
};

type CategoryNode = {
    id: number;
    name: string;
    parent: number | null;
    children?: CategoryNode[];
    code?: string;
};

function buildCategoryTree(flatCategories: Record<string, any>[]): CategoryNode[] {
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];
    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, { id: cat.id, name: cat.name, parent: cat.parent, code: cat.code, children: [] });
    });
    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parent === null || cat.parent === undefined) { roots.push(node); }
        else { const parent = categoryMap.get(cat.parent); if (parent) parent.children!.push(node); }
    });
    return roots;
}

const initialState: AttributeState = { message: '', errors: {} };

export function AttributeFormModal({ isOpen, onClose, attribute, categories }: AttributeFormModalProps) {
    const [state, formAction] = useActionState(attribute ? updateAttribute.bind(null, attribute.id) : createAttribute, initialState);
    const [pending, setPending] = useState(false);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(
        attribute?.categories?.map((c: Record<string, any>) => c.id) || []
    );

    useEffect(() => {
        if (isOpen) {
            setSelectedCategoryIds(attribute?.categories?.map((c: Record<string, any>) => c.id) || []);
            setPending(false);
        }
    }, [isOpen, attribute]);

    useEffect(() => {
        if (state.message === 'success') { onClose(); setPending(false); }
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
                    style={{ background: 'color-mix(in srgb, var(--app-warning) 6%, var(--app-surface))', borderBottom: '1px solid var(--app-border)' }}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{ background: 'var(--app-warning)', boxShadow: '0 4px 12px color-mix(in srgb, var(--app-warning) 30%, transparent)' }}>
                            <Sparkles size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">{attribute ? 'Edit Attribute' : 'New Attribute'}</h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {attribute ? `Editing "${attribute.name}"` : 'Create a scent, flavor, or variant'}
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
                    onSubmit={() => setPending(true)}
                    className="flex-1 overflow-y-auto custom-scrollbar"
                >
                    <div className="p-5 space-y-4">

                        {state.message && state.message !== 'success' && (
                            <div className="p-3 rounded-xl text-[12px] font-bold"
                                style={{ background: 'color-mix(in srgb, var(--app-error) 8%, transparent)', color: 'var(--app-error)', border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)' }}>
                                {state.message}
                            </div>
                        )}

                        {/* Name + Code */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                    <Sparkles size={9} /> Attribute Name
                                </label>
                                <input
                                    name="name"
                                    defaultValue={attribute?.name || ''}
                                    placeholder="e.g. Vanilla"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                    required
                                />
                                {state.errors?.name && <p className="text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest">Short Code</label>
                                <input
                                    name="shortName"
                                    defaultValue={attribute?.short_name || ''}
                                    placeholder="e.g. VAN"
                                    className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono font-medium text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                    style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                                />
                            </div>
                        </div>

                        {/* Category Selection */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1">
                                <Tag size={9} /> Linked Categories
                            </label>

                            <CategoryTreeSelector
                                categories={buildCategoryTree(categories)}
                                selectedIds={selectedCategoryIds}
                                onChange={setSelectedCategoryIds}
                                maxHeight="max-h-56"
                            />

                            {selectedCategoryIds.map(id => (
                                <input key={id} type="hidden" name="categoryIds" value={id} />
                            ))}

                            <p className="text-[10px] text-app-muted-foreground">
                                Leave empty to make this attribute <strong>universal</strong> (available for ALL categories).
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
                            <span>Save Attribute</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}