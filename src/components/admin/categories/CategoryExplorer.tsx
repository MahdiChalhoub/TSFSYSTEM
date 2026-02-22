'use client';

import { useState, useEffect } from 'react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tag, Box, Package, Search, ExternalLink, Filter, ArrowRight } from 'lucide-react';
import { erpFetch } from '@/lib/erp-api';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import clsx from 'clsx';

interface ExplorerData {
    brands: Array<{ id: number; name: string; logo: string | null; cat_product_count: number }>;
    parfums: Array<{ id: number; name: string; cat_product_count: number }>;
    products: Array<{
        id: number;
        sku: string;
        name: string;
        brand_name: string | null;
        parfum_name: string | null;
        selling_price_ttc: number;
        image_url: string | null;
        status: string;
    }>;
}

export function CategoryExplorer({
    categoryId,
    categoryName,
    isOpen,
    onClose,
    authToken
}: {
    categoryId: number | null;
    categoryName: string | null;
    isOpen: boolean;
    onClose: () => void;
    authToken?: string;
}) {
    const [data, setData] = useState<ExplorerData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [activeBrandFilter, setActiveBrandFilter] = useState<string | null>(null);
    const [activeParfumFilter, setActiveParfumFilter] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && categoryId) {
            loadData();
        } else {
            setData(null);
            setActiveBrandFilter(null);
            setActiveParfumFilter(null);
        }
    }, [isOpen, categoryId]);

    async function loadData() {
        if (!categoryId) return;
        setIsLoading(true);
        try {
            const result = await erpFetch(`inventory/categories/${categoryId}/explore/`, {
                headers: authToken ? { 'Authorization': `Token ${authToken}` } : {}
            });
            setData(result);
        } catch (e) {
            console.error("Failed to fetch explorer data", e);
        } finally {
            setIsLoading(false);
        }
    }

    const filteredProducts = data?.products.filter(p => {
        if (activeBrandFilter && p.brand_name !== activeBrandFilter) return false;
        if (activeParfumFilter && p.parfum_name !== activeParfumFilter) return false;
        return true;
    }) || [];

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-xl bg-white/95 backdrop-blur-xl border-l border-gray-100 p-0 overflow-hidden flex flex-col">
                <div className="h-full flex flex-col relative">
                    {/* Header with Glassmorphism */}
                    <SheetHeader className="p-8 border-b border-gray-100/50 bg-gradient-to-r from-gray-50/50 to-white/50">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shadow-inner ring-4 ring-orange-50/50">
                                <Search size={20} strokeWidth={2.5} />
                            </div>
                            <div className="uppercase tracking-widest text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                                Category Explorer
                            </div>
                        </div>
                        <SheetTitle className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            {categoryName || 'Loading...'}
                        </SheetTitle>
                        <SheetDescription className="text-gray-500 font-medium">
                            Explore specific Brands, Attributes, and Products linked to this category.
                        </SheetDescription>
                    </SheetHeader>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        {isLoading ? (
                            <div className="space-y-6 animate-pulse">
                                <Skeleton className="h-40 w-full rounded-3xl" />
                                <Skeleton className="h-40 w-full rounded-3xl" />
                                <Skeleton className="h-64 w-full rounded-3xl" />
                            </div>
                        ) : data ? (
                            <Tabs defaultValue="products" className="w-full">
                                <TabsList className="grid w-full grid-cols-3 mb-8 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100/50 shadow-inner">
                                    <TabsTrigger value="products" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-orange-600 font-bold transition-all">
                                        Products ({data.products.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="brands" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-blue-600 font-bold transition-all">
                                        Brands ({data.brands.length})
                                    </TabsTrigger>
                                    <TabsTrigger value="parfums" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-purple-600 font-bold transition-all">
                                        Attributes ({data.parfums.length})
                                    </TabsTrigger>
                                </TabsList>

                                {/* Tabs Content with Glassmorphism Cards */}
                                <TabsContent value="products" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Active Filters Display */}
                                    {(activeBrandFilter || activeParfumFilter) && (
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {activeBrandFilter && (
                                                <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 px-3 py-1 rounded-full flex items-center gap-2 font-bold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setActiveBrandFilter(null)}>
                                                    {activeBrandFilter} ├ù
                                                </Badge>
                                            )}
                                            {activeParfumFilter && (
                                                <Badge variant="secondary" className="bg-purple-50 text-purple-600 border-purple-100 px-3 py-1 rounded-full flex items-center gap-2 font-bold cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors" onClick={() => setActiveParfumFilter(null)}>
                                                    {activeParfumFilter} ├ù
                                                </Badge>
                                            )}
                                        </div>
                                    )}

                                    {filteredProducts.length === 0 ? (
                                        <div className="py-20 text-center opacity-50">
                                            <Package size={48} className="mx-auto mb-4 text-gray-300" />
                                            <p className="font-bold text-gray-400">No products found for this category.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {filteredProducts.map((p, idx) => (
                                                <div key={p.id} className="group flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-2xl hover:shadow-xl hover:border-orange-200 transition-all duration-300 cursor-pointer animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${idx * 20}ms` }}>
                                                    <div className="w-14 h-14 bg-gray-50 rounded-xl flex-shrink-0 flex items-center justify-center border border-gray-100 overflow-hidden relative">
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Package size={24} className="text-gray-300" />
                                                        )}
                                                        <div className="absolute top-1 left-1 w-2 h-2 rounded-full bg-emerald-500" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">{p.sku}</span>
                                                            <div className="h-1 w-1 bg-gray-200 rounded-full" />
                                                            <span className="text-[10px] font-black tracking-widest uppercase text-orange-500">{p.brand_name || 'Generic'}</span>
                                                        </div>
                                                        <h5 className="font-extrabold text-sm text-gray-900 truncate group-hover:text-orange-600 transition-colors">{p.name}</h5>
                                                        <div className="flex items-center gap-3 mt-1">
                                                            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                                                {p.selling_price_ttc.toLocaleString()} TTC
                                                            </span>
                                                            {p.parfum_name && (
                                                                <span className="text-[11px] font-bold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100">
                                                                    {p.parfum_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0 p-2 text-orange-500">
                                                        <ExternalLink size={18} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="brands" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-2 gap-3">
                                        {data.brands.map((b, idx) => (
                                            <div
                                                key={b.id}
                                                onClick={() => { setActiveBrandFilter(b.name); setActiveParfumFilter(null); }}
                                                className={clsx(
                                                    "p-4 rounded-3xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden group hover:-translate-y-1 shadow-sm",
                                                    activeBrandFilter === b.name
                                                        ? "bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100"
                                                        : "bg-white border-gray-100 hover:border-blue-400 hover:shadow-blue-500/10"
                                                )}
                                                style={{ animationDelay: `${idx * 30}ms` }}
                                            >
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110",
                                                    activeBrandFilter === b.name ? "bg-white/20" : "bg-blue-50 text-blue-600"
                                                )}>
                                                    <Tag size={24} />
                                                </div>
                                                <h6 className="font-extrabold text-sm truncate px-2">{b.name}</h6>
                                                <p className={clsx(
                                                    "text-[10px] font-black uppercase tracking-widest mt-1",
                                                    activeBrandFilter === b.name ? "text-white/70" : "text-gray-400"
                                                )}>
                                                    {b.cat_product_count} Products
                                                </p>
                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>

                                <TabsContent value="parfums" className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="grid grid-cols-2 gap-3">
                                        {data.parfums.map((pa, idx) => (
                                            <div
                                                key={pa.id}
                                                onClick={() => { setActiveParfumFilter(pa.name); setActiveBrandFilter(null); }}
                                                className={clsx(
                                                    "p-4 rounded-3xl border transition-all duration-300 cursor-pointer text-center relative overflow-hidden group hover:-translate-y-1 shadow-sm",
                                                    activeParfumFilter === pa.name
                                                        ? "bg-purple-600 text-white border-purple-600 ring-4 ring-purple-100"
                                                        : "bg-white border-gray-100 hover:border-purple-400 hover:shadow-purple-500/10"
                                                )}
                                                style={{ animationDelay: `${idx * 30}ms` }}
                                            >
                                                <div className={clsx(
                                                    "w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center shadow-inner transition-transform group-hover:scale-110",
                                                    activeParfumFilter === pa.name ? "bg-white/20" : "bg-purple-50 text-purple-600"
                                                )}>
                                                    <Box size={24} />
                                                </div>
                                                <h6 className="font-extrabold text-sm truncate px-2">{pa.name}</h6>
                                                <p className={clsx(
                                                    "text-[10px] font-black uppercase tracking-widest mt-1",
                                                    activeParfumFilter === pa.name ? "text-white/70" : "text-gray-400"
                                                )}>
                                                    {pa.cat_product_count} Products
                                                </p>
                                                <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full duration-1000 transition-transform pointer-events-none" />
                                            </div>
                                        ))}
                                    </div>
                                </TabsContent>
                            </Tabs>
                        ) : null}
                    </div>

                    {/* Footer / Stats with Glassmorphism */}
                    {data && (
                        <div className="p-8 border-t border-gray-100/50 bg-gray-50/30 backdrop-blur-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex gap-4">
                                    <div className="text-center">
                                        <div className="text-xl font-black text-gray-900">{data.products.length}</div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total SKU</div>
                                    </div>
                                    <div className="w-px h-8 bg-gray-200 self-center" />
                                    <div className="text-center">
                                        <div className="text-xl font-black text-gray-900">{data.brands.length}</div>
                                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Brands</div>
                                    </div>
                                </div>
                                <button className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl font-extrabold flex items-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all">
                                    Manage Catalog <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
