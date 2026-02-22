'use client';

import { AdminEntity, AdminCountryHierarchyItem } from "@/types/erp"
import { useState } from 'react';
import { Plus, Search, Filter, X, Edit2, ChevronDown, ChevronRight, LayoutGrid, LayoutList, Factory, Package, Save, Loader2 } from "lucide-react";
import { getCountryHierarchy, createCountry, updateCountry, CountryState } from '@/app/actions/inventory/countries';
import { useActionState, useEffect } from 'react';

type CountryManagerProps = {
    countries: Record<string, any>[];
    // Make categories optional in case parent doesn't provide it yet, but we updated parent.
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
        setEditingCountry(country);
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Countries</h1>
                    <p className="text-gray-500">Manage manufacturing origins.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <Plus size={20} />
                    <span>Add Country</span>
                </button>
            </div>

            <div className="card-premium p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div className="flex flex-1 items-center gap-3 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search countries..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 w-full transition-all"
                            />
                        </div>

                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="appearance-none pl-9 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-emerald-500 cursor-pointer min-w-[150px]"
                            >
                                <option value="all">All Categories</option>
                                {categories?.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        </div>

                        {(searchTerm || selectedCategory !== 'all') && (
                            <button onClick={clearFilters} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <X size={18} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 shrink-0">
                        <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutList size={18} /></button>
                        <button onClick={() => setViewMode('grid')} className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid size={18} /></button>
                    </div>
                </div>

                <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : "space-y-4"}>
                    {filteredCountries.map((country: Record<string, any>) => (
                        viewMode === 'list' ? (
                            <CountryRow key={country.id} country={country} onEdit={handleEdit} />
                        ) : (
                            <CountryCard key={country.id} country={country} onEdit={handleEdit} />
                        )
                    ))}
                </div>
            </div>

            <CountryFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} country={editingCountry} />
        </div>
    );
}

function CountryCard({ country, onEdit }: Record<string, any>) {
    return (
        <div className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all bg-white relative overflow-hidden flex flex-col cursor-pointer hover:border-emerald-200" onClick={() => onEdit(country)}>
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-xl font-bold text-indigo-700 uppercase border border-indigo-100">
                    {country.code}
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    <Package size={12} />
                    {country.product_count || 0} products
                </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{country.name}</h3>
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
        <div className={`bg-white border transition-all rounded-xl ${isExpanded ? 'border-emerald-200 ring-4 ring-emerald-50/50 shadow-md' : 'border-gray-200 hover:border-emerald-200 hover:shadow-sm'}`}>
            <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={toggleExpand}>
                <div className="flex items-center gap-4 flex-1">
                    <button className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-emerald-100 text-emerald-700' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-sm font-bold text-indigo-600 border border-indigo-100">{country.code}</div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">{country.name}</h3>
                        <span className="text-xs font-mono text-gray-400">{country.product_count || 0} products</span>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onEdit(country) }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
            </div>

            {isExpanded && (
                <div className="border-t border-gray-100 bg-slate-50/50 p-4 animate-in slide-in-from-top-2">
                    {isLoading && <div className="text-center py-4 text-emerald-600"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current inline-block"></div></div>}
                    {!isLoading && data && (
                        <div className="space-y-4 pl-0 md:pl-12">
                            {data.map((brand: Record<string, any>) => (
                                <div key={brand.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                    <div className="px-4 py-2 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Factory size={14} className="text-purple-500" />
                                            <span className="font-bold text-sm text-gray-800">{brand.name}</span>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Stock: {brand.totalStock}</span>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {brand.products.map((p: Record<string, any>) => (
                                            <div key={p.id} className="px-4 py-2 flex justify-between items-center text-sm hover:bg-gray-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-700 font-medium">{p.name} {p.size && `- ${p.size}${p.unit ? p.unit.name : ''}`}</span>
                                                        {p.sku && <span className="text-[10px] text-gray-400 font-mono">{p.sku}</span>}
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-bold ${p.stock > 0 ? 'text-gray-700' : 'text-red-400'}`}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {data.length === 0 && <p className="text-gray-400 italic text-sm p-2">No inventory found.</p>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-900">
                        {country ? 'Edit Country' : 'Add New Country'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form action={(formData) => { setPending(true); formAction(formData); setPending(false); }} className="p-6 space-y-4">
                    {state.message && state.message !== 'success' && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {state.message}
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Name</label>
                        <input name="name" defaultValue={country?.name} className="input-field w-full" placeholder="Turkey" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Code</label>
                        <input name="code" defaultValue={country?.code} className="input-field w-full uppercase" placeholder="TR" required maxLength={3} />
                    </div>

                    <div className="pt-2 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl border font-semibold text-gray-600">Cancel</button>
                        <button type="submit" disabled={pending} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-semibold flex items-center justify-center gap-2">
                            {pending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Save
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}