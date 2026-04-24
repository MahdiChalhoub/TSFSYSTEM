'use client';

import { useActionState } from 'react';
import { createCategory, updateCategory, CategoryState } from '@/app/actions/categories';
import { X, Save, Loader2, FolderTree, AlertCircle, Hash, Tag, ChevronRight } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { CategoryCascader } from './CategoryCascader';
import { peekNextCode } from '@/lib/sequences-client';
import { LockableCodeInput } from '@/components/admin/_shared/LockableCodeInput';

type CategoryFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    category?: Record<string, any>;
    parentId?: number | null;
    potentialParents?: Record<string, any>[];
};

const initialState: CategoryState = { message: '', errors: {} };

export function CategoryFormModal({ isOpen, onClose, category, parentId, potentialParents = [] }: CategoryFormModalProps) {
    const [state, formAction] = useActionState(category ? updateCategory.bind(null, category.id) : createCategory, initialState);
    const [pending, setPending] = useState(false);

    const getDescendants = (id: number, allCats: Record<string, any>[]) => {
        const descendants = new Set<number>();
        const stack = [id];
        while (stack.length > 0) {
            const current = stack.pop()!;
            const children = allCats.filter(c => c.parent === current);
            children.forEach(c => { descendants.add(c.id); stack.push(c.id); });
        }
        return descendants;
    };

    const descendants = useMemo(() => {
        if (!category) return new Set();
        return getDescendants(category.id, potentialParents);
    }, [category, potentialParents]);

    const availableParents = useMemo(() => {
        return potentialParents.filter(p => (!category || p.id !== category.id) && !descendants.has(p.id));
    }, [potentialParents, category, descendants]);

    const [isSubCategory, setIsSubCategory] = useState(!!parentId || (category && !!category.parent));
    const [selectedParent, setSelectedParent] = useState<number | string>(parentId || category?.parent || '');
    // Pre-filled code from /settings/sequences (peek only — sequence is
    // consumed server-side on save). Empty while creating an existing
    // category or until the first fetch resolves.
    const [suggestedCode, setSuggestedCode] = useState<string>('');

    useEffect(() => { if (state.message === 'success') onClose(); }, [state, onClose]);

    useEffect(() => {
        if (isOpen) {
            setIsSubCategory(!!parentId || (category && !!category.parent));
            setSelectedParent(parentId || category?.parent || '');
            if (!category) {
                // New record — peek next code from sequence so the Code input is pre-filled.
                peekNextCode('CATEGORY').then(setSuggestedCode).catch(() => setSuggestedCode(''));
            } else {
                setSuggestedCode('');
            }
        }
    }, [isOpen, parentId, category]);

    if (!isOpen) return null;

    const parentName = selectedParent ? potentialParents.find(p => p.id == selectedParent)?.name : null;
    const parentCode = selectedParent ? potentialParents.find(p => p.id == selectedParent)?.code : null;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col"
                style={{ background: 'var(--app-surface)', border: '1px solid var(--app-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
            >
                {/* ── Modal Header — matches design-language §11 ── */}
                <div
                    className="px-5 py-3 flex items-center justify-between flex-shrink-0"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center gap-2.5">
                        <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <FolderTree size={15} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground">
                                {category ? 'Edit Category' : 'Create Category'}
                            </h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground">
                                {category ? `Editing #${category.id}` : 'Product Taxonomy'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Form Body ── */}
                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }}
                    className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                    {/* Error */}
                    {state.message && state.message !== 'success' && (
                        <div
                            className="p-3 rounded-xl flex items-center gap-2 text-[12px] font-bold animate-in slide-in-from-top-1 duration-200"
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

                    {/* Category Type Toggle */}
                    {!parentId && (
                        <div
                            className="flex p-1 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-background) 60%, transparent)', border: '1px solid var(--app-border)' }}
                        >
                            <button
                                type="button"
                                onClick={() => setIsSubCategory(false)}
                                className="flex-1 py-2 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                style={!isSubCategory ? {
                                    background: 'var(--app-surface)',
                                    color: 'var(--app-primary)',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                } : {
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                <FolderTree size={13} />
                                Root Category
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSubCategory(true)}
                                className="flex-1 py-2 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                style={isSubCategory ? {
                                    background: 'var(--app-surface)',
                                    color: 'var(--app-primary)',
                                    boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 10%, transparent)',
                                } : {
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                <ChevronRight size={13} />
                                Sub-Category
                            </button>
                        </div>
                    )}

                    {/* Parent Selector */}
                    {isSubCategory && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-1.5">
                            <label className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground block">Parent Category</label>
                            <CategoryCascader
                                allCategories={availableParents as any}
                                selectedId={typeof selectedParent === 'number' ? selectedParent : parseInt(selectedParent as string) || null}
                                onSelect={(id) => setSelectedParent(id || '')}
                                excludeId={category?.id}
                            />
                            <input type="hidden" name="parentId" value={selectedParent} />
                            {parentName && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: 'var(--app-success)' }}>
                                    <ChevronRight size={10} />
                                    Nesting under &ldquo;{parentName}&rdquo;
                                    {parentCode && <span className="font-mono opacity-60">({parentCode})</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Name + Short Name — §12 inline form */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">
                                <Tag size={9} className="inline mr-1" />Category Name
                            </label>
                            <input
                                name="name"
                                defaultValue={category?.name || ''}
                                placeholder="e.g. Beverages"
                                required
                                className="w-full text-[12px] font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid var(--app-border)',
                                }}
                            />
                            {state.errors?.name && <p className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>}
                        </div>

                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">Short Name</label>
                            <input
                                name="shortName"
                                defaultValue={category?.short_name || ''}
                                placeholder="e.g. BEV"
                                className="w-full text-[12px] font-bold px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid var(--app-border)',
                                }}
                            />
                        </div>
                    </div>

                    {/* Code */}
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-app-muted-foreground mb-1 block">
                            <Hash size={9} className="inline mr-1" />Code (Unique)
                        </label>
                        <LockableCodeInput
                            name="code"
                            defaultValue={category?.code}
                            suggestedValue={suggestedCode}
                            isEdit={!!category}
                            placeholder="e.g. 1001 or CAT-BEV"
                            mono
                            className="w-full text-[12px] px-3 py-2.5 rounded-xl text-app-foreground placeholder:text-app-muted-foreground outline-none transition-all"
                            style={{ background: 'var(--app-background)', border: '1px solid var(--app-border)' }}
                        />
                        <p className="text-[10px] font-bold text-app-muted-foreground mt-1">
                            Used for barcode generation and internal reference.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all"
                            style={{
                                color: 'var(--app-muted-foreground)',
                                border: '1px solid var(--app-border)',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={pending}
                            className="flex-1 py-2.5 rounded-xl text-[11px] font-bold bg-app-primary text-white transition-all flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50"
                            style={{
                                boxShadow: '0 2px 8px color-mix(in srgb, var(--app-primary) 25%, transparent)',
                            }}
                        >
                            {pending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                            {category ? 'Update' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}