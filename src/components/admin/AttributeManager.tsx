'use client';

import { AdminEntity, AdminHierarchyGroup } from "@/types/erp"
import { useState } from 'react';
import { Plus, Search, Filter, X, Edit2, ChevronDown, ChevronRight, LayoutGrid, LayoutList, Factory, Sparkles, Globe } from "lucide-react";
import { getAttributeHierarchy } from '@/app/actions/attributes';
import { AttributeFormModal } from './AttributeFormModal';

type AttributeManagerProps = {
    attributes: Record<string, any>[];
    categories: Record<string, any>[];
};

export function AttributeManager({ attributes, categories }: AttributeManagerProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAttribute, setEditingAttribute] = useState<AdminEntity | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const filteredAttributes = attributes.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' ||
            (a.categories && a.categories.some((c: Record<string, any>) => c.id === Number(selectedCategory)));
        return matchesSearch && matchesCategory;
    });

    const handleEdit = (attr: Record<string, any>) => {
        setEditingAttribute(attr);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingAttribute(null);
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
                    <h1 className="text-4xl font-bold text-gray-900 tracking-tight mb-2">Attributes</h1>
                    <p className="text-gray-500">Manage scents, flavors, and other variant attributes.</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-emerald-900/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
                >
                    <Plus size={20} />
                    <span>Add Attribute</span>
                </button>
            </div>

            <div className="card-premium p-6">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 pb-4 border-b border-gray-100">
                    <div className="flex flex-1 items-center gap-3 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search attributes..."
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
                                {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    {filteredAttributes.map((attr: Record<string, any>) => (
                        viewMode === 'list' ? (
                            <AttributeRow key={attr.id} attribute={attr} onEdit={handleEdit} />
                        ) : (
                            <AttributeCard key={attr.id} attribute={attr} onEdit={handleEdit} />
                        )
                    ))}
                </div>
            </div>

            <AttributeFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} attribute={editingAttribute} categories={categories} />
        </div>
    );
}

function AttributeCard({ attribute, onEdit }: Record<string, any>) {
    return (
        <div className="group border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition-all bg-white relative overflow-hidden flex flex-col cursor-pointer hover:border-emerald-200" onClick={() => onEdit(attribute)}>
            <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-xl font-bold text-orange-600 border border-orange-100">
                    <Sparkles size={24} />
                </div>
                <div className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    {attribute.product_count || 0} products
                </div>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{attribute.name}</h3>
            {attribute.short_name && <p className="text-sm text-gray-500">{attribute.short_name}</p>}

            <div className="mt-4 pt-3 border-t border-gray-50 flex flex-wrap gap-1">
                {attribute.categories && attribute.categories.map((c: Record<string, any>) => (
                    <span key={c.id} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">{c.name}</span>
                ))}
            </div>
        </div>
    );
}

function AttributeRow({ attribute, onEdit }: Record<string, any>) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [data, setData] = useState<AdminHierarchyGroup[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const toggleExpand = async (e: React.MouseEvent) => {
        e.preventDefault();
        const newState = !isExpanded;
        setIsExpanded(newState);
        if (newState && !data) {
            setIsLoading(true);
            const res = await getAttributeHierarchy(attribute.id);
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
                    <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 border border-orange-100"><Sparkles size={20} /></div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">{attribute.name}</h3>
                        <div className="flex gap-2 text-xs text-gray-500">
                            {attribute.short_name && <span className="font-mono bg-gray-100 px-1 rounded">{attribute.short_name}</span>}
                            <span>{attribute.product_count || 0} products</span>
                        </div>
                    </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onEdit(attribute) }} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
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
                                                        <span className="text-gray-700 font-medium">{p.name} {p.size && `- ${p.size}${p.unit_name || ''}`}</span>
                                                        {p.country_name && <div className="flex items-center gap-1 text-[10px] text-gray-400 uppercase tracking-wider"><Globe size={10} /> {p.country_name}</div>}
                                                    </div>
                                                </div>
                                                <span className={`font-mono font-bold ${p.stock > 0 ? 'text-gray-700' : 'text-red-400'}`}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {data.length === 0 && <p className="text-gray-400 italic text-sm p-2">No items found with this attribute.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
