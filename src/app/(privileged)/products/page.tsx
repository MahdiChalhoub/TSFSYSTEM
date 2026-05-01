// @ts-nocheck
import Link from 'next/link';
import { erpFetch } from "@/lib/erp-api";
import { Plus, Search, Layers, Globe, ChevronLeft, ChevronRight, Edit2, Copy, Barcode } from 'lucide-react';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

async function getProducts(page: number) {
    try {
        // Backend pagination expected: ?page=X (DRF default)
        // We assume backend page_size is consistent or we pass it if supported.
        // Standard DRF PageNumberPagination returns { count, next, previous, results }
        const data = await erpFetch(`products/?page=${page}&page_size=${PAGE_SIZE}`);
        const results = data.results || [];
        const total = data.count || 0;

        return {
            data: results,
            total,
            totalPages: Math.ceil(total / PAGE_SIZE)
        };
    } catch (e) {
        console.error("Failed to fetch products:", e);
        return { data: [], total: 0, totalPages: 0 };
    }
}

async function getGroups(page: number) {
    try {
        const data = await erpFetch(`product-groups/?page=${page}&page_size=${PAGE_SIZE}`);
        const results = data.results || [];
        const total = data.count || 0;

        return {
            data: results,
            total,
            totalPages: Math.ceil(total / PAGE_SIZE)
        };
    } catch (e) {
        console.error("Failed to fetch product groups:", e);
        return { data: [], total: 0, totalPages: 0 };
    }
}

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ view?: string, page?: string }> }) {
    const params = await searchParams;
    const isGrouped = params.view === 'grouped';
    const page = Number(params.page) || 1;

    const { data, total, totalPages } = isGrouped ? await getGroups(page) : await getProducts(page);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold text-app-foreground tracking-tight mb-2">Product Registry</h1>
                    <p className="text-app-muted-foreground text-base">Manage your product catalog.</p>
                </div>
                <div className="flex gap-4">
                    <Link
                        href="/products/new"
                        className="bg-app-surface border text-app-foreground px-6 py-3.5 rounded-2xl font-semibold shadow-sm hover:bg-app-surface transition-all flex items-center gap-2"
                    >
                        <Plus size={18} />
                        <span>Single Product</span>
                    </Link>
                    <Link
                        href="/products/create-group"
                        className="bg-app-gradient-primary text-white px-6 py-3.5 rounded-2xl font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Layers size={18} />
                        <span>Create Group</span>
                    </Link>
                </div>
            </div>

            {/* View Toggle & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex p-1 bg-app-surface-2 rounded-xl">
                    <Link
                        href="/products?view=flat"
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${!isGrouped ? 'bg-app-surface shadow text-app-foreground' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                    >
                        Detailed (SKUs)
                    </Link>
                    <Link
                        href="/products?view=grouped"
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isGrouped ? 'bg-app-surface shadow text-app-foreground' : 'text-app-muted-foreground hover:text-app-foreground'}`}
                    >
                        Grouped (Master)
                    </Link>
                </div>

                <div className="flex gap-4 w-full max-w-xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-app-muted-foreground pointer-events-none" size={20} />
                        <input
                            type="text"
                            placeholder="Search..."
                            className="w-full pl-12 pr-4 py-3 bg-app-surface rounded-xl border border-app-border focus:border-app-primary outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="card-premium p-0 overflow-hidden shadow-xl border border-white/50">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-app-surface/50 border-b border-app-border text-xs uppercase tracking-wider text-app-muted-foreground font-semibold text-left">
                                <th className="py-5 px-8">Product / Master</th>
                                <th className="py-5 px-8">Origin / Variants</th>
                                <th className="py-5 px-8">Code / SKU</th>
                                <th className="py-5 px-8">Stock Level</th>
                                <th className="py-5 px-8 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                            {data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-app-muted-foreground">No products found.</td>
                                </tr>
                            ) : (
                                data.map((item: Record<string, any>) => isGrouped ? <GroupRow key={item.id} group={item} /> : <ProductRow key={item.id} product={item} />)
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="bg-app-surface border-t border-app-border px-8 py-6 flex items-center justify-between text-sm text-app-muted-foreground">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-app-foreground text-base">{total}</span>
                        <span className="text-app-muted-foreground text-base">items total</span>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-3">
                            <Link
                                href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page > 1 ? page - 1 : 1}`}
                                className={`px-4 py-2 flex items-center gap-2 border border-app-border rounded-xl font-semibold hover:bg-app-surface transition-all ${page <= 1 ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <ChevronLeft size={16} /> Previous
                            </Link>
                            <span className="font-mono bg-app-surface-2 px-3 py-2 rounded-lg">Page {page} of {totalPages}</span>
                            <Link
                                href={`/products?view=${isGrouped ? 'grouped' : 'flat'}&page=${page < totalPages ? page + 1 : totalPages}`}
                                className={`px-4 py-2 flex items-center gap-2 border border-app-border rounded-xl font-semibold hover:bg-app-surface transition-all ${page >= totalPages ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                Next <ChevronRight size={16} />
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function ProductRow({ product }: { product: Record<string, any> }) {
    const totalStock = product.inventory?.reduce((acc: number, inv: Record<string, any>) => acc + Number(inv.quantity), 0) || 0;

    return (
        <tr className="hover:bg-app-surface/60 transition-colors">
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <span className="font-bold text-app-foreground">{product.name}</span>
                    <span className="text-xs text-app-muted-foreground">{product.brand?.name} ΓÇó {product.category?.name}</span>
                    {product.productGroupId && <span className="text-[10px] bg-app-info-bg text-app-info px-1.5 rounded w-fit">Part of Group</span>}
                </div>
            </td>
            <td className="py-6 px-8">
                {product.country ? (
                    <div className="flex items-center gap-1.5">
                        <Globe size={14} className="text-app-muted-foreground" />
                        <span className="text-sm font-medium">{product.country.name}</span>
                        <span className="text-xs bg-app-surface-2 px-1 rounded text-app-muted-foreground">{product.country.code}</span>
                    </div>
                ) : <span className="text-app-muted-foreground">ΓÇö</span>}

                {Number(product.size) > 0 && (
                    <div className="text-xs text-app-muted-foreground mt-1">{Number(product.size)} {product.sizeUnit?.shortName}</div>
                )}
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <span className="font-mono text-xs bg-app-surface-2 px-2 py-1 rounded w-fit">{product.sku}</span>
                    {product.barcode && <span className="text-xs text-app-muted-foreground flex items-center gap-1"><Barcode size={10} /> {product.barcode}</span>}
                </div>
            </td>
            <td className="py-6 px-8">
                <span className={`font-bold ${totalStock > 0 ? 'text-app-success' : 'text-app-error'}`}>
                    {totalStock} {product.unit?.shortName}
                </span>
            </td>
            <td className="py-6 px-8 text-right">
                <div className="flex items-center justify-end gap-2">
                    <Link
                        href={`/products/new?cloneId=${product.id}`}
                        className="p-2 text-app-muted-foreground hover:text-app-success hover:bg-app-success-bg rounded-lg transition-all"
                        title="Clone Product"
                    >
                        <Copy size={18} />
                    </Link>
                    <Link
                        href={`/products/${product.id}/edit`}
                        className="p-2 text-app-muted-foreground hover:text-app-info hover:bg-app-info-bg rounded-lg transition-all"
                        title="Edit Product"
                    >
                        <Edit2 size={18} />
                    </Link>
                </div>
            </td>
        </tr>
    );
}

function GroupRow({ group }: { group: Record<string, any> }) {
    // Aggregate Stock
    const totalVarStock = group.products?.reduce((acc: number, p: Record<string, any>) => {
        const pStock = p.inventory?.reduce((invAcc: number, inv: Record<string, any>) => invAcc + Number(inv.quantity), 0) || 0;
        return acc + pStock;
    }, 0) || 0;

    const variantCount = group.products?.length || 0;
    // Extract Unique Countries
    const uniqueCountries = Array.from(new Set(group.products?.map((p: Record<string, any>) => p.country?.code).filter(Boolean)));

    return (
        <tr className="hover:bg-app-surface/60 transition-colors bg-app-surface/30">
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <Layers size={16} className="text-app-success" />
                        <span className="font-bold text-app-foreground text-lg">{group.name}</span>
                    </div>
                    <span className="text-xs text-app-muted-foreground pl-6">{group.brand?.name} ΓÇó {group.category?.name}</span>
                </div>
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-app-foreground">{variantCount} Variants</span>
                    <div className="flex gap-1 flex-wrap">
                        {uniqueCountries.map((c: Record<string, any>) => (
                            <span key={c} className="text-[10px] bg-app-surface border border-app-border px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                                <Globe size={8} className="text-app-muted-foreground" /> {c}
                            </span>
                        ))}
                    </div>
                </div>
            </td>
            <td className="py-6 px-8">
                <span className="text-xs text-app-muted-foreground italic">Var. SKUs</span>
            </td>
            <td className="py-6 px-8">
                <div className="flex flex-col">
                    <span className="font-bold text-app-success text-lg">{totalVarStock}</span>
                    <span className="text-xs text-app-success">Total Units</span>
                </div>
            </td>
            <td className="py-6 px-8 text-right">
                <Link href={`/products/groups/${group.id}/edit`} className="text-sm font-semibold text-app-success hover:text-app-success flex items-center justify-end gap-1">
                    <Edit2 size={16} /> Edit
                </Link>
            </td>
        </tr>
    );
}