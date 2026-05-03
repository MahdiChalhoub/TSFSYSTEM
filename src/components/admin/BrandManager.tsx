'use client';

import { AdminEntity, AdminHierarchyBrandData } from "@/types/erp"
import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Globe, Award, Edit2, ChevronDown, ChevronRight, Layers, Package, Filter, X, LayoutGrid, LayoutList, Settings2 } from "lucide-react";
import { BrandFormModal } from './BrandFormModal';
import { getBrandHierarchy } from '@/app/actions/brands';

type BrandManagerProps = {
    brands: Record<string, any>[];
    countries: Record<string, any>[];
    categories: Record<string, any>[];
};

export function BrandManager({ brands, countries, categories }: BrandManagerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState<AdminEntity | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [selectedCountry, setSelectedCountry] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const filteredBrands = brands.filter(b => {
        const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.countries && b.countries.some((c: Record<string, any>) => c.name.toLowerCase().includes(searchTerm.toLowerCase())));
        const matchesCategory = selectedCategory === 'all' ||
            (b.categories && (b.categories.length === 0 || b.categories.some((c: Record<string, any>) => c.id === Number(selectedCategory))));
        const matchesCountry = selectedCountry === 'all' ||
            (b.countries && b.countries.some((c: Record<string, any>) => c.id === Number(selectedCountry)));
        return matchesSearch && matchesCategory && matchesCountry;
    });

    const handleEdit = (brand: Record<string, any>) => { setEditingBrand(brand as any); setIsModalOpen(true); };
    const handleCreate = () => { setEditingBrand(null); setIsModalOpen(true); };
    const clearFilters = () => { setSearchTerm(''); setSelectedCategory('all'); setSelectedCountry('all'); };
    const hasActiveFilters = searchTerm || selectedCategory !== 'all' || selectedCountry !== 'all';
    const totalProducts = brands.reduce((sum, b) => sum + (b.product_count || 0), 0);

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
                        <Award size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
                            Inventory / Taxonomy
                        </p>
                        <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--app-text)' }}>
                            Brands
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-text-muted)' }}>
                            Manage manufacturers and product brands.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href="/inventory/maintenance?tab=brand"
                        className="px-4 py-2.5 rounded-xl font-bold text-[12px] flex items-center gap-2 transition-all"
                        style={{
                            background: 'var(--app-surface)',
                            border: '1px solid var(--app-border)',
                            color: 'var(--app-text)',
                        }}
                    >
                        <Settings2 size={16} />
                        Reorganize
                    </Link>
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
                        Add Brand
                    </button>
                </div>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Brands', value: brands.length },
                    { label: 'Countries Covered', value: new Set(brands.flatMap(b => (b.countries || []).map((c: Record<string, any>) => c.id))).size },
                    { label: 'Linked Products', value: totalProducts },
                ].map(kpi => (
                    <div key={kpi.label} className="p-4 rounded-xl" style={{
                        background: 'var(--app-surface)',
                        border: '1px solid var(--app-border)',
                    }}>
                        <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>{kpi.label}</p>
                        <p className="text-2xl font-black mt-1" style={{ color: 'var(--app-text)' }}>{kpi.value}</p>
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={16} style={{ color: 'var(--app-text-muted)' }} />
                            <input
                                type="text"
                                placeholder="Search brands..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9 pr-4 py-2 rounded-xl text-[12px] w-full transition-all outline-none"
                                style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                                    className="appearance-none pl-8 pr-8 py-2 rounded-xl text-[12px] cursor-pointer min-w-[140px] outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2" size={13} style={{ color: 'var(--app-text-muted)' }} />
                            </div>

                            <div className="relative">
                                <select value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
                                    className="appearance-none pl-8 pr-8 py-2 rounded-xl text-[12px] cursor-pointer min-w-[140px] outline-none"
                                    style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)', color: 'var(--app-text)' }}
                                >
                                    <option value="all">All Origins</option>
                                    {countries.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2" size={13} style={{ color: 'var(--app-text-muted)' }} />
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--app-text-muted)' }}>
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center p-1 rounded-xl shrink-0" style={{ background: 'var(--app-bg)', border: '1px solid var(--app-border)' }}>
                        {(['list', 'grid'] as const).map(m => (
                            <button key={m} onClick={() => setViewMode(m)} className="p-2 rounded-lg transition-all" style={{
                                background: viewMode === m ? 'var(--app-surface)' : 'transparent',
                                color: viewMode === m ? 'var(--app-primary)' : 'var(--app-text-muted)',
                                boxShadow: viewMode === m ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                            }} title={m === 'list' ? 'List View' : 'Grid View'}>
                                {m === 'list' ? <LayoutList size={16} /> : <LayoutGrid size={16} />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Items */}
                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
                    {filteredBrands.length === 0 ? (
                        <div className="col-span-full py-12 text-center rounded-xl border border-dashed" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-muted)' }}>
                            <p className="text-[13px]">No brands found matching your filters.</p>
                            <button onClick={clearFilters} className="mt-2 font-bold text-[12px]" style={{ color: 'var(--app-primary)' }}>Clear Filters</button>
                        </div>
                    ) : (
                        filteredBrands.map(brand => (
                            viewMode === 'list' ? (
                                <BrandRow key={brand.id} brand={brand} onEdit={handleEdit} />
                            ) : (
                                <BrandCard key={brand.id} brand={brand} onEdit={handleEdit} />
                            )
                        ))
                    )}
                </div>
            </div>

            {isModalOpen && (
                <BrandFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} brand={editingBrand as any} countries={countries} categories={categories} attributes={[]} />
            )}
        </div>
    );
}

