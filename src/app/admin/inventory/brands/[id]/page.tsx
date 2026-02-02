import { erpFetch } from "@/lib/erp-api";
import { notFound } from "next/navigation";
import Link from 'next/link';
import { ChevronLeft, Globe, Layers, Edit2 } from "lucide-react";

export const dynamic = 'force-dynamic';

interface BrandDetail {
    id: number;
    name: string;
    shortName?: string;
    countries: Array<{ id: number; name: string; code: string }>;
    productGroups: Array<{
        id: number;
        name: string;
        products: Product[];
    }>;
    products: Product[]; // Standalone
}

interface Product {
    id: number;
    name: string;
    sku: string;
    country?: { name: string; code: string };
    unit?: { code: string; short_name?: string }; // backend uses snake_case usually, we handle both
    inventory: Array<{ quantity: string }>;
    size?: number; // legacy, might be missing
}

async function getBrandDetails(id: string): Promise<BrandDetail | null> {
    try {
        return await erpFetch(`brands/${id}/`);
    } catch (e) {
        return null;
    }
}

export default async function BrandDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const brand = await getBrandDetails(id);

    if (!brand) notFound();

    return (
        <div className="space-y-8 animate-in fade-in">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/admin/inventory/brands" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ChevronLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{brand.name}</h1>
                    {brand.shortName && <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">{brand.shortName}</span>}
                </div>
            </div>

            {/* Operating Countries Pills */}
            <div className="flex flex-wrap gap-2">
                <span className="text-sm font-medium text-gray-500 py-1">Operating In:</span>
                {brand.countries.length > 0 ? brand.countries.map(c => (
                    <span key={c.id} className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full flex items-center gap-1">
                        <Globe size={12} /> {c.name}
                    </span>
                )) : <span className="text-sm text-gray-400 italic py-1">Global / Unspecified</span>}
            </div>

            <div className="border-t border-gray-100 my-4"></div>

            {/* Content: Groups */}
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
                <Layers className="text-emerald-600" /> Parfums / Families
            </h2>

            <div className="grid gap-6">
                {(brand.productGroups?.length || 0) === 0 && (brand.products?.length || 0) === 0 && (
                    <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl">No products found for this brand.</div>
                )}

                {/* Groups */}
                <div className="space-y-4">
                    {brand.productGroups?.map(group => {
                        const totalGroupStock = group.products.reduce((acc, p) => acc + p.inventory.reduce((a, b) => a + Number(b.quantity), 0), 0);

                        return (
                            <div key={group.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                {/* Group Header */}
                                <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-white border rounded">
                                            <Layers className="text-emerald-600" size={18} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 leading-none">{group.name}</h3>
                                            <p className="text-xs text-gray-500 mt-1">{group.products.length} Variants • Total Stock: {totalGroupStock}</p>
                                        </div>
                                    </div>
                                    <Link href={`/admin/products/groups/${group.id}/edit`} className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-white rounded-lg transition-all">
                                        <Edit2 size={16} />
                                    </Link>
                                </div>

                                {/* Variants List */}
                                <div className="divide-y divide-gray-50">
                                    {group.products.length === 0 ? (
                                        <div className="p-4 text-sm text-gray-400 italic pl-12">No variants defined.</div>
                                    ) : (
                                        group.products.map(variant => {
                                            const stock = variant.inventory.reduce((a, b) => a + Number(b.quantity), 0);
                                            // Handling camelCase vs snake_case for unit properties if backend varies
                                            const unitName = variant.unit?.short_name || variant.unit?.code || '';

                                            return (
                                                <div key={variant.id} className="p-3 pl-12 flex justify-between items-center hover:bg-gray-50 transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-6 border-l-2 border-b-2 border-gray-200 h-4 -mt-4 rounded-bl-none text-transparent">.</div>
                                                        <div className="flex items-center gap-2 min-w-[120px]">
                                                            <Globe size={14} className="text-blue-500" />
                                                            <span className="font-medium text-gray-700 text-sm">{variant.country?.name || 'Unknown'}</span>
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-gray-900">{variant.name}</span>
                                                            <span className="text-[10px] text-gray-400 font-mono flex items-center gap-2">
                                                                SKU: {variant.sku}
                                                                <span className="bg-gray-100 px-1 rounded">{unitName}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="pr-4 text-right">
                                                        <span className={`font-bold ${stock > 0 ? 'text-emerald-600' : 'text-red-400'}`}>
                                                            {stock}
                                                        </span>
                                                        <span className="text-xs text-gray-400 ml-1">qty</span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Standalone Products */}
                {(brand.products?.length || 0) > 0 && (
                    <div className="card-premium p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">Individual Items</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="text-gray-500"><th className="pb-2">Name</th><th className="pb-2">Country</th><th className="pb-2">Stock</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {brand.products.map(p => (
                                        <tr key={p.id}>
                                            <td className="py-2">{p.name}</td>
                                            <td className="py-2 flex items-center gap-1"><Globe size={12} />{p.country?.code}</td>
                                            <td className="py-2 font-bold">{p.inventory.reduce((a, b) => a + Number(b.quantity), 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
