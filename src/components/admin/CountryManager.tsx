'use client';

import { AdminEntity, AdminCountryHierarchyItem } from "@/types/erp"
import { useState } from 'react';
import { Plus, Search, Filter, X, Edit2, ChevronDown, ChevronRight, LayoutGrid, LayoutList, Factory, Package, Save, Loader2, Globe2 } from "lucide-react";
import { getCountryHierarchy, createCountry, updateCountry, CountryState } from '@/app/actions/countries';
import { useActionState, useEffect } from 'react';

type CountryManagerProps = {
    countries: Record<string, any>[];
    categories?: Record<string, any>[];
};

export function CountryManager({ countries, categories = [] }: CountryManagerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCountry, setEditingCountry] = useState<AdminEntity | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const filteredCountries = countries.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.code.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' ||
            (c.products && c.products.some((p: Record<string, any>) => p.category === Number(selectedCategory)));
        return matchesSearch && matchesCategory;
    });

    const handleEdit = (country: Record<string, any>) => {
        setEditingCountry(country as any);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingCountry(null);
        setIsModalOpen(true);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
    };

    const totalProducts = countries.reduce((sum, c) => sum + (c.product_count || c._count?.products || 0), 0);

    return (
        <div className="space-y-6">
            {/* V2 Icon-Box Header */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 fade-in-up">
                <div className="flex items-center gap-4">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                        style={{
                            background: 'var(--app-primary-bg, color-mix(in srgb, var(--app-primary) 10%, transparent))',
                            border: '1px solid var(--app-primary-border, color-mix(in srgb, var(--app-primary) 20%, transparent))',
                        }}
                    >
                        <Globe2 size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            Inventory / Taxonomy
                        </p>
                        <h1 style={{ color: 'var(--app-foreground)' }}>
                            Countries
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Manage manufacturing origins and product provenance.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleCreate}
                    className="px-5 py-2.5 rounded-xl font-bold text-[12px] flex items-center gap-2 transition-all shadow-lg"
                    style={{
                        background: 'var(--app-primary)',
                        color: 'white',
                        boxShadow: '0 4px 14px color-mix(in srgb, var(--app-primary) 30%, transparent)',
                    }}
                >
                    <Plus size={18} />
                    Add Country
                </button>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Countries', value: countries.length },
                    { label: 'With Products', value: countries.filter(c => (c.product_count || c._count?.products || 0) > 0).length },
                    { label: 'Linked Products', value: totalProducts },
                ].map(kpi => (
                    <div key={kpi.label} className="p-4 rounded-xl" style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>{kpi.label}</p>
                        <p className="text-2xl font-black mt-1" style={{ color: 'var(--app-foreground)' }}>{kpi.value}</p>
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="p-5 rounded-2xl" style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}>
                {/* Toolbar */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-5 pb-4" style={{ borderBottom: '1px solid var(--app-border)' }}>
                    <div className="flex flex-1 items-center gap-3 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--app-muted-foreground)' }} />
                            <input
                                type="text"
                                placeholder="Search countries..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-xl text-[12px] w-full transition-all outline-none"
                                style={{
                                    background: 'var(--app-bg)',
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                            />
                        </div>

                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={e => setSelectedCategory(e.target.value)}
                                className="appearance-none pl-8 pr-8 py-2 rounded-xl text-[12px] cursor-pointer min-w-[150px] outline-none"
                                style={{
                                    background: 'var(--app-bg)',
                                    border: '1px solid var(--app-border)',
                                    color: 'var(--app-foreground)',
                                }}
                            >
                                <option value="all">All Categories</option>
                                {categories?.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2" size={13} style={{ color: 'var(--app-muted-foreground)' }} />
                        </div>

                        {(searchTerm || selectedCategory !== 'all') && (
                            <button onClick={clearFilters} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--app-muted-foreground)' }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center p-1 rounded-xl shrink-0" style={{
                        background: 'var(--app-bg)',
                        border: '1px solid var(--app-border)',
                    }}>
                        {(['list', 'grid'] as const).map(m => (
                            <button key={m} onClick={() => setViewMode(m)} className="p-2 rounded-lg transition-all" style={{
                                background: viewMode === m ? 'var(--app-surface)' : 'transparent',
                                color: viewMode === m ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                                boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                            }}>
                                {m === 'list' ? <LayoutList size={16} /> : <LayoutGrid size={16} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Items */}
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                    {filteredCountries.map((country: Record<string, any>) => (
                        viewMode === 'list' ? (
                            <CountryRow key={country.id} country={country} onEdit={handleEdit} />
                        ) : (
                            <CountryCard key={country.id} country={country} onEdit={handleEdit} />
                        )
                    ))}
                    {filteredCountries.length === 0 && (
                        <div className="col-span-full py-12 text-center text-[13px]" style={{ color: 'var(--app-muted-foreground)' }}>
                            No countries found.
                        </div>
                    )}
                </div>
            </div>

            <CountryFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} country={editingCountry as any} />
        </div>
    );
}

function CountryCard({ country, onEdit }: Record<string, any>) {
    return (
        <div
            className="group rounded-2xl p-5 transition-all cursor-pointer flex flex-col border"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            onClick={() => onEdit(country)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--app-primary)'; e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black uppercase" style={{
                    background: 'color-mix(in srgb, var(--app-info, #6366f1) 10%, transparent)',
                    color: 'var(--app-info, #6366f1)',
                    border: '1px solid color-mix(in srgb, var(--app-info, #6366f1) 15%, transparent)',
                }}>
                    {country.code}
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg" style={{
                    background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}>
                    <Package size={10} />
                    {country.product_count || country._count?.products || 0} products
                </span>
            </div>
            <h3 style={{ color: 'var(--app-foreground)' }}>{country.name}</h3>
        </div>
    );
}

function CountryRow({ country, onEdit }: Record<string, any>) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [data, setData] = useState<AdminCountryHierarchyItem[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = async (e: React.MouseEvent) => {
        e.preventDefault();
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (newState && !data) {
            setIsLoading(true);
            const res = await getCountryHierarchy(country.id);
            setData(res);
            setIsLoading(false);
        }
    }

    return (
        <div className="rounded-xl border transition-all" style={{
            background: 'var(--app-surface)',
            borderColor: isExpanded ? 'var(--app-primary)' : 'var(--app-border)',
            boxShadow: isExpanded ? '0 2px 12px color-mix(in srgb, var(--app-primary) 8%, transparent)' : 'none',
        }}>
            <div className="p-3 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
                <div className="flex items-center gap-3 flex-1">
                    <button className="p-1 rounded-lg transition-colors" style={{
                        background: isExpanded ? 'color-mix(in srgb, var(--app-primary) 10%, transparent)' : 'transparent',
                        color: isExpanded ? 'var(--app-primary)' : 'var(--app-muted-foreground)',
                    }}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black uppercase" style={{
                        background: 'color-mix(in srgb, var(--app-info, #6366f1) 10%, transparent)',
                        color: 'var(--app-info, #6366f1)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #6366f1) 15%, transparent)',
                    }}>{country.code}</div>
                    <div>
                        <h3 style={{ color: 'var(--app-foreground)' }}>{country.name}</h3>
                        <span className="text-[11px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>{country.product_count || country._count?.products || 0} products</span>
                    </div>
                </div>
                <button
                    onClick={e => { e.stopPropagation(); onEdit(country) }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--app-muted-foreground)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-muted-foreground)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <Edit2 size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="p-4 animate-in slide-in-from-top-2" style={{
                    borderTop: '1px solid var(--app-border)',
                    background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)',
                }}>
                    {isLoading && (
                        <div className="text-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 inline-block" style={{ borderColor: 'var(--app-primary)' }}></div>
                        </div>
                    )}
                    {!isLoading && data && (
                        <div className="space-y-3 pl-0 md:pl-10">
                            {data.map((brand: Record<string, any>) => (
                                <div key={brand.id} className="rounded-xl overflow-hidden border" style={{
                                    background: 'var(--app-surface)',
                                    borderColor: 'var(--app-border)',
                                }}>
                                    <div className="px-4 py-2 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                                        <div className="flex items-center gap-2">
                                            <Factory size={13} style={{ color: 'var(--app-info, #8b5cf6)' }} />
                                            <span className="font-bold text-[12px]" style={{ color: 'var(--app-foreground)' }}>{brand.name}</span>
                                        </div>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{
                                            background: 'color-mix(in srgb, var(--app-primary) 8%, transparent)',
                                            color: 'var(--app-primary)',
                                        }}>Stock: {brand.totalStock}</span>
                                    </div>
                                    <div>
                                        {brand.products.map((p: Record<string, any>) => (
                                            <div key={p.id} className="px-4 py-2 flex justify-between items-center text-[12px] transition-colors" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-bg)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--app-border)' }}></div>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium" style={{ color: 'var(--app-foreground)' }}>{p.name} {p.size && `- ${p.size}${p.unit ? p.unit.name : ''}`}</span>
                                                        {p.sku && <span className="text-[9px] font-mono" style={{ color: 'var(--app-muted-foreground)' }}>{p.sku}</span>}
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold" style={{ color: p.stock > 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {data.length === 0 && <p className="italic text-[12px] p-2" style={{ color: 'var(--app-muted-foreground)' }}>No inventory found.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function CountryFormModal({ isOpen, onClose, country }: { isOpen: boolean, onClose: () => void, country?: Record<string, any> }) {
    const initialState: CountryState = { message: '', errors: {} };
    const [state, formAction] = useActionState(country ? updateCountry.bind(null, country.id) : createCountry, initialState);
    const [pending, setPending] = useState(false);

    useEffect(() => {
        if (state.message === 'success') {
            onClose();
        }
    }, [state, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200" style={{
                background: 'var(--app-surface)',
                border: '1px solid var(--app-border)',
            }}>
                <div className="px-6 py-4 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                    <h3 style={{ color: 'var(--app-foreground)' }}>
                        {country ? 'Edit Country' : 'Add New Country'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full transition-colors" style={{ color: 'var(--app-muted-foreground)' }}>
                        <X size={18} />
                    </button>
                </div>

                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }} className="p-6 space-y-4">
                    {state.message && state.message !== 'success' && (
                        <div className="p-3 text-[12px] rounded-lg" style={{
                            background: 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                            color: 'var(--app-error, #ef4444)',
                            border: '1px solid color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)',
                        }}>
                            {state.message}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Name</label>
                        <input name="name" defaultValue={country?.name} className="w-full px-4 py-2.5 rounded-xl text-[13px] outline-none" style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }} placeholder="Turkey" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>Code</label>
                        <input name="code" defaultValue={country?.code} className="w-full px-4 py-2.5 rounded-xl text-[13px] uppercase outline-none" style={{
                            background: 'var(--app-bg)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-foreground)',
                        }} placeholder="TR" required maxLength={3} />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl font-bold text-[12px]" style={{
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-muted-foreground)',
                        }}>Cancel</button>
                        <button type="submit" disabled={pending} className="flex-1 py-2.5 rounded-xl font-bold text-[12px] flex items-center justify-center gap-2" style={{
                            background: 'var(--app-primary)',
                            color: 'white',
                        }}>
                            {pending ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}