function BrandCard({ brand, onEdit }: Record<string, any>) {
    return (
        <div
            className="group rounded-2xl p-5 transition-all cursor-pointer h-full flex flex-col justify-between border relative overflow-hidden"
            style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--app-primary)'; e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Award size={64} />
            </div>
            <button
                onClick={e => { e.stopPropagation(); onEdit(brand); }}
                className="absolute top-2 right-2 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                style={{ background: 'var(--app-bg)', color: 'var(--app-text-muted)' }}
            >
                <Edit2 size={13} />
            </button>

            <div>
                <div className="flex justify-between items-start mb-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[14px] font-black uppercase" style={{
                        background: 'color-mix(in srgb, var(--app-text-muted) 6%, transparent)',
                        color: 'var(--app-text)',
                        border: '1px solid var(--app-border)',
                    }}>
                        {brand.logo ? (
                            <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            brand.name.substring(0, 2)
                        )}
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg" style={{
                        background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                        color: 'var(--app-info, #3b82f6)',
                    }}>
                        <Award size={10} />
                        {brand.product_count || 0} products
                    </span>
                </div>

                <h3 className="text-[14px] font-bold mb-1" style={{ color: 'var(--app-text)' }}>
                    <Link href={`/inventory/brands/${brand.id}`} className="block transition-colors"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text)'; }}
                    >
                        {brand.name}
                        {brand.short_name && <span className="ml-2 text-[12px] font-normal" style={{ color: 'var(--app-text-muted)' }}>({brand.short_name})</span>}
                    </Link>
                </h3>

                <div className="flex flex-wrap gap-1 mt-2">
                    {(brand.countries && brand.countries.length > 0) ? (
                        brand.countries.map((c: Record<string, any>) => (
                            <div key={c.id} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{
                                background: 'color-mix(in srgb, var(--app-text-muted) 6%, transparent)',
                                color: 'var(--app-text-muted)',
                                border: '1px solid color-mix(in srgb, var(--app-border) 80%, transparent)',
                            }}>
                                <Globe size={9} /> {c.code}
                            </div>
                        ))
                    ) : (
                        <span className="text-[10px] italic" style={{ color: 'var(--app-text-muted)' }}>No Origin</span>
                    )}
                </div>
            </div>

            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--app-border)' }}>
                <div className="flex flex-wrap gap-1">
                    {(brand.categories && brand.categories.length > 0) ? (
                        brand.categories.slice(0, 3).map((cat: Record<string, any>) => (
                            <span key={cat.id} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{
                                background: 'color-mix(in srgb, var(--app-info, #8b5cf6) 7%, transparent)',
                                color: 'var(--app-info, #8b5cf6)',
                                border: '1px solid color-mix(in srgb, var(--app-info, #8b5cf6) 12%, transparent)',
                            }}>
                                {cat.name}
                            </span>
                        ))
                    ) : (
                        <span className="text-[9px] italic" style={{ color: 'var(--app-text-muted)' }}>Universal</span>
                    )}
                    {brand.categories && brand.categories.length > 3 && <span className="text-[9px]" style={{ color: 'var(--app-text-muted)' }}>+{brand.categories.length - 3}</span>}
                </div>
            </div>
        </div>
    );
}

