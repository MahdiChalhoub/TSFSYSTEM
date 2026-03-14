// @ts-nocheck
'use client';

import { useActionState } from 'react';
import { createCategory, updateCategory, CategoryState } from '@/app/actions/inventory/categories';
import { X, Save, Loader2, FolderTree, AlertCircle, ChevronRight, Bookmark, Hash, Tag, Type } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
type CategoryFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    category?: Record<string, any>;
    parentId?: number | null;
    potentialParents?: Record<string, any>[];
};

const initialState: CategoryState = { message: '', errors: {} };

/* ═══════════════════════════════════════════════════════════
 *  CATEGORY FORM MODAL
 * ═══════════════════════════════════════════════════════════ */
export function CategoryFormModal({ isOpen, onClose, category, parentId, potentialParents = [] }: CategoryFormModalProps) {
    const [state, formAction] = useActionState(category ? updateCategory.bind(null, category.id) : createCategory, initialState);
    const [pending, setPending] = useState(false);

    /* ── Filter parents to avoid circular loops ── */
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
        return potentialParents.filter(p =>
            (!category || p.id !== category.id) &&
            !descendants.has(p.id)
        );
    }, [potentialParents, category, descendants]);

    const [isSubCategory, setIsSubCategory] = useState(!!parentId || (category && !!category.parent));
    const [selectedParent, setSelectedParent] = useState<number | string>(parentId || category?.parent || '');

    useEffect(() => { if (state.message === 'success') onClose(); }, [state, onClose]);

    useEffect(() => {
        if (isOpen) {
            setIsSubCategory(!!parentId || (category && !!category.parent));
            setSelectedParent(parentId || category?.parent || '');
        }
    }, [isOpen, parentId, category]);

    if (!isOpen) return null;

    const isEditing = !!category;
    const parentCat = selectedParent ? potentialParents.find(p => p.id == selectedParent) : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                style={{
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, var(--app-border) 50%, transparent)',
                }}
            >
                {/* ── Header ── */}
                <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{
                        background: 'color-mix(in srgb, var(--app-primary) 6%, var(--app-surface))',
                        borderBottom: '1px solid var(--app-border)',
                    }}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 12px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            <FolderTree size={17} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-app-foreground tracking-tight">
                                {isEditing ? 'Edit Category' : 'New Category'}
                            </h3>
                            <p className="text-[10px] font-bold text-app-muted-foreground uppercase tracking-widest">
                                {isEditing ? `ID #${category.id}` : isSubCategory ? 'Sub-Category' : 'Root Category'}
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

                <form
                    action={(formData) => { setPending(true); formAction(formData); setPending(false); }}
                    className="p-6 space-y-5"
                >
                    {/* ── Error Banner ── */}
                    {state.message && state.message !== 'success' && (
                        <div
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[12px] font-bold animate-in slide-in-from-top-1 duration-200"
                            style={{
                                background: 'color-mix(in srgb, var(--app-error) 8%, transparent)',
                                border: '1px solid color-mix(in srgb, var(--app-error) 20%, transparent)',
                                color: 'var(--app-error)',
                            }}
                        >
                            <AlertCircle size={14} className="flex-shrink-0" />
                            {state.message}
                        </div>
                    )}

                    {/* ── Type Toggle (Main / Sub) ── */}
                    {!parentId && (
                        <div
                            className="flex p-1 rounded-xl"
                            style={{ background: 'color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                        >
                            <button
                                type="button"
                                onClick={() => { setIsSubCategory(false); setSelectedParent(''); }}
                                className="flex-1 py-2.5 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                style={!isSubCategory ? {
                                    background: 'var(--app-surface)',
                                    color: 'var(--app-primary)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                } : {
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                <Bookmark size={13} />
                                Root Category
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsSubCategory(true)}
                                className="flex-1 py-2.5 text-[12px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5"
                                style={isSubCategory ? {
                                    background: 'var(--app-surface)',
                                    color: 'var(--app-primary)',
                                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                                } : {
                                    color: 'var(--app-muted-foreground)',
                                }}
                            >
                                <ChevronRight size={13} />
                                Sub-Category
                            </button>
                        </div>
                    )}

                    {/* ── Parent Selector ── */}
                    {isSubCategory && (
                        <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <FolderTree size={10} />
                                Parent Category
                            </label>
                            <select
                                value={selectedParent}
                                onChange={e => setSelectedParent(e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none transition-all"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                            >
                                <option value="">Select parent...</option>
                                {availableParents.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.code ? `${p.code} — ` : ''}{p.full_path || p.name}
                                    </option>
                                ))}
                            </select>
                            <input type="hidden" name="parentId" value={selectedParent} />
                            {parentCat && (
                                <div
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-bold"
                                    style={{
                                        background: 'color-mix(in srgb, var(--app-primary) 6%, transparent)',
                                        color: 'var(--app-primary)',
                                        border: '1px solid color-mix(in srgb, var(--app-primary) 15%, transparent)',
                                    }}
                                >
                                    <ChevronRight size={10} />
                                    Will be created under: <strong>{parentCat.name}</strong>
                                    {parentCat.code && <span className="font-mono opacity-70">({parentCat.code})</span>}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Name + Short Name ── */}
                    <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-3 space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Type size={10} />
                                Category Name *
                            </label>
                            <input
                                name="name"
                                defaultValue={category?.name || ''}
                                placeholder="e.g. Beverages"
                                required
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-medium outline-none transition-all"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                            />
                            {state.errors?.name && (
                                <p className="text-[10px] font-bold" style={{ color: 'var(--app-error)' }}>{state.errors.name[0]}</p>
                            )}
                        </div>

                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                                <Tag size={10} />
                                Short Name
                            </label>
                            <input
                                name="shortName"
                                defaultValue={category?.short_name || ''}
                                placeholder="e.g. BEV"
                                className="w-full px-3 py-2.5 rounded-xl text-[13px] font-bold uppercase outline-none transition-all"
                                style={{
                                    background: 'var(--app-background)',
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                            />
                        </div>
                    </div>

                    {/* ── Code ── */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-app-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                            <Hash size={10} />
                            Code
                        </label>
                        <input
                            name="code"
                            defaultValue={category?.code || ''}
                            placeholder="e.g. 1001 or CAT-BEV"
                            className="w-full px-3 py-2.5 rounded-xl text-[13px] font-mono font-bold outline-none transition-all"
                            style={{
                                background: 'var(--app-background)',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-foreground)',
                            }}
                        />
                        <p className="text-[10px] font-medium text-app-muted-foreground">
                            Unique identifier used for barcode generation and hierarchy mapping.
                        </p>
                    </div>

                    {/* ── Actions ── */}
                    <div className="flex gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                            style={{
                                background: 'transparent',
                                border: '1px solid var(--app-border)',
                                color: 'var(--app-muted-foreground)',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={pending}
                            className="flex-[2] py-2.5 rounded-xl text-[12px] font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                            style={{
                                background: 'var(--app-primary)',
                                boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                            }}
                        >
                            {pending ? (
                                <Loader2 className="animate-spin" size={15} />
                            ) : (
                                <Save size={15} />
                            )}
                            {isEditing ? 'Update Category' : 'Save Category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}