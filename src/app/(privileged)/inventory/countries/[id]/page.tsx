import { erpFetch } from "@/lib/erp-api";
import { notFound } from "next/navigation";
import Link from 'next/link';
import { ChevronLeft, Package, Factory, Globe } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function CountryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    let country: Record<string, any>;
    let brands: Record<string, any>[] = [];

    try {
        country = await erpFetch(`countries/${id}/`);
        brands = await erpFetch(`countries/${id}/hierarchy/`);
    } catch (e) {
        console.error(e);
        notFound();
    }

    if (!country) notFound();

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <Link href="/inventory/countries" className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500 hover:text-gray-900">
                    <ChevronLeft size={24} />
                </Link>
                <div>
                    <h1 className="page-header-title  tracking-tighter flex items-center gap-4">
                        <span className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-lg font-black text-white shadow-lg shadow-indigo-200">{country.code}</span>
                        {country.name}
                    </h1>
                    <p className="text-gray-500 mt-2">Inventory breakdown by Brand.</p>
                </div>
            </div>

            {/* Brands List */}
            <div className="space-y-6">
                {brands.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <Globe size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No brands associated with this country.</p>
                    </div>
                ) : (
                    brands.map((brand: Record<string, any>) => {
                        const products = brand.products;
                        const hasProducts = products.length > 0;
                        const totalStock = brand.totalStock;

                        if (!hasProducts) return null;

                        return (
                            <div key={brand.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:border-emerald-200 transition-colors">
                                {/* Brand Header */}
                                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 via-white to-white border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shadow-sm">
                                            <Factory size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-gray-900 text-lg">{brand.name}</span>
                                                <span className="text-xs font-bold text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full bg-white">{products.length} Products</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-gray-400 uppercase font-bold tracking-wider">Total Stock</span>
                                        <span className="font-mono font-bold text-emerald-700 text-lg">{totalStock}</span>
                                    </div>
                                </div>

                                {/* Products List */}
                                <div className="bg-white">
                                    {products.map((p: Record<string, any>, idx: number) => {
                                        const isLast = idx === products.length - 1;
                                        const stock = p.stock;

                                        return (
                                            <div key={p.id} className="relative pl-6 hover:bg-slate-50 transition-colors group/item">
                                                {/* Tree Connector Line */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-px bg-gray-100 ${isLast ? 'h-1/2' : ''}`}></div>

                                                <div className="py-3 pr-4 pl-4 flex justify-between items-center border-b border-gray-50 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        {/* Horizontal Connector */}
                                                        <div className="absolute left-0 top-1/2 w-4 h-px bg-gray-200"></div>

                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-gray-900">{p.name}</span>
                                                                <span className="text-sm text-gray-500">{Number(p.size)} {p.unitShortName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                                                                {p.sku && <span>SKU: {p.sku}</span>}
                                                                {p.categoryName && <span>ΓÇó {p.categoryName}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${stock > 10 ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : stock > 0 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                                                        {stock} <span className="font-normal opacity-70">qty</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}