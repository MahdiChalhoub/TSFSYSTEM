'use client';

import { useActionState } from 'react';
import { createAttribute, updateAttribute, AttributeState } from '@/app/actions/attributes';
import { X, Save, Loader2, Tag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { peekNextCode } from '@/lib/sequences-client';
import { LockableCodeInput } from '@/components/admin/_shared/LockableCodeInput';
import { CategoryTreeSelector } from './CategoryTreeSelector';
import { getCatalogueLanguages, labelFor, placeholderFor, isRTL, type LocaleCode } from '@/lib/catalogue-languages';

type AttributeFormModalProps = {
    isOpen: boolean;
    onClose: () => void;
    attribute?: Record<string, any>; // If provided, edit mode
    categories: Record<string, any>[]; // Categories for linking
};

type CategoryNode = {
    id: number;
    name: string;
    parentId: number | null;
    children?: CategoryNode[];
    code?: string;
};

// Helper to build tree from flat list
function buildCategoryTree(flatCategories: Record<string, any>[]): CategoryNode[] {
    const categoryMap = new Map<number, CategoryNode>();
    const roots: CategoryNode[] = [];

    // First pass: Create all nodes
    flatCategories.forEach(cat => {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            parentId: cat.parent,
            code: cat.code,
            children: []
        });
    });

    // Second pass: Build tree structure
    flatCategories.forEach(cat => {
        const node = categoryMap.get(cat.id)!;
        if (cat.parent === null || cat.parent === undefined) {
            roots.push(node);
        } else {
            const parent = categoryMap.get(cat.parent);
            if (parent) {
                parent.children!.push(node);
            }
        }
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
    // Pre-filled short code from /settings/sequences (PRODUCT_ATTRIBUTE key). Peek-only.
    const [suggestedCode, setSuggestedCode] = useState<string>('');

    // Tenant-configured catalogue locales (first = default).
    const [locales, setLocales] = useState<LocaleCode[]>([]);
    type LangEntry = { name?: string; short_name?: string };
    const coerce = (v: any): LangEntry =>
        typeof v === 'string' ? { name: v } : (v && typeof v === 'object' ? v : {});
    const [translations, setTranslations] = useState<Record<string, LangEntry>>({});
    const patchT = (code: string, field: 'name' | 'short_name', value: string) =>
        setTranslations(t => ({ ...t, [code]: { ...(t[code] || {}), [field]: value } }));
    const [activeLang, setActiveLang] = useState<string>('__default__');

    useEffect(() => {
        if (isOpen) getCatalogueLanguages().then(setLocales).catch(() => setLocales([]));
    }, [isOpen]);

    // Reset selected categories when attribute changes (for edit mode)
    useEffect(() => {
        if (isOpen) {
            setSelectedCategoryIds(attribute?.categories?.map((c: Record<string, any>) => c.id) || []);
            setPending(false); // Reset pending state when opening
            if (!attribute) peekNextCode('PRODUCT_ATTRIBUTE').then(setSuggestedCode).catch(() => setSuggestedCode(''));
            else setSuggestedCode('');
            const src: Record<string, any> = { ...(attribute?.translations || {}) };
            const out: Record<string, LangEntry> = {};
            Object.keys(src).forEach(k => { out[k] = coerce(src[k]); });
            setTranslations(out);
            setActiveLang('__default__');
        }
    }, [isOpen, attribute]);

    // Close modal on successful save
    useEffect(() => {
        if (state.message === 'success') {
            onClose();
            setPending(false); // Reset pending state after success
        }
    }, [state.message, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-app-border flex justify-between items-center bg-gray-50/50">
                    <h3>
                        {attribute ? 'Edit Attribute' : 'Add New Attribute'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-app-muted-foreground hover:text-app-muted-foreground transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form
                    action={formAction}
                    className="p-6 space-y-4"
                    onSubmit={() => setPending(true)}
                >

                    {state.message && state.message !== 'success' && (
                        <div className="p-3 bg-app-error-soft text-app-error text-sm rounded-lg border border-red-100">
                            {state.message}
                        </div>
                    )}

                    <div>
                        {(() => {
                            const defaultCode = locales[0];
                            const extras = locales.slice(1);
                            if (extras.length === 0) return null;
                            return (
                                <div className="flex items-center gap-1 mb-2 overflow-x-auto">
                                    <button type="button"
                                        onClick={() => setActiveLang('__default__')}
                                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex-shrink-0 border ${activeLang === '__default__' ? 'bg-app-success-soft border-app-success text-app-success' : 'bg-white border-app-border text-app-muted-foreground'}`}>
                                        <Tag size={9} /> DEFAULT{defaultCode ? ` · ${defaultCode.toUpperCase()}` : ''}
                                    </button>
                                    {extras.map(code => {
                                        const active = activeLang === code;
                                        const filled = !!translations[code];
                                        return (
                                            <button key={code} type="button"
                                                onClick={() => setActiveLang(code)}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-all flex-shrink-0 border ${active ? 'bg-app-success-soft border-app-success text-app-success' : 'bg-white border-app-border ' + (filled ? 'text-app-foreground' : 'text-app-muted-foreground')}`}>
                                                {code}
                                                {filled && <span className="w-1 h-1 rounded-full bg-app-success" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })()}

                        <div className="grid grid-cols-2 gap-4">
                            {activeLang === '__default__' ? (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wide">Attribute Name</label>
                                        <input
                                            name="name"
                                            defaultValue={attribute?.name || ''}
                                            placeholder="e.g. Vanilla"
                                            className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-app-success outline-none transition-all"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wide">Short Code</label>
                                        <LockableCodeInput
                                            name="shortName"
                                            defaultValue={attribute?.short_name}
                                            suggestedValue={suggestedCode}
                                            isEdit={!!attribute}
                                            placeholder="e.g. VAN"
                                            className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-app-success outline-none transition-all"
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wide">{labelFor(activeLang)}</label>
                                        <input
                                            value={translations[activeLang]?.name || ''}
                                            onChange={e => patchT(activeLang, 'name', e.target.value)}
                                            placeholder={placeholderFor(activeLang)}
                                            dir={isRTL(activeLang) ? 'rtl' : undefined}
                                            className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-app-success outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wide">Short Code · {activeLang.toUpperCase()}</label>
                                        <input
                                            value={translations[activeLang]?.short_name || ''}
                                            onChange={e => patchT(activeLang, 'short_name', e.target.value)}
                                            placeholder={isRTL(activeLang) ? 'مثال: فان' : 'e.g. VAN'}
                                            dir={isRTL(activeLang) ? 'rtl' : undefined}
                                            className="w-full px-4 py-3 rounded-xl border border-app-border focus:border-app-success outline-none transition-all"
                                        />
                                    </div>
                                    <input type="hidden" name="name" value={attribute?.name || ''} />
                                    <input type="hidden" name="shortName" value={attribute?.short_name || ''} />
                                </>
                            )}
                        </div>
                        <input type="hidden" name="translationsJson" value={JSON.stringify(translations)} />
                    </div>

                    {/* Category Selection Tree */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-app-muted-foreground uppercase tracking-wide flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            Linked Categories
                        </label>

                        <CategoryTreeSelector
                            categories={buildCategoryTree(categories) as any}
                            selectedIds={selectedCategoryIds}
                            onChange={setSelectedCategoryIds}
                            maxHeight="max-h-56"
                        />

                        {/* Hidden inputs for form submission */}
                        {selectedCategoryIds.map(id => (
                            <input key={id} type="hidden" name="categoryIds" value={id} />
                        ))}

                        <p className="text-[10px] text-app-muted-foreground">
                            ≡ƒÆí Leave empty to make this attribute <strong>universal</strong> (available for ALL categories).
                            <br />
                            Select parent category to include all sub-categories automatically.
                        </p>
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold border border-app-border text-app-muted-foreground hover:bg-gray-50 transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={pending} className="flex-1 py-3 rounded-xl font-semibold bg-app-success text-white hover:bg-app-success transition-colors shadow-lg hover:shadow-emerald-600/20 flex items-center justify-center gap-2">
                            {pending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            <span>Save Attribute</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}