function BrandRow({ brand, onEdit }: Record<string, any>) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [data, setData] = useState<AdminHierarchyBrandData | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = async (e: React.MouseEvent) => {
        e.preventDefault();
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (newState && !data) {
            setIsLoading(true);
            const res = await getBrandHierarchy(brand.id);
            setData(res);
            setIsLoading(false);
        }
    };

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
                        color: isExpanded ? 'var(--app-primary)' : 'var(--app-text-muted)',
                    }}>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-black uppercase" style={{
                        background: 'color-mix(in srgb, var(--app-text-muted) 6%, transparent)',
                        color: 'var(--app-text)',
                        border: '1px solid var(--app-border)',
                    }}>
                        {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover rounded-lg" /> : brand.name.substring(0, 2)}
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-[14px]" style={{ color: 'var(--app-text)' }}>{brand.name}</h3>
                            <span className="text-[10px] font-mono" style={{ color: 'var(--app-text-muted)' }}>({brand.product_count || 0})</span>
                        </div>
                        <div className="flex gap-1 mt-0.5">
                            {brand.countries?.map((c: Record<string, any>) => (
                                <span key={c.id} className="text-[9px] px-1.5 py-0.5 rounded" style={{
                                    background: 'color-mix(in srgb, var(--app-text-muted) 6%, transparent)',
                                    color: 'var(--app-text-muted)',
                                }}>{c.code}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <button
                    onClick={e => { e.stopPropagation(); onEdit(brand); }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--app-text-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--app-primary)'; e.currentTarget.style.background = 'color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--app-text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                >
                    <Edit2 size={14} />
                </button>
            </div>

            {isExpanded && (
                <div className="p-4 md:p-5 animate-in slide-in-from-top-2 fade-in duration-200" style={{
                    borderTop: '1px solid var(--app-border)',
                    background: 'color-mix(in srgb, var(--app-bg) 50%, transparent)',
                }}>
                    {isLoading ? (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--app-primary)' }}></div>
                        </div>
                    ) : (data ? (
                        <div className="space-y-3">
                            {data.groups.map((group: Record<string, any>) => (
                                <div key={group.id} className="rounded-xl overflow-hidden border" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <div className="px-4 py-2.5 flex justify-between items-center" style={{ borderBottom: '1px solid var(--app-border)', background: 'var(--app-bg)' }}>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1 rounded-lg" style={{
                                                background: 'color-mix(in srgb, var(--app-info, #3b82f6) 8%, transparent)',
                                                color: 'var(--app-info, #3b82f6)',
                                            }}>
                                                <Layers size={14} />
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-[12px]" style={{ color: 'var(--app-text)' }}>{group.name}</span>
                                                {group.products.length > 0 && (
                                                    <span className="text-[9px] font-bold px-1.5 rounded-full" style={{
                                                        background: 'var(--app-surface)',
                                                        color: 'var(--app-text-muted)',
                                                        border: '1px solid var(--app-border)',
                                                    }}>{group.products.length} VARS</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-[8px] uppercase font-black tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Total Stock</span>
                                            <span className="font-mono font-bold text-[13px]" style={{ color: 'var(--app-primary)' }}>{group.totalStock}</span>
                                        </div>
                                    </div>

                                    <div>
                                        {group.products.map((p: Record<string, any>, idx: number) => (
                                            <div key={p.id} className="relative pl-6 transition-colors"
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-bg)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div className="absolute left-0 top-0 bottom-0 w-px" style={{
                                                    background: 'var(--app-border)',
                                                    height: idx === group.products.length - 1 ? '50%' : undefined,
                                                }}></div>
                                                <div className="py-2.5 pr-4 pl-4 flex justify-between items-center" style={{
                                                    borderBottom: idx < group.products.length - 1 ? '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' : 'none',
                                                }}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="absolute left-0 top-1/2 w-4 h-px" style={{ background: 'var(--app-border)' }}></div>
                                                        <div className="flex items-center gap-1.5 min-w-[90px]">
                                                            <Globe size={12} style={{ color: 'var(--app-text-muted)' }} />
                                                            <span className="text-[11px] font-semibold" style={{ color: 'var(--app-text)' }}>{p.countryName}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[12px] font-medium" style={{ color: 'var(--app-text)' }}>{p.name} {p.size && `- ${p.size}${p.unitName}`}</span>
                                                            {p.sku && <span className="text-[9px] font-mono" style={{ color: 'var(--app-text-muted)' }}>SKU: {p.sku}</span>}
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{
                                                        background: p.stock > 10
                                                            ? 'color-mix(in srgb, var(--app-primary) 8%, transparent)'
                                                            : p.stock > 0
                                                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 8%, transparent)'
                                                                : 'color-mix(in srgb, var(--app-error, #ef4444) 8%, transparent)',
                                                        color: p.stock > 10
                                                            ? 'var(--app-primary)'
                                                            : p.stock > 0
                                                                ? 'var(--app-warning, #f59e0b)'
                                                                : 'var(--app-error, #ef4444)',
                                                        border: `1px solid ${p.stock > 10
                                                            ? 'color-mix(in srgb, var(--app-primary) 15%, transparent)'
                                                            : p.stock > 0
                                                                ? 'color-mix(in srgb, var(--app-warning, #f59e0b) 15%, transparent)'
                                                                : 'color-mix(in srgb, var(--app-error, #ef4444) 15%, transparent)'}`,
                                                    }}>
                                                        {p.stock} <span className="font-normal opacity-70">qty</span>
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}

                            {data.looseProducts.length > 0 && (
                                <div className="rounded-xl overflow-hidden border mt-3" style={{ background: 'var(--app-surface)', borderColor: 'var(--app-border)' }}>
                                    <div className="px-4 py-2 flex items-center gap-2" style={{ background: 'var(--app-bg)', borderBottom: '1px solid var(--app-border)' }}>
                                        <Package size={13} style={{ color: 'var(--app-text-muted)' }} />
                                        <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Ungrouped Items</span>
                                    </div>
                                    <div>
                                        {data.looseProducts.map((p: Record<string, any>) => (
                                            <div key={p.id} className="px-4 py-2.5 flex justify-between items-center transition-colors" style={{ borderBottom: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--app-bg)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Globe size={12} style={{ color: 'var(--app-text-muted)' }} />
                                                    <div className="flex flex-col">
                                                        <span className="text-[12px] font-medium" style={{ color: 'var(--app-text)' }}>{p.name}</span>
                                                        {p.sku && <span className="text-[9px] font-mono" style={{ color: 'var(--app-text-muted)' }}>{p.sku} · {p.countryName}</span>}
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold text-[12px]" style={{ color: p.stock > 0 ? 'var(--app-text)' : 'var(--app-error, #ef4444)' }}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.groups.length === 0 && data.looseProducts.length === 0 && (
                                <div className="text-center py-8">
                                    <Package size={28} className="mx-auto mb-2" style={{ color: 'var(--app-border)' }} />
                                    <p className="text-[12px]" style={{ color: 'var(--app-text-muted)' }}>No products found for this brand.</p>
                                </div>
                            )}
                        </div>
                    ) : <div className="text-center py-4 text-[12px]" style={{ color: 'var(--app-error, #ef4444)' }}>Unavailable data</div>)}
                </div>
            )}
        </div>
    );
}