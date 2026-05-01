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
            <div className="flex items-center gap-4 border-b border-app-border pb-6">
                <Link href="/inventory/countries" className="p-2 hover:bg-app-surface-2 rounded-full transition-colors text-app-muted-foreground hover:text-app-foreground">
                    <ChevronLeft size={24} />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-app-foreground flex items-center gap-3">
                        <span className="w-10 h-10 rounded-lg bg-app-info-bg border border-indigo-100 flex items-center justify-center text-lg font-bold text-app-info">{country.code}</span>
                        {country.name}
                    </h1>
                    <p className="text-app-muted-foreground mt-1">Inventory breakdown by Brand.</p>
                </div>
            </div>

            {/* Brands List */}
            <div className="space-y-6">
                {brands.length === 0 ? (
                    <div className="p-12 text-center text-app-muted-foreground bg-app-surface rounded-xl border border-dashed border-app-border">
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
                            <div key={brand.id} className="bg-app-surface border border-app-border rounded-xl overflow-hidden shadow-sm hover:border-app-success transition-colors">
                                {/* Brand Header */}
                                <div className="px-5 py-3 bg-gradient-to-r from-gray-50 via-white to-white border-b border-app-border flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shadow-sm">
                                            <Factory size={16} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-app-foreground text-lg">{brand.name}</span>
                                                <span className="text-xs font-bold text-app-muted-foreground border border-app-border px-2 py-0.5 rounded-full bg-app-surface">{products.length} Products</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="block text-[10px] text-app-muted-foreground uppercase font-bold tracking-wider">Total Stock</span>
                                        <span className="font-mono font-bold text-app-success text-lg">{totalStock}</span>
                                    </div>
                                </div>

                                {/* Products List */}
                                <div className="bg-app-surface">
                                    {products.map((p: Record<string, any>, idx: number) => {
                                        const isLast = idx === products.length - 1;
                                        const stock = p.stock;

                                        return (
                                            <div key={p.id} className="relative pl-6 hover:bg-app-surface transition-colors group/item">
                                                {/* Tree Connector Line */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-px bg-app-surface-2 ${isLast ? 'h-1/2' : ''}`}></div>

                                                <div className="py-3 pr-4 pl-4 flex justify-between items-center border-b border-gray-50 last:border-0">
                                                    <div className="flex items-center gap-3">
                                                        {/* Horizontal Connector */}
                                                        <div className="absolute left-0 top-1/2 w-4 h-px bg-app-surface-2"></div>

                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-semibold text-app-foreground">{p.name}</span>
                                                                <span className="text-sm text-app-muted-foreground">{Number(p.size)} {p.unitShortName}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 text-[10px] text-app-muted-foreground font-mono">
                                                                {p.sku && <span>SKU: {p.sku}</span>}
                                                                {p.categoryName && <span>ΓÇó {p.categoryName}</span>}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className={`px-3 py-1 rounded-full text-xs font-bold border ${stock > 10 ? 'bg-app-success-bg text-app-success border-emerald-100' : stock > 0 ? 'bg-app-warning-bg text-app-warning border-amber-100' : 'bg-app-error-bg text-app-error border-red-100'}`}>
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