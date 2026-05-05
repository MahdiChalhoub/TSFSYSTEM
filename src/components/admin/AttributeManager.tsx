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
        setEditingAttribute(attr as any);
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
                        <Sparkles size={26} style={{ color: 'var(--app-primary)' }} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--app-muted-foreground)' }}>
                            Inventory / Taxonomy
                        </p>
                        <h1 style={{ color: 'var(--app-foreground)' }}>
                            Attributes
                        </h1>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--app-muted-foreground)' }}>
                            Manage scents, flavors, and other variant attributes.
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
                    Add Attribute
                </button>
            </header>

            {/* KPI Strip */}
            <div className="grid grid-cols-3 gap-4">
                {[
                    { label: 'Total Attributes', value: attributes.length },
                    { label: 'With Products', value: attributes.filter(a => (a.product_count || 0) > 0).length },
                    { label: 'Categories Used', value: new Set(attributes.flatMap((a: Record<string, any>) => (a.categories || []).map((c: Record<string, any>) => c.id))).size },
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
                                placeholder="Search attributes..."
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
                                {categories.map((c: Record<string, any>) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
                    {filteredAttributes.map((attr: Record<string, any>) => (
                        viewMode === 'list' ? (
                            <AttributeRow key={attr.id} attribute={attr} onEdit={handleEdit} />
                        ) : (
                            <AttributeCard key={attr.id} attribute={attr} onEdit={handleEdit} />
                        )
                    ))}
                    {filteredAttributes.length === 0 && (
                        <div className="col-span-full py-12 text-center text-[13px]" style={{ color: 'var(--app-muted-foreground)' }}>
                            No attributes found.
                        </div>
                    )}
                </div>
            </div>

            <AttributeFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} attribute={editingAttribute as any} categories={categories} />
        </div>
    );
}

function AttributeCard({ attribute, onEdit }: Record<string, any>) {
    return (
        <div
            className="group rounded-2xl p-5 transition-all cursor-pointer flex flex-col border"
            style={{
                background: 'var(--app-surface)',
                borderColor: 'var(--app-border)',
            }}
            onClick={() => onEdit(attribute)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--app-primary)'; e.currentTarget.style.boxShadow = '0 4px 16px color-mix(in srgb, var(--app-primary) 8%, transparent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--app-border)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
            <div className="flex justify-between items-start mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                    background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                    color: 'var(--app-warning, #f59e0b)',
                }}>
                    <Sparkles size={20} />
                </div>
                <span className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{
                    background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)',
                    color: 'var(--app-muted-foreground)',
                }}>
                    {attribute.product_count || 0} products
                </span>
            </div>
            <h3 className="mb-1" style={{ color: 'var(--app-foreground)' }}>{attribute.name}</h3>
            {attribute.short_name && <p className="text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>{attribute.short_name}</p>}

            <div className="mt-3 pt-3 flex flex-wrap gap-1" style={{ borderTop: '1px solid var(--app-border)' }}>
                {attribute.categories && attribute.categories.map((c: Record<string, any>) => (
                    <span key={c.id} className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{
                        background: 'color-mix(in srgb, var(--app-info, #8b5cf6) 8%, transparent)',
                        color: 'var(--app-info, #8b5cf6)',
                        border: '1px solid color-mix(in srgb, var(--app-info, #8b5cf6) 15%, transparent)',
                    }}>{c.name}</span>
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
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{
                        background: 'color-mix(in srgb, var(--app-warning, #f59e0b) 10%, transparent)',
                        color: 'var(--app-warning, #f59e0b)',
                    }}><Sparkles size={18} /></div>
                    <div>
                        <h3 style={{ color: 'var(--app-foreground)' }}>{attribute.name}</h3>
                        <div className="flex gap-2 text-[11px]" style={{ color: 'var(--app-muted-foreground)' }}>
                            {attribute.short_name && <span className="font-mono px-1 rounded" style={{ background: 'color-mix(in srgb, var(--app-muted-foreground) 8%, transparent)' }}>{attribute.short_name}</span>}
                            <span>{attribute.product_count || 0} products</span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={e => { e.stopPropagation(); onEdit(attribute) }}
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
                                                        <span className="font-medium" style={{ color: 'var(--app-foreground)' }}>{p.name} {p.size && `- ${p.size}${p.unit_name || ''}`}</span>
                                                        {p.country_name && (
                                                            <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider" style={{ color: 'var(--app-muted-foreground)' }}>
                                                                <Globe size={9} /> {p.country_name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="font-mono font-bold" style={{ color: p.stock > 0 ? 'var(--app-foreground)' : 'var(--app-error, #ef4444)' }}>{p.stock}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {data.length === 0 && <p className="italic text-[12px] p-2" style={{ color: 'var(--app-muted-foreground)' }}>No items found with this attribute.</p>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
