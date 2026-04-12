'use client';

import { AdminEntity, AdminHierarchyBrandData } from "@/types/erp"
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Globe, Award, Edit2, ChevronDown, ChevronRight, Layers, Package, Filter, X, LayoutGrid, LayoutList } from "lucide-react";
import { BrandFormModal } from './BrandFormModal';
import { getBrandHierarchy } from '@/app/actions/brands';

type BrandManagerProps = {
    brands: Record<string, any>[]; // using any for speed, ideally typed
    countries: Record<string, any>[];
    categories: Record<string, any>[]; // NEW: Categories for linking
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

    const handleEdit = (brand: Record<string, any>) => {
        setEditingBrand(brand as any);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingBrand(null);
        setIsModalOpen(true);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedCategory('all');
        setSelectedCountry('all');
    };

    const hasActiveFilters = searchTerm || selectedCategory !== 'all' || selectedCountry !== 'all';

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Brands</h1>
                    <p className="text-gray-500">Manage manufacturers and product brands.</p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/inventory/maintenance?tab=brand"
                        className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-emerald-600 px-4 py-3 rounded-xl font-semibold shadow-sm transition-all flex items-center gap-2"
                    >
                        <Edit2 size={20} />
                        <span>Reorganize</span>
                    </Link>
                    <button
                        onClick={handleCreate}
                        className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        <Plus size={20} />
                        <span>Add New Brand</span>
                    </button>
                </div>
            </div>

            <div className="card-premium p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div className="flex flex-1 items-center gap-3 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search brands..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 w-full transition-all"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                    className="appearance-none pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[150px]"
                                >
                                    <option value="all">All Categories</option>
                                    {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            </div>

                            <div className="relative">
                                <select
                                    value={selectedCountry}
                                    onChange={(e) => setSelectedCountry(e.target.value)}
                                    className="appearance-none pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[150px]"
                                >
                                    <option value="all">All Origins</option>
                                    {countries.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                        >
                            <LayoutList size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>

                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                    {filteredBrands.length === 0 ? (
                        <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-300">
                            <p>No brands found matching your filters.</p>
                            <button onClick={clearFilters} className="mt-2 text-emerald-600 font-semibold text-sm hover:underline">Clear Filters</button>
                        </div>
                    ) : (
                        filteredBrands.map((brand) => (
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
                <BrandFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    brand={editingBrand as any}
                    countries={countries}
                    categories={categories}
                />
            )}
        </div>
    );
}

function BrandCard({ brand, onEdit }: Record<string, any>) {
    return (
        <div className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all bg-white relative overflow-hidden h-full flex flex-col justify-between cursor-pointer hover:border-emerald-200">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Award size={64} />
            </div>
            <button
                onClick={(e) => { e.stopPropagation(); onEdit(brand); }}
                className="absolute top-2 right-2 p-2 bg-gray-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-emerald-50 text-gray-400 hover:text-emerald-600 z-10"
            >
                <Edit2 size={14} />
            </button>

            <div>
                <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center text-xl font-bold text-gray-700 uppercase border border-gray-100">
                        {brand.logo ? (
                            <img src={brand.logo} alt={brand.name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                            brand.name.substring(0, 2)
                        )}
                    </div>
                    <div className="flex items-center gap-1 text-xs font-semibold bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">
                        <Award size={12} />
                        {brand.product_count || 0} products
                    </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-1 hover:text-emerald-600 transition-colors">
                    <Link href={`/inventory/brands/${brand.id}`} className="block">
                        {brand.name}
                        {brand.short_name && <span className="ml-2 text-sm text-gray-400 font-normal">({brand.short_name})</span>}
                    </Link>
                </h3>

                {/* Countries */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {(brand.countries && brand.countries.length > 0) ? (
                        brand.countries.map((c: Record<string, any>) => (
                            <div key={c.id} className="flex items-center gap-1 text-xs bg-gray-50 border border-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                                <Globe size={10} className="text-gray-400" />
                                <span>{c.code}</span>
                            </div>
                        ))
                    ) : (
                        <span className="text-xs text-gray-400 italic">No Origin</span>
                    )}
                </div>
            </div>

            {/* Categories Footer */}
            <div className="mt-4 pt-3 border-t border-gray-50">
                <div className="flex flex-wrap gap-1">
                    {(brand.categories && brand.categories.length > 0) ? (
                        brand.categories.slice(0, 3).map((cat: Record<string, any>) => (
                            <span key={cat.id} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-medium border border-purple-100">
                                {cat.name}
                            </span>
                        ))
                    ) : (
                        <span className="text-[10px] text-gray-400 italic">Universal</span>
                    )}
                    {brand.categories && brand.categories.length > 3 && <span className="text-[10px] text-gray-400">+{brand.categories.length - 3}</span>}
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
        <div className={`bg-white border transition-all rounded-xl ${isExpanded ? 'border-emerald-200 ring-4 ring-emerald-50/50 shadow-md' : 'border-gray-200 hover:border-emerald-200 hover:shadow-sm'}`}>
            <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
                <div className="flex items-center gap-4 flex-1">
                    <button className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>

                    <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-sm font-bold text-gray-600 uppercase border border-gray-100">
                        {brand.logo ? <img src={brand.logo} className="w-full h-full object-cover rounded-lg" /> : brand.name.substring(0, 2)}
                    </div>

                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-gray-900 text-lg">{brand.name}</h3>
                            <span className="text-xs font-mono text-gray-400">({brand.product_count || 0})</span>
                        </div>
                        <div className="flex gap-2">
                            {brand.countries?.map((c: Record<string, any>) => <span key={c.id} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{c.code}</span>)}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(brand); }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={16} />
                    </button>
                </div>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-100 bg-slate-50/50 p-4 md:p-6 animate-in slide-in-from-top-2 fade-in duration-200">
                    {isLoading ? (
                        <div className="flex justify-center py-4 text-emerald-600"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div></div>
                    ) : (data ? (
                        <div className="space-y-4">
                            {/* Groups */}
                            {data.groups.map((group: Record<string, any>) => (
                                <div key={group.id} className="relative">
                                    <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden group-card hover:border-emerald-200 transition-colors">
                                        {/* Group Header */}
                                        <div className="px-5 py-3 bg-gradient-to-r from-gray-50 via-white to-white border-b border-gray-100 flex justify-between items-center group cursor-default">
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm">
                                                    <Layers size={16} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-gray-800">{group.name}</span>
                                                        {group.products.length > 0 && <span className="text-[10px] font-bold text-gray-400 border border-gray-200 px-1.5 rounded-full bg-white">{group.products.length} VARS</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="text-right">
                                                    <span className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Stock</span>
                                                    <span className="font-mono font-bold text-emerald-700">{group.totalStock}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Variants List */}
                                        <div className="bg-white">
                                            {group.products.map((p: Record<string, any>, idx: number) => {
                                                const isLast = idx === group.products.length - 1;
                                                return (
                                                    <div key={p.id} className="relative pl-6 hover:bg-slate-50 transition-colors group/item">
                                                        <div className={`absolute left-0 top-0 bottom-0 w-px bg-gray-100 ${isLast ? 'h-1/2' : ''}`}></div>

                                                        <div className="py-3 pr-4 pl-4 flex justify-between items-center border-b border-gray-50 last:border-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className="absolute left-0 top-1/2 w-4 h-px bg-gray-200"></div>

                                                                <div className="flex items-center gap-1.5 min-w-[100px]">
                                                                    <Globe size={14} className="text-gray-400 group-hover/item:text-blue-500 transition-colors" />
                                                                    <span className="text-sm font-semibold text-gray-700">{p.countryName}</span>
                                                                </div>

                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-gray-900">{p.name} {p.size && `- ${p.size}${p.unitName}`}</span>
                                                                    {p.sku && <span className="text-[10px] text-gray-400 font-mono">SKU: {p.sku}</span>}
                                                                </div>
                                                            </div>

                                                            <div className={`px-2.5 py-1 rounded-full text-xs font-bold border ${p.stock > 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : p.stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                                {p.stock} <span className="font-normal opacity-70">qty</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Loose Items */}
                            {data.looseProducts.length > 0 && (
                                <div className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden mt-4">
                                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                        <Package size={14} className="text-gray-400" />
                                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ungrouped Items</span>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {data.looseProducts.map((p: Record<string, any>) => (
                                            <div key={p.id} className="px-4 py-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <Globe size={14} className="text-gray-300" />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-gray-700">{p.name}</span>
                                                        {p.sku && <span className="text-[10px] text-gray-400 font-mono">{p.sku} ΓÇó {p.countryName}</span>}
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-bold text-sm ${p.stock > 0 ? 'text-gray-700' : 'text-red-400'}`}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {data.groups.length === 0 && data.looseProducts.length === 0 && (
                                <div className="text-center py-8">
                                    <Package size={32} className="mx-auto text-gray-200 mb-2" />
                                    <p className="text-sm text-gray-400">No products found for this brand.</p>
                                </div>
                            )}
                        </div>
                    ) : <div className="text-center py-4 text-red-500 text-sm">Unavailable data</div>)}
                </div>
            )}
        </div>
    );